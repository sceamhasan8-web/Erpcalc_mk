"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import type { ProductionFlow, BuyerOrder, BuyerOrderItem, Department } from '@/types';
import { 
  Factory, 
  CheckCircle2, 
  Clock, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  Trash2, 
  Calendar, 
  Package, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Image as ImageIcon,
  PlusCircle,
  BarChart3,
  ListOrdered,
  Filter,
  ArrowRight
} from 'lucide-react';

const GENDER_CATEGORIES = [
  { id: 'mens' as const, label: "Men's", rangeText: '40# - 46#', sizes: [40, 41, 42, 43, 44, 45, 46] },
  { id: 'womens' as const, label: "Women's", rangeText: '35# - 41#', sizes: [35, 36, 37, 38, 39, 40, 41] },
  { id: 'both' as const, label: "Men's & Women's", rangeText: '35# - 46#', sizes: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46] },
];

export function ProductionPage() {
  const defaultProductionUnit = useProductionUnit();
  const { showAlert, showConfirm, toast } = useModal();

  const [flows, setFlows] = useState<ProductionFlow[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Active navigation view: defaults to 'history' (Production Entry List)
  const [activeTab, setActiveTab] = useState<'history' | 'entry' | 'monitoring'>('history');

  // Helper for current date and time strings
  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentTimeString = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Form states
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getTodayDateString);
  const [entryTime, setEntryTime] = useState<string>(getCurrentTimeString);
  const [sizeQuantities, setSizeQuantities] = useState<Record<number, string>>({});
  const [directQuantity, setDirectQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

  // Filtering & view tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [historyDeptFilter, setHistoryDeptFilter] = useState<string>('all');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [productionViewMode, setProductionViewMode] = useState<'total' | 'size'>('total');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Load initial data and live real-time subscriptions
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        const [ordersData, flowsData, deptsData] = await Promise.all([
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
          apiService.getDepartments(),
        ]);
        setBuyerOrders(ordersData);
        setFlows(flowsData);
        const validDepts = deptsData
          .filter((d) => d.name.toLowerCase() !== 'warehouse')
          .map((d) => d.name);
        setDepartments(validDepts);
        if (ordersData.length > 0) {
          setSelectedOrderId(ordersData[0].id);
        }
      } catch (error) {
        console.error('Failed to load production data', error);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();

    const unsubOrders = firebaseService.subscribeOrders((liveOrders) => {
      if (liveOrders && Array.isArray(liveOrders)) {
        setBuyerOrders(liveOrders);
      }
    });

    const unsubFlows = firebaseService.subscribeProductionFlows((liveFlows) => {
      if (liveFlows && Array.isArray(liveFlows)) {
        setFlows(liveFlows);
      }
    });

    const unsubDepts = firebaseService.subscribeDepartments((liveDepts) => {
      if (liveDepts && Array.isArray(liveDepts) && liveDepts.length > 0) {
        setDepartments(liveDepts.filter((d) => d.name.toLowerCase() !== 'warehouse').map((d) => d.name));
      }
    });

    const handleLocalSync = () => {
      apiService.getProductionFlows().then(setFlows).catch(() => {});
      apiService.getBuyerOrders().then(setBuyerOrders).catch(() => {});
    };
    window.addEventListener('erp:productionFlowsUpdated', handleLocalSync);
    window.addEventListener('erp:buyerOrdersUpdated', handleLocalSync);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubDepts();
      window.removeEventListener('erp:productionFlowsUpdated', handleLocalSync);
      window.removeEventListener('erp:buyerOrdersUpdated', handleLocalSync);
    };
  }, []);

  // Deduplicate orders
  const uniqueOrders = useMemo(() => {
    const seen = new Set<string>();
    const list: BuyerOrder[] = [];
    for (const o of buyerOrders) {
      const key = o.id || o.orderNumber;
      if (key && !seen.has(key) && (!o.orderNumber || !seen.has(o.orderNumber))) {
        seen.add(key);
        if (o.orderNumber) seen.add(o.orderNumber);
        list.push(o);
      }
    }
    return list;
  }, [buyerOrders]);

  // Selected Order for Entry
  const selectedOrder = useMemo(() => {
    return uniqueOrders.find((o) => o.id === selectedOrderId) || uniqueOrders[0] || null;
  }, [uniqueOrders, selectedOrderId]);

  // Normalized items of the selected order
  const orderItems = useMemo((): BuyerOrderItem[] => {
    if (!selectedOrder) return [];
    if (selectedOrder.items && selectedOrder.items.length > 0) {
      return selectedOrder.items;
    }
    // Fallback single-item
    return [
      {
        id: selectedOrder.id,
        articleId: selectedOrder.articleId,
        articleName: selectedOrder.articleName || 'Standard Item',
        color: selectedOrder.color || 'Standard',
        genderCategory: selectedOrder.genderCategory || 'mens',
        sizeBreakdown: selectedOrder.sizeBreakdown,
        quantity: selectedOrder.quantity,
        image: selectedOrder.image,
        requiredDepartments: selectedOrder.requiredDepartments,
      },
    ];
  }, [selectedOrder]);

  // Set selected item if changed or reset
  useEffect(() => {
    if (orderItems.length > 0) {
      if (!selectedItemId || !orderItems.some((i) => i.id === selectedItemId)) {
        setSelectedItemId(orderItems[0].id);
      }
    } else {
      setSelectedItemId('');
    }
  }, [orderItems, selectedItemId]);

  // Selected Item
  const selectedItem = useMemo(() => {
    return orderItems.find((i) => i.id === selectedItemId) || orderItems[0] || null;
  }, [orderItems, selectedItemId]);

  // Available departments strictly for the selected item
  const availableDepartments = useMemo(() => {
    if (selectedItem?.requiredDepartments && selectedItem.requiredDepartments.length > 0) {
      return selectedItem.requiredDepartments;
    }

    const itemsWithSpecificDepts = orderItems.filter(
      (it) => it.id !== selectedItem?.id && it.requiredDepartments && it.requiredDepartments.length > 0
    );

    const orderLevelDepts = (selectedOrder?.requiredDepartments || []);

    if (itemsWithSpecificDepts.length === 0) {
      return orderLevelDepts.length > 0
        ? orderLevelDepts
        : departments.length > 0 ? departments : ['Lasting', 'DIP', 'Packing', 'Goods Store'];
    }

    const deptsInAllSpecific = itemsWithSpecificDepts[0].requiredDepartments!.filter((d) =>
      itemsWithSpecificDepts.every((it) => it.requiredDepartments!.includes(d))
    );

    const exclusiveToSpecificItems = new Set(
      itemsWithSpecificDepts
        .flatMap((it) => it.requiredDepartments || [])
        .filter((d) => !deptsInAllSpecific.includes(d))
    );

    const cleaned = orderLevelDepts.filter((d) => !exclusiveToSpecificItems.has(d));
    if (cleaned.length > 0) return cleaned;

    const fallback = (departments.length > 0 ? departments : ['Lasting', 'DIP', 'Packing', 'Goods Store'])
      .filter((d) => !exclusiveToSpecificItems.has(d));
    return fallback.length > 0 ? fallback : ['Lasting', 'DIP', 'Packing', 'Goods Store'];
  }, [selectedItem, selectedOrder, orderItems, departments]);

  // Set default department when item or available departments change
  useEffect(() => {
    if (availableDepartments.length > 0) {
      if (!selectedDepartment || !availableDepartments.includes(selectedDepartment)) {
        setSelectedDepartment(availableDepartments[0]);
      }
    } else {
      setSelectedDepartment('');
    }
  }, [availableDepartments, selectedItemId]);

  // Selected category & sizes config
  const activeCategoryConfig = useMemo(() => {
    const cat = selectedItem?.genderCategory || 'mens';
    return GENDER_CATEGORIES.find((c) => c.id === cat) || GENDER_CATEGORIES[0];
  }, [selectedItem]);

  // Calculate produced breakdown in this department for the selected item
  const itemDeptProduced = useMemo(() => {
    if (!selectedOrder || !selectedDepartment) return { total: 0, bySize: {} as Record<number, number> };

    const itemFlows = flows.filter(
      (f) =>
        f.orderId === selectedOrder.id &&
        f.department === selectedDepartment &&
        (!selectedItem || !f.itemId || f.itemId === selectedItem.id)
    );

    const total = itemFlows.reduce((sum, f) => sum + f.completed, 0);
    const bySize: Record<number, number> = {};

    activeCategoryConfig.sizes.forEach((s) => {
      bySize[s] = itemFlows.reduce((sum, f) => {
        if (f.sizeBreakdown && f.sizeBreakdown[s]) {
          return sum + (Number(f.sizeBreakdown[s]) || 0);
        }
        return sum;
      }, 0);
    });

    return { total, bySize };
  }, [selectedOrder, selectedDepartment, selectedItem, flows, activeCategoryConfig]);

  // Calculate this entry's total quantity
  const currentEntryQuantity = useMemo(() => {
    const sizeTotal = Object.values(sizeQuantities).reduce((sum, val) => sum + (Number(val) || 0), 0);
    if (sizeTotal > 0) return sizeTotal;
    return Number(directQuantity) || 0;
  }, [sizeQuantities, directQuantity]);

  // Handlers for size quantities
  function handleSizeQuantityChange(size: number, val: string) {
    setSizeQuantities((prev) => ({ ...prev, [size]: val }));
    setDirectQuantity('');
  }

  function handleClearSizes() {
    setSizeQuantities({});
    setDirectQuantity('');
  }

  function handleFillRemaining() {
    if (!selectedItem) return;
    const newSizes: Record<number, string> = {};
    if (selectedItem.sizeBreakdown) {
      activeCategoryConfig.sizes.forEach((s) => {
        const target = Number(selectedItem.sizeBreakdown?.[s]) || 0;
        const produced = itemDeptProduced.bySize[s] || 0;
        const rem = Math.max(0, target - produced);
        if (rem > 0) {
          newSizes[s] = String(rem);
        }
      });
    } else {
      const target = selectedItem.quantity || 0;
      const rem = Math.max(0, target - itemDeptProduced.total);
      setDirectQuantity(String(rem));
      return;
    }
    setSizeQuantities(newSizes);
    setDirectQuantity('');
  }

  // Submit production entry
  async function handleSubmitEntry(e: FormEvent) {
    e.preventDefault();

    if (!selectedOrder) {
      showAlert({ title: 'No Order Selected', message: 'Please select an order to proceed.', type: 'warning' });
      return;
    }

    if (!selectedDepartment) {
      showAlert({ title: 'No Department', message: 'Please select a production department.', type: 'warning' });
      return;
    }

    if (currentEntryQuantity <= 0) {
      showAlert({
        title: 'Zero Quantity',
        message: 'Please enter output count for at least one size or set the total quantity.',
        type: 'warning',
      });
      return;
    }

    // Process size breakdown
    const numericSizeBreakdown: Record<string, number> = {};
    activeCategoryConfig.sizes.forEach((s) => {
      const val = Number(sizeQuantities[s]);
      if (!isNaN(val) && val > 0) {
        numericSizeBreakdown[String(s)] = val;
      }
    });

    // Construct ISO Date string from selected entryDate and entryTime
    let finalDate = new Date();
    if (entryDate) {
      const dateParts = entryDate.split('-').map(Number);
      if (dateParts.length === 3) {
        finalDate.setFullYear(dateParts[0], dateParts[1] - 1, dateParts[2]);
      }
    }
    if (entryTime) {
      const timeParts = entryTime.split(':').map(Number);
      if (timeParts.length >= 2) {
        finalDate.setHours(timeParts[0], timeParts[1], 0, 0);
      }
    }

    try {
      const flowPayload: Omit<ProductionFlow, 'id'> = {
        orderId: selectedOrder.id,
        department: selectedDepartment,
        completed: currentEntryQuantity,
        pending: 0,
        rejected: 0,
        updatedAt: finalDate.toISOString(),
        itemId: selectedItem?.id,
        articleName: selectedItem?.articleName || selectedOrder.articleName,
        color: selectedItem?.color || selectedOrder.color,
        genderCategory: selectedItem?.genderCategory || selectedOrder.genderCategory,
        sizeBreakdown: Object.keys(numericSizeBreakdown).length > 0 ? numericSizeBreakdown : undefined,
        notes: notes.trim() || undefined,
      };

      const created = await apiService.createProductionFlow(flowPayload);
      setFlows((prev) => [created, ...prev]);

      const displayDateStr = finalDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
      const displayTimeStr = finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      toast.success(
        `Recorded ${currentEntryQuantity} ${selectedOrder.unit || defaultProductionUnit} for ${selectedDepartment} (${displayDateStr} at ${displayTimeStr})!`
      );

      // Reset entry inputs
      setSizeQuantities({});
      setDirectQuantity('');
      setNotes('');
      setEntryDate(getTodayDateString());
      setEntryTime(getCurrentTimeString());

      // Automatically switch back to history view to see the new entry at the top
      setActiveTab('history');
    } catch (error) {
      console.error('Failed to save production flow', error);
      showAlert({
        title: 'Save Failed',
        message: 'Unable to save production entry. Please try again.',
        type: 'error',
      });
    }
  }

  // Delete production log
  async function handleDeleteFlow(flow: ProductionFlow) {
    const matchedOrder = uniqueOrders.find((o) => o.id === flow.orderId);
    const orderDisplay = matchedOrder?.orderNumber ? `Order #${matchedOrder.orderNumber}` : 'Selected Order';
    const unit = matchedOrder?.unit || defaultProductionUnit;
    const { date, time } = formatDateTime(flow.updatedAt);

    const confirmed = await showConfirm({
      title: 'Delete Production Entry?',
      message: `Are you sure you want to delete this production entry?\n\n• ${orderDisplay} (${matchedOrder?.buyerName || 'Buyer'})\n• Department: ${flow.department}\n• Output Quantity: ${flow.completed} ${unit}\n• Recorded: ${date} ${time}\n\nThis will remove the record and adjust the department progress accordingly.`,
      type: 'danger',
      confirmText: 'Yes, Delete Entry',
      cancelText: 'Cancel',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteProductionFlow(flow.id);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
      toast.success(`Production entry (${flow.completed} ${unit} for ${flow.department}) deleted successfully.`);
    } catch (error) {
      console.error('Failed to delete production flow', error);
      showAlert({ title: 'Delete Failed', message: 'Unable to delete entry. Please try again.', type: 'error' });
    }
  }

  function toggleExpandOrder(orderId: string) {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  // Production statistics
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayFlows = flows.filter((f) => {
      if (!f.updatedAt) return false;
      const d = new Date(f.updatedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    const todayQty = todayFlows.reduce((sum, f) => sum + f.completed, 0);
    const totalQty = flows.reduce((sum, f) => sum + f.completed, 0);
    const activeOrdersCount = uniqueOrders.filter((o) => o.status !== 'Completed').length;

    return { todayQty, totalQty, totalEntries: flows.length, activeOrdersCount };
  }, [flows, uniqueOrders]);

  // Filtered & Sorted Production Logs (Sorted newest first)
  const sortedAndFilteredFlows = useMemo(() => {
    let list = [...flows].sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    // Department filter
    if (historyDeptFilter !== 'all') {
      list = list.filter((f) => f.department === historyDeptFilter);
    }

    // Date range filter (Start Date & End Date)
    if (historyStartDate) {
      const [sYear, sMonth, sDay] = historyStartDate.split('-').map(Number);
      const startDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
      list = list.filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        return d.getTime() >= startDate.getTime();
      });
    }

    if (historyEndDate) {
      const [eYear, eMonth, eDay] = historyEndDate.split('-').map(Number);
      const endDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      list = list.filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        return d.getTime() <= endDate.getTime();
      });
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((f) => {
        const order = uniqueOrders.find((o) => o.id === f.orderId);
        return (
          f.department?.toLowerCase().includes(q) ||
          f.articleName?.toLowerCase().includes(q) ||
          f.color?.toLowerCase().includes(q) ||
          f.notes?.toLowerCase().includes(q) ||
          order?.orderNumber?.toLowerCase().includes(q) ||
          order?.buyerName?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [flows, historyDeptFilter, historyStartDate, historyEndDate, searchQuery, uniqueOrders]);

  // Date range display label
  const dateRangeLabel = useMemo(() => {
    if (!historyStartDate && !historyEndDate) return null;
    if (historyStartDate && historyEndDate) {
      const [sy, sm, sd] = historyStartDate.split('-').map(Number);
      const [ey, em, ed] = historyEndDate.split('-').map(Number);
      const s = new Date(sy, sm - 1, sd).toLocaleDateString([], { day: 'numeric', month: 'short' });
      const e = new Date(ey, em - 1, ed).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      return `${s} – ${e}`;
    }
    if (historyStartDate) {
      const [sy, sm, sd] = historyStartDate.split('-').map(Number);
      const s = new Date(sy, sm - 1, sd).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      return `From ${s}`;
    }
    if (historyEndDate) {
      const [ey, em, ed] = historyEndDate.split('-').map(Number);
      const e = new Date(ey, em - 1, ed).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
      return `Until ${e}`;
    }
    return null;
  }, [historyStartDate, historyEndDate]);

  // Helper date formatter
  function formatDateTime(isoString?: string) {
    if (!isoString) return { date: 'N/A', time: '', isToday: false };
    const dateObj = new Date(isoString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(isoString);
    checkDate.setHours(0, 0, 0, 0);

    const isToday = checkDate.getTime() === today.getTime();
    const dateStr = isToday
      ? 'Today'
      : dateObj.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    const timeStr = dateObj.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return { date: dateStr, time: timeStr, isToday };
  }

  return (
    <div className="min-h-screen bg-[var(--ec-background)] text-[var(--ec-foreground)] py-4 sm:py-6 px-3 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Quick Navigation Bar */}
        <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-3.5 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20">
                <Factory className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-black text-[var(--ec-foreground)] tracking-tight">
                  Production Management
                </h1>
                <p className="text-xs text-[var(--ec-muted)]">
                  Record daily multi-department outputs, size-wise matrix, and track progress
                </p>
              </div>
            </div>

            {/* View Mode Switching Tabs (History / New Entry / Order Progress) */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl sm:rounded-2xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`py-2 px-2 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Logs</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-black/20 text-white">
                  {flows.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('entry')}
                className={`py-2 px-2 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'entry'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25'
                    : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] sm:bg-cyan-500/10 sm:text-cyan-400 sm:border sm:border-cyan-500/25 hover:sm:bg-cyan-500/20'
                }`}
              >
                <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">New Entry</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`py-2 px-2 sm:px-4 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'monitoring'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] sm:border sm:border-[var(--ec-border)] sm:bg-[var(--ec-surface)]'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">Orders</span>
              </button>
            </div>
          </div>

          {/* Quick KPI Stats Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm">
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Today's Output</p>
              <p className="text-base sm:text-2xl font-black text-cyan-400 mt-0.5 sm:mt-1 truncate">
                {stats.todayQty.toLocaleString()} <span className="text-[11px] sm:text-xs font-normal text-[var(--ec-muted)]">{defaultProductionUnit}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm">
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Total Output</p>
              <p className="text-base sm:text-2xl font-black text-emerald-400 mt-0.5 sm:mt-1 truncate">
                {stats.totalQty.toLocaleString()} <span className="text-[11px] sm:text-xs font-normal text-[var(--ec-muted)]">{defaultProductionUnit}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm">
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Total Entries</p>
              <p className="text-base sm:text-2xl font-black text-[var(--ec-foreground)] mt-0.5 sm:mt-1 truncate">
                {stats.totalEntries} <span className="text-[11px] sm:text-xs font-normal text-[var(--ec-muted)]">logs</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm">
              <p className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Active Orders</p>
              <p className="text-base sm:text-2xl font-black text-amber-400 mt-0.5 sm:mt-1 truncate">
                {stats.activeOrdersCount} <span className="text-[11px] sm:text-xs font-normal text-[var(--ec-muted)]">running</span>
              </p>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: PRODUCTION LOGS / ENTRY LIST (DEFAULT LANDING VIEW) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Filter & Search Toolbar */}
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm space-y-2.5">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Order #, Buyer, Article, Color, Department..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Department Filter */}
                  <select
                    value={historyDeptFilter}
                    onChange={(e) => setHistoryDeptFilter(e.target.value)}
                    className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  {/* Date Range: Start Date */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2.5 py-1.5 focus-within:border-cyan-500">
                    <span className="text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Start Date:</span>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[var(--ec-foreground)] focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Date Range: End Date */}
                  <div className="flex items-center gap-1.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2.5 py-1.5 focus-within:border-cyan-500">
                    <span className="text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">End Date:</span>
                    <input
                      type="date"
                      value={historyEndDate}
                      min={historyStartDate || undefined}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-[var(--ec-foreground)] focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Quick Clear Filter Button */}
                  {(historyStartDate || historyEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryStartDate('');
                        setHistoryEndDate('');
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] hover:bg-[var(--ec-card)] text-red-400 hover:text-red-300 text-xs font-bold transition flex items-center gap-1"
                      title="Clear Date Filter"
                    >
                      <span>✕ Clear</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('entry')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 text-white text-xs font-bold hover:bg-cyan-400 transition shadow-sm ml-auto"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>+ New Entry</span>
                </button>
              </div>
            </div>

            {/* Logs Section Header with Total vs Size-Wise Toggle */}
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--ec-border)] pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <h3 className="font-bold text-xs sm:text-base text-[var(--ec-foreground)] flex items-center gap-2 flex-wrap">
                    <span>Date-Wise Production Output Records ({sortedAndFilteredFlows.length})</span>
                    {dateRangeLabel && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {dateRangeLabel}
                      </span>
                    )}
                  </h3>
                </div>

                {/* View Mode Toggle Switch (Total Production vs Size Wise Production) */}
                <div className="flex items-center p-1 bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-xl self-start sm:self-auto gap-1">
                  <button
                    type="button"
                    onClick={() => setProductionViewMode('total')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      productionViewMode === 'total'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Show Total Production</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductionViewMode('size')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      productionViewMode === 'size'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Show Size Wise Production</span>
                  </button>
                </div>
              </div>

              {sortedAndFilteredFlows.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--ec-surface)] mx-auto flex items-center justify-center text-[var(--ec-muted)]">
                    <Factory className="h-6 w-6 opacity-40" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[var(--ec-muted)]">
                    No production entries match your criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('entry')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 transition"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Record First Production Entry</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW: Touch-Friendly Card List (Shown on screens < 768px) */}
                  <div className="block md:hidden space-y-3">
                    {sortedAndFilteredFlows.map((f) => {
                      const matchedOrder = uniqueOrders.find((o) => o.id === f.orderId);
                      const { date, time, isToday } = formatDateTime(f.updatedAt);
                      const unit = matchedOrder?.unit || defaultProductionUnit;
                      const hasSizes = f.sizeBreakdown && Object.keys(f.sizeBreakdown).length > 0;

                      return (
                        <div
                          key={f.id}
                          className="p-3.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] space-y-2.5 shadow-sm"
                        >
                          {/* Top Row: Order Badge, Department & Delete Button */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                {matchedOrder?.orderNumber || f.orderId}
                              </span>
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                {f.department}
                              </span>
                            </div>

                            {/* Prominent Red Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFlow(f)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-[11px] font-black transition active:scale-95 flex-shrink-0"
                              title="Delete this entry"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>

                          {/* Middle Row: Item Name, Buyer, and Output Display */}
                          <div className="flex items-center justify-between gap-2 border-y border-[var(--ec-border)]/50 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-xs text-[var(--ec-foreground)] truncate">
                                {f.articleName || 'Standard Item'}
                              </p>
                              <p className="text-[10px] text-[var(--ec-muted)] truncate mt-0.5">
                                Buyer: <strong className="text-[var(--ec-foreground)]">{matchedOrder?.buyerName || 'Unknown'}</strong> {f.color ? `• Color: ${f.color}` : ''}
                              </p>
                            </div>

                            {/* Total Badge */}
                            <div className="flex-shrink-0">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                                <span className="font-black text-xs text-emerald-400">
                                  +{f.completed.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-emerald-300 font-bold">
                                  {unit}
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Size-Wise Breakdown Box (Shown when 'Show Size Wise Production' is selected) */}
                          {productionViewMode === 'size' && (
                            <div className="p-2.5 rounded-lg bg-[var(--ec-card)] border border-cyan-500/30 space-y-1.5 animate-fadeIn">
                              <div className="flex items-center justify-between text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                                <span>Size-Wise Production Breakdown:</span>
                                <span className="text-emerald-400 font-black">Total: {f.completed} {unit}</span>
                              </div>

                              {hasSizes ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(f.sizeBreakdown!).map(([sz, qty]) => (
                                    <span
                                      key={sz}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                                    >
                                      <span className="text-[var(--ec-muted)]">{sz}#:</span>
                                      <strong className="text-cyan-400 font-black">{qty}</strong>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-[var(--ec-muted)] italic">
                                  Direct (Non-Sized): <strong className="text-emerald-400">{f.completed} {unit}</strong>
                                </p>
                              )}
                            </div>
                          )}

                          {/* Bottom Row: Date/Time & Notes */}
                          <div className="flex items-center justify-between text-[10px] text-[var(--ec-muted)]">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3 inline text-cyan-400" />
                              <strong className={isToday ? 'text-cyan-400' : 'text-[var(--ec-foreground)]'}>{date}</strong> {time && `(${time})`}
                            </span>

                            {f.notes && (
                              <span className="italic truncate max-w-[140px]" title={f.notes}>
                                "{f.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* DESKTOP VIEW: Full Data Table (Shown on screens >= 768px) */}
                  <div className="hidden md:block overflow-x-auto relative rounded-xl border border-[var(--ec-border)]">
                    <table className="w-full text-left text-xs text-[var(--ec-foreground)]">
                      <thead>
                        <tr className="border-b border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)] uppercase text-[10px] tracking-wider font-bold">
                          <th className="py-3 px-3">Date & Time</th>
                          <th className="py-3 px-3">Order Number</th>
                          <th className="py-3 px-3">Article & Color</th>
                          <th className="py-3 px-3">Department</th>
                          <th className="py-3 px-3">
                            {productionViewMode === 'size' ? 'Size-Wise Output Breakdown' : 'Total Output Entry'}
                          </th>
                          <th className="py-3 px-3">Notes</th>
                          <th className="py-3 px-3 text-center sticky right-0 bg-[var(--ec-surface)] shadow-[-4px_0_6px_rgba(0,0,0,0.1)] z-10 min-w-[90px]">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ec-border)]">
                        {sortedAndFilteredFlows.map((f) => {
                          const matchedOrder = uniqueOrders.find((o) => o.id === f.orderId);
                          const { date, time, isToday } = formatDateTime(f.updatedAt);
                          const unit = matchedOrder?.unit || defaultProductionUnit;
                          const hasSizes = f.sizeBreakdown && Object.keys(f.sizeBreakdown).length > 0;

                          return (
                            <tr key={f.id} className="hover:bg-[var(--ec-surface)]/80 transition group">
                              {/* Date & Time */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className={`font-bold ${isToday ? 'text-cyan-400' : 'text-[var(--ec-foreground)]'}`}>
                                    {date}
                                  </span>
                                  {time && (
                                    <span className="text-[10px] font-mono text-[var(--ec-muted)] flex items-center gap-1 mt-0.5">
                                      <Clock className="h-3 w-3 inline" /> {time}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Order Number & Buyer */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <div>
                                  <span className="font-mono font-extrabold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                    {matchedOrder?.orderNumber || f.orderId}
                                  </span>
                                  <p className="text-[11px] text-[var(--ec-muted)] mt-1 truncate max-w-[140px]">
                                    {matchedOrder?.buyerName || 'Unknown Buyer'}
                                  </p>
                                </div>
                              </td>

                              {/* Article & Color */}
                              <td className="py-3 px-3">
                                <div className="font-bold text-[var(--ec-foreground)]">
                                  {f.articleName || 'Standard Item'}
                                </div>
                                {f.color && (
                                  <div className="text-[11px] text-[var(--ec-muted)] mt-0.5">
                                    Color: <strong className="text-[var(--ec-foreground)]">{f.color}</strong>
                                  </div>
                                )}
                              </td>

                              {/* Department */}
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-lg font-extrabold text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                  {f.department}
                                </span>
                              </td>

                              {/* Output Quantity Column (Total vs Size-Wise) */}
                              <td className="py-3 px-3">
                                {productionViewMode === 'size' ? (
                                  hasSizes ? (
                                    <div className="flex flex-wrap items-center gap-1.5 py-0.5 max-w-[280px]">
                                      {Object.entries(f.sizeBreakdown!).map(([sz, qty]) => (
                                        <span
                                          key={sz}
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-[11px]"
                                        >
                                          <span className="text-[var(--ec-muted)] font-semibold">{sz}#:</span>
                                          <strong className="text-cyan-400 font-bold">{qty}</strong>
                                        </span>
                                      ))}
                                      <span className="text-[10px] font-black text-emerald-400 ml-1">
                                        (={f.completed} {unit})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                                      <span className="text-xs text-[var(--ec-muted)]">Direct:</span>
                                      <span className="font-black text-xs text-emerald-400">{f.completed} {unit}</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 whitespace-nowrap">
                                    <span className="font-black text-sm text-emerald-400">
                                      {f.completed.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-emerald-300 font-bold">
                                      {unit}
                                    </span>
                                  </span>
                                )}
                              </td>

                              {/* Notes */}
                              <td className="py-3 px-3 text-[var(--ec-muted)] max-w-[180px] truncate text-[11px]">
                                {f.notes || '—'}
                              </td>

                              {/* Action - Sticky Right */}
                              <td className="py-3 px-3 text-center whitespace-nowrap sticky right-0 bg-[var(--ec-card)] group-hover:bg-[var(--ec-surface)] shadow-[-4px_0_6px_rgba(0,0,0,0.1)] z-10">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFlow(f)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
                                  title="Delete this entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="text-[11px]">Delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 2: PRODUCTION ENTRY FORM (STEP-BY-STEP RECORDING) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'entry' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Left Column: Order & Item Selection & Input Form (8 cols) */}
            <div className="lg:col-span-8 space-y-5 sm:space-y-6">
              {/* Mobile Quick Status Banner: Pinned Summary of Selected Order */}
              {selectedOrder && (
                <div className="block lg:hidden rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded">
                      {selectedOrder.orderNumber}
                    </span>
                    <span className="text-xs font-black text-cyan-400">
                      Total: {selectedOrder.quantity} {selectedOrder.unit || defaultProductionUnit}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ec-foreground)] font-semibold truncate">
                    Buyer: {selectedOrder.buyerName} &bull; Item: {selectedItem?.articleName} ({selectedItem?.color})
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitEntry} className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-6 shadow-sm space-y-5 sm:space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-cyan-400" />
                    <h2 className="text-sm sm:text-lg font-black text-[var(--ec-foreground)]">
                      New Production Entry
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-bold text-cyan-400 hover:underline transition"
                  >
                    ← Back to Logs
                  </button>
                </div>

                {/* Step 1: Order Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <span>1️⃣</span> Select Order to Produce:
                    </label>
                    {selectedOrder && (
                      <span className="hidden sm:inline text-xs text-[var(--ec-muted)]">
                        Buyer: <strong className="text-[var(--ec-foreground)]">{selectedOrder.buyerName}</strong> &bull; Total: <strong className="text-cyan-400">{selectedOrder.quantity} {selectedOrder.unit || defaultProductionUnit}</strong>
                      </span>
                    )}
                  </div>

                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-xs sm:text-sm text-[var(--ec-foreground)] font-semibold focus:outline-none focus:border-cyan-500"
                  >
                    {uniqueOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} — {o.buyerName || 'Unknown'} — {o.quantity} {o.unit || defaultProductionUnit} ({o.items?.length || 1} Item{o.items && o.items.length > 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Article & Color (Item) Selector */}
                {selectedOrder && orderItems.length > 0 && (
                  <div className="space-y-2.5 pt-4 border-t border-[var(--ec-border)]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>2️⃣</span> Select Article & Color Item:
                      </label>
                      <span className="text-[10px] sm:text-[11px] text-[var(--ec-muted)]">
                        {orderItems.length} variant{orderItems.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {orderItems.map((it) => {
                        const isSelected = selectedItemId === it.id;
                        return (
                          <div
                            key={it.id}
                            onClick={() => setSelectedItemId(it.id)}
                            className={`cursor-pointer rounded-xl border p-2.5 sm:p-3 transition flex items-start gap-2.5 ${
                              isSelected
                                ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-400/40 shadow-sm'
                                : 'border-[var(--ec-border)] bg-[var(--ec-surface)] hover:border-cyan-500/30'
                            }`}
                          >
                            {it.image ? (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage({ src: it.image!, title: `${it.articleName} • ${it.color}` });
                                }}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-cyan-500/30 overflow-hidden flex-shrink-0 bg-black/20"
                              >
                                <img src={it.image} alt={it.articleName} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] flex items-center justify-center text-[var(--ec-muted)] flex-shrink-0">
                                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 opacity-40" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs sm:text-sm text-[var(--ec-foreground)] truncate">{it.articleName}</span>
                                <span className="font-black text-[11px] sm:text-xs text-cyan-400 flex-shrink-0">{it.quantity} {selectedOrder.unit || defaultProductionUnit}</span>
                              </div>
                              <div className="text-[11px] text-[var(--ec-muted)] mt-0.5">
                                Color: <strong className="text-[var(--ec-foreground)]">{it.color}</strong>
                              </div>
                              {it.genderCategory && (
                                <span className="inline-block text-[8px] sm:text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-1">
                                  {it.genderCategory === 'womens' ? "Women's" : it.genderCategory === 'both' ? "Both" : "Men's"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Production Date & Time Selector */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--ec-border)]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <span>3️⃣</span> Select Date & Time:
                    </label>

                    {/* Quick Date Presets */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEntryDate(getTodayDateString())}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          entryDate === getTodayDateString()
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-[var(--ec-surface)] border border-[var(--ec-border)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const y = new Date();
                          y.setDate(y.getDate() - 1);
                          const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                          setEntryDate(yStr);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          (() => {
                            const y = new Date();
                            y.setDate(y.getDate() - 1);
                            const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                            return entryDate === yStr;
                          })()
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-[var(--ec-surface)] border border-[var(--ec-border)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                        }`}
                      >
                        Yesterday
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-[11px] text-[var(--ec-muted)] font-semibold mb-1">
                        Production Date
                      </label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm text-[var(--ec-foreground)] font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-[11px] text-[var(--ec-muted)] font-semibold mb-1">
                        Time (Optional)
                      </label>
                      <input
                        type="time"
                        value={entryTime}
                        onChange={(e) => setEntryTime(e.target.value)}
                        className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm text-[var(--ec-foreground)] font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 4: Department Selector */}
                <div className="space-y-2.5 pt-4 border-t border-[var(--ec-border)]">
                  <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <span>4️⃣</span> Select Production Department:
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableDepartments.map((dept) => {
                      const isSelected = selectedDepartment === dept;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDepartment(dept)}
                          className={`p-2.5 sm:p-3 rounded-xl border text-xs font-bold transition text-left flex flex-col justify-between gap-1 ${
                            isSelected
                              ? 'border-cyan-500 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                              : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-500/40'
                          }`}
                        >
                          <span className="truncate">{dept}</span>
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-cyan-100' : 'text-[var(--ec-muted)]'}`}>
                            Done: {itemDeptProduced.total} / {selectedItem?.quantity || selectedOrder?.quantity || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 5: Size-Wise Production Entry Grid */}
                <div className="space-y-3 pt-4 border-t border-[var(--ec-border)]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>5️⃣</span> Size-Wise Production Output Entry:
                      </label>
                      <p className="text-[11px] text-[var(--ec-muted)] mt-0.5">
                        Category: <strong className="text-[var(--ec-foreground)]">{activeCategoryConfig.label} ({activeCategoryConfig.rangeText})</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleFillRemaining}
                        className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition"
                      >
                        Fill Remaining
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSizes}
                        className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-red-400 transition"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Size Matrix Cards (Mobile: 3 or 4 cols, Desktop: 7 cols) */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {activeCategoryConfig.sizes.map((sz) => {
                      const target = Number(selectedItem?.sizeBreakdown?.[sz]) || 0;
                      const produced = itemDeptProduced.bySize[sz] || 0;
                      const remaining = Math.max(0, target - produced);
                      const currentVal = sizeQuantities[sz] || '';

                      return (
                        <div
                          key={sz}
                          className={`rounded-xl border p-2 flex flex-col items-center justify-between gap-1 transition ${
                            currentVal && Number(currentVal) > 0
                              ? 'border-cyan-500 bg-cyan-500/10'
                              : 'border-[var(--ec-border)] bg-[var(--ec-surface)]'
                          }`}
                        >
                          <span className="text-xs font-black text-[var(--ec-foreground)]">
                            {sz}#
                          </span>

                          <div className="text-[9px] sm:text-[10px] text-center w-full leading-tight border-y border-[var(--ec-border)]/60 py-0.5 space-y-0.5">
                            <p className="text-[var(--ec-muted)]">T: <strong>{target}</strong></p>
                            <p className="text-emerald-400">D: <strong>{produced}</strong></p>
                            <p className="text-amber-400">R: <strong>{remaining}</strong></p>
                          </div>

                          <input
                            type="number"
                            min="0"
                            value={currentVal}
                            onChange={(e) => handleSizeQuantityChange(sz, e.target.value)}
                            placeholder="0"
                            className="w-full text-center font-black text-xs sm:text-sm rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] px-1 py-1 text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Non-sized / direct quantity fallback */}
                  <div className="pt-2 border-t border-[var(--ec-border)] flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] sm:text-xs font-medium text-[var(--ec-muted)]">Direct/Non-Sized:</span>
                      <input
                        type="number"
                        min="0"
                        value={directQuantity}
                        onChange={(e) => {
                          setDirectQuantity(e.target.value);
                          setSizeQuantities({});
                        }}
                        placeholder="0"
                        className="w-20 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] px-2 py-1 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-[11px] text-[var(--ec-muted)]">{selectedOrder?.unit || defaultProductionUnit}</span>
                    </div>

                    <div className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                      <span className="text-[var(--ec-muted)]">This Output:</span>
                      <span className="text-sm sm:text-base font-black text-cyan-400">
                        {currentEntryQuantity} {selectedOrder?.unit || defaultProductionUnit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-semibold text-[var(--ec-muted)]">
                    Production Notes (Optional):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Shift A, Line 2 output"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition transform active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span>RECORD ENTRY ({currentEntryQuantity} {selectedOrder?.unit || defaultProductionUnit})</span>
                </button>
              </form>
            </div>

            {/* Right Column: Live Order Status Overview (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {selectedOrder ? (
                <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 space-y-4 sticky top-6">
                  <div className="flex items-center justify-between border-b border-[var(--ec-border)] pb-3">
                    <div>
                      <span className="text-xs font-mono font-black text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25">
                        {selectedOrder.orderNumber}
                      </span>
                      <p className="font-bold text-xs sm:text-sm text-[var(--ec-foreground)] mt-1 truncate">
                        Buyer: {selectedOrder.buyerName}
                      </p>
                    </div>
                    <span className="text-xs font-extrabold text-cyan-400">
                      {selectedOrder.quantity} {selectedOrder.unit || defaultProductionUnit}
                    </span>
                  </div>

                  {/* Departments Live Progress */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                      Departments Progress
                    </p>

                    <div className="space-y-2">
                      {availableDepartments.map((dept) => {
                        const deptFlows = flows.filter(
                          (f) => f.orderId === selectedOrder.id && f.department === dept
                        );
                        const totalProduced = deptFlows.reduce((sum, f) => sum + f.completed, 0);
                        const pct = Math.min(
                          100,
                          Math.round((totalProduced / (selectedOrder.quantity || 1)) * 100)
                        );

                        return (
                          <div key={dept} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span>{dept}</span>
                              <span className="text-cyan-400 font-mono font-bold text-[11px]">
                                {totalProduced} / {selectedOrder.quantity} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full bg-[var(--ec-surface)] h-2 rounded-full overflow-hidden border border-[var(--ec-border)]">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Size Breakdown in Target Order */}
                  {selectedItem && selectedItem.sizeBreakdown && (
                    <div className="space-y-2 pt-3 border-t border-[var(--ec-border)]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                        {selectedItem.articleName} ({selectedItem.color}) Size Targets
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(selectedItem.sizeBreakdown).map(([sz, qty]) => (
                          <span
                            key={sz}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--ec-surface)] border border-[var(--ec-border)] font-medium"
                          >
                            {sz}#: <strong className="text-cyan-400">{qty}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Entries for Selected Order with Quick Delete */}
                  <div className="space-y-2 pt-3 border-t border-[var(--ec-border)]">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                        Recent Entries ({flows.filter((f) => f.orderId === selectedOrder.id).length})
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="text-[10px] text-cyan-400 hover:underline font-bold"
                      >
                        All Logs →
                      </button>
                    </div>

                    {flows.filter((f) => f.orderId === selectedOrder.id).length === 0 ? (
                      <p className="text-xs text-[var(--ec-muted)] italic py-1">No production entries yet for this order.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {flows
                          .filter((f) => f.orderId === selectedOrder.id)
                          .slice(0, 5)
                          .map((f) => {
                            const { date, time } = formatDateTime(f.updatedAt);
                            return (
                              <div
                                key={f.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--ec-surface)] border border-[var(--ec-border)] text-xs"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-cyan-400 text-xs">{f.department}</span>
                                    <span className="text-[11px] font-bold text-emerald-400">
                                      +{f.completed} {selectedOrder.unit || defaultProductionUnit}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-[var(--ec-muted)] mt-0.5 truncate">
                                    {date} {time && `• ${time}`} {f.notes && `• "${f.notes}"`}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteFlow(f)}
                                  className="flex-shrink-0 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 transition shadow-sm"
                                  title="Delete this mistaken entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 text-center text-sm text-[var(--ec-muted)]">
                  Select an order to view its live progress.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW 3: ORDER COMPLETION & MONITORING VIEW */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm flex items-center justify-between flex-wrap gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter order by number, buyer or article..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] pl-10 pr-4 py-2 text-xs sm:text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="text-xs text-[var(--ec-muted)]">
                Showing <strong className="text-[var(--ec-foreground)]">{uniqueOrders.length}</strong> active orders
              </div>
            </div>

            <div className="space-y-3">
              {uniqueOrders.length === 0 ? (
                <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-8 text-center text-[var(--ec-muted)] text-sm">
                  No orders found.
                </div>
              ) : (
                uniqueOrders.map((order) => {
                  const isExpanded = expandedOrderIds.has(order.id);
                  const orderFlows = flows.filter((f) => f.orderId === order.id);
                  const depts = order.requiredDepartments && order.requiredDepartments.length > 0
                    ? order.requiredDepartments
                    : departments;

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-lg">
                            {order.orderNumber}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-[var(--ec-foreground)]">
                            {order.buyerName}
                          </span>
                          <span className="text-xs font-black text-cyan-400">
                            {order.quantity} {order.unit || defaultProductionUnit}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setActiveTab('entry');
                            }}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-cyan-500 text-white hover:bg-cyan-400 transition flex items-center gap-1 shadow-sm"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span>Entry</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleExpandOrder(order.id)}
                            className="text-xs font-bold text-cyan-400 px-2.5 py-1.5 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 transition flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Hide ▲' : 'Matrix ▼'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Department Progress Chips (Mobile: 2-cols, Desktop: 4-cols) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--ec-border)]/60">
                        {depts.map((d) => {
                          const total = orderFlows.filter((f) => f.department === d).reduce((s, f) => s + f.completed, 0);
                          const pct = Math.min(100, Math.round((total / (order.quantity || 1)) * 100));
                          return (
                            <div key={d} className="rounded-xl bg-[var(--ec-surface)] p-2 sm:p-2.5 text-xs border border-[var(--ec-border)]">
                              <div className="flex justify-between font-bold text-[11px] sm:text-xs">
                                <span className="truncate">{d}</span>
                                <span className="text-cyan-400 font-mono">{pct}%</span>
                              </div>
                              <div className="w-full bg-[var(--ec-card)] h-1.5 rounded-full overflow-hidden mt-1.5 border border-[var(--ec-border)]/60">
                                <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="text-[9px] sm:text-[10px] text-[var(--ec-muted)] mt-1.5 flex justify-between">
                                <span>Done: {total}</span>
                                <span>Target: {order.quantity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Expanded Size Matrix */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-[var(--ec-border)] space-y-3 animate-fadeIn">
                          <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                            Size-Wise Production Breakdown
                          </p>

                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-2.5">
                              {order.items.map((it) => {
                                const catConfig = GENDER_CATEGORIES.find((c) => c.id === it.genderCategory) || GENDER_CATEGORIES[0];
                                return (
                                  <div key={it.id} className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-2.5 sm:p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold">
                                      <span className="truncate">{it.articleName} &bull; {it.color}</span>
                                      <span className="text-cyan-400 flex-shrink-0">{it.quantity} {order.unit || defaultProductionUnit}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-1 text-xs">
                                      {catConfig.sizes.map((sz) => {
                                        const target = Number(it.sizeBreakdown?.[sz]) || 0;
                                        return (
                                          <span key={sz} className="inline-flex items-center gap-1 rounded bg-[var(--ec-card)] border border-[var(--ec-border)] px-1.5 py-0.5 text-[10px]">
                                            <span className="text-[var(--ec-muted)] font-bold">{sz}#:</span>
                                            <strong className="text-cyan-400">{target}</strong>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--ec-muted)]">No itemized size breakdown found for this order.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full-Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-2xl overflow-hidden shadow-2xl p-3"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--ec-border)]">
              <span className="font-bold text-sm text-[var(--ec-foreground)]">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <img src={previewImage.src} alt={previewImage.title} className="w-full max-h-[70vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionPage;
