"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import type { ProductionFlow, BuyerOrder, BuyerOrderItem, Department, OrderProductionPlan, SectionPlanTarget } from '@/types';
import { 
  Factory, 
  CheckCircle2, 
  Clock, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  Trash2, 
  Pencil,
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
  ArrowRight,
  Target,
  AlertTriangle,
  Sliders
} from 'lucide-react';

const GENDER_CATEGORIES = [
  { id: 'mens' as const, label: "Men's", rangeText: '40# - 46#', sizes: [40, 41, 42, 43, 44, 45, 46] },
  { id: 'womens' as const, label: "Women's", rangeText: '35# - 41#', sizes: [35, 36, 37, 38, 39, 40, 41] },
  { id: 'both' as const, label: "Men's & Women's", rangeText: '35# - 46#', sizes: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46] },
];

const DEFAULT_PROCESSES: Record<string, string[]> = {
  printing: [],
  embossing: [],
};

function isMultiProcessDept(dept: string): boolean {
  const lower = (dept || '').toLowerCase().trim();
  return lower === 'printing' || lower === 'embossing';
}

export function ProductionPage() {
  const defaultProductionUnit = useProductionUnit();
  const { showAlert, showConfirm, toast } = useModal();

  const [flows, setFlows] = useState<ProductionFlow[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [plans, setPlans] = useState<OrderProductionPlan[]>([]);
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
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [customProcesses, setCustomProcesses] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('ec-custom-processes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_PROCESSES;
  });
  const [showAddProcessModal, setShowAddProcessModal] = useState<boolean>(false);
  const [editingProcess, setEditingProcess] = useState<{ oldName: string; newName: string } | null>(null);
  const [newProcessName, setNewProcessName] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getTodayDateString);
  const [entryTime, setEntryTime] = useState<string>(getCurrentTimeString);
  const [sizeQuantities, setSizeQuantities] = useState<Record<number, string>>({});
  const [directQuantity, setDirectQuantity] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = React.useRef<boolean>(false);

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
        const [ordersData, flowsData, deptsData, plansData] = await Promise.all([
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
          apiService.getDepartments(),
          apiService.getProductionPlans(),
        ]);
        setBuyerOrders(ordersData);
        setFlows(flowsData);
        setPlans(plansData);
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

    const unsubPlans = firebaseService.subscribeProductionPlans((livePlans) => {
      if (livePlans && Array.isArray(livePlans)) {
        setPlans(livePlans);
      }
    });

    const handleLocalSync = () => {
      apiService.getProductionFlows().then(setFlows).catch(() => {});
      apiService.getBuyerOrders().then(setBuyerOrders).catch(() => {});
      apiService.getProductionPlans().then(setPlans).catch(() => {});
    };
    window.addEventListener('erp:productionFlowsUpdated', handleLocalSync);
    window.addEventListener('erp:buyerOrdersUpdated', handleLocalSync);
    window.addEventListener('erp:productionPlansUpdated', handleLocalSync);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubDepts();
      unsubPlans();
      window.removeEventListener('erp:productionFlowsUpdated', handleLocalSync);
      window.removeEventListener('erp:buyerOrdersUpdated', handleLocalSync);
      window.removeEventListener('erp:productionPlansUpdated', handleLocalSync);
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
    // 1. If this specific item has custom specific departments configured:
    const validItemDepts = (selectedItem?.requiredDepartments || []).filter((d) =>
      departments.length > 0 ? departments.includes(d) : true
    );

    if (validItemDepts.length > 0) {
      return validItemDepts;
    }

    // 2. If no item-specific customization, automatically use the Order's Required Departments:
    const validOrderDepts = (selectedOrder?.requiredDepartments || []).filter((d) =>
      departments.length > 0 ? departments.includes(d) : true
    );

    if (validOrderDepts.length > 0) {
      return validOrderDepts;
    }

    // 3. Fallback: Active departments list from system
    return departments;
  }, [selectedItem, selectedOrder, departments]);

  // Available processes for the selected department
  const currentDeptProcesses = useMemo(() => {
    if (!selectedDepartment || !isMultiProcessDept(selectedDepartment)) return [];
    const key = selectedDepartment.toLowerCase().trim();
    const list = customProcesses[key] || DEFAULT_PROCESSES[key] || [];

    const recordedInFlows = flows
      .filter((f) => f.orderId === selectedOrder?.id && f.department === selectedDepartment && f.processName)
      .map((f) => f.processName as string);

    return Array.from(new Set([...list, ...recordedInFlows]));
  }, [selectedDepartment, customProcesses, flows, selectedOrder]);

  // Keep selectedProcess synced when department or processes change
  useEffect(() => {
    if (isMultiProcessDept(selectedDepartment)) {
      if (!selectedProcess || !currentDeptProcesses.includes(selectedProcess)) {
        setSelectedProcess(currentDeptProcesses[0] || '');
      }
    } else {
      setSelectedProcess('');
    }
  }, [selectedDepartment, currentDeptProcesses, selectedProcess]);

  // Helper to calculate completion for any department
  const getDeptCompletion = (deptName: string) => {
    const target = selectedItem?.quantity || selectedOrder?.quantity || 0;
    const deptFlows = flows.filter(
      (f) =>
        f.orderId === selectedOrder?.id &&
        f.department === deptName &&
        (!selectedItem || !f.itemId || f.itemId === selectedItem.id)
    );

    if (isMultiProcessDept(deptName)) {
      const key = deptName.toLowerCase().trim();
      const configuredStages = customProcesses[key] || [];
      const recordedInFlows = Array.from(new Set(deptFlows.map((f) => f.processName).filter(Boolean))) as string[];
      const allActiveStages = Array.from(new Set([...configuredStages, ...recordedInFlows]));

      if (allActiveStages.length === 0) {
        const total = deptFlows.reduce((sum, f) => sum + f.completed, 0);
        return { completed: total, target, isComplete: total >= target && target > 0, processCount: 0 };
      }

      // Calculate output sum for every stage. Any stage with 0 output will bring the minimum to 0.
      const processTotals = allActiveStages.map((p) =>
        deptFlows.filter((f) => f.processName === p).reduce((sum, f) => sum + f.completed, 0)
      );

      // Overall completed count is the minimum across ALL configured stages
      const minCompleted = Math.min(...processTotals);
      const isComplete = processTotals.every((qty) => qty >= target) && target > 0;
      return { completed: minCompleted, target, isComplete, processCount: allActiveStages.length };
    }

    const total = deptFlows.reduce((sum, f) => sum + f.completed, 0);
    return { completed: total, target, isComplete: total >= target && target > 0, processCount: 0 };
  };

  // Helper to calculate progress for a specific process
  const getProcessProgress = (procName: string) => {
    const target = selectedItem?.quantity || selectedOrder?.quantity || 0;
    const pFlows = flows.filter(
      (f) =>
        f.orderId === selectedOrder?.id &&
        f.department === selectedDepartment &&
        (!selectedItem || !f.itemId || f.itemId === selectedItem.id) &&
        f.processName === procName
    );
    const completed = pFlows.reduce((sum, f) => sum + f.completed, 0);
    const remaining = Math.max(0, target - completed);
    const isComplete = completed >= target && target > 0;
    return { completed, target, remaining, isComplete };
  };

  // Selected category & sizes config
  const activeCategoryConfig = useMemo(() => {
    const cat = selectedItem?.genderCategory || 'mens';
    return GENDER_CATEGORIES.find((c) => c.id === cat) || GENDER_CATEGORIES[0];
  }, [selectedItem]);

  // Calculate produced breakdown in this department (and process) for the selected item
  const itemDeptProduced = useMemo(() => {
    if (!selectedOrder || !selectedDepartment) return { total: 0, bySize: {} as Record<number, number> };

    const itemFlows = flows.filter(
      (f) =>
        f.orderId === selectedOrder.id &&
        f.department === selectedDepartment &&
        (!selectedItem || !f.itemId || f.itemId === selectedItem.id) &&
        (!isMultiProcessDept(selectedDepartment) || !selectedProcess || f.processName === selectedProcess)
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
  }, [selectedOrder, selectedDepartment, selectedItem, selectedProcess, flows, activeCategoryConfig]);

  // Current order production plan
  const currentPlan = useMemo(() => {
    if (!selectedOrder) return null;
    return plans.find((p) => p.orderId === selectedOrder.id || p.orderNumber === selectedOrder.orderNumber) || null;
  }, [plans, selectedOrder]);

  // Live calculation of department targets, achieved fill, and due adjustment
  const currentDeptPlanTarget = useMemo(() => {
    if (!selectedDepartment || !selectedOrder) return null;
    const planSection = currentPlan?.sections?.[selectedDepartment];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const deptFlows = flows.filter((f) => f.orderId === selectedOrder.id && f.department === selectedDepartment);
    const totalOutput = deptFlows.reduce((sum, f) => sum + (f.completed || 0), 0);
    
    const todayOutput = deptFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const dt = new Date(f.updatedAt);
        dt.setHours(0, 0, 0, 0);
        return dt.getTime() === today.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const weekOutput = deptFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const dt = new Date(f.updatedAt);
        return dt.getTime() >= monday.getTime() && dt.getTime() <= sunday.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const dailyTarget = planSection?.dailyTarget || Math.ceil((selectedOrder.quantity || 1000) / 10);
    const weeklyTarget = planSection?.weeklyTarget || (dailyTarget * 6);
    const totalTarget = planSection?.totalTarget || selectedOrder.quantity || 1000;

    const todayDue = Math.max(0, dailyTarget - todayOutput);
    const weekDue = Math.max(0, weeklyTarget - weekOutput);
    const totalDue = Math.max(0, totalTarget - totalOutput);

    const dailyPct = dailyTarget > 0 ? Math.min(100, Math.round((todayOutput / dailyTarget) * 100)) : 0;
    const weeklyPct = weeklyTarget > 0 ? Math.min(100, Math.round((weekOutput / weeklyTarget) * 100)) : 0;
    const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalOutput / totalTarget) * 100)) : 0;

    return {
      dailyTarget,
      weeklyTarget,
      totalTarget,
      todayOutput,
      weekOutput,
      totalOutput,
      todayDue,
      weekDue,
      totalDue,
      dailyPct,
      weeklyPct,
      totalPct,
    };
  }, [selectedDepartment, selectedOrder, currentPlan, flows]);

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

  // Handler to add custom process
  function handleAddCustomProcess(e: FormEvent) {
    e.preventDefault();
    const name = newProcessName.trim();
    if (!name || !selectedDepartment) return;
    const key = selectedDepartment.toLowerCase().trim();
    const prevList = customProcesses[key] || [];
    if (!prevList.includes(name)) {
      const updated = { ...customProcesses, [key]: [...prevList, name] };
      setCustomProcesses(updated);
      try {
        window.localStorage.setItem('ec-custom-processes', JSON.stringify(updated));
      } catch (err) {}
    }
    setSelectedProcess(name);
    setNewProcessName('');
    setShowAddProcessModal(false);
    toast.success(`Stage "${name}" added to ${selectedDepartment}!`);
  }

  // Handler to rename a process
  async function handleRenameProcess(e: FormEvent) {
    e.preventDefault();
    if (!editingProcess || !selectedDepartment) return;
    const { oldName, newName } = editingProcess;
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew === oldName) {
      setEditingProcess(null);
      return;
    }

    const key = selectedDepartment.toLowerCase().trim();
    const prevList = customProcesses[key] || [];
    const updatedList = prevList.map((p) => (p === oldName ? trimmedNew : p));
    const updated = { ...customProcesses, [key]: updatedList };
    setCustomProcesses(updated);
    try {
      window.localStorage.setItem('ec-custom-processes', JSON.stringify(updated));
    } catch (err) {}

    // Update in-memory flows and backend if needed
    const matchingFlows = flows.filter((f) => f.department === selectedDepartment && f.processName === oldName);
    if (matchingFlows.length > 0) {
      const updatedFlows = flows.map((f) => {
        if (f.department === selectedDepartment && f.processName === oldName) {
          return { ...f, processName: trimmedNew };
        }
        return f;
      });
      setFlows(updatedFlows);
      for (const f of matchingFlows) {
        try {
          await apiService.updateProductionFlow(f.id, { processName: trimmedNew });
        } catch (err) {
          console.error('Failed to sync updated process name to flow', err);
        }
      }
    }

    if (selectedProcess === oldName) {
      setSelectedProcess(trimmedNew);
    }
    setEditingProcess(null);
    toast.success(`Stage renamed to "${trimmedNew}"!`);
  }

  // Handler to delete a process
  async function handleDeleteProcess(procName: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!selectedDepartment) return;
    const confirmed = await showConfirm({
      title: `Delete Stage "${procName}"?`,
      message: `Are you sure you want to remove the stage "${procName}" from ${selectedDepartment}?`,
      type: 'warning',
    });
    if (!confirmed) return;

    const key = selectedDepartment.toLowerCase().trim();
    const prevList = customProcesses[key] || [];
    const updatedList = prevList.filter((p) => p !== procName);
    const updated = { ...customProcesses, [key]: updatedList };
    setCustomProcesses(updated);
    try {
      window.localStorage.setItem('ec-custom-processes', JSON.stringify(updated));
    } catch (err) {}

    if (selectedProcess === procName) {
      setSelectedProcess(updatedList[0] || '');
    }
    toast.success(`Stage "${procName}" removed from ${selectedDepartment}!`);
  }

  // Submit production entry
  async function handleSubmitEntry(e: FormEvent) {
    e.preventDefault();

    // Prevent multi-click duplicate submissions
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!selectedOrder) {
      showAlert({ title: 'No Order Selected', message: 'Please select an order to proceed.', type: 'warning' });
      return;
    }

    if (!selectedDepartment) {
      showAlert({ title: 'No Department', message: 'Please select a production department.', type: 'warning' });
      return;
    }

    const isMulti = isMultiProcessDept(selectedDepartment);
    if (isMulti && currentDeptProcesses.length > 0 && !selectedProcess) {
      showAlert({ title: 'No Stage Selected', message: `Please select a specific ${selectedDepartment} stage.`, type: 'warning' });
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

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Process size breakdown
    const numericSizeBreakdown: Record<string, number> = {};
    activeCategoryConfig.sizes.forEach((s) => {
      const val = Number(sizeQuantities[s]);
      if (!isNaN(val) && val > 0) {
        numericSizeBreakdown[String(s)] = val;
      }
    });

    // Construct ISO Date string from selected entryDate and entryTime
    const finalDate = new Date();
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
        processName: isMulti ? (selectedProcess || 'General') : undefined,
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
      setFlows((prev) => {
        if (prev.some((f) => f.id === created.id)) return prev;
        return [created, ...prev];
      });

      const displayDateStr = finalDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
      const displayTimeStr = finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const processInfo = isMulti && selectedProcess ? ` (${selectedProcess})` : '';

      toast.success(
        `Recorded ${currentEntryQuantity} ${selectedOrder.unit || defaultProductionUnit} for ${selectedDepartment}${processInfo} (${displayDateStr} at ${displayTimeStr})!`
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
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
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

  // Aggregated Grand Total Statistics for date-wise filtered flows
  const totalProductionStats = useMemo(() => {
    let totalQty = 0;
    const sizeMap: Record<string, number> = {};
    const deptMap: Record<string, number> = {};

    sortedAndFilteredFlows.forEach((f) => {
      const qty = f.completed || 0;
      totalQty += qty;
      if (f.department) {
        deptMap[f.department] = (deptMap[f.department] || 0) + qty;
      }
      if (f.sizeBreakdown) {
        Object.entries(f.sizeBreakdown).forEach(([sz, sQty]) => {
          sizeMap[sz] = (sizeMap[sz] || 0) + (Number(sQty) || 0);
        });
      }
    });

    return {
      totalQty,
      totalEntries: sortedAndFilteredFlows.length,
      sizeBreakdown: sizeMap,
      deptBreakdown: deptMap,
      hasSizes: Object.keys(sizeMap).length > 0,
    };
  }, [sortedAndFilteredFlows]);

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
                              {f.processName && (
                                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                  ⚙️ {f.processName}
                                </span>
                              )}
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
                    {/* Mobile Grand Total Summary Box */}
                    <div className="p-4 rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-[var(--ec-surface)] to-emerald-500/10 shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-cyan-400" />
                          <span className="font-black text-xs uppercase tracking-wider text-[var(--ec-foreground)]">
                            Grand Total Production
                          </span>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          {totalProductionStats.totalEntries} {totalProductionStats.totalEntries === 1 ? 'Entry' : 'Entries'}
                        </span>
                      </div>

                      {/* Total Output Highlight */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ec-card)] border border-emerald-500/25 shadow-inner">
                        <span className="text-xs font-bold text-[var(--ec-muted)]">Total Output Completed:</span>
                        <span className="inline-flex items-center gap-1 font-black text-base text-emerald-400">
                          +{totalProductionStats.totalQty.toLocaleString()}
                          <span className="text-xs text-emerald-300 font-bold">{defaultProductionUnit}</span>
                        </span>
                      </div>

                      {/* Size Breakdown in Mobile if mode is 'size' */}
                      {productionViewMode === 'size' && totalProductionStats.hasSizes && (
                        <div className="pt-2 border-t border-[var(--ec-border)]/60 space-y-1.5">
                          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                            Aggregated Size Breakdown:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(totalProductionStats.sizeBreakdown).map(([sz, qty]) => (
                              <span
                                key={sz}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                              >
                                <span className="text-[var(--ec-muted)]">{sz}#:</span>
                                <strong className="text-cyan-400 font-black">{qty.toLocaleString()}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                                <div className="flex flex-col gap-1 items-start">
                                  <span className="px-2.5 py-1 rounded-lg font-extrabold text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                    {f.department}
                                  </span>
                                  {f.processName && (
                                    <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                      ⚙️ {f.processName}
                                    </span>
                                  )}
                                </div>
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
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/25 text-xs font-bold transition active:scale-95 shadow-sm"
                                  title="Delete this entry"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Metric Footer Card */}
                  <div className="mt-3.5 p-3.5 sm:p-4 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 via-[var(--ec-surface)] to-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-[var(--ec-foreground)]">
                          Total Output Recorded: <span className="text-emerald-400 font-black text-sm">+{totalProductionStats.totalQty.toLocaleString()} {defaultProductionUnit}</span>
                        </div>
                        <div className="text-[11px] text-[var(--ec-muted)]">
                          Showing aggregate from {totalProductionStats.totalEntries} entries across {Object.keys(totalProductionStats.deptBreakdown).length} departments
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                      <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-lg">
                        {dateRangeLabel || 'All Recorded Dates'}
                      </span>
                    </div>
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
                <div className="space-y-1.5">
                  <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <span>1️⃣</span> Select Order to Produce:
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-xs sm:text-sm font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    {uniqueOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber || o.id} — {o.buyerName || 'Buyer'} — {o.quantity} {o.unit || defaultProductionUnit} ({o.items?.length || 1} {o.items?.length === 1 ? 'Item' : 'Items'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Multi-Item / Variant Selector (if order has variants) */}
                {orderItems.length > 1 && (
                  <div className="space-y-2.5 pt-4 border-t border-[var(--ec-border)]">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>2️⃣</span> Select Article & Color Item:
                      </label>
                      <span className="text-[11px] text-[var(--ec-muted)] font-semibold">
                        {orderItems.length} variants
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {orderItems.map((it) => {
                        const isSelected = selectedItemId === it.id;
                        return (
                          <div
                            key={it.id}
                            onClick={() => setSelectedItemId(it.id)}
                            className={`p-3 rounded-2xl border cursor-pointer transition flex items-center gap-3 relative overflow-hidden ${
                              isSelected
                                ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/40 shadow-sm'
                                : 'border-[var(--ec-border)] bg-[var(--ec-surface)]/60 hover:bg-[var(--ec-surface)] hover:border-cyan-500/30'
                            }`}
                          >
                            <div className="w-12 h-12 rounded-xl bg-[var(--ec-card)] border border-[var(--ec-border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {it.image ? (
                                <img src={it.image} alt={it.articleName} className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-[var(--ec-muted)]" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className="font-bold text-xs sm:text-sm text-[var(--ec-foreground)] truncate">
                                  {it.articleName}
                                </p>
                                <span className="text-xs font-black text-cyan-400 flex-shrink-0">
                                  {it.quantity} {selectedOrder?.unit || defaultProductionUnit}
                                </span>
                              </div>

                              <p className="text-[11px] text-[var(--ec-muted)] truncate mt-0.5">
                                Color: <strong className="text-[var(--ec-foreground)]">{it.color}</strong>
                              </p>

                              {it.genderCategory && (
                                <span className="inline-block mt-1 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--ec-card)] text-cyan-400 border border-[var(--ec-border)]">
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
                      const { completed, target, processCount } = getDeptCompletion(dept);
                      const isMulti = isMultiProcessDept(dept);
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDepartment(dept)}
                          className={`p-2.5 sm:p-3 rounded-xl border text-xs font-bold transition text-left flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? 'border-cyan-500 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                              : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{dept}</span>
                            {isMulti && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                              }`}>
                                Multi-Process
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] font-medium ${isSelected ? 'text-cyan-100' : 'text-[var(--ec-muted)]'}`}>
                            Done: <strong className={isSelected ? 'text-white' : 'text-cyan-400'}>{completed}</strong> / {target} {processCount > 1 ? `(${processCount} stages)` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4.5: Multi-Process Stage Selector (For Printing & Embossing) */}
                {isMultiProcessDept(selectedDepartment) && (
                  <div className="space-y-3 pt-4 border-t border-[var(--ec-border)] bg-gradient-to-r from-purple-500/5 via-cyan-500/5 to-blue-500/5 p-3.5 sm:p-4 rounded-2xl border border-cyan-500/30 animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <span>⚙️</span> {selectedDepartment} Stages / Processes:
                        </label>
                        <p className="text-[11px] text-[var(--ec-muted)] mt-0.5">
                          {currentDeptProcesses.length > 0
                            ? `Record production separately for each stage. All stages must be completed for ${selectedDepartment} to be 100% complete.`
                            : `Add multiple stages (e.g. Screen Print, Foil, Emboss) or enter direct output below.`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddProcessModal(true)}
                        className="text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-cyan-500/20"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>+ Add Stage</span>
                      </button>
                    </div>

                    {currentDeptProcesses.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-cyan-500/30 bg-[var(--ec-surface)]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-[var(--ec-foreground)]">No stages added yet for {selectedDepartment}</p>
                          <p className="text-[11px] text-[var(--ec-muted)]">Click "+ Add Stage" to create separate production stages, or record output directly below.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAddProcessModal(true)}
                          className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition whitespace-nowrap"
                        >
                          + Add First Stage
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {currentDeptProcesses.map((proc) => {
                          const isSelected = selectedProcess === proc;
                          const { completed, target, isComplete } = getProcessProgress(proc);
                          const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;

                          return (
                            <div
                              key={proc}
                              onClick={() => setSelectedProcess(proc)}
                              className={`group p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-2.5 relative shadow-sm ${
                                isSelected
                                  ? 'border-cyan-500 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white ring-2 ring-cyan-400 shadow-md shadow-blue-500/20'
                                  : 'border-[var(--ec-border)] bg-[var(--ec-card)] text-[var(--ec-foreground)] hover:border-cyan-500/60 hover:bg-[var(--ec-surface)]'
                              }`}
                            >
                              {/* Top row: Stage Name + Status Badge + Actions */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`text-xs sm:text-sm font-black truncate capitalize ${
                                    isSelected ? 'text-white' : 'text-[var(--ec-foreground)]'
                                  }`}>
                                    {proc}
                                  </span>
                                  {isComplete && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider flex-shrink-0 ${
                                      isSelected ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                    }`}>
                                      ✓ Done
                                    </span>
                                  )}
                                </div>

                                {/* Action Buttons: Rename & Delete */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingProcess({ oldName: proc, newName: proc });
                                    }}
                                    className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                      isSelected
                                        ? 'bg-white/20 hover:bg-white/35 text-white'
                                        : 'bg-[var(--ec-surface)] hover:bg-cyan-500/15 text-[var(--ec-muted)] hover:text-cyan-500 border border-[var(--ec-border)] hover:border-cyan-500/30'
                                    }`}
                                    title="Rename Stage"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteProcess(proc, e)}
                                    className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                      isSelected
                                        ? 'bg-red-500/30 hover:bg-red-500 text-white'
                                        : 'bg-[var(--ec-surface)] hover:bg-red-500/15 text-red-400 hover:text-red-600 border border-[var(--ec-border)] hover:border-red-500/30'
                                    }`}
                                    title="Remove Stage"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                isSelected ? 'bg-white/25' : 'bg-[var(--ec-surface)] border border-[var(--ec-border)]/60'
                              }`}>
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isComplete
                                      ? (isSelected ? 'bg-emerald-300' : 'bg-emerald-500')
                                      : (isSelected ? 'bg-white' : 'bg-cyan-500')
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {/* Bottom Info: Output vs Target & Percentage */}
                              <div className="flex items-center justify-between text-[11px] pt-1">
                                <span className={`font-semibold ${isSelected ? 'text-blue-100' : 'text-[var(--ec-muted)]'}`}>
                                  Output: <strong className={`font-black ${isSelected ? 'text-white' : 'text-[var(--ec-foreground)]'}`}>{completed}</strong> / {target}
                                </span>
                                <span className={`font-mono font-black ${
                                  isComplete
                                    ? (isSelected ? 'text-emerald-300' : 'text-emerald-500')
                                    : (isSelected ? 'text-cyan-100' : 'text-cyan-600 dark:text-cyan-400')
                                }`}>
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* LIVE PRODUCTION PLAN TARGET FILL & DUE TRACKER */}
                {selectedDepartment && currentDeptPlanTarget && (
                  <div className="pt-4 border-t border-[var(--ec-border)] space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <Target className="h-4 w-4" /> {selectedDepartment} Production Target & Due Status:
                      </label>
                      <a
                        href="/planning"
                        className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
                      >
                        <Sliders className="h-3 w-3" />
                        <span>Adjust Plan in Planning</span>
                      </a>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-[var(--ec-surface)] to-slate-900/90 border border-cyan-500/30 space-y-3 shadow-sm">
                      {/* Metric Chips: Daily, Weekly, Total Target Fill */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {/* Daily Fill */}
                        <div className="p-2.5 rounded-xl bg-[var(--ec-card)] border border-[var(--ec-border)]/70 space-y-1">
                          <span className="text-[10px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Today's Target</span>
                          <p className="text-xs sm:text-sm font-black text-cyan-400">
                            {currentDeptPlanTarget.todayOutput} <span className="text-[10px] font-normal text-[var(--ec-muted)]">/ {currentDeptPlanTarget.dailyTarget}</span>
                          </p>
                          <div className="w-full bg-[var(--ec-surface)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${currentDeptPlanTarget.dailyPct}%` }} />
                          </div>
                          <span className="text-[9px] font-black text-cyan-300 block">{currentDeptPlanTarget.dailyPct}% Filled</span>
                        </div>

                        {/* Weekly Fill */}
                        <div className="p-2.5 rounded-xl bg-[var(--ec-card)] border border-[var(--ec-border)]/70 space-y-1">
                          <span className="text-[10px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Week's Target</span>
                          <p className="text-xs sm:text-sm font-black text-blue-400">
                            {currentDeptPlanTarget.weekOutput} <span className="text-[10px] font-normal text-[var(--ec-muted)]">/ {currentDeptPlanTarget.weeklyTarget}</span>
                          </p>
                          <div className="w-full bg-[var(--ec-surface)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-400 h-full rounded-full" style={{ width: `${currentDeptPlanTarget.weeklyPct}%` }} />
                          </div>
                          <span className="text-[9px] font-black text-blue-300 block">{currentDeptPlanTarget.weeklyPct}% Filled</span>
                        </div>

                        {/* Total Order Target & Remaining Due */}
                        <div className="p-2.5 rounded-xl bg-[var(--ec-card)] border border-[var(--ec-border)]/70 space-y-1">
                          <span className="text-[10px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Total Order</span>
                          <p className="text-xs sm:text-sm font-black text-emerald-400">
                            {currentDeptPlanTarget.totalOutput} <span className="text-[10px] font-normal text-[var(--ec-muted)]">/ {currentDeptPlanTarget.totalTarget}</span>
                          </p>
                          <div className="w-full bg-[var(--ec-surface)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${currentDeptPlanTarget.totalPct}%` }} />
                          </div>
                          <span className="text-[9px] font-black text-emerald-300 block">{currentDeptPlanTarget.totalPct}% Filled</span>
                        </div>
                      </div>

                      {/* DUE / SHORTFALL ADJUSTMENT FOOTER */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/20 text-xs">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${currentDeptPlanTarget.todayDue > 0 ? 'text-amber-400 animate-bounce' : 'text-emerald-400'}`} />
                          <div>
                            <span className="font-bold text-[var(--ec-foreground)]">
                              {currentDeptPlanTarget.todayDue > 0 ? `Today's Remaining Due: ${currentDeptPlanTarget.todayDue} ${selectedOrder?.unit || defaultProductionUnit}` : `Today's Daily Target Completed!`}
                            </span>
                            <p className="text-[10px] text-[var(--ec-muted)]">
                              Total Order Remaining Due: <strong className="text-rose-400">{currentDeptPlanTarget.totalDue}</strong> {selectedOrder?.unit || defaultProductionUnit}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          currentDeptPlanTarget.totalDue === 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : currentDeptPlanTarget.todayDue === 0
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {currentDeptPlanTarget.totalDue === 0 ? '✓ Order 100% Done' : currentDeptPlanTarget.todayDue === 0 ? '✓ Day Target Met' : '⚠️ Due Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Size-Wise Production Entry Grid */}
                <div className="space-y-3 pt-4 border-t border-[var(--ec-border)]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>5️⃣</span> Size-Wise Production Output Entry:
                      </label>
                      <p className="text-[11px] text-[var(--ec-muted)] mt-0.5">
                        Category: <strong className="text-[var(--ec-foreground)]">{activeCategoryConfig.label} ({activeCategoryConfig.rangeText})</strong>
                        {isMultiProcessDept(selectedDepartment) && selectedProcess && (
                          <span className="ml-2 font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                            Stage: {selectedProcess}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleFillRemaining}
                        disabled={isSubmitting}
                        className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition disabled:opacity-50"
                      >
                        Fill Remaining
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSizes}
                        disabled={isSubmitting}
                        className="px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-muted)] hover:text-red-400 transition disabled:opacity-50"
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
                            disabled={isSubmitting}
                            onChange={(e) => handleSizeQuantityChange(sz, e.target.value)}
                            placeholder="0"
                            className="w-full text-center font-black text-xs sm:text-sm rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] px-1 py-1 text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 disabled:opacity-50"
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
                        disabled={isSubmitting}
                        onChange={(e) => {
                          setDirectQuantity(e.target.value);
                          setSizeQuantities({});
                        }}
                        placeholder="0"
                        className="w-20 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] px-2 py-1 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 disabled:opacity-50"
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
                    disabled={isSubmitting}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Shift A, Line 2 output"
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || currentEntryQuantity <= 0}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>SAVING PRODUCTION ENTRY...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span>RECORD ENTRY ({currentEntryQuantity} {selectedOrder?.unit || defaultProductionUnit})</span>
                    </>
                  )}
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
                        const { completed: totalProduced, processCount } = getDeptCompletion(dept);
                        const pct = Math.min(
                          100,
                          Math.round((totalProduced / (selectedOrder.quantity || 1)) * 100)
                        );

                        return (
                          <div key={dept} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="flex items-center gap-1.5">
                                <span>{dept}</span>
                                {processCount > 1 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/15 text-purple-400 font-bold">
                                    {processCount} stages
                                  </span>
                                )}
                              </span>
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
                          const isMulti = isMultiProcessDept(d);
                          let total = 0;
                          let stagesText = '';

                          if (isMulti) {
                            const dFlows = orderFlows.filter((f) => f.department === d);
                            const key = d.toLowerCase().trim();
                            const configuredStages = customProcesses[key] || [];
                            const recordedProcesses = Array.from(new Set(dFlows.map((f) => f.processName).filter(Boolean))) as string[];
                            const allStages = Array.from(new Set([...configuredStages, ...recordedProcesses]));

                            if (allStages.length > 0) {
                              const processTotals = allStages.map((proc) =>
                                dFlows.filter((f) => f.processName === proc).reduce((s, f) => s + f.completed, 0)
                              );
                              total = Math.min(...processTotals);
                              stagesText = `(${allStages.length} stages)`;
                            } else {
                              total = dFlows.reduce((s, f) => s + f.completed, 0);
                            }
                          } else {
                            total = orderFlows.filter((f) => f.department === d).reduce((s, f) => s + f.completed, 0);
                          }

                          const orderPlan = plans.find((p) => p.orderId === order.id || p.orderNumber === order.orderNumber);
                          const sPlan = orderPlan?.sections?.[d];
                          const totalTarget = sPlan?.totalTarget || order.quantity || 1;
                          const dailyTarget = sPlan?.dailyTarget || Math.ceil(totalTarget / 10);
                          const pct = Math.min(100, Math.round((total / totalTarget) * 100));
                          const remainingDue = Math.max(0, totalTarget - total);

                          return (
                            <div key={d} className={`rounded-xl p-2 sm:p-2.5 text-xs border transition ${
                              pct >= 100
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : remainingDue > 0
                                ? 'bg-[var(--ec-surface)] border-[var(--ec-border)]'
                                : 'bg-[var(--ec-surface)] border-[var(--ec-border)]'
                            }`}>
                              <div className="flex justify-between font-bold text-[11px] sm:text-xs">
                                <span className="truncate">{d}</span>
                                <span className={pct >= 100 ? 'text-emerald-400 font-mono' : 'text-cyan-400 font-mono'}>{pct}%</span>
                              </div>
                              <div className="w-full bg-[var(--ec-card)] h-1.5 rounded-full overflow-hidden mt-1.5 border border-[var(--ec-border)]/60">
                                <div
                                  className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="text-[9px] sm:text-[10px] text-[var(--ec-muted)] mt-1.5 flex justify-between gap-1 flex-wrap">
                                <span>Done: <strong className="text-[var(--ec-foreground)]">{total}</strong> {stagesText}</span>
                                <span>Target: <strong>{totalTarget}</strong></span>
                              </div>
                              {remainingDue > 0 ? (
                                <div className="text-[9px] font-black text-rose-400 mt-1 flex justify-between border-t border-[var(--ec-border)]/40 pt-1">
                                  <span>Due: {remainingDue}</span>
                                  <span className="text-[var(--ec-muted)] font-normal">Day: {dailyTarget}/d</span>
                                </div>
                              ) : (
                                <div className="text-[9px] font-black text-emerald-400 mt-1 border-t border-emerald-500/20 pt-1">
                                  ✓ Target Completed
                                </div>
                              )}
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

      {/* Add Custom Process Modal */}
      {showAddProcessModal && (
        <div
          onClick={() => setShowAddProcessModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-[var(--ec-card)] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
              <span className="font-extrabold text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                <span>⚙️</span> Add Custom Stage for {selectedDepartment}
              </span>
              <button
                type="button"
                onClick={() => setShowAddProcessModal(false)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCustomProcess} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ec-muted)] mb-1.5">
                  Stage / Process Name:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newProcessName}
                  onChange={(e) => setNewProcessName(e.target.value)}
                  placeholder={`e.g. Screen Print, Gold Foil, Debossing...`}
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2.5 text-xs text-[var(--ec-foreground)] font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProcessModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProcessName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  Add Stage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Rename Process Modal */}
      {editingProcess && (
        <div
          onClick={() => setEditingProcess(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-md w-full bg-[var(--ec-card)] border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)]">
              <span className="font-extrabold text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                <Pencil className="h-4 w-4 text-cyan-400" /> Rename Stage for {selectedDepartment}
              </span>
              <button
                type="button"
                onClick={() => setEditingProcess(null)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameProcess} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--ec-muted)] mb-1.5">
                  Stage Name:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editingProcess.newName}
                  onChange={(e) => setEditingProcess({ ...editingProcess, newName: e.target.value })}
                  placeholder="Enter new stage name..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2.5 text-xs text-[var(--ec-foreground)] font-bold focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-[var(--ec-muted)] mt-1">
                  Renaming will automatically update all existing production records under this stage name.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProcess(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editingProcess.newName.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
