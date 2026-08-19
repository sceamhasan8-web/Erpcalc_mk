"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useMaterialUnit, getMaterialUnit, DEFAULT_MATERIAL_UNITS } from '@/lib/unitSettings';
import type { WarehouseStock, MaterialReceival, BuyerOrder, Buyer } from '@/types';
import {
  Package,
  Layers,
  Inbox,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Boxes,
  MapPin,
  Calendar,
  ShoppingBag,
  Receipt,
  Calculator,
  DollarSign
} from 'lucide-react';

export function WarehousePage() {
  const materialUnit = useMaterialUnit();
  const { showConfirm, showAlert, toast } = useModal();

  const [stocks, setStocks] = useState<WarehouseStock[]>([]);
  const [receivals, setReceivals] = useState<MaterialReceival[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab Navigation: 'order-wise' | 'stock' | 'receive'
  const [activeTab, setActiveTab] = useState<'order-wise' | 'stock' | 'receive'>('order-wise');

  // Selected Order for Order-Wise Materials view
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [stockOrderFilter, setStockOrderFilter] = useState<string>('all');

  // Stock Form States (Two-way auto-synced unit price & total price)
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [stockForm, setStockForm] = useState({
    orderId: '',
    sku: '',
    item: '',
    quantity: '',
    unit: getMaterialUnit(),
    unitPrice: '',
    totalPrice: '',
    reorderLevel: '',
    location: '',
    category: '',
  });

  // Receive Form States (Two-way auto-synced unit price & total price)
  const [receiveForm, setReceiveForm] = useState({
    orderId: '',
    sku: '',
    item: '',
    quantity: '',
    unit: getMaterialUnit(),
    unitPrice: '',
    totalPrice: '',
    source: 'Buyer' as 'Buyer' | 'Own Purchase',
    buyerId: '',
    location: '',
    category: '',
    notes: '',
  });

  // Quick Modal for Adding Material to Selected Order
  const [showAddOrderMaterialModal, setShowAddOrderMaterialModal] = useState(false);
  const [orderMaterialForm, setOrderMaterialForm] = useState({
    sku: '',
    item: '',
    quantity: '',
    unit: getMaterialUnit(),
    unitPrice: '',
    totalPrice: '',
    category: 'Upper Material',
    location: 'Warehouse Section A',
    reorderLevel: '50',
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Helper to format currency
  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '৳0';
    return `৳${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // ---------------------------------------------------------------------------
  // Two-way calculation handlers for Stock Form
  // ---------------------------------------------------------------------------
  const handleStockQuantityChange = (qtyStr: string) => {
    const q = Number(qtyStr);
    const u = Number(stockForm.unitPrice);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u > 0) {
      setStockForm((prev) => ({
        ...prev,
        quantity: qtyStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setStockForm((prev) => ({ ...prev, quantity: qtyStr }));
    }
  };

  const handleStockUnitPriceChange = (uStr: string) => {
    const q = Number(stockForm.quantity);
    const u = Number(uStr);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u >= 0) {
      setStockForm((prev) => ({
        ...prev,
        unitPrice: uStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setStockForm((prev) => ({ ...prev, unitPrice: uStr }));
    }
  };

  const handleStockTotalPriceChange = (tStr: string) => {
    const q = Number(stockForm.quantity);
    const t = Number(tStr);
    if (!isNaN(q) && q > 0 && !isNaN(t) && t >= 0) {
      setStockForm((prev) => ({
        ...prev,
        totalPrice: tStr,
        unitPrice: String(Number((t / q).toFixed(2))),
      }));
    } else {
      setStockForm((prev) => ({ ...prev, totalPrice: tStr }));
    }
  };

  // ---------------------------------------------------------------------------
  // Two-way calculation handlers for Receive Form
  // ---------------------------------------------------------------------------
  const handleReceiveQuantityChange = (qtyStr: string) => {
    const q = Number(qtyStr);
    const u = Number(receiveForm.unitPrice);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u > 0) {
      setReceiveForm((prev) => ({
        ...prev,
        quantity: qtyStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setReceiveForm((prev) => ({ ...prev, quantity: qtyStr }));
    }
  };

  const handleReceiveUnitPriceChange = (uStr: string) => {
    const q = Number(receiveForm.quantity);
    const u = Number(uStr);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u >= 0) {
      setReceiveForm((prev) => ({
        ...prev,
        unitPrice: uStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setReceiveForm((prev) => ({ ...prev, unitPrice: uStr }));
    }
  };

  const handleReceiveTotalPriceChange = (tStr: string) => {
    const q = Number(receiveForm.quantity);
    const t = Number(tStr);
    if (!isNaN(q) && q > 0 && !isNaN(t) && t >= 0) {
      setReceiveForm((prev) => ({
        ...prev,
        totalPrice: tStr,
        unitPrice: String(Number((t / q).toFixed(2))),
      }));
    } else {
      setReceiveForm((prev) => ({ ...prev, totalPrice: tStr }));
    }
  };

  // ---------------------------------------------------------------------------
  // Two-way calculation handlers for Order Material Modal Form
  // ---------------------------------------------------------------------------
  const handleOrderMaterialQuantityChange = (qtyStr: string) => {
    const q = Number(qtyStr);
    const u = Number(orderMaterialForm.unitPrice);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u > 0) {
      setOrderMaterialForm((prev) => ({
        ...prev,
        quantity: qtyStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setOrderMaterialForm((prev) => ({ ...prev, quantity: qtyStr }));
    }
  };

  const handleOrderMaterialUnitPriceChange = (uStr: string) => {
    const q = Number(orderMaterialForm.quantity);
    const u = Number(uStr);
    if (!isNaN(q) && q > 0 && !isNaN(u) && u >= 0) {
      setOrderMaterialForm((prev) => ({
        ...prev,
        unitPrice: uStr,
        totalPrice: String(Number((q * u).toFixed(2))),
      }));
    } else {
      setOrderMaterialForm((prev) => ({ ...prev, unitPrice: uStr }));
    }
  };

  const handleOrderMaterialTotalPriceChange = (tStr: string) => {
    const q = Number(orderMaterialForm.quantity);
    const t = Number(tStr);
    if (!isNaN(q) && q > 0 && !isNaN(t) && t >= 0) {
      setOrderMaterialForm((prev) => ({
        ...prev,
        totalPrice: tStr,
        unitPrice: String(Number((t / q).toFixed(2))),
      }));
    } else {
      setOrderMaterialForm((prev) => ({ ...prev, totalPrice: tStr }));
    }
  };

  // Load initial data and live subscriptions
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [stocksData, receivalsData, buyersData, ordersData] = await Promise.all([
          apiService.getWarehouseStocks(),
          apiService.getMaterialReceivals(),
          apiService.getBuyers(),
          apiService.getBuyerOrders(),
        ]);
        setStocks(stocksData);
        setReceivals(receivalsData);
        setBuyers(buyersData);
        setOrders(ordersData);

        if (ordersData.length > 0 && !selectedOrderId) {
          setSelectedOrderId(ordersData[0].id);
        }
      } catch (err) {
        console.error('Failed to load warehouse data', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const unsubStocks = firebaseService.subscribeWarehouseStocks((live) => {
      if (live && Array.isArray(live)) setStocks(live);
    });

    const unsubReceivals = firebaseService.subscribeMaterialReceivals((live) => {
      if (live && Array.isArray(live)) setReceivals(live);
    });

    const unsubOrders = firebaseService.subscribeOrders((live) => {
      if (live && Array.isArray(live)) setOrders(live);
    });

    const handleLocalSync = () => {
      apiService.getWarehouseStocks().then(setStocks).catch(() => {});
      apiService.getMaterialReceivals().then(setReceivals).catch(() => {});
      apiService.getBuyerOrders().then(setOrders).catch(() => {});
    };

    window.addEventListener('erp:warehouseStocksUpdated', handleLocalSync);
    window.addEventListener('erp:materialReceivalsUpdated', handleLocalSync);
    window.addEventListener('erp:buyerOrdersUpdated', handleLocalSync);

    return () => {
      unsubStocks();
      unsubReceivals();
      unsubOrders();
      window.removeEventListener('erp:warehouseStocksUpdated', handleLocalSync);
      window.removeEventListener('erp:materialReceivalsUpdated', handleLocalSync);
      window.removeEventListener('erp:buyerOrdersUpdated', handleLocalSync);
    };
  }, []);

  // Filtered Orders for Selection
  const filteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return orders;
    const q = orderSearchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q) ||
        o.articleName?.toLowerCase().includes(q)
    );
  }, [orders, orderSearchQuery]);

  // Selected Order object
  const currentOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0] || null;
  }, [orders, selectedOrderId]);

  // Materials linked to the currently selected order
  const currentOrderStocks = useMemo(() => {
    if (!currentOrder) return [];
    return stocks.filter((s) => s.orderId === currentOrder.id || s.orderNumber === currentOrder.orderNumber);
  }, [stocks, currentOrder]);

  // Receivals linked to the currently selected order
  const currentOrderReceivals = useMemo(() => {
    if (!currentOrder) return [];
    return receivals.filter((r) => r.orderId === currentOrder.id || r.orderNumber === currentOrder.orderNumber);
  }, [receivals, currentOrder]);

  // Order Financial & Stock Metrics
  const orderValuation = useMemo(() => {
    const totalQty = currentOrderStocks.reduce((sum, s) => sum + s.quantity, 0);
    const totalCost = currentOrderStocks.reduce((sum, s) => {
      const uPrice = s.unitPrice || 0;
      const tPrice = s.totalPrice || (s.quantity * uPrice);
      return sum + tPrice;
    }, 0);
    return { totalQty, totalCost };
  }, [currentOrderStocks]);

  // Total Warehouse Valuation across all inventory
  const totalWarehouseValuation = useMemo(() => {
    return stocks.reduce((sum, s) => {
      const uPrice = s.unitPrice || 0;
      const tPrice = s.totalPrice || (s.quantity * uPrice);
      return sum + tPrice;
    }, 0);
  }, [stocks]);

  // Filtered Stock list for Manage Stock Tab
  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      if (stockOrderFilter === 'general') return !s.orderId && !s.orderNumber;
      if (stockOrderFilter === 'orders') return !!s.orderId || !!s.orderNumber;
      if (stockOrderFilter !== 'all') return s.orderId === stockOrderFilter || s.orderNumber === stockOrderFilter;
      return true;
    });
  }, [stocks, stockOrderFilter]);

  // Handle Add/Edit Stock Submit
  async function handleStockSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!stockForm.item.trim()) {
      showAlert({ title: 'Material Name Required', message: 'Please enter a valid material name.', type: 'warning' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const matchedOrder = orders.find((o) => o.id === stockForm.orderId);
    const qty = Number(stockForm.quantity) || 0;
    const uPrice = stockForm.unitPrice ? Number(stockForm.unitPrice) : undefined;
    const tPrice = stockForm.totalPrice
      ? Number(stockForm.totalPrice)
      : (uPrice !== undefined && qty > 0 ? qty * uPrice : undefined);

    const stockPayload: Omit<WarehouseStock, 'id'> = {
      sku: stockForm.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      item: stockForm.item.trim(),
      quantity: qty,
      unit: stockForm.unit || materialUnit,
      unitPrice: uPrice,
      totalPrice: tPrice,
      reorderLevel: stockForm.reorderLevel ? Number(stockForm.reorderLevel) : undefined,
      location: stockForm.location.trim() || undefined,
      category: stockForm.category.trim() || 'General Material',
      orderId: matchedOrder?.id,
      orderNumber: matchedOrder?.orderNumber,
      buyerName: matchedOrder?.buyerName,
      articleName: matchedOrder?.articleName,
    };

    try {
      if (isEditingStock && selectedStockId) {
        const updated = await apiService.updateWarehouseStock(selectedStockId, stockPayload);
        setStocks((prev) => prev.map((stock) => (stock.id === selectedStockId ? { ...stock, ...updated } : stock)));
        setIsEditingStock(false);
        setSelectedStockId(null);
        toast.success(
          matchedOrder
            ? `Updated "${stockPayload.item}" for Order #${matchedOrder.orderNumber}!`
            : `Updated "${stockPayload.item}" in General Inventory!`
        );
      } else {
        const created = await apiService.createWarehouseStock(stockPayload);
        setStocks((prev) => [created, ...prev]);
        if (matchedOrder) {
          toast.success(`Allocated "${stockPayload.item}" to Order #${matchedOrder.orderNumber} materials!`);
        } else {
          toast.success(`Added "${stockPayload.item}" to General Factory Inventory!`);
        }
      }

      setStockForm({
        orderId: '',
        sku: '',
        item: '',
        quantity: '',
        unit: getMaterialUnit(),
        unitPrice: '',
        totalPrice: '',
        reorderLevel: '',
        location: '',
        category: '',
      });
    } catch (err) {
      showAlert({ title: 'Operation Failed', message: 'Could not save stock entry. Please try again.', type: 'error' });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // Handle Material Receival Submit
  async function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!receiveForm.item.trim()) {
      showAlert({ title: 'Material Name Required', message: 'Please enter material name.', type: 'warning' });
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const matchedOrder = orders.find((o) => o.id === receiveForm.orderId);
    const buyerName = receiveForm.source === 'Buyer'
      ? (matchedOrder?.buyerName || buyers.find((b) => b.id === receiveForm.buyerId)?.name)
      : undefined;

    const qty = Number(receiveForm.quantity) || 0;
    const uPrice = receiveForm.unitPrice ? Number(receiveForm.unitPrice) : undefined;
    const tPrice = receiveForm.totalPrice
      ? Number(receiveForm.totalPrice)
      : (uPrice !== undefined && qty > 0 ? qty * uPrice : undefined);

    const receivalPayload: Omit<MaterialReceival, 'id'> = {
      sku: receiveForm.sku.trim() || `MAT-${Date.now().toString().slice(-6)}`,
      item: receiveForm.item.trim(),
      quantity: qty,
      unit: receiveForm.unit || materialUnit,
      unitPrice: uPrice,
      totalPrice: tPrice,
      source: receiveForm.source,
      buyerId: receiveForm.source === 'Buyer' ? (receiveForm.buyerId || matchedOrder?.buyerId) : undefined,
      buyerName: buyerName,
      orderId: matchedOrder?.id,
      orderNumber: matchedOrder?.orderNumber,
      articleName: matchedOrder?.articleName,
      location: receiveForm.location.trim() || undefined,
      category: receiveForm.category.trim() || 'Raw Material',
      receivedAt: new Date().toISOString(),
      notes: receiveForm.notes.trim() || undefined,
    };

    try {
      const created = await apiService.createMaterialReceival(receivalPayload);
      setReceivals((prev) => [created, ...prev]);

      // Also automatically update or create corresponding Warehouse Stock
      const existingStock = stocks.find(
        (s) =>
          s.item.toLowerCase() === receivalPayload.item.toLowerCase() &&
          (!receivalPayload.orderId || s.orderId === receivalPayload.orderId)
      );

      if (existingStock) {
        const updatedQty = (existingStock.quantity || 0) + receivalPayload.quantity;
        const updatedUnitPrice = uPrice || existingStock.unitPrice;
        const updatedTotalPrice = updatedUnitPrice ? updatedQty * updatedUnitPrice : undefined;

        await apiService.updateWarehouseStock(existingStock.id, {
          quantity: updatedQty,
          unitPrice: updatedUnitPrice,
          totalPrice: updatedTotalPrice,
        });
        setStocks((prev) =>
          prev.map((s) =>
            s.id === existingStock.id
              ? { ...s, quantity: updatedQty, unitPrice: updatedUnitPrice, totalPrice: updatedTotalPrice }
              : s
          )
        );
      } else {
        const newStock = await apiService.createWarehouseStock({
          sku: receivalPayload.sku,
          item: receivalPayload.item,
          quantity: receivalPayload.quantity,
          unit: receivalPayload.unit,
          unitPrice: receivalPayload.unitPrice,
          totalPrice: receivalPayload.totalPrice,
          location: receivalPayload.location,
          category: receivalPayload.category,
          orderId: receivalPayload.orderId,
          orderNumber: receivalPayload.orderNumber,
          buyerName: receivalPayload.buyerName,
          articleName: receivalPayload.articleName,
          reorderLevel: 50,
        });
        setStocks((prev) => [newStock, ...prev]);
      }

      setReceiveForm({
        orderId: '',
        sku: '',
        item: '',
        quantity: '',
        unit: getMaterialUnit(),
        unitPrice: '',
        totalPrice: '',
        source: 'Buyer',
        buyerId: '',
        location: '',
        category: '',
        notes: '',
      });

      toast.success(`Received ${receivalPayload.quantity} ${receivalPayload.unit} of "${receivalPayload.item}"!`);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Could not record material receipt.', type: 'error' });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // Handle Quick Add Material for Specific Order
  async function handleQuickAddOrderMaterial(e: React.FormEvent) {
    e.preventDefault();

    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!currentOrder || !orderMaterialForm.item.trim()) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const qty = Number(orderMaterialForm.quantity) || 0;
    const uPrice = orderMaterialForm.unitPrice ? Number(orderMaterialForm.unitPrice) : undefined;
    const tPrice = orderMaterialForm.totalPrice
      ? Number(orderMaterialForm.totalPrice)
      : (uPrice !== undefined && qty > 0 ? qty * uPrice : undefined);

    const payload: Omit<WarehouseStock, 'id'> = {
      sku: orderMaterialForm.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
      item: orderMaterialForm.item.trim(),
      quantity: qty,
      unit: orderMaterialForm.unit || materialUnit,
      unitPrice: uPrice,
      totalPrice: tPrice,
      category: orderMaterialForm.category.trim() || 'Order Material',
      location: orderMaterialForm.location.trim() || 'Warehouse',
      reorderLevel: Number(orderMaterialForm.reorderLevel) || 50,
      orderId: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      buyerName: currentOrder.buyerName,
      articleName: currentOrder.articleName,
    };

    try {
      const created = await apiService.createWarehouseStock(payload);
      setStocks((prev) => [created, ...prev]);
      setShowAddOrderMaterialModal(false);
      setOrderMaterialForm({
        sku: '',
        item: '',
        quantity: '',
        unit: getMaterialUnit(),
        unitPrice: '',
        totalPrice: '',
        category: 'Upper Material',
        location: 'Warehouse Section A',
        reorderLevel: '50',
      });
      toast.success(`Added "${payload.item}" to Order #${currentOrder.orderNumber}!`);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to add material to order.', type: 'error' });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // Delete Stock
  async function handleDeleteStock(stock: WarehouseStock) {
    const confirmed = await showConfirm({
      title: 'Delete Material Stock?',
      message: `Are you sure you want to remove "${stock.item}" from warehouse stock?`,
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteWarehouseStock(stock.id);
      setStocks((prev) => prev.filter((s) => s.id !== stock.id));
      toast.success(`Removed "${stock.item}"`);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to delete stock.', type: 'error' });
    }
  }

  function startEditStock(stock: WarehouseStock) {
    const qty = stock.quantity || 0;
    const uPrice = stock.unitPrice;
    const tPrice = stock.totalPrice || (uPrice ? qty * uPrice : undefined);

    setStockForm({
      orderId: stock.orderId || '',
      sku: stock.sku,
      item: stock.item,
      quantity: String(qty),
      unit: stock.unit || materialUnit,
      unitPrice: uPrice ? String(uPrice) : '',
      totalPrice: tPrice ? String(tPrice) : '',
      reorderLevel: stock.reorderLevel ? String(stock.reorderLevel) : '',
      location: stock.location || '',
      category: stock.category || '',
    });
    setSelectedStockId(stock.id);
    setIsEditingStock(true);
    setActiveTab('stock');
  }

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--ec-foreground)] flex items-center gap-2.5">
            <Boxes className="h-6 w-6 text-cyan-400" />
            <span>Warehouse & Material Stocks</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ec-muted)] mt-0.5">
            Order-wise material cost & breakdown, inventory valuation, and material receipts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-right">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 block">Total Inventory Asset</span>
            <strong className="text-sm font-black text-emerald-400 font-mono">{formatCurrency(totalWarehouseValuation)}</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              if (currentOrder) {
                setShowAddOrderMaterialModal(true);
              } else {
                setActiveTab('stock');
              }
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Add Material Stock</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (3 Premium Tabs) */}
      <div className="flex border-b border-[var(--ec-border)] gap-2 sm:gap-4 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('order-wise')}
          className={`pb-3 px-3 text-xs sm:text-sm font-black flex items-center gap-2 transition border-b-2 whitespace-nowrap ${
            activeTab === 'order-wise'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-[var(--ec-muted)] border-transparent hover:text-[var(--ec-foreground)]'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Order-Wise Materials</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            {orders.length} Orders
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`pb-3 px-3 text-xs sm:text-sm font-black flex items-center gap-2 transition border-b-2 whitespace-nowrap ${
            activeTab === 'stock'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-[var(--ec-muted)] border-transparent hover:text-[var(--ec-foreground)]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Manage Stock & Price</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--ec-surface)] text-[var(--ec-muted)] border border-[var(--ec-border)]">
            {stocks.length} Items
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receive')}
          className={`pb-3 px-3 text-xs sm:text-sm font-black flex items-center gap-2 transition border-b-2 whitespace-nowrap ${
            activeTab === 'receive'
              ? 'text-cyan-400 border-cyan-400'
              : 'text-[var(--ec-muted)] border-transparent hover:text-[var(--ec-foreground)]'
          }`}
        >
          <Inbox className="h-4 w-4" />
          <span>Receive Materials</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--ec-surface)] text-[var(--ec-muted)] border border-[var(--ec-border)]">
            {receivals.length} Logs
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ORDER-WISE MATERIALS VIEW (WITH ACCOUNTING PRICING REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'order-wise' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Order Selection Bar */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <span>📦</span> Select Buyer Order to View Materials & Valuation:
              </label>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search order number or buyer..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Horizontal Order Selector Chips */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1">
              {filteredOrders.length === 0 ? (
                <p className="text-xs text-[var(--ec-muted)] py-2">No matching orders found.</p>
              ) : (
                filteredOrders.map((o) => {
                  const isSelected = selectedOrderId === o.id;
                  const orderStocks = stocks.filter((s) => s.orderId === o.id || s.orderNumber === o.orderNumber);
                  const orderCost = orderStocks.reduce((sum, s) => sum + (s.totalPrice || ((s.quantity || 0) * (s.unitPrice || 0))), 0);

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrderId(o.id)}
                      className={`flex-shrink-0 p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 min-w-[210px] ${
                        isSelected
                          ? 'border-cyan-500 bg-gradient-to-br from-blue-600/20 to-cyan-500/20 ring-2 ring-cyan-500/50 shadow-md'
                          : 'border-[var(--ec-border)] bg-[var(--ec-surface)] hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                          {o.orderNumber}
                        </span>
                        <span className="text-[10px] font-black text-emerald-400 font-mono">
                          {formatCurrency(orderCost)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[var(--ec-foreground)] truncate">{o.buyerName}</p>
                      <div className="flex items-center justify-between text-[11px] text-[var(--ec-muted)]">
                        <span className="truncate">{o.articleName || 'Standard Item'}</span>
                        <strong className="text-cyan-400 font-bold">{o.quantity} {o.unit || 'pairs'}</strong>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Order Detail Header Card */}
          {currentOrder && (
            <div className="rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-[var(--ec-card)] to-blue-500/10 p-4 sm:p-6 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--ec-border)]/60 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-black text-white bg-cyan-500 px-2.5 py-1 rounded-lg shadow-sm">
                      {currentOrder.orderNumber}
                    </span>
                    <span className="text-base sm:text-lg font-black text-[var(--ec-foreground)]">
                      {currentOrder.buyerName}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      {currentOrder.status || 'In Production'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ec-muted)]">
                    Article: <strong className="text-[var(--ec-foreground)]">{currentOrder.articleName}</strong> &bull; Color: <strong className="text-[var(--ec-foreground)]">{currentOrder.color || 'Standard'}</strong> &bull; Target Quantity: <strong className="text-cyan-400">{currentOrder.quantity} {currentOrder.unit || 'pairs'}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowAddOrderMaterialModal(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>+ Allocate Material with Price</span>
                  </button>
                </div>
              </div>

              {/* Order Materials Summary Stats Grid (With Accounting Totals) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/80 p-3">
                  <span className="text-[11px] text-[var(--ec-muted)] font-bold">Total Material Items:</span>
                  <p className="text-lg font-black text-cyan-400 mt-0.5">{currentOrderStocks.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/80 p-3">
                  <span className="text-[11px] text-[var(--ec-muted)] font-bold">Total Warehouse Qty:</span>
                  <p className="text-lg font-black text-blue-400 mt-0.5">
                    {orderValuation.totalQty.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">Total Material Valuation:</span>
                  <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                    {formatCurrency(orderValuation.totalCost)}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/80 p-3">
                  <span className="text-[11px] text-[var(--ec-muted)] font-bold">Low Stock Warning:</span>
                  <p className="text-lg font-black text-amber-400 mt-0.5">
                    {currentOrderStocks.filter((s) => s.reorderLevel && s.quantity <= s.reorderLevel).length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Material Items Accounting Breakdown Table for Selected Order */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-sm font-black text-[var(--ec-foreground)] flex items-center gap-2">
                <Receipt className="h-4 w-4 text-cyan-400" />
                <span>Accounting & Material Breakdown for {currentOrder?.orderNumber || 'Selected Order'}:</span>
              </h2>

              <span className="text-xs text-[var(--ec-muted)] font-bold">
                Showing {currentOrderStocks.length} material items
              </span>
            </div>

            {currentOrderStocks.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-[var(--ec-border)] bg-[var(--ec-surface)] space-y-3">
                <Package className="h-8 w-8 text-[var(--ec-muted)] mx-auto opacity-60" />
                <p className="text-xs font-bold text-[var(--ec-foreground)]">
                  No materials allocated yet for Order #{currentOrder?.orderNumber}
                </p>
                <p className="text-[11px] text-[var(--ec-muted)] max-w-md mx-auto">
                  Click the button below to add leather, fabrics, outsoles, eyelets, or packaging materials with unit rate and pricing for this order.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddOrderMaterialModal(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Allocate First Material with Price</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[var(--ec-foreground)]">
                  <thead>
                    <tr className="border-b border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)] uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-3 px-3">Material Name & SKU</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Warehouse Location</th>
                      <th className="py-3 px-3 text-right">In-Stock Qty</th>
                      <th className="py-3 px-3 text-right">Unit Rate (Price)</th>
                      <th className="py-3 px-3 text-right">Total Amount</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ec-border)]">
                    {currentOrderStocks.map((stock) => {
                      const isLowStock = stock.reorderLevel && stock.quantity <= stock.reorderLevel;
                      const unitRate = stock.unitPrice || 0;
                      const itemTotal = stock.totalPrice || (stock.quantity * unitRate);

                      return (
                        <tr key={stock.id} className="hover:bg-[var(--ec-surface)]/60 transition group">
                          {/* Name & SKU */}
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-xs sm:text-sm text-[var(--ec-foreground)]">
                              {stock.item}
                            </div>
                            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                              {stock.sku}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[var(--ec-surface)] border border-[var(--ec-border)] text-[var(--ec-muted)]">
                              {stock.category || 'General'}
                            </span>
                          </td>

                          {/* Location */}
                          <td className="py-3 px-3">
                            <span className="flex items-center gap-1 text-[11px] text-[var(--ec-muted)] font-medium">
                              <MapPin className="h-3 w-3 text-cyan-400 inline" />
                              {stock.location || 'Warehouse'}
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-black text-sm text-[var(--ec-foreground)]">
                              {stock.quantity.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-[var(--ec-muted)] font-bold ml-1">{stock.unit || materialUnit}</span>
                          </td>

                          {/* Unit Rate / Price */}
                          <td className="py-3 px-3 text-right font-mono font-bold text-cyan-400 whitespace-nowrap">
                            {unitRate > 0 ? `${formatCurrency(unitRate)} / ${stock.unit || materialUnit}` : '—'}
                          </td>

                          {/* Total Amount */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-mono font-black text-xs sm:text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg inline-block">
                              {formatCurrency(itemTotal)}
                            </span>
                          </td>

                          {/* Reorder Status */}
                          <td className="py-3 px-3 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                                <AlertTriangle className="h-3 w-3" /> Low
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-bold">
                                ✓ Available
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditStock(stock)}
                                className="p-1.5 rounded-lg bg-[var(--ec-surface)] hover:bg-cyan-500/15 text-[var(--ec-muted)] hover:text-cyan-400 border border-[var(--ec-border)] transition"
                                title="Edit Stock & Price"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStock(stock)}
                                className="p-1.5 rounded-lg bg-[var(--ec-surface)] hover:bg-red-500/15 text-[var(--ec-muted)] hover:text-red-400 border border-[var(--ec-border)] transition"
                                title="Delete Stock"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Accounting Table Footer Summary */}
                  <tfoot>
                    <tr className="border-t-2 border-[var(--ec-border)] bg-[var(--ec-surface)]/80 font-black text-xs">
                      <td colSpan={3} className="py-3 px-3 text-[var(--ec-foreground)]">
                        TOTAL SUMMARY FOR ORDER #{currentOrder.orderNumber}:
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--ec-foreground)] font-mono">
                        {orderValuation.totalQty.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--ec-muted)] font-mono">
                        —
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                        {formatCurrency(orderValuation.totalCost)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANAGE STOCK & PRICE (GENERAL & ALL ORDERS) */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Add / Edit Stock Form Card */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-3">
              <h2 className="text-sm sm:text-base font-black text-[var(--ec-foreground)] flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <span>{isEditingStock ? 'Edit Material Stock & Price Entry' : 'Add Material to Warehouse Stock'}</span>
              </h2>
              {isEditingStock && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingStock(false);
                    setSelectedStockId(null);
                    setStockForm({
                      orderId: '',
                      sku: '',
                      item: '',
                      quantity: '',
                      unit: getMaterialUnit(),
                      unitPrice: '',
                      totalPrice: '',
                      reorderLevel: '',
                      location: '',
                      category: '',
                    });
                  }}
                  className="text-xs font-bold text-red-400 hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleStockSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Destination / Order Allocation Section */}
              <div className="col-span-full p-3.5 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-transparent space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <span>📦</span> Destination / Order Allocation (Optional):
                  </label>
                  <span className="text-[11px] font-bold text-[var(--ec-muted)]">
                    {stockForm.orderId ? '✓ Will be added directly to Selected Order Materials' : '✓ Will be added to General Factory Inventory'}
                  </span>
                </div>
                <select
                  value={stockForm.orderId}
                  onChange={(e) => setStockForm({ ...stockForm, orderId: e.target.value })}
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 shadow-sm"
                >
                  <option value="">🏢 General Factory Inventory (Unassigned / Standard Stock)</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      📦 Order #{o.orderNumber} &bull; {o.buyerName} ({o.articleName || 'Item'} - {o.quantity} {o.unit || 'pairs'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Material Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Material Name *</label>
                <input
                  type="text"
                  required
                  value={stockForm.item}
                  onChange={(e) => setStockForm({ ...stockForm, item: e.target.value })}
                  placeholder="e.g. PU Leather, Eva Outsole, Mesh Fabric..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* SKU */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">SKU / Code (Optional)</label>
                <input
                  type="text"
                  value={stockForm.sku}
                  onChange={(e) => setStockForm({ ...stockForm, sku: e.target.value })}
                  placeholder="Auto-generated if blank"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Quantity & Unit */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Quantity & Unit *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    value={stockForm.quantity}
                    onChange={(e) => handleStockQuantityChange(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                  <select
                    value={stockForm.unit}
                    onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                    className="w-28 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  >
                    {Array.from(new Set([stockForm.unit, ...DEFAULT_MATERIAL_UNITS])).filter(Boolean).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two-Way Pricing Block: Unit Price & Total Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-cyan-400">Unit Price / Rate (৳)</label>
                    <span className="text-[10px] text-[var(--ec-muted)]">Per Unit</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockForm.unitPrice}
                    onChange={(e) => handleStockUnitPriceChange(e.target.value)}
                    placeholder="e.g. 150"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-emerald-400">Total Price / Cost (৳)</label>
                    <span className="text-[10px] text-emerald-400 font-bold">Qty × Rate</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stockForm.totalPrice}
                    onChange={(e) => handleStockTotalPriceChange(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full rounded-xl border border-emerald-500/40 bg-[var(--ec-surface)] px-3 py-2 text-xs font-black text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Warehouse Location</label>
                <input
                  type="text"
                  value={stockForm.location}
                  onChange={(e) => setStockForm({ ...stockForm, location: e.target.value })}
                  placeholder="e.g. Shelf A-3, Rack 2, Bin 10"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Category</label>
                <input
                  type="text"
                  value={stockForm.category}
                  onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}
                  placeholder="e.g. Upper, Lining, Sole, Packaging..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="col-span-full flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : (isEditingStock ? 'Save Changes' : '+ Add to Stock')}
                </button>
              </div>
            </form>
          </div>

          {/* All Stocks List with Filter */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-black text-[var(--ec-foreground)] flex items-center gap-2">
                <Boxes className="h-4 w-4 text-cyan-400" />
                <span>Warehouse Inventory ({filteredStocks.length} Items):</span>
              </h2>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStockOrderFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    stockOrderFilter === 'all'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] border border-[var(--ec-border)]'
                  }`}
                >
                  All ({stocks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockOrderFilter('general')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    stockOrderFilter === 'general'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] border border-[var(--ec-border)]'
                  }`}
                >
                  🏢 General Stock ({stocks.filter((s) => !s.orderId && !s.orderNumber).length})
                </button>
                <button
                  type="button"
                  onClick={() => setStockOrderFilter('orders')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    stockOrderFilter === 'orders'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] border border-[var(--ec-border)]'
                  }`}
                >
                  📦 Order-Specific ({stocks.filter((s) => !!s.orderId || !!s.orderNumber).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStocks.map((stock) => {
                const unitRate = stock.unitPrice || 0;
                const itemTotal = stock.totalPrice || (stock.quantity * unitRate);

                return (
                  <div
                    key={stock.id}
                    className="p-4 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] hover:border-cyan-500/40 transition space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-[var(--ec-foreground)] truncate">
                          {stock.item}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                            {stock.sku}
                          </span>
                          <span className="text-[10px] text-[var(--ec-muted)] font-bold px-1.5 py-0.2 rounded bg-[var(--ec-card)]">
                            {stock.category || 'General'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 block">
                          {stock.quantity.toLocaleString()} {stock.unit || materialUnit}
                        </span>
                        {unitRate > 0 && (
                          <span className="text-[10px] font-mono font-bold text-cyan-400 block mt-0.5">
                            {formatCurrency(unitRate)} / {stock.unit || materialUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Total Amount Badge */}
                    {itemTotal > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                        <span className="text-emerald-300 font-bold">Total Stock Value:</span>
                        <strong className="font-mono font-black text-emerald-400">{formatCurrency(itemTotal)}</strong>
                      </div>
                    )}

                    {/* Linked Order Badge with 1-click jump to Order-Wise Materials */}
                    {stock.orderNumber ? (
                      <div
                        onClick={() => {
                          if (stock.orderId) setSelectedOrderId(stock.orderId);
                          setActiveTab('order-wise');
                        }}
                        className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between text-[11px] cursor-pointer hover:bg-cyan-500/20 transition group/badge"
                        title="Click to view in Order-Wise Materials"
                      >
                        <span className="text-cyan-300 font-bold flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" /> Order #{stock.orderNumber}
                        </span>
                        <span className="text-[var(--ec-muted)] group-hover/badge:text-cyan-400 transition truncate max-w-[110px]">
                          {stock.buyerName} &rarr;
                        </span>
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-[var(--ec-card)] border border-[var(--ec-border)] text-[10px] text-[var(--ec-muted)] font-semibold flex items-center gap-1">
                        <span>🏢 General Factory Inventory</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--ec-border)] text-xs text-[var(--ec-muted)]">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-cyan-400" /> {stock.location || 'Warehouse'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditStock(stock)}
                          className="p-1 rounded-lg hover:bg-cyan-500/15 text-[var(--ec-muted)] hover:text-cyan-400 transition"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStock(stock)}
                          className="p-1 rounded-lg hover:bg-red-500/15 text-[var(--ec-muted)] hover:text-red-400 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RECEIVE MATERIALS */}
      {/* ========================================================================= */}
      {activeTab === 'receive' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Receive Form */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-black text-[var(--ec-foreground)] flex items-center gap-2 border-b border-[var(--ec-border)] pb-3">
              <Inbox className="h-4 w-4 text-cyan-400" />
              <span>Record New Material Receipt with Price</span>
            </h2>

            <form onSubmit={handleReceiveSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Source Selection */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Material Source *</label>
                <select
                  value={receiveForm.source}
                  onChange={(e) => setReceiveForm({ ...receiveForm, source: e.target.value as 'Buyer' | 'Own Purchase' })}
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                >
                  <option value="Buyer">From Buyer (Customer Supplied)</option>
                  <option value="Own Purchase">Factory Own Purchase</option>
                </select>
              </div>

              {/* Order Association */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Assign to Buyer Order (Optional)</label>
                <select
                  value={receiveForm.orderId}
                  onChange={(e) => setReceiveForm({ ...receiveForm, orderId: e.target.value })}
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                >
                  <option value="">No Specific Order (General Stock)</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} &bull; {o.buyerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buyer Selector if source is Buyer and no order selected */}
              {receiveForm.source === 'Buyer' && !receiveForm.orderId && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[var(--ec-muted)]">Select Buyer</label>
                  <select
                    value={receiveForm.buyerId}
                    onChange={(e) => setReceiveForm({ ...receiveForm, buyerId: e.target.value })}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Choose a buyer...</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.company})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Material Name */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Material Name *</label>
                <input
                  type="text"
                  required
                  value={receiveForm.item}
                  onChange={(e) => setReceiveForm({ ...receiveForm, item: e.target.value })}
                  placeholder="e.g. Genuine Leather, Rubber Sole..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Quantity & Unit */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Received Quantity *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    value={receiveForm.quantity}
                    onChange={(e) => handleReceiveQuantityChange(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                  <select
                    value={receiveForm.unit}
                    onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value })}
                    className="w-28 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  >
                    {Array.from(new Set([receiveForm.unit, ...DEFAULT_MATERIAL_UNITS])).filter(Boolean).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two-Way Pricing Block: Unit Price & Total Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:col-span-2 lg:col-span-2 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-cyan-400">Unit Price / Rate (৳)</label>
                    <span className="text-[10px] text-[var(--ec-muted)]">Per Unit</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiveForm.unitPrice}
                    onChange={(e) => handleReceiveUnitPriceChange(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-emerald-400">Total Price / Cost (৳)</label>
                    <span className="text-[10px] text-emerald-400 font-bold">Qty × Rate</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={receiveForm.totalPrice}
                    onChange={(e) => handleReceiveTotalPriceChange(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full rounded-xl border border-emerald-500/40 bg-[var(--ec-surface)] px-3 py-2 text-xs font-black text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Storage Location</label>
                <input
                  type="text"
                  value={receiveForm.location}
                  onChange={(e) => setReceiveForm({ ...receiveForm, location: e.target.value })}
                  placeholder="e.g. Shelf B-2, Warehouse 1"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Notes */}
              <div className="col-span-full space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Receipt Notes / Challan No.</label>
                <input
                  type="text"
                  value={receiveForm.notes}
                  onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                  placeholder="e.g. Challan #CH-882, Inspected and approved"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="col-span-full flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Recording Receipt...' : 'Receive & Add to Stock'}
                </button>
              </div>
            </form>
          </div>

          {/* Receipt Logs History */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-[var(--ec-foreground)] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <span>Material Receiving History ({receivals.length} Logs):</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {receivals.map((r) => {
                const unitRate = r.unitPrice || 0;
                const totalCost = r.totalPrice || (r.quantity * unitRate);

                return (
                  <div key={r.id} className="p-3.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-[var(--ec-foreground)]">{r.item}</span>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                          +{r.quantity} {r.unit || materialUnit}
                        </span>
                        {totalCost > 0 && (
                          <span className="text-[10px] font-mono font-bold text-cyan-400 block mt-0.5">
                            {formatCurrency(totalCost)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--ec-muted)]">
                      <span>Source: <strong className={r.source === 'Buyer' ? 'text-blue-400' : 'text-emerald-400'}>{r.source}</strong> {r.buyerName ? `(${r.buyerName})` : ''}</span>
                      {r.orderNumber && (
                        <span className="text-cyan-400 font-mono font-bold">Order #{r.orderNumber}</span>
                      )}
                    </div>

                    {r.notes && (
                      <p className="text-[10px] text-[var(--ec-muted)] italic">"{r.notes}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Order Material Modal (With Two-Way Unit Price & Total Price) */}
      {showAddOrderMaterialModal && currentOrder && (
        <div
          onClick={() => setShowAddOrderMaterialModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-[var(--ec-card)] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
              <span className="font-extrabold text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-cyan-400" /> Allocate Material for Order #{currentOrder.orderNumber}
              </span>
              <button
                type="button"
                onClick={() => setShowAddOrderMaterialModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddOrderMaterial} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Material Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={orderMaterialForm.item}
                  onChange={(e) => setOrderMaterialForm({ ...orderMaterialForm, item: e.target.value })}
                  placeholder="e.g. Upper Mesh Fabric, Outsole, Thread..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[var(--ec-muted)]">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={orderMaterialForm.quantity}
                    onChange={(e) => handleOrderMaterialQuantityChange(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[var(--ec-muted)]">Unit</label>
                  <select
                    value={orderMaterialForm.unit}
                    onChange={(e) => setOrderMaterialForm({ ...orderMaterialForm, unit: e.target.value })}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  >
                    {Array.from(new Set([orderMaterialForm.unit, ...DEFAULT_MATERIAL_UNITS])).filter(Boolean).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two-Way Pricing Block: Unit Price & Total Price */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5">
                <div className="space-y-1">
                  <label className="block text-xs font-black text-cyan-400">Unit Price (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderMaterialForm.unitPrice}
                    onChange={(e) => handleOrderMaterialUnitPriceChange(e.target.value)}
                    placeholder="e.g. 250"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-black text-emerald-400">Total Price (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderMaterialForm.totalPrice}
                    onChange={(e) => handleOrderMaterialTotalPriceChange(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full rounded-xl border border-emerald-500/40 bg-[var(--ec-surface)] px-3 py-2 text-xs font-black text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Category</label>
                <input
                  type="text"
                  value={orderMaterialForm.category}
                  onChange={(e) => setOrderMaterialForm({ ...orderMaterialForm, category: e.target.value })}
                  placeholder="e.g. Upper, Lining, Sole, Eyelets"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2 text-xs text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[var(--ec-muted)]">Storage Location</label>
                <input
                  type="text"
                  value={orderMaterialForm.location}
                  onChange={(e) => setOrderMaterialForm({ ...orderMaterialForm, location: e.target.value })}
                  placeholder="e.g. Section A, Rack 3"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2 text-xs text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddOrderMaterialModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !orderMaterialForm.item.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : 'Save Material & Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WarehousePage;
