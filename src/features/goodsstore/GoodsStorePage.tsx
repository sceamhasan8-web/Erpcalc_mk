"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import type { FinishedGoods, BuyerOrder, ProductionFlow } from '@/types';
import { Boxes, PackageCheck, Ship, Plus, Search, CheckCircle, Clock, AlertCircle, TrendingUp, Info } from 'lucide-react';

export function GoodsStorePage() {
  const productionUnit = useProductionUnit();
  const { showAlert, showConfirm, toast } = useModal();
  const [items, setItems] = useState<FinishedGoods[]>(erpService.getFinishedGoods());
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>(erpService.getBuyerOrders());
  const [flows, setFlows] = useState<ProductionFlow[]>(erpService.getProductionFlows());

  // UI state
  const [activeTab, setActiveTab] = useState<'stock' | 'production' | 'manual'>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal state for receiving production goods
  const [receiveModal, setReceiveModal] = useState<{
    open: boolean;
    order: BuyerOrder | null;
    readyQty: number;
    quantity: number;
    sku: string;
    item: string;
    status: 'Ready' | 'Packed' | 'Reserved';
  }>({
    open: false,
    order: null,
    readyQty: 0,
    quantity: 0,
    sku: '',
    item: '',
    status: 'Ready',
  });

  // Manual entry form state
  const [manualForm, setManualForm] = useState({
    sku: '',
    item: '',
    quantity: '',
    status: 'Ready' as 'Ready' | 'Packed' | 'Reserved',
    orderId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Refresh data when database updates
  useEffect(() => {
    function handleFinishedGoodsUpdated() {
      setItems([...erpService.getFinishedGoods()]);
    }
    function handleBuyerOrdersUpdated() {
      setBuyerOrders([...erpService.getBuyerOrders()]);
    }
    function handleProductionFlowsUpdated() {
      setFlows([...erpService.getProductionFlows()]);
      setBuyerOrders([...erpService.getBuyerOrders()]);
    }

    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('erp:finishedGoodsUpdated', handleFinishedGoodsUpdated);
        window.addEventListener('erp:buyerOrdersUpdated', handleBuyerOrdersUpdated);
        window.addEventListener('erp:productionFlowsUpdated', handleProductionFlowsUpdated);
      }
    } catch (e) {}

    return () => {
      try {
        if (typeof window !== 'undefined') {
          window.removeEventListener('erp:finishedGoodsUpdated', handleFinishedGoodsUpdated);
          window.removeEventListener('erp:buyerOrdersUpdated', handleBuyerOrdersUpdated);
          window.removeEventListener('erp:productionFlowsUpdated', handleProductionFlowsUpdated);
        }
      } catch (e) {}
    };
  }, []);

  // Compute production ready status for all orders
  const productionReadyList = useMemo(() => {
    return buyerOrders.map((order) => {
      const depts = order.requiredDepartments ?? [];
      
      // Calculate bottleneck qty across all assigned departments
      let effectiveQty = 0;
      if (depts.length > 0) {
        const legacyId = order.id.replace('bo', 'o');
        const deptTotals = depts.map((dept) => {
          return flows
            .filter((f) => (f.orderId === order.id || f.orderId === legacyId) && f.department === dept)
            .reduce((sum, f) => sum + f.completed, 0);
        });
        effectiveQty = Math.min(...deptTotals);
      }

      // Calculate total quantity already entered in the Goods Store
      const legacyId = order.id.replace('bo', 'o');
      const enteredQty = items
        .filter((fg) => fg.orderId === order.id || fg.orderId === legacyId)
        .reduce((sum, fg) => sum + fg.quantity, 0);

      const readyQty = Math.max(0, effectiveQty - enteredQty);

      return {
        order,
        effectiveQty,
        enteredQty,
        readyQty,
      };
    }).filter(p => p.readyQty > 0);
  }, [buyerOrders, flows, items]);

  // Statistics
  const stats = useMemo(() => {
    const totalInStock = items
      .filter((it) => it.status !== 'Shipped')
      .reduce((sum, it) => sum + it.quantity, 0);

    const totalShipped = items
      .filter((it) => it.status === 'Shipped')
      .reduce((sum, it) => sum + it.quantity, 0);

    const totalReadyFromProduction = productionReadyList.reduce((sum, p) => sum + p.readyQty, 0);

    const activeSkusCount = new Set(items.map((it) => it.sku)).size;

    return {
      totalInStock,
      totalShipped,
      totalReadyFromProduction,
      activeSkusCount,
    };
  }, [items, productionReadyList]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch =
        it.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (it.orderId && it.orderId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || it.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, statusFilter]);

  // Ship finished goods item
  async function shipItem(fgId: string) {
    const itemToShip = items.find((it) => it.id === fgId);
    const confirmed = await showConfirm({
      title: 'Ship Finished Goods',
      message: `Are you sure you want to mark "${itemToShip?.item || 'this item'}" (${itemToShip?.quantity.toLocaleString()} units) as Shipped?`,
      type: 'question',
      confirmText: 'Ship Item',
    });
    if (!confirmed) return;

    const res = erpService.markFinishedGoodShipped(fgId);
    if (!res.finished) {
      showAlert({ title: 'Shipment Failed', message: 'Failed to mark item as shipped.', type: 'error' });
      return;
    }
    setItems((s) => s.map((it) => (it.id === fgId ? { ...it, status: 'Shipped' } : it)));
    toast.success('Item shipped! Associated Buyer Order marked as Completed.');
  }

  // Open Receive Production Modal
  function openReceiveModal(order: BuyerOrder, readyQty: number) {
    setReceiveModal({
      open: true,
      order,
      readyQty,
      quantity: readyQty,
      sku: `FG-${order.orderNumber}`,
      item: `${order.articleName} (${order.color})`,
      status: 'Ready',
    });
  }

  // Submit Receive Production Flow
  function submitReceiveProduction() {
    if (isSubmittingRef.current || isSubmitting) return;

    const { order, quantity, sku, item, status, readyQty } = receiveModal;
    if (!order || quantity <= 0) return;

    if (quantity > readyQty) {
      showAlert({
        title: 'Exceeded Ready Quantity',
        message: `Cannot receive more than the ready quantity of ${readyQty.toLocaleString()}.`,
        type: 'warning',
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Check if an entry with same SKU, orderId and status already exists to update it
      const existing = items.find(
        (fg) => fg.orderId === order.id && fg.sku === sku && fg.status === status
      );

      if (existing) {
        erpService.updateFinishedGood(existing.id, {
          quantity: existing.quantity + quantity,
        });
      } else {
        erpService.createFinishedGood({
          sku,
          item,
          quantity,
          status,
          orderId: order.id,
        });
      }

      toast.success(`Successfully received ${quantity.toLocaleString()} ${order.unit || productionUnit} into Goods Store.`);
      setReceiveModal({
        open: false,
        order: null,
        readyQty: 0,
        quantity: 0,
        sku: '',
        item: '',
        status: 'Ready',
      });
      setItems([...erpService.getFinishedGoods()]);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // Submit Manual Custom Entry Form
  function submitManualEntry(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmittingRef.current || isSubmitting) return;

    const qty = Number(manualForm.quantity);
    if (!manualForm.sku.trim() || !manualForm.item.trim() || isNaN(qty) || qty <= 0) {
      showAlert({
        title: 'Incomplete Fields',
        message: 'Please fill all manual entry fields with valid values.',
        type: 'warning',
      });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Check existing
      const existing = items.find(
        (fg) =>
          fg.sku === manualForm.sku &&
          fg.status === manualForm.status &&
          (manualForm.orderId ? fg.orderId === manualForm.orderId : !fg.orderId)
      );

      if (existing) {
        erpService.updateFinishedGood(existing.id, {
          quantity: existing.quantity + qty,
        });
      } else {
        erpService.createFinishedGood({
          sku: manualForm.sku,
          item: manualForm.item,
          quantity: qty,
          status: manualForm.status,
          orderId: manualForm.orderId || undefined,
        });
      }

      toast.success(`Successfully entered ${qty.toLocaleString()} units of ${manualForm.item} manually.`);
      setManualForm({
        sku: '',
        item: '',
        quantity: '',
        status: 'Ready',
        orderId: '',
      });
      setItems([...erpService.getFinishedGoods()]);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full text-[var(--ec-foreground)] space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Inventory & Storage</p>
          <h1 className="text-2xl font-bold">Goods Store Dashboard</h1>
          <p className="text-sm text-[var(--ec-muted)]">
            Manage finished goods stock, receive products completed from production, and dispatch shipments.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[var(--ec-muted)] font-medium">Total In Stock</p>
            <p className="text-2xl font-bold font-mono mt-0.5">{stats.totalInStock.toLocaleString()}</p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="p-3 bg-yellow-500/10 text-yellow-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[var(--ec-muted)] font-medium">Ready from Production</p>
            <p className="text-2xl font-bold font-mono mt-0.5 text-yellow-400">
              {stats.totalReadyFromProduction.toLocaleString()}
            </p>
          </div>
          {stats.totalReadyFromProduction > 0 && (
            <span className="absolute top-2 right-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
          )}
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Ship className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[var(--ec-muted)] font-medium">Total Shipped</p>
            <p className="text-2xl font-bold font-mono mt-0.5 text-emerald-400">
              {stats.totalShipped.toLocaleString()}
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-[var(--ec-muted)] font-medium">Active SKUs</p>
            <p className="text-2xl font-bold font-mono mt-0.5">{stats.activeSkusCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-[var(--ec-border)] text-sm font-medium">
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all ${
            activeTab === 'stock'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
              : 'border-transparent text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)]'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Goods Stock ({filteredItems.length})
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all relative ${
            activeTab === 'production'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
              : 'border-transparent text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Ready from Production
          {productionReadyList.length > 0 && (
            <span className="ml-1.5 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-semibold text-yellow-400">
              {productionReadyList.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
              : 'border-transparent text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)]'
          }`}
        >
          <Plus className="w-4 h-4" />
          Manual Stock Entry
        </button>
      </div>

      {/* Tabs Content */}
      <div className="space-y-4">
        
        {/* Tab 1: Current Stock */}
        {activeTab === 'stock' && (
          <div className="space-y-4">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  placeholder="Search stock by SKU, Item Name, or Order Link..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--ec-card)] pl-10 pr-4 py-2 rounded-xl border border-[var(--ec-border)] focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[var(--ec-card)] px-4 py-2 rounded-xl border border-[var(--ec-border)] focus:outline-none focus:border-cyan-500 text-sm cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Ready">Ready</option>
                <option value="Packed">Packed</option>
                <option value="Reserved">Reserved</option>
                <option value="Shipped">Shipped</option>
              </select>
            </div>

            {/* List */}
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-12 text-center text-[var(--ec-muted)]">
                <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">No finished goods found</p>
                <p className="text-xs mt-1">Try refining your search query or filters.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredItems.map((it) => (
                  <div
                    key={it.id}
                    className={`rounded-2xl border p-5 bg-[var(--ec-card)] transition-all ${
                      it.status === 'Shipped'
                        ? 'border-emerald-500/25 bg-emerald-500/5 opacity-80'
                        : 'border-[var(--ec-border)] hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold tracking-wider uppercase text-[var(--ec-muted)] px-2 py-0.5 rounded bg-[var(--ec-surface)] border border-[var(--ec-border)]">
                            {it.sku}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              it.status === 'Shipped'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : it.status === 'Ready'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : it.status === 'Packed'
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}
                          >
                            {it.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg leading-tight mt-1">{it.item}</h3>
                        {it.orderId && (
                          <p className="text-xs text-[var(--ec-muted)]">
                            Linked Order: <strong className="text-cyan-400">{it.orderId}</strong>
                          </p>
                        )}
                      </div>

                      {/* Right: Quantity and Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--ec-border)]">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-[var(--ec-muted)]">Stock Qty</p>
                          <p className="text-xl font-bold font-mono text-[var(--ec-foreground)]">{it.quantity.toLocaleString()}</p>
                        </div>
                        <div>
                          {it.status !== 'Shipped' ? (
                            <button
                              onClick={() => shipItem(it.id)}
                              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-emerald-500/10"
                            >
                              <Ship className="w-4 h-4" />
                              Ship Stock
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold px-3 py-1 bg-emerald-500/10 rounded-lg">
                              <CheckCircle className="w-4 h-4" /> Dispatched
                            </span>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Receive from Production */}
        {activeTab === 'production' && (
          <div className="space-y-4">
            
            {/* Info notice */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex gap-3 text-sm text-[var(--ec-muted)]">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <p>
                The list below displays orders that have completed output in their respective production departments.
                Since automatic store sync is disabled, you must click <strong>✓ Receive / Entry</strong> to record them in Goods Store stock.
              </p>
            </div>

            {productionReadyList.length === 0 ? (
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-12 text-center text-[var(--ec-muted)]">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400 opacity-60" />
                <p className="font-semibold text-sm">All production is fully received</p>
                <p className="text-xs mt-1">There are currently no outstanding production quantities ready for warehouse receipt.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {productionReadyList.map(({ order, effectiveQty, enteredQty, readyQty }) => (
                  <div key={order.id} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5 hover:border-cyan-500/30 transition-all shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Left: Info */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--ec-muted)] uppercase tracking-wider">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/20 text-yellow-400">
                            Ready for store
                          </span>
                        </div>
                        <h3 className="font-bold text-lg leading-tight mt-1">
                          {order.articleName} · <span className="text-cyan-400 font-medium">{order.color}</span>
                        </h3>
                        <p className="text-xs text-[var(--ec-muted)]">
                          Buyer: <strong>{order.buyerName}</strong> · Target: {order.quantity.toLocaleString()} {order.unit || productionUnit}
                        </p>
                      </div>

                      {/* Middle: Progress stats */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs border-y md:border-y-0 py-3 md:py-0 border-[var(--ec-border)] shrink-0 min-w-[280px]">
                        <div className="bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl p-2.5">
                          <p className="text-[var(--ec-muted)]">Completed Prod.</p>
                          <p className="font-bold font-mono text-[var(--ec-foreground)] mt-0.5">{effectiveQty.toLocaleString()}</p>
                        </div>
                        <div className="bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl p-2.5">
                          <p className="text-[var(--ec-muted)]">Already Recv.</p>
                          <p className="font-bold font-mono text-[var(--ec-foreground)] mt-0.5">{enteredQty.toLocaleString()}</p>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5">
                          <p className="text-yellow-400 font-semibold">Ready to Entry</p>
                          <p className="font-bold font-mono text-yellow-400 mt-0.5">{readyQty.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Right: Receive Button */}
                      <div className="shrink-0 flex items-center justify-end">
                        <button
                          onClick={() => openReceiveModal(order, readyQty)}
                          className="bg-[var(--ec-primary)] hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-opacity flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          Receive / Entry
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Manual Stock Entry */}
        {activeTab === 'manual' && (
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 shadow-sm max-w-xl">
            <h2 className="text-lg font-bold mb-1">Manual Stock Entry</h2>
            <p className="text-xs text-[var(--ec-muted)] mb-5">
              Directly enter goods into the store inventory without production constraints. Useful for initial stock, manual adjustments, or samples.
            </p>

            <form onSubmit={submitManualEntry} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--ec-muted)]">SKU / Item Code *</span>
                  <input
                    type="text"
                    required
                    value={manualForm.sku}
                    onChange={(e) => setManualForm({ ...manualForm, sku: e.target.value })}
                    placeholder="e.g. FG-MAT-005"
                    className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--ec-muted)]">Status</span>
                  <select
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value as any })}
                    className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="Ready">Ready (Inspection Passed)</option>
                    <option value="Packed">Packed</option>
                    <option value="Reserved">Reserved</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5 text-sm">
                <span className="text-[var(--ec-muted)]">Item Name / Description *</span>
                <input
                  type="text"
                  required
                  value={manualForm.item}
                  onChange={(e) => setManualForm({ ...manualForm, item: e.target.value })}
                  placeholder="e.g. Classic Runner Black Pair (Grade A)"
                  className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-cyan-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--ec-muted)]">Quantity *</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={manualForm.quantity}
                    onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--ec-muted)]">Link to Buyer Order (Optional)</span>
                  <select
                    value={manualForm.orderId}
                    onChange={(e) => setManualForm({ ...manualForm, orderId: e.target.value })}
                    className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">-- None --</option>
                    {buyerOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} · {o.articleName} ({o.color})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-[var(--ec-primary)] hover:opacity-90 text-white px-6 py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving...' : '✓ Entry Stock'}
              </button>

            </form>
          </div>
        )}

      </div>

      {/* ════════════════════════════════════════════════════
           RECEIVE PRODUCTION MODAL
      ════════════════════════════════════════════════════ */}
      {receiveModal.open && receiveModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            
            <div>
              <h2 className="text-lg font-bold mb-1">Receive Goods from Production</h2>
              <p className="text-xs text-[var(--ec-muted)]">
                Order: <strong className="text-[var(--ec-foreground)]">{receiveModal.order.orderNumber}</strong> · Buyer: {receiveModal.order.buyerName}
              </p>
            </div>

            {/* Qty Stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-[var(--ec-surface)] rounded-xl p-2 border border-[var(--ec-border)]">
                <p className="text-[var(--ec-muted)]">Order Target</p>
                <p className="font-bold text-[var(--ec-foreground)] mt-0.5">
                  {receiveModal.order.quantity.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--ec-surface)] rounded-xl p-2 border border-[var(--ec-border)]">
                <p className="text-[var(--ec-muted)]">Completed Qty</p>
                <p className="font-bold text-cyan-400 mt-0.5">
                  {receiveModal.readyQty.toLocaleString()}
                </p>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-2 border border-yellow-500/25">
                <p className="text-yellow-400 font-semibold">Max to Entry</p>
                <p className="font-bold text-yellow-400 mt-0.5">
                  {receiveModal.readyQty.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[var(--ec-muted)] uppercase tracking-wider">
                Quantity to Receive ({receiveModal.order.unit || productionUnit})
              </label>
              <input
                type="number"
                min={1}
                max={receiveModal.readyQty}
                value={receiveModal.quantity || ''}
                onChange={(e) => setReceiveModal({ ...receiveModal, quantity: Number(e.target.value) })}
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-4 py-3 text-xl font-bold text-center focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[11px] text-[var(--ec-muted)] text-center">
                Maximum you can receive right now: <span className="font-bold text-yellow-400">{receiveModal.readyQty.toLocaleString()}</span> {receiveModal.order.unit || productionUnit}
              </p>

              <label className="block space-y-1.5 text-sm mt-4">
                <span className="text-xs font-semibold text-[var(--ec-muted)] uppercase tracking-wider">Item SKU Code</span>
                <input
                  type="text"
                  value={receiveModal.sku}
                  onChange={(e) => setReceiveModal({ ...receiveModal, sku: e.target.value })}
                  className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-cyan-500 font-mono"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="text-xs font-semibold text-[var(--ec-muted)] uppercase tracking-wider">Item Stock Description</span>
                <input
                  type="text"
                  value={receiveModal.item}
                  onChange={(e) => setReceiveModal({ ...receiveModal, item: e.target.value })}
                  className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-cyan-500"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="text-xs font-semibold text-[var(--ec-muted)] uppercase tracking-wider">Storage Status</span>
                <select
                  value={receiveModal.status}
                  onChange={(e) => setReceiveModal({ ...receiveModal, status: e.target.value as any })}
                  className="w-full bg-[var(--ec-surface)] border border-[var(--ec-border)] px-3 py-2 rounded-xl text-sm focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="Ready">Ready</option>
                  <option value="Packed">Packed</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReceiveModal({ open: false, order: null, readyQty: 0, quantity: 0, sku: '', item: '', status: 'Ready' })}
                className="flex-1 rounded-xl border border-[var(--ec-border)] py-2.5 text-sm font-medium hover:bg-[var(--ec-surface)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReceiveProduction}
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-[var(--ec-primary)] hover:opacity-90 text-white py-2.5 text-sm font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving Receipt...' : 'Save Receipt'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default GoodsStorePage;
