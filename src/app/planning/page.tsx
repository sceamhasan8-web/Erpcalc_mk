"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { erpService } from '@/services/erpService';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import type { Department, ProductionFlow, BuyerOrder, OrderProductionPlan, SectionPlanTarget } from '@/types';
import {
  Calendar,
  Layers,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Target,
  Pencil,
  PlusCircle,
  Sparkles,
  Sliders,
  Filter,
  Search,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Flame,
  AlertTriangle,
  RefreshCw,
  Zap,
  Users,
  ChevronRight,
  Check,
  Building2,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

const STANDARD_WORKING_HOURS = 8;
const DEFAULT_WORKING_DAYS_PER_WEEK = 6;

// Helper to get week start and end date
function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// Helper to get month start and end date
function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default function PlanningPage() {
  const defaultProductionUnit = useProductionUnit();
  const { showAlert, toast } = useModal();

  const [loading, setLoading] = useState(true);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>([]);
  const [plans, setPlans] = useState<OrderProductionPlan[]>([]);

  // Selected view tab: 'order-plans' | 'matrix' | 'simulator'
  const [activeTab, setActiveTab] = useState<'order-plans' | 'matrix' | 'simulator'>('order-plans');

  // Filter and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [targetHorizonFilter, setTargetHorizonFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Plan Edit Modal state
  const [editingPlanOrder, setEditingPlanOrder] = useState<BuyerOrder | null>(null);
  const [editSections, setEditSections] = useState<Record<string, SectionPlanTarget>>({});
  const [autoDistributeDays, setAutoDistributeDays] = useState<number>(10);
  const [activeEditDept, setActiveEditDept] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Load and subscribe data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [ordersData, flowsData, deptsData, plansData] = await Promise.all([
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
          apiService.getDepartments(),
          apiService.getProductionPlans(),
        ]);
        setBuyerOrders(ordersData);
        setProductionFlows(flowsData);
        setDepartments(deptsData.filter((d) => d.name.toLowerCase() !== 'warehouse'));
        setPlans(plansData);

        if (ordersData.length > 0 && !selectedOrderId) {
          setSelectedOrderId(ordersData[0].id);
        }
      } catch (e) {
        console.error('Failed to load planning data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Firebase real-time subscriptions
    const unsubOrders = firebaseService.subscribeOrders((live) => {
      if (live && Array.isArray(live)) setBuyerOrders(live);
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((live) => {
      if (live && Array.isArray(live)) setProductionFlows(live);
    });
    const unsubDepts = firebaseService.subscribeDepartments((live) => {
      if (live && Array.isArray(live)) {
        setDepartments(live.filter((d) => d.name.toLowerCase() !== 'warehouse'));
      }
    });
    const unsubPlans = firebaseService.subscribeProductionPlans((live) => {
      if (live && Array.isArray(live)) setPlans(live);
    });

    const handleSync = () => {
      setPlans(erpService.getProductionPlans());
      setProductionFlows(erpService.getProductionFlows());
      setBuyerOrders(erpService.getBuyerOrders());
    };
    window.addEventListener('erp:productionPlansUpdated', handleSync);
    window.addEventListener('erp:productionFlowsUpdated', handleSync);
    window.addEventListener('erp:buyerOrdersUpdated', handleSync);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubDepts();
      unsubPlans();
      window.removeEventListener('erp:productionPlansUpdated', handleSync);
      window.removeEventListener('erp:productionFlowsUpdated', handleSync);
      window.removeEventListener('erp:buyerOrdersUpdated', handleSync);
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

  // Available valid department names
  const validDeptNames = useMemo(() => {
    return departments.map((d) => d.name);
  }, [departments]);

  // Helper to retrieve or generate a production plan for an order
  const getOrderPlan = (order: BuyerOrder): OrderProductionPlan => {
    const existing = plans.find((p) => p.orderId === order.id || p.orderNumber === order.orderNumber);
    const reqDepts = order.requiredDepartments && order.requiredDepartments.length > 0
      ? order.requiredDepartments
      : validDeptNames;

    const sections: Record<string, SectionPlanTarget> = {};

    reqDepts.forEach((dept) => {
      if (existing?.sections?.[dept]) {
        sections[dept] = existing.sections[dept];
      } else {
        const totalQty = order.quantity || 1000;
        const estDays = Math.max(1, Math.min(20, Math.ceil(totalQty / 500)));
        const daily = Math.ceil(totalQty / estDays);
        const weekly = daily * DEFAULT_WORKING_DAYS_PER_WEEK;
        const monthly = totalQty;

        const deptObj = departments.find((d) => d.name === dept);
        sections[dept] = {
          department: dept,
          dailyTarget: daily,
          weeklyTarget: weekly,
          monthlyTarget: monthly,
          totalTarget: totalQty,
          startDate: order.createdAt ? order.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
          targetDeliveryDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : undefined,
          manpower: deptObj?.manpower || 12,
          workingHours: deptObj?.workingHours || STANDARD_WORKING_HOURS,
        };
      }
    });

    return {
      id: existing?.id || `plan_${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      articleName: order.articleName,
      totalQuantity: order.quantity,
      unit: order.unit || defaultProductionUnit,
      startDate: order.createdAt ? order.createdAt.slice(0, 10) : undefined,
      targetDeliveryDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : undefined,
      sections,
      status: existing?.status || 'In Progress',
      updatedAt: existing?.updatedAt || new Date().toISOString(),
    };
  };

  // Currently selected order
  const selectedOrder = useMemo(() => {
    return uniqueOrders.find((o) => o.id === selectedOrderId) || uniqueOrders[0] || null;
  }, [uniqueOrders, selectedOrderId]);

  // Selected order's plan
  const selectedOrderPlan = useMemo(() => {
    if (!selectedOrder) return null;
    return getOrderPlan(selectedOrder);
  }, [selectedOrder, plans, validDeptNames, departments, defaultProductionUnit]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let list = uniqueOrders;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q) ||
        o.articleName?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((o) => o.status === statusFilter);
    }

    return list;
  }, [uniqueOrders, searchQuery, statusFilter]);

  // Filtered orders specifically for the Cross-Section Matrix view
  const filteredMatrixOrders = useMemo(() => {
    if (!matrixSearchQuery.trim()) return uniqueOrders;
    const q = matrixSearchQuery.toLowerCase();
    return uniqueOrders.filter((o) => {
      const orderMatch = o.orderNumber?.toLowerCase().includes(q);
      const buyerMatch = o.buyerName?.toLowerCase().includes(q);
      const articleMatch = o.articleName?.toLowerCase().includes(q) ||
        (o.items && o.items.some((it) => it.articleName?.toLowerCase().includes(q)));
      return Boolean(orderMatch || buyerMatch || articleMatch);
    });
  }, [uniqueOrders, matrixSearchQuery]);

  // Helper to compute actual production output for a specific order and department across horizons
  const getOrderDeptMetrics = (orderId: string, deptName: string, sectionPlan?: SectionPlanTarget) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { monday, sunday } = getWeekRange(new Date());
    const { start: monthStart, end: monthEnd } = getMonthRange(new Date());

    const orderFlows = productionFlows.filter((f) => f.orderId === orderId && f.department === deptName);

    const totalActual = orderFlows.reduce((sum, f) => sum + (f.completed || 0), 0);

    const todayActual = orderFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const weekActual = orderFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        return d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const monthActual = orderFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        return d.getTime() >= monthStart.getTime() && d.getTime() <= monthEnd.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const dailyTarget = sectionPlan?.dailyTarget || 0;
    const weeklyTarget = sectionPlan?.weeklyTarget || (dailyTarget * DEFAULT_WORKING_DAYS_PER_WEEK);
    const monthlyTarget = sectionPlan?.monthlyTarget || sectionPlan?.totalTarget || 0;
    const totalTarget = sectionPlan?.totalTarget || 0;

    const todayDue = Math.max(0, dailyTarget - todayActual);
    const weekDue = Math.max(0, weeklyTarget - weekActual);
    const monthDue = Math.max(0, monthlyTarget - monthActual);
    const totalDue = Math.max(0, totalTarget - totalActual);

    const dailyPct = dailyTarget > 0 ? Math.min(100, Math.round((todayActual / dailyTarget) * 100)) : 0;
    const weeklyPct = weeklyTarget > 0 ? Math.min(100, Math.round((weekActual / weeklyTarget) * 100)) : 0;
    const totalPct = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0;

    let status: 'Completed' | 'Ahead' | 'On Track' | 'Behind Due' | 'Not Started' = 'On Track';
    if (totalTarget > 0 && totalActual >= totalTarget) {
      status = 'Completed';
    } else if (totalActual === 0 && todayActual === 0) {
      status = 'Not Started';
    } else if (todayActual >= dailyTarget && dailyTarget > 0) {
      status = 'Ahead';
    } else if (todayDue > 0) {
      status = 'Behind Due';
    }

    return {
      totalActual,
      todayActual,
      weekActual,
      monthActual,
      dailyTarget,
      weeklyTarget,
      monthlyTarget,
      totalTarget,
      todayDue,
      weekDue,
      monthDue,
      totalDue,
      dailyPct,
      weeklyPct,
      totalPct,
      status,
    };
  };

  // Executive Factory-Wide KPI Summary
  const factorySummary = useMemo(() => {
    let plannedDailyTotal = 0;
    let plannedWeeklyTotal = 0;
    let plannedMonthlyTotal = 0;
    let actualTodayTotal = 0;
    let actualWeekTotal = 0;
    let totalFactoryDue = 0;
    let behindSectionsCount = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { monday, sunday } = getWeekRange(new Date());

    uniqueOrders.forEach((order) => {
      if (order.status === 'Completed') return;
      const plan = getOrderPlan(order);
      Object.entries(plan.sections).forEach(([dept, sTarget]) => {
        plannedDailyTotal += sTarget.dailyTarget || 0;
        plannedWeeklyTotal += sTarget.weeklyTarget || (sTarget.dailyTarget * DEFAULT_WORKING_DAYS_PER_WEEK);
        plannedMonthlyTotal += sTarget.monthlyTarget || sTarget.totalTarget || 0;

        const metrics = getOrderDeptMetrics(order.id, dept, sTarget);
        if (metrics.todayDue > 0) behindSectionsCount++;
        totalFactoryDue += metrics.totalDue;
      });
    });

    actualTodayTotal = productionFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    actualWeekTotal = productionFlows
      .filter((f) => {
        if (!f.updatedAt) return false;
        const d = new Date(f.updatedAt);
        return d.getTime() >= monday.getTime() && d.getTime() <= sunday.getTime();
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const todayFillRate = plannedDailyTotal > 0 ? Math.min(100, Math.round((actualTodayTotal / plannedDailyTotal) * 100)) : 0;
    const weekFillRate = plannedWeeklyTotal > 0 ? Math.min(100, Math.round((actualWeekTotal / plannedWeeklyTotal) * 100)) : 0;

    return {
      plannedDailyTotal,
      plannedWeeklyTotal,
      plannedMonthlyTotal,
      actualTodayTotal,
      actualWeekTotal,
      todayFillRate,
      weekFillRate,
      totalFactoryDue,
      behindSectionsCount,
      activeOrdersCount: uniqueOrders.filter((o) => o.status !== 'Completed').length,
    };
  }, [uniqueOrders, plans, productionFlows, validDeptNames, departments]);

  // Open Plan Edit Modal
  const handleOpenEditPlan = (order: BuyerOrder, targetDept?: string) => {
    const currentPlan = getOrderPlan(order);
    setEditingPlanOrder(order);
    setEditSections(JSON.parse(JSON.stringify(currentPlan.sections)));
    const firstDept = targetDept || Object.keys(currentPlan.sections)[0] || 'Cutting';
    setActiveEditDept(firstDept);

    const totalQty = order.quantity || 1000;
    const currentDaily = currentPlan.sections[firstDept]?.dailyTarget || 500;
    const estDays = Math.max(1, Math.ceil(totalQty / (currentDaily || 1)));
    setAutoDistributeDays(estDays);
  };

  // Auto-distribute targets across working days
  const handleApplyAutoDistribute = () => {
    if (!editingPlanOrder || autoDistributeDays <= 0) return;
    const totalQty = editingPlanOrder.quantity || 1000;
    const daily = Math.ceil(totalQty / autoDistributeDays);
    const weekly = daily * DEFAULT_WORKING_DAYS_PER_WEEK;
    const monthly = totalQty;

    setEditSections((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((dept) => {
        next[dept] = {
          ...next[dept],
          dailyTarget: daily,
          weeklyTarget: weekly,
          monthlyTarget: monthly,
          totalTarget: totalQty,
        };
      });
      return next;
    });

    toast.success(`Distributed: ${daily} ${editingPlanOrder.unit || defaultProductionUnit}/day across all sections!`);
  };

  // Save modified plan
  const handleSavePlan = async () => {
    if (!editingPlanOrder) return;
    setIsSavingPlan(true);

    try {
      const planPayload: OrderProductionPlan = {
        id: `plan_${editingPlanOrder.id}`,
        orderId: editingPlanOrder.id,
        orderNumber: editingPlanOrder.orderNumber,
        buyerName: editingPlanOrder.buyerName,
        articleName: editingPlanOrder.articleName,
        totalQuantity: editingPlanOrder.quantity,
        unit: editingPlanOrder.unit || defaultProductionUnit,
        startDate: editingPlanOrder.createdAt ? editingPlanOrder.createdAt.slice(0, 10) : undefined,
        targetDeliveryDate: editingPlanOrder.deliveryDate ? editingPlanOrder.deliveryDate.slice(0, 10) : undefined,
        sections: editSections,
        status: 'In Progress',
        updatedAt: new Date().toISOString(),
      };

      await apiService.saveProductionPlan(planPayload);

      setPlans((prev) => {
        const idx = prev.findIndex((p) => p.orderId === editingPlanOrder.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = planPayload;
          return next;
        }
        return [planPayload, ...prev];
      });

      toast.success(`Production plan for Order #${editingPlanOrder.orderNumber} updated successfully!`);
      setEditingPlanOrder(null);
    } catch (e) {
      console.error('Failed to save plan:', e);
      showAlert({ title: 'Save Failed', message: 'Could not save production plan. Please try again.', type: 'error' });
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 pb-24 max-w-7xl mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* COMPACT & RESPONSIVE HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-blue-950/90 via-slate-900/95 to-cyan-950/90 p-3.5 sm:p-6 shadow-xl backdrop-blur-xl space-y-3.5 sm:space-y-5">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top title and View Mode tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25 flex-shrink-0">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-cyan-400 block truncate">
                EASYCALC FACTORY ERP
              </span>
              <h1 className="text-base sm:text-2xl font-black text-white tracking-tight truncate">
                Production Planning & Target Control
              </h1>
            </div>
          </div>

          {/* 3-Tab Segmented Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 border border-white/10 rounded-xl sm:rounded-2xl w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('order-plans')}
              className={`py-1.5 px-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'order-plans'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Target className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Orders</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`py-1.5 px-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`py-1.5 px-2 sm:px-3.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'simulator'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Timeline</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards (Responsive 2x2 grid on mobile, 4-col on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 pt-3 border-t border-white/10">
          {/* Today's Target vs Produced */}
          <div className="bg-slate-900/70 border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Target</span>
              <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                factorySummary.todayFillRate >= 90 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {factorySummary.todayFillRate}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-cyan-400">
                {factorySummary.actualTodayTotal.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400">
                / {factorySummary.plannedDailyTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full"
                style={{ width: `${factorySummary.todayFillRate}%` }}
              />
            </div>
          </div>

          {/* This Week's Target vs Produced */}
          <div className="bg-slate-900/70 border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Target</span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                {factorySummary.weekFillRate}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-emerald-400">
                {factorySummary.actualWeekTotal.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400">
                / {factorySummary.plannedWeeklyTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full"
                style={{ width: `${factorySummary.weekFillRate}%` }}
              />
            </div>
          </div>

          {/* Factory Total Due / Backlog */}
          <div className="bg-slate-900/70 border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Factory Due</span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                Backlog
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-xl font-black text-rose-400">
                {factorySummary.totalFactoryDue.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400">{defaultProductionUnit}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              Uncompleted target work
            </p>
          </div>

          {/* Active Orders & Behind Sections */}
          <div className="bg-slate-900/70 border border-white/10 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Operations</span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                {factorySummary.activeOrdersCount} Orders
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-xl font-black text-amber-400">
                {factorySummary.behindSectionsCount}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400">Sections Due</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
              Across running departments
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: ORDER-WISE PRODUCTION PLAN & TARGETS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'order-plans' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Order Selector Toolbar */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3 sm:p-4 shadow-sm space-y-3">
            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter order # or buyer..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] pl-9 pr-3 py-2 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Order Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>

              {/* Mobile Order Dropdown Selector */}
              <div className="relative">
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="w-full rounded-xl border border-cyan-500/40 bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-cyan-400 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer pr-8 truncate"
                >
                  {filteredOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.orderNumber} - {o.buyerName} ({o.quantity} {o.unit || defaultProductionUnit})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400 pointer-events-none" />
              </div>
            </div>

            {/* Quick Order Horizontal Chips (Touch-friendly & sleek) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
              {filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id;
                const plan = getOrderPlan(order);
                const reqDepts = Object.keys(plan.sections);
                let totalDone = 0;
                reqDepts.forEach((dept) => {
                  const m = getOrderDeptMetrics(order.id, dept, plan.sections[dept]);
                  totalDone = Math.max(totalDone, m.totalActual);
                });
                const overallPct = order.quantity > 0 ? Math.min(100, Math.round((totalDone / order.quantity) * 100)) : 0;

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500 shadow-sm'
                        : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs">#{order.orderNumber}</span>
                        <span className="text-[10px] font-black text-emerald-400">{overallPct}%</span>
                      </div>
                      <p className="text-[10px] text-[var(--ec-muted)] truncate max-w-[120px]">{order.buyerName}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Order Detailed Plan & Section Target Matrix */}
          {selectedOrder && selectedOrderPlan && (
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-4 sm:space-y-5">
              {/* Order Header Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--ec-border)]">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-xl font-black text-[var(--ec-foreground)] truncate">
                      Order #{selectedOrder.orderNumber}
                    </h2>
                    <span className="text-xs text-[var(--ec-muted)] font-semibold truncate">
                      ({selectedOrder.buyerName})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      {selectedOrder.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--ec-muted)]">
                    Article: <strong className="text-[var(--ec-foreground)]">{selectedOrder.articleName || 'Standard'}</strong> • Total Planned: <strong className="text-cyan-400">{selectedOrder.quantity} {selectedOrder.unit || defaultProductionUnit}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEditPlan(selectedOrder)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black transition shadow-md shadow-cyan-500/20 w-full sm:w-auto"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Change Plan</span>
                </button>
              </div>

              {/* 3 TARGET HORIZON OPTIONS (Daily Target | Weekly Target | Monthly Target) */}
              <div className="pt-1">
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--ec-surface)] border border-[var(--ec-border)] rounded-2xl shadow-inner">
                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('daily')}
                    className={`py-2 px-2 sm:px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      targetHorizonFilter === 'daily'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">Daily Target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('weekly')}
                    className={`py-2 px-2 sm:px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      targetHorizonFilter === 'weekly'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">Weekly Target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('monthly')}
                    className={`py-2 px-2 sm:px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      targetHorizonFilter === 'monthly'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400'
                        : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                    }`}
                  >
                    <Target className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">Monthly Target</span>
                  </button>
                </div>
              </div>

              {/* Section Targets Grid */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {targetHorizonFilter === 'daily' && 'Daily Section Targets & Today\'s Due'}
                      {targetHorizonFilter === 'weekly' && 'Weekly Section Targets & Week\'s Due'}
                      {targetHorizonFilter === 'monthly' && 'Monthly & Total Section Targets & Backlog'}
                    </span>
                  </h3>
                  <span className="text-[10px] text-[var(--ec-muted)] capitalize">
                    {targetHorizonFilter} View Mode
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(selectedOrderPlan.sections).map(([dept, sTarget]) => {
                    const metrics = getOrderDeptMetrics(selectedOrder.id, dept, sTarget);

                    // Dynamic Horizon values according to selected option
                    const horizonTarget = targetHorizonFilter === 'daily' ? metrics.dailyTarget : targetHorizonFilter === 'weekly' ? metrics.weeklyTarget : metrics.totalTarget;
                    const horizonActual = targetHorizonFilter === 'daily' ? metrics.todayActual : targetHorizonFilter === 'weekly' ? metrics.weekActual : metrics.totalActual;
                    const horizonPct = targetHorizonFilter === 'daily' ? metrics.dailyPct : targetHorizonFilter === 'weekly' ? metrics.weeklyPct : metrics.totalPct;
                    const horizonDue = targetHorizonFilter === 'daily' ? metrics.todayDue : targetHorizonFilter === 'weekly' ? metrics.weekDue : metrics.totalDue;
                    const horizonLabel = targetHorizonFilter === 'daily' ? "Today's Target" : targetHorizonFilter === 'weekly' ? "Week's Target" : "Total Target";
                    const horizonDueLabel = targetHorizonFilter === 'daily' ? "Today's Due" : targetHorizonFilter === 'weekly' ? "Week's Due" : "Total Due";

                    return (
                      <div
                        key={dept}
                        className="rounded-xl sm:rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3.5 sm:p-4 space-y-3 shadow-sm hover:border-cyan-500/50 transition"
                      >
                        {/* Section Name & Status Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                              {dept.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-xs sm:text-sm text-[var(--ec-foreground)] truncate">{dept}</h4>
                              <p className="text-[10px] text-[var(--ec-muted)]">
                                {sTarget.manpower ? `${sTarget.manpower} workers` : 'Standard'} • {sTarget.workingHours || 8}h
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              metrics.status === 'Completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : metrics.status === 'Ahead'
                                ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                                : metrics.status === 'Behind Due'
                                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                            }`}>
                              {metrics.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPlan(selectedOrder, dept)}
                              className="p-1 rounded-lg text-[var(--ec-muted)] hover:text-cyan-400 hover:bg-[var(--ec-card)] transition"
                              title="Edit target"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Selected Horizon Primary Output Highlight */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--ec-card)] to-[var(--ec-surface)] border border-[var(--ec-border)]/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                              {horizonLabel} Fill:
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              horizonPct >= 100
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-cyan-500/20 text-cyan-300'
                            }`}>
                              {horizonPct}% Filled
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-1">
                            <span className="text-lg sm:text-xl font-black text-cyan-400">
                              {horizonActual.toLocaleString()}
                            </span>
                            <span className="text-xs text-[var(--ec-muted)] font-semibold">
                              Target: <strong className="text-[var(--ec-foreground)]">{horizonTarget.toLocaleString()}</strong> {selectedOrder.unit || defaultProductionUnit}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-[var(--ec-surface)] h-2 rounded-full overflow-hidden border border-[var(--ec-border)]/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                horizonPct >= 100
                                  ? 'bg-emerald-400'
                                  : 'bg-gradient-to-r from-blue-500 to-cyan-400'
                              }`}
                              style={{ width: `${Math.min(100, horizonPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick 3-Horizon Mini Reference Grid */}
                        <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-lg bg-[var(--ec-card)]/60 border border-[var(--ec-border)]/40 text-center text-[10px]">
                          <div className={`p-1 rounded ${targetHorizonFilter === 'daily' ? 'bg-cyan-500/10 font-bold text-cyan-400' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase">Daily</span>
                            <span>{metrics.todayActual}/{metrics.dailyTarget}</span>
                          </div>

                          <div className={`p-1 rounded ${targetHorizonFilter === 'weekly' ? 'bg-blue-500/10 font-bold text-blue-400' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase">Weekly</span>
                            <span>{metrics.weekActual}/{metrics.weeklyTarget}</span>
                          </div>

                          <div className={`p-1 rounded ${targetHorizonFilter === 'monthly' ? 'bg-emerald-500/10 font-bold text-emerald-400' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase">Total</span>
                            <span>{metrics.totalActual}/{metrics.totalTarget}</span>
                          </div>
                        </div>

                        {/* Due & Shortfall Box */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent border border-rose-500/20 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">
                              {horizonDueLabel}:
                            </span>
                            <span className={`text-xs font-black ${horizonDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {horizonDue > 0 ? `${horizonDue.toLocaleString()} ${selectedOrder.unit || defaultProductionUnit} due` : '✓ Target Reached'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 block">Total Due:</span>
                            <span className="text-xs font-black text-rose-400">
                              {metrics.totalDue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: CROSS-SECTION BOTTLENECK MATRIX */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[var(--ec-foreground)] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  <span>All Orders × Department Matrix</span>
                </h3>
                <p className="text-[10px] sm:text-xs text-[var(--ec-muted)]">
                  Search by Order # or Article Name to view department targets, completed output, and bottlenecks.
                </p>
              </div>

              {/* Matrix Search Input Bar */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cyan-400" />
                <input
                  type="text"
                  value={matrixSearchQuery}
                  onChange={(e) => setMatrixSearchQuery(e.target.value)}
                  placeholder="Search Order #, Article, Buyer..."
                  className="w-full rounded-xl border border-cyan-500/30 bg-[var(--ec-surface)] pl-9 pr-8 py-2 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500 shadow-sm"
                />
                {matrixSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMatrixSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--ec-muted)] hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {matrixSearchQuery && (
              <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold pt-1 border-t border-[var(--ec-border)]/60">
                <span>Filtered Results: {filteredMatrixOrders.length} order(s) found</span>
                <button
                  type="button"
                  onClick={() => setMatrixSearchQuery('')}
                  className="text-[11px] text-[var(--ec-muted)] hover:underline"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] overflow-x-auto shadow-sm">
            <table className="w-full text-left text-xs border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-[var(--ec-surface)] border-b border-[var(--ec-border)] text-[10px] font-extrabold text-[var(--ec-muted)] uppercase tracking-wider">
                  <th className="p-3">Order / Article / Buyer</th>
                  <th className="p-3">Total Qty</th>
                  {validDeptNames.map((dept) => (
                    <th key={dept} className="p-3 text-center">{dept}</th>
                  ))}
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ec-border)]">
                {filteredMatrixOrders.length === 0 ? (
                  <tr>
                    <td colSpan={validDeptNames.length + 3} className="p-8 text-center text-xs text-[var(--ec-muted)]">
                      No orders found matching "{matrixSearchQuery}". Try another Order # or Article name.
                    </td>
                  </tr>
                ) : (
                  filteredMatrixOrders.map((order) => {
                    const plan = getOrderPlan(order);
                    return (
                      <tr key={order.id} className="hover:bg-[var(--ec-surface)]/50 transition">
                        <td className="p-3 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-cyan-400 text-xs">
                              #{order.orderNumber}
                            </span>
                            {order.articleName && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 truncate max-w-[120px]">
                                {order.articleName}
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-[var(--ec-foreground)] text-[11px] truncate max-w-[150px]">
                            {order.buyerName}
                          </div>
                        </td>

                        <td className="p-3 font-black text-[var(--ec-foreground)] whitespace-nowrap text-xs">
                          {order.quantity} <span className="text-[9px] font-normal text-[var(--ec-muted)]">{order.unit || defaultProductionUnit}</span>
                        </td>

                        {validDeptNames.map((dept) => {
                          const sTarget = plan.sections[dept];
                          const isRequired = !order.requiredDepartments || order.requiredDepartments.length === 0 || order.requiredDepartments.includes(dept);

                          if (!isRequired) {
                            return (
                              <td key={dept} className="p-2 text-center text-[var(--ec-muted)] text-[10px]">
                                —
                              </td>
                            );
                          }

                          const metrics = getOrderDeptMetrics(order.id, dept, sTarget);

                          return (
                            <td key={dept} className="p-1.5 text-center">
                              <div className={`p-1.5 rounded-lg border text-[10px] space-y-0.5 ${
                                metrics.status === 'Completed'
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                  : metrics.totalDue > 0
                                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                                  : 'bg-[var(--ec-surface)] border-[var(--ec-border)] text-[var(--ec-foreground)]'
                              }`}>
                                <div className="font-black">
                                  {metrics.totalActual} / {metrics.totalTarget}
                                </div>
                                <div className="text-[9px] font-bold text-cyan-400">
                                  {metrics.totalPct}%
                                </div>
                                {metrics.totalDue > 0 && (
                                  <div className="text-[9px] font-black text-rose-400">
                                    Due: {metrics.totalDue}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        <td className="p-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPlan(order)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/25 text-[11px] font-bold transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: TIMELINE SIMULATOR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'simulator' && (
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-black text-[var(--ec-foreground)] flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-cyan-400" />
              Timeline & Forecast
            </h3>
            <p className="text-[10px] sm:text-xs text-[var(--ec-muted)]">
              Estimated lead times based on daily target allocations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {uniqueOrders.map((order) => {
              const plan = getOrderPlan(order);
              const totalQty = order.quantity || 1000;
              const depts = Object.keys(plan.sections);

              const dailyPaces = depts.map((d) => plan.sections[d]?.dailyTarget || 500);
              const minDailyPace = Math.max(1, Math.min(...dailyPaces));
              const estWorkingDays = Math.ceil(totalQty / minDailyPace);

              const estDate = new Date();
              estDate.setDate(estDate.getDate() + estWorkingDays);

              return (
                <div key={order.id} className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-cyan-400">
                      #{order.orderNumber}
                    </span>
                    <span className="text-[10px] font-black text-amber-400">
                      ~{estWorkingDays} days
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-[var(--ec-foreground)] truncate">{order.buyerName}</h4>
                    <p className="text-[10px] text-[var(--ec-muted)]">
                      Total: <strong>{totalQty} {order.unit || defaultProductionUnit}</strong>
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-[var(--ec-card)] border border-[var(--ec-border)] text-[10px] space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[var(--ec-muted)]">Rate:</span>
                      <strong className="text-cyan-400">{minDailyPace}/d</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ec-muted)]">Forecast:</span>
                      <strong className="text-emerald-400">{estDate.toLocaleDateString([], { day: 'numeric', month: 'short' })}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FULLY RESPONSIVE MODAL: EDIT PRODUCTION PLAN */}
      {/* ------------------------------------------------------------- */}
      {editingPlanOrder && (
        <div
          onClick={() => setEditingPlanOrder(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full bg-[var(--ec-card)] border border-cyan-500/40 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)] flex-shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400">
                  CONFIGURE TARGETS
                </span>
                <h3 className="text-base sm:text-lg font-black text-[var(--ec-foreground)] truncate">
                  Order #{editingPlanOrder.orderNumber} ({editingPlanOrder.buyerName})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setEditingPlanOrder(null)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Unified Batch Controller Toolbar */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-indigo-600/10 border border-cyan-500/30 space-y-2.5 flex-shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-black text-[var(--ec-foreground)] block">
                      Bulk Target Setter (All Sections At Once)
                    </span>
                    <span className="text-[10px] text-[var(--ec-muted)]">
                      Total Order Quantity: <strong className="text-cyan-400">{editingPlanOrder.quantity} {editingPlanOrder.unit || defaultProductionUnit}</strong>
                    </span>
                  </div>
                </div>

                {/* Auto distribute across days */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-[var(--ec-surface)] px-2.5 py-1.5 rounded-xl border border-[var(--ec-border)]">
                    <span className="text-[10px] text-[var(--ec-muted)] font-bold">Target Days:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={autoDistributeDays}
                      onChange={(e) => setAutoDistributeDays(Number(e.target.value) || 1)}
                      className="w-9 bg-transparent text-xs font-black text-cyan-400 focus:outline-none text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAutoDistribute}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black transition shadow-sm"
                  >
                    Distribute to All
                  </button>
                </div>
              </div>
            </div>

            {/* UNIFIED ALL-SECTIONS SIMULTANEOUS EDIT MATRIX */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 -mr-1">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  All Sections Plan Grid ({Object.keys(editSections).length} sections)
                </span>
                <span className="text-[10px] text-[var(--ec-muted)]">
                  Edit any section directly below
                </span>
              </div>

              {Object.keys(editSections).map((dept) => {
                const s = editSections[dept];
                return (
                  <div
                    key={dept}
                    className="p-3 rounded-2xl bg-[var(--ec-surface)] border border-[var(--ec-border)] hover:border-cyan-500/40 transition space-y-2.5 shadow-sm"
                  >
                    {/* Section Row Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-[10px]">
                          {dept.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-xs sm:text-sm text-[var(--ec-foreground)] truncate">
                          {dept}
                        </span>
                      </div>

                      {/* Quick copy order qty to this section total */}
                      <button
                        type="button"
                        onClick={() => {
                          const qty = editingPlanOrder.quantity || 1000;
                          const daily = Math.ceil(qty / (autoDistributeDays || 10));
                          setEditSections((prev) => ({
                            ...prev,
                            [dept]: {
                              ...prev[dept],
                              dailyTarget: daily,
                              weeklyTarget: daily * DEFAULT_WORKING_DAYS_PER_WEEK,
                              totalTarget: qty,
                              monthlyTarget: qty,
                            },
                          }));
                        }}
                        className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20"
                      >
                        Reset to Default
                      </button>
                    </div>

                    {/* Inputs in a clean responsive 4-column grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Daily Target */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Daily Target (/day)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={s.dailyTarget || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditSections((prev) => ({
                              ...prev,
                              [dept]: {
                                ...prev[dept],
                                dailyTarget: val,
                                weeklyTarget: val * DEFAULT_WORKING_DAYS_PER_WEEK,
                              },
                            }));
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-1.5 text-xs font-black text-cyan-400 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Weekly Target */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Weekly Target (/wk)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={s.weeklyTarget || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditSections((prev) => ({
                              ...prev,
                              [dept]: {
                                ...prev[dept],
                                weeklyTarget: val,
                              },
                            }));
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-1.5 text-xs font-black text-blue-400 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Total Target */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Total Target (Order)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={s.totalTarget || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setEditSections((prev) => ({
                              ...prev,
                              [dept]: {
                                ...prev[dept],
                                totalTarget: val,
                                monthlyTarget: val,
                              },
                            }));
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-1.5 text-xs font-black text-emerald-400 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Manpower & Shift */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Workers • Shift Hours
                        </label>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="number"
                            min="1"
                            value={s.manpower || 12}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 1;
                              setEditSections((prev) => ({
                                ...prev,
                                [dept]: {
                                  ...prev[dept],
                                  manpower: val,
                                },
                              }));
                            }}
                            title="Workers"
                            className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-1.5 py-1.5 text-xs font-bold text-center text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                          />
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={s.workingHours || 8}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 8;
                              setEditSections((prev) => ({
                                ...prev,
                                [dept]: {
                                  ...prev[dept],
                                  workingHours: val,
                                },
                              }));
                            }}
                            title="Working hours"
                            className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-1.5 py-1.5 text-xs font-bold text-center text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--ec-border)] flex-shrink-0">
              <span className="text-[11px] text-[var(--ec-muted)] hidden sm:inline">
                Saves all section targets simultaneously.
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingPlanOrder(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSavePlan}
                  disabled={isSavingPlan}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 disabled:opacity-50"
                >
                  {isSavingPlan ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save All Sections</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
