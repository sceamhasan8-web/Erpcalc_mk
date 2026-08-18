"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';

const sizes = Array.from({ length: 11 }, (_, index) => 36 + index);

interface SizeWiseOrder {
  id: string;
  buyerName: string;
  articleName: string;
  color: string;
  sizePairs: Record<number, number>;
  totalPairs: number;
  receivedAt: string;
}

const STORAGE_KEY = 'ec-footwear-production-orders';

export default function FootwearProductionReportPage() {
  const { showAlert, toast } = useModal();
  const buyers = erpService.getBuyers();
  const articles = erpService.getArticles();

  const [buyerId, setBuyerId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [sizePairs, setSizePairs] = useState<Record<number, number>>(() => {
    return sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {} as Record<number, number>);
  });
  const [receivedOrders, setReceivedOrders] = useState<SizeWiseOrder[]>([]);
  const [saved, setSaved] = useState(false);

  const selectedBuyer = buyers.find((b) => b.id === buyerId);
  const selectedArticle = articles.find((a) => a.id === articleId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setReceivedOrders(JSON.parse(raw));
      }
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(receivedOrders));
    } catch {
      // ignore storage errors
    }
  }, [receivedOrders]);

  const totalPairs = useMemo(
    () => Object.values(sizePairs).reduce((sum, value) => sum + (value || 0), 0),
    [sizePairs]
  );

  const sizeTotals = useMemo(() => {
    return sizes.reduce((acc, size) => {
      acc[size] = receivedOrders.reduce((sum, order) => sum + (order.sizePairs[size] || 0), 0);
      return acc;
    }, {} as Record<number, number>);
  }, [receivedOrders]);

  const overallPairs = useMemo(() => {
    return receivedOrders.reduce((sum, order) => sum + order.totalPairs, 0);
  }, [receivedOrders]);

  function updateSize(size: number, value: number) {
    setSizePairs((current) => ({ ...current, [size]: Math.max(0, value) }));
  }

  function resetForm() {
    setBuyerId('');
    setArticleId('');
    setColor('');
    setNotes('');
    setSizePairs(sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {} as Record<number, number>));
    setSaved(false);
  }

  function handleReceive() {
    if (!buyerId) {
      showAlert({ title: 'Missing Buyer', message: 'Please select a buyer.', type: 'warning' });
      return;
    }
    if (!articleId) {
      showAlert({ title: 'Missing Article', message: 'Please select an article.', type: 'warning' });
      return;
    }
    if (!color.trim()) {
      showAlert({ title: 'Missing Color', message: 'Please enter a color specification.', type: 'warning' });
      return;
    }
    if (totalPairs <= 0) {
      showAlert({ title: 'Zero Quantity', message: 'Please enter pair counts for at least one size.', type: 'warning' });
      return;
    }

    const newOrder: SizeWiseOrder = {
      id: `fp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      buyerName: selectedBuyer?.name ?? 'Unknown',
      articleName: selectedArticle?.name ?? 'Unknown',
      color: color.trim(),
      sizePairs,
      totalPairs,
      receivedAt: new Date().toISOString(),
    };

    setReceivedOrders((current) => [newOrder, ...current]);
    setSaved(true);
    toast.success(`Received ${totalPairs.toLocaleString()} pairs for ${selectedArticle?.name ?? 'article'}.`);
    setTimeout(() => setSaved(false), 1800);
    resetForm();
  }

  return (
    <main className="min-h-screen p-4 lg:p-8 text-[var(--ec-foreground)]">
      <div className="mx-auto max-w-6xl rounded-2xl border bg-[var(--ec-card)] p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-cyan-500">Footwear Production</p>
            <h1 className="text-2xl font-semibold">Footwear Production Report</h1>
            <p className="text-sm text-[var(--ec-muted)] mt-1">
              Record size-wise footwear production and review orders by shoe size.
            </p>
          </div>
          <Link href="/production" className="inline-flex items-center justify-center rounded-full border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-2 text-sm font-semibold text-[var(--ec-foreground)] shadow-sm hover:bg-[var(--ec-card)]">
            Back to production report
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] mb-6">
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Size-wise order receive</h2>
            <div className="grid gap-4 lg:grid-cols-3 mb-4">
              <div>
                <label className="block text-xs text-[var(--ec-muted)] mb-1">Buyer</label>
                <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-full rounded border px-3 py-2">
                  <option value="">Select buyer...</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>{buyer.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--ec-muted)] mb-1">Article</label>
                <select value={articleId} onChange={(e) => setArticleId(e.target.value)} className="w-full rounded border px-3 py-2">
                  <option value="">Select article...</option>
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>{article.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--ec-muted)] mb-1">Color</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  placeholder="Enter color"
                />
              </div>
            </div>

            <section className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 mb-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">Size quantities</h3>
                  <p className="text-sm text-[var(--ec-muted)]">Enter pairs per size for the received footwear order.</p>
                </div>
                <div className="text-sm font-semibold">Total: {totalPairs}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sizes.map((size) => (
                  <label key={size} className="space-y-2 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 text-sm">
                    <span className="block font-semibold">Size {size}</span>
                    <input
                      type="number"
                      min={0}
                      value={sizePairs[size] ?? 0}
                      onChange={(event) => updateSize(size, Number(event.target.value))}
                      className="w-full rounded border px-3 py-2"
                    />
                    <div className="text-[10px] text-[var(--ec-muted)]">pairs</div>
                  </label>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleReceive}
                className="inline-flex items-center justify-center rounded-full bg-[var(--ec-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--ec-primary-600)]"
              >
                Receive footwear order
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-[var(--ec-border)] bg-[var(--ec-card)] px-5 py-2 text-sm font-semibold"
              >
                Reset form
              </button>
            </div>
            {saved && <p className="mt-4 text-sm text-emerald-500">Footwear order received successfully.</p>}
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Size-wise production summary</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
                <p className="text-sm text-[var(--ec-muted)]">Orders recorded</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ec-foreground)]">{receivedOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
                <p className="text-sm text-[var(--ec-muted)]">Total pairs</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ec-foreground)]">{overallPairs}</p>
              </div>
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
                <p className="text-sm text-[var(--ec-muted)]">Average size pairs</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--ec-foreground)]">
                  {receivedOrders.length > 0 ? Math.round(overallPairs / receivedOrders.length) : 0}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4">
              <h3 className="text-sm font-semibold text-[var(--ec-foreground)] mb-3">Total pairs by size</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {sizes.map((size) => (
                  <div key={size} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 text-sm">
                    <p className="text-[var(--ec-muted)]">Size {size}</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--ec-foreground)]">{sizeTotals[size] || 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Footwear production entries</h2>
              <p className="text-sm text-[var(--ec-muted)]">Review recorded size-wise footwear orders and their full size breakdown.</p>
            </div>
            <button
              type="button"
              onClick={() => setReceivedOrders([])}
              className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/20"
            >
              Clear all entries
            </button>
          </div>

          {receivedOrders.length === 0 ? (
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 text-center text-sm text-[var(--ec-muted)]">
              No footwear production entries recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {receivedOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-[var(--ec-muted)]">{new Date(order.receivedAt).toLocaleString()}</p>
                      <p className="text-lg font-semibold">{order.buyerName} · {order.articleName} · {order.color}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--ec-muted)]">Total pairs</p>
                      <p className="text-2xl font-bold text-[var(--ec-foreground)]">{order.totalPairs}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {sizes.filter((size) => order.sizePairs[size] > 0).map((size) => (
                      <div key={size} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 text-sm">
                        <p className="font-semibold">Size {size}</p>
                        <p className="mt-2 text-lg font-bold text-[var(--ec-foreground)]">{order.sizePairs[size]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
