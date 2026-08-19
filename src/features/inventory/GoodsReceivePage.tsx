"use client";
import { useMemo, useState, useRef, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, PackageCheck } from 'lucide-react';
import { erpService } from '@/services/erpService';
import { useMaterialUnit } from '@/lib/unitSettings';

export function GoodsReceivePage() {
  const materialUnit = useMaterialUnit();
  const departments = erpService.getDepartments();
  const initialReceivals = erpService.getMaterialReceivals();
  const [item, setItem] = useState('Leather Sheet');
  const [quantity, setQuantity] = useState('100');
  const [unit, setUnit] = useState(materialUnit);
  const [section, setSection] = useState('Warehouse');
  const [source, setSource] = useState<'Buyer' | 'Own Purchase'>('Own Purchase');
  const [buyerName, setBuyerName] = useState('');
  const [notes, setNotes] = useState('');
  const [receivals, setReceivals] = useState(initialReceivals);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  const latestReceivals = useMemo(() => receivals.slice(0, 6), [receivals]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (isSubmittingRef.current || isSubmitting) return;

    const parsedQuantity = Number(quantity);
    if (!item.trim()) {
      setFeedback({ type: 'error', text: 'Enter the material name before saving.' });
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFeedback({ type: 'error', text: 'Enter a valid quantity.' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = erpService.receiveGoods({
        item: item.trim(),
        quantity: parsedQuantity,
        unit,
        section,
        source,
        buyerName: buyerName.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setFeedback({ type: 'error', text: result.message ?? 'Goods receive could not be completed.' });
        return;
      }

      setReceivals(erpService.getMaterialReceivals());
      setFeedback({
        type: 'success',
        text: `Received ${parsedQuantity} ${unit} of ${item.trim()} into ${section}.`,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Goods Receive (GRN)</h1>
        <p className="text-xs sm:text-sm text-[var(--ec-muted)]">Record materials received for any section and update inventory immediately.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-cyan-400">
            <PackageCheck className="h-4 w-4" />
            Receive goods
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Material name</span>
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                placeholder="Leather Sheet"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Unit</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                placeholder="kg"
              />
            </label>

            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Section</span>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Source</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as 'Buyer' | 'Own Purchase')}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              >
                <option value="Own Purchase">Own Purchase</option>
                <option value="Buyer">Buyer</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Buyer / Supplier</span>
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2 text-sm text-[var(--ec-foreground)]">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              placeholder="Enter any notes for this receipt"
            />
          </label>

          {feedback ? (
            <div className={`mt-4 flex items-start gap-2 rounded-2xl border px-3 py-3 text-sm ${feedback.type === 'error' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
              {feedback.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save goods receive'}
          </button>
        </form>

        <div className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
          <div className="mb-4 text-sm font-medium text-cyan-400">Recent receipts</div>
          <div className="space-y-2">
            {latestReceivals.map((receipt) => (
              <div key={receipt.id} className="rounded-2xl bg-[var(--ec-surface)] px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--ec-foreground)]">{receipt.item}</div>
                    <div className="text-xs text-[var(--ec-muted)]">{receipt.location ?? 'Unassigned'} · {receipt.source}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[var(--ec-foreground)]">{receipt.quantity} {receipt.unit || materialUnit}</div>
                    <div className="text-xs text-[var(--ec-muted)]">{receipt.receivedAt ? new Date(receipt.receivedAt).toLocaleDateString() : 'Recent'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GoodsReceivePage;
