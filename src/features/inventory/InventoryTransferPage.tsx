"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertCircle, ArrowRightLeft, Boxes, CheckCircle2 } from 'lucide-react';
import { erpService } from '@/services/erpService';
import { useMaterialUnit } from '@/lib/unitSettings';

export function InventoryTransferPage() {
  const materialUnit = useMaterialUnit();
  const [departments, setDepartments] = useState(() => erpService.getDepartments());
  const [stocks, setStocks] = useState(() => erpService.getWarehouseStocks());
  const [selectedItemId, setSelectedItemId] = useState(stocks[0]?.id ?? '');
  const [fromSection, setFromSection] = useState('Warehouse');
  const [toSection, setToSection] = useState('PD');
  const [quantity, setQuantity] = useState('10');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    function handleUpdate() {
      setStocks(erpService.getWarehouseStocks());
      setDepartments(erpService.getDepartments());
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('erp:warehouseStocksUpdated', handleUpdate);
      window.addEventListener('erp:departmentsUpdated', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp:warehouseStocksUpdated', handleUpdate);
        window.removeEventListener('erp:departmentsUpdated', handleUpdate);
      }
    };
  }, []);

  const selectedItem = useMemo(
    () => stocks.find((stock) => stock.id === selectedItemId) ?? null,
    [selectedItemId, stocks],
  );

  const availableItems = stocks.filter((stock) => (stock.quantity ?? 0) > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmittingRef.current || isSubmitting) return;

    if (!selectedItem) {
      setFeedback({ type: 'error', text: 'Select an inventory item before transferring.' });
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setFeedback({ type: 'error', text: 'Enter a valid transfer quantity.' });
      return;
    }

    if (parsedQuantity > (selectedItem.quantity ?? 0)) {
      setFeedback({ type: 'error', text: `Only ${selectedItem.quantity} ${selectedItem.unit || materialUnit} are available from ${fromSection}.` });
      return;
    }

    if (!fromSection || !toSection) {
      setFeedback({ type: 'error', text: 'Select both source and destination sections.' });
      return;
    }

    if (fromSection === toSection) {
      setFeedback({
        type: 'error',
        text: 'Select a different destination section. Warehouse-to-Warehouse transfers are not allowed.',
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const result = erpService.transferInventory({
        itemId: selectedItem.id,
        fromSection,
        toSection,
        quantity: parsedQuantity,
      });

      if (!result.ok) {
        setFeedback({ type: 'error', text: result.message ?? 'Transfer could not be completed.' });
        return;
      }

      setStocks(erpService.getWarehouseStocks());
      setFeedback({
        type: 'success',
        text: `Transferred ${parsedQuantity} ${selectedItem.unit || materialUnit} of ${selectedItem.item} from ${fromSection} to ${toSection}.`,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Inventory Transfer</h1>
        <p className="text-xs sm:text-sm text-[var(--ec-muted)]">Move stock from one section to another with instant validation.</p>
      </div>

      <div className="grid gap-6">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-cyan-400">
            <ArrowRightLeft className="h-4 w-4" />
            Transfer form
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-[var(--ec-foreground)]">
              <span>Inventory item</span>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              >
                {availableItems.map((stock) => (
                  <option key={stock.id} value={stock.id}>
                    {stock.item} · {stock.location ?? 'Unassigned'} · {stock.quantity} {stock.unit || materialUnit}
                  </option>
                ))}
              </select>
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
              <span>From section</span>
              <select
                value={fromSection}
                onChange={(e) => setFromSection(e.target.value)}
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
              <span>To section</span>
              <select
                value={toSection}
                onChange={(e) => setToSection(e.target.value)}
                className="w-full rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-sm text-[var(--ec-foreground)]"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
            {isSubmitting ? 'Transferring...' : 'Save transfer'}
          </button>
        </form>

      </div>
    </div>
  );
}

export default InventoryTransferPage;
