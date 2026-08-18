"use client";
import { useEffect, useMemo, useState } from 'react';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';
import type { Article, Buyer } from '@/types';

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

export function FootwearProductionPage() {
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

  const totalPairs = useMemo(() => Object.values(sizePairs).reduce((sum, value) => sum + (value || 0), 0), [sizePairs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ec-footwear-production-orders');
      if (raw) {
        setReceivedOrders(JSON.parse(raw));
      }
    } catch {
      // ignore invalid localStorage
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ec-footwear-production-orders', JSON.stringify(receivedOrders));
    } catch {
      // ignore
    }
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wider text-cyan-500">Footwear production</p>
            <h1 className="text-2xl font-semibold">Size wise order receive</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-[var(--ec-border)] bg-[var(--ec-card)] px-4 py-2 text-sm"
            >
              Reset form
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 mb-6">
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

        <section className="mb-6 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Size wise order receive</h2>
              <p className="text-sm text-[var(--ec-muted)]">Enter pairs per footwear size from 36 to 46.</p>
            </div>
            <div className="text-sm font-semibold">Total pairs: {totalPairs}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sizes.map((size) => (
              <label key={size} className="space-y-2 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 text-sm">
                <span className="block font-semibold">Size {size}</span>
                <input
                  type="number"
                  min={0}
                  value={sizePairs[size] ?? 0}
                  onChange={(event) => updateSize(size, Number(event.target.value))}
                  className="w-full rounded border px-3 py-2"
                />
                <div className="text-[10px] text-[var(--ec-muted)]">x pair</div>
              </label>
            ))}
          </div>
        </section>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleReceive}
            className="inline-flex items-center justify-center rounded-full bg-[var(--ec-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--ec-primary-600)]"
          >
            Receive order size wise
          </button>
          <p className="text-sm text-[var(--ec-muted)]">Select the size quantities and submit to record the footwear order.</p>
        </div>

        {saved && <p className="mb-6 text-sm text-emerald-500">Order received successfully.</p>}

        <section>
          <h2 className="text-lg font-semibold mb-4">Received size-wise orders</h2>
          {receivedOrders.length === 0 ? (
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-5 text-sm text-[var(--ec-muted)]">No footwear size orders received yet.</div>
          ) : (
            <div className="space-y-4">
              {receivedOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{order.buyerName} • {order.articleName} • {order.color}</p>
                      <p className="text-sm text-[var(--ec-muted)]">Received on {new Date(order.receivedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right text-sm font-semibold">Total {order.totalPairs} pairs</div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {sizes.filter((size) => order.sizePairs[size] > 0).map((size) => (
                      <div key={size} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 text-sm">
                        Size {size}: {order.sizePairs[size]} pair{order.sizePairs[size] !== 1 ? 's' : ''}
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
