"use client";
import { useState, useEffect } from 'react';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';
import { useMaterialUnit, getMaterialUnit, DEFAULT_MATERIAL_UNITS } from '@/lib/unitSettings';
import type { WarehouseStock, MaterialReceival } from '@/types';

export function WarehousePage() {
  const materialUnit = useMaterialUnit();
  const { showConfirm, toast } = useModal();
  const [stocks, setStocks] = useState<WarehouseStock[]>(erpService.getWarehouseStocks());
  const [receivals, setReceivals] = useState<MaterialReceival[]>(erpService.getMaterialReceivals());
  const [buyers] = useState(erpService.getBuyers());
  const [activeTab, setActiveTab] = useState<'stock' | 'receive'>('stock');
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    function handleUpdate() {
      setStocks(erpService.getWarehouseStocks());
      setReceivals(erpService.getMaterialReceivals());
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('erp:warehouseStocksUpdated', handleUpdate);
      window.addEventListener('erp:materialReceivalsUpdated', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('erp:warehouseStocksUpdated', handleUpdate);
        window.removeEventListener('erp:materialReceivalsUpdated', handleUpdate);
      }
    };
  }, []);
  
  const [form, setForm] = useState({ sku: '', item: '', quantity: '', unit: getMaterialUnit(), reorderLevel: '', location: '', category: '' });
  const [receiveForm, setReceiveForm] = useState({ 
    sku: '', 
    item: '', 
    quantity: '', 
    unit: getMaterialUnit(),
    source: 'Buyer' as 'Buyer' | 'Own Purchase',
    buyerId: '',
    location: '', 
    category: '',
    notes: ''
  });

  function handleChange<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function handleReceiveChange<K extends keyof typeof receiveForm>(key: K, value: typeof receiveForm[K]) {
    setReceiveForm((s) => ({ ...s, [key]: value }));
  }

  const selectedStock = selectedStockId ? stocks.find((s) => s.id === selectedStockId) ?? null : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const stockPayload = {
      sku: form.sku || `SKU-${Date.now()}`,
      item: form.item,
      quantity: Number(form.quantity),
      unit: form.unit,
      reorderLevel: Number(form.reorderLevel),
      location: form.location,
      category: form.category,
    };

    if (isEditing && selectedStockId) {
      const updated = erpService.updateWarehouseStock(selectedStockId, stockPayload);
      if (updated) {
        setStocks((prev) => prev.map((stock) => (stock.id === selectedStockId ? updated : stock)));
        setIsEditing(false);
        setSelectedStockId(null);
      }
    } else {
      const created = erpService.createWarehouseStock(stockPayload);
      setStocks((prev) => [created, ...prev]);
    }

    setForm({ sku: '', item: '', quantity: '', unit: getMaterialUnit(), reorderLevel: '', location: '', category: '' });
  }

  function selectStock(stockId: string) {
    setSelectedStockId(stockId);
    setIsEditing(false);
  }

  function startEditSelected() {
    if (!selectedStock) return;
    setForm({
      sku: selectedStock.sku,
      item: selectedStock.item,
      quantity: selectedStock.quantity.toString(),
      unit: selectedStock.unit || getMaterialUnit(),
      reorderLevel: (selectedStock.reorderLevel ?? '').toString(),
      location: selectedStock.location ?? '',
      category: selectedStock.category ?? '',
    });
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setForm({ sku: '', item: '', quantity: '', unit: getMaterialUnit(), reorderLevel: '', location: '', category: '' });
  }

  async function deleteSelectedStock() {
    if (!selectedStockId) return;
    const confirmed = await showConfirm({
      title: 'Delete Stock Entry',
      message: `Are you sure you want to delete "${selectedStock?.item || 'this stock entry'}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Stock',
    });
    if (!confirmed) return;
    const deleted = erpService.deleteWarehouseStock(selectedStockId);
    if (deleted) {
      setStocks((prev) => prev.filter((stock) => stock.id !== selectedStockId));
      setSelectedStockId(null);
      setIsEditing(false);
      setForm({ sku: '', item: '', quantity: '', unit: getMaterialUnit(), reorderLevel: '', location: '', category: '' });
      toast.success('Stock entry deleted successfully.');
    }
  }

  function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const buyerName = receiveForm.source === 'Buyer' 
      ? buyers.find(b => b.id === receiveForm.buyerId)?.name 
      : undefined;

    const created = erpService.createMaterialReceival({
      sku: receiveForm.sku || `SKU-${Date.now()}`,
      item: receiveForm.item,
      quantity: Number(receiveForm.quantity),
      unit: receiveForm.unit,
      source: receiveForm.source,
      buyerId: receiveForm.source === 'Buyer' ? receiveForm.buyerId : undefined,
      buyerName: buyerName,
      location: receiveForm.location,
      category: receiveForm.category,
      notes: receiveForm.notes,
    });
    
    setReceivals((s) => [created, ...s]);
    setReceiveForm({ 
      sku: '', 
      item: '', 
      quantity: '', 
      unit: getMaterialUnit(),
      source: 'Buyer',
      buyerId: '',
      location: '', 
      category: '',
      notes: ''
    });
  }

  return (
    <div className="w-full space-y-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--ec-foreground)]">Warehouse & Stock</h1>
          <p className="text-xs sm:text-sm text-[var(--ec-muted)]">Manage inventory stock and receive materials</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-4 border-b border-[var(--ec-border)]">
        <button
          onClick={() => setActiveTab('stock')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'stock'
              ? 'text-[var(--ec-primary)] border-b-2 border-[var(--ec-primary)]'
              : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
          }`}
        >
          Manage Stock
        </button>
        <button
          onClick={() => setActiveTab('receive')}
          className={`pb-3 px-1 font-medium transition-colors ${
            activeTab === 'receive'
              ? 'text-[var(--ec-primary)] border-b-2 border-[var(--ec-primary)]'
              : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
          }`}
        >
          Receive Materials
        </button>
      </div>

      {/* Stock Management Tab */}
      {activeTab === 'stock' && (
        <>
          <form onSubmit={handleSubmit} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={form.sku} onChange={(e) => handleChange('sku', e.target.value)} placeholder="SKU" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <input value={form.item} onChange={(e) => handleChange('item', e.target.value)} placeholder="Material name" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <div className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]">
              <label className="block text-xs font-medium text-[var(--ec-muted)]">Quantity</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                  placeholder="Qty"
                  className="w-full rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                />
                <select
                  value={form.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-28 rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none font-semibold"
                >
                  {Array.from(new Set([form.unit, ...DEFAULT_MATERIAL_UNITS])).filter(Boolean).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>
            <input type="number" value={form.reorderLevel} onChange={(e) => handleChange('reorderLevel', e.target.value)} placeholder="Reorder level" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <input value={form.location} onChange={(e) => handleChange('location', e.target.value)} placeholder="Location" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <input value={form.category} onChange={(e) => handleChange('category', e.target.value)} placeholder="Category" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <div className="col-span-full flex flex-wrap gap-3 items-center">
              <button type="submit" className="rounded-md bg-[var(--ec-primary)] px-4 py-2 text-sm font-medium text-white">
                {isEditing ? 'Save Changes' : 'Add to Stock'}
              </button>
              {isEditing && (
                <button type="button" onClick={cancelEdit} className="rounded-md border border-[var(--ec-border)] px-4 py-2 text-sm font-medium text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)]">
                  Cancel Edit
                </button>
              )}
              {selectedStock && !isEditing && (
                <button type="button" onClick={startEditSelected} className="rounded-md border border-cyan-500 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-500 hover:bg-cyan-500/20">
                  Edit Selected
                </button>
              )}
              {selectedStock && (
                <button type="button" onClick={deleteSelectedStock} className="rounded-md border border-red-500 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20">
                  Delete Selected
                </button>
              )}
            </div>
          </form>

          <div className="grid gap-3">
            {stocks.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectStock(s.id)}
                className={`text-left rounded-2xl border p-3 transition-all ${
                  selectedStockId === s.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-[var(--ec-border)] bg-[var(--ec-card)] hover:border-cyan-500/30'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-[var(--ec-muted)]">{s.category}</div>
                    <div className="font-medium text-[var(--ec-foreground)]">{s.item} ({s.sku})</div>
                    <div className="text-sm text-[var(--ec-muted)]">Location: {s.location}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-[var(--ec-muted)]">Quantity</div>
                    <div className="font-semibold text-[var(--ec-foreground)]">{s.quantity} {s.unit || materialUnit}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Receive Materials Tab */}
      {activeTab === 'receive' && (
        <>
          <form onSubmit={handleReceiveSubmit} className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Source Selection */}
            <div className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]">
              <label className="block text-xs font-medium text-[var(--ec-muted)]">Source</label>
              <select
                value={receiveForm.source}
                onChange={(e) => handleReceiveChange('source', e.target.value as 'Buyer' | 'Own Purchase')}
                className="mt-1 w-full rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none"
              >
                <option value="Buyer">From Buyer</option>
                <option value="Own Purchase">Own Purchase</option>
              </select>
            </div>

            {/* Buyer Selection - Only visible when source is Buyer */}
            {receiveForm.source === 'Buyer' && (
              <div className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]">
                <label className="block text-xs font-medium text-[var(--ec-muted)]">Select Buyer</label>
                <select
                  value={receiveForm.buyerId}
                  onChange={(e) => handleReceiveChange('buyerId', e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                >
                  <option value="">Choose a buyer...</option>
                  {buyers.map((buyer) => (
                    <option key={buyer.id} value={buyer.id}>
                      {buyer.name} ({buyer.company})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input value={receiveForm.sku} onChange={(e) => handleReceiveChange('sku', e.target.value)} placeholder="SKU" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <input value={receiveForm.item} onChange={(e) => handleReceiveChange('item', e.target.value)} placeholder="Material name" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            
            <div className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]">
              <label className="block text-xs font-medium text-[var(--ec-muted)]">Quantity</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="number"
                  value={receiveForm.quantity}
                  onChange={(e) => handleReceiveChange('quantity', e.target.value)}
                  placeholder="Qty"
                  className="w-full rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none"
                />
                <select
                  value={receiveForm.unit}
                  onChange={(e) => handleReceiveChange('unit', e.target.value)}
                  className="w-28 rounded-md border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-sm text-[var(--ec-foreground)] outline-none font-semibold"
                >
                  {Array.from(new Set([receiveForm.unit, ...DEFAULT_MATERIAL_UNITS])).filter(Boolean).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <input value={receiveForm.location} onChange={(e) => handleReceiveChange('location', e.target.value)} placeholder="Location" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            <input value={receiveForm.category} onChange={(e) => handleReceiveChange('category', e.target.value)} placeholder="Category" className="rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]" />
            
            <textarea 
              value={receiveForm.notes} 
              onChange={(e) => handleReceiveChange('notes', e.target.value)} 
              placeholder="Notes (optional)" 
              className="col-span-full rounded-md bg-[var(--ec-card)] p-2 text-sm text-[var(--ec-foreground)]"
              rows={2}
            />
            
            <div className="col-span-full">
              <button type="submit" className="rounded-md bg-[var(--ec-primary)] px-4 py-2 text-sm font-medium text-white">Receive Materials</button>
            </div>
          </form>

          {/* Received Materials List */}
          <div className="grid gap-3">
            {receivals.map((r) => (
              <div key={r.id} className="ec-card p-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-[var(--ec-foreground)]">
                        {r.item} ({r.sku})
                      </div>
                      <div className="text-xs text-[var(--ec-muted)]">{r.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[var(--ec-foreground)]">{r.quantity} {r.unit || materialUnit}</div>
                      <div className={`text-xs font-medium ${r.source === 'Buyer' ? 'text-blue-500' : 'text-green-500'}`}>
                        {r.source === 'Buyer' ? '👤 ' : '🏢 '}{r.source}
                      </div>
                    </div>
                  </div>
                  
                  {r.source === 'Buyer' && r.buyerName && (
                    <div className="text-sm text-[var(--ec-muted)]">From: <span className="font-medium text-[var(--ec-foreground)]">{r.buyerName}</span></div>
                  )}
                  
                  <div className="text-xs text-[var(--ec-muted)]">
                    📍 Location: {r.location} | 📅 {r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : 'N/A'}
                  </div>
                  
                  {r.notes && (
                    <div className="text-xs text-[var(--ec-muted)]">Notes: {r.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default WarehousePage;
