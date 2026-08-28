"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { erpService } from '@/services/erpService';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { mockRepository } from '@/repositories/mockRepository';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import { calculateMultiProcessProduction } from '@/lib/productionUtils';
import type { Department, ProductionFlow, BuyerOrder, OrderProductionPlan, SectionPlanTarget, DailyManpowerRecord } from '@/types';
import {
  Calendar,
  Layers,
  TrendingUp,
  Clock,
  Factory,
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
  ChevronDown,
  CalendarRange,
  Hash,
  Package,
  FileSpreadsheet,
  Download,
  Wand2,
  Copy,
  RotateCcw,
  TableProperties,
  Grid,
  CalendarPlus,
  FilePlus,
  CheckCheck,
  Maximize2,
  ChevronLeft,
  FileText
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

// Helper to count working days between two dates (excludes Friday - Bangladesh weekly off-day)
function getWorkingDaysBetween(startStr: string, endStr: string): number {
  const s = new Date(startStr); s.setHours(0, 0, 0, 0);
  const e = new Date(endStr); e.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 5) count++; // Skip Friday (Bangladesh Off-day)
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

// Helper to calculate period end date from period type
function calcPeriodEnd(startStr: string, periodType: string): string {
  const d = new Date(startStr);
  switch (periodType) {
    case '15days': d.setDate(d.getDate() + 14); break;
    case '1month': d.setMonth(d.getMonth() + 1); break;
    case '2months': d.setMonth(d.getMonth() + 2); break;
    case '3months': d.setMonth(d.getMonth() + 3); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

// Helper to generate full list of dates in range for Excel Matrix
interface MatrixDateItem {
  dateStr: string;
  dayNum: number;
  dayName: string;
  isSunday: boolean;
  isFriday: boolean;
}

function getDatesInRange(startStr: string, endStr: string): MatrixDateItem[] {
  const list: MatrixDateItem[] = [];
  const cur = new Date(startStr);
  const end = new Date(endStr);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayOfMonth}`;
    const dayOfWeek = cur.getDay();
    list.push({
      dateStr,
      dayNum: cur.getDate(),
      dayName: dayNames[dayOfWeek],
      isSunday: dayOfWeek === 0,
      isFriday: dayOfWeek === 5,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return list;
}

// Helper to convert any timestamp / ISO string / Date into Bangladesh/Local Date format (YYYY-MM-DD)
function getFlowLocalDate(updatedAt?: string | Date | null): string {
  if (!updatedAt) return '';
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper to test if a production flow belongs to a specific local calendar date (YYYY-MM-DD)
function isFlowOnDate(updatedAt?: string | Date | null, targetDateStr?: string): boolean {
  if (!updatedAt || !targetDateStr) return false;
  return getFlowLocalDate(updatedAt) === targetDateStr;
}

export default function PlanningPage() {
  const defaultProductionUnit = useProductionUnit();
  const { showAlert, toast } = useModal();

  const [loading, setLoading] = useState<boolean>(false);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>(() => mockRepository.getBuyerOrders());
  const [departments, setDepartments] = useState<Department[]>(() => erpService.getDepartments().filter((d) => d.name.toLowerCase() !== 'warehouse'));
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>(() => mockRepository.getProductionFlows());
  const [plans, setPlans] = useState<OrderProductionPlan[]>(() => erpService.getProductionPlans());
  const [dailyManpowerRecords, setDailyManpowerRecords] = useState<DailyManpowerRecord[]>(() => mockRepository.getDailyManpowerRecords());
  const [planningDate, setPlanningDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Selected view tab
  const [activeTab, setActiveTab] = useState<'order-plans' | 'matrix' | 'simulator' | 'monthly-plan'>('order-plans');

  // Filter and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [targetHorizonFilter, setTargetHorizonFilter] = useState<'daily' | 'weekly' | 'monthly' | 'total'>('daily');

  // Plan Edit Modal state (Quick Target Modal)
  const [editingPlanOrder, setEditingPlanOrder] = useState<BuyerOrder | null>(null);
  const [editSections, setEditSections] = useState<Record<string, SectionPlanTarget>>({});
  const [autoDistributeDays, setAutoDistributeDays] = useState<number>(10);
  const [activeEditDept, setActiveEditDept] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Full Date-Wise Excel Planner Modal state
  const [isDateWiseModalOpen, setIsDateWiseModalOpen] = useState(false);
  const [dwSelectedOrderId, setDwSelectedOrderId] = useState<string>('');
  const [dwRangePreset, setDwRangePreset] = useState<'15days' | '1month' | '2months' | 'custom'>('1month');
  const [dwStartDate, setDwStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [dwEndDate, setDwEndDate] = useState<string>(() => calcPeriodEnd(new Date().toISOString().split('T')[0], '1month'));
  const [dwSchedule, setDwSchedule] = useState<Record<string, Record<string, number>>>({});
  const [dwQuickDailyPace, setDwQuickDailyPace] = useState<number>(50);
  const [dwIsSaving, setDwIsSaving] = useState(false);
  const [showInPageExcelView, setShowInPageExcelView] = useState<boolean>(true);
  const [scheduleViewMode, setScheduleViewMode] = useState<'all_orders' | 'selected_order'>('selected_order');

  // Overview Section-Wise Target Horizon state
  const [overviewSectionHorizon, setOverviewSectionHorizon] = useState<'daily' | 'weekly' | 'monthly' | 'total'>('daily');

  // Date-Wise Production Report Sheet Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportHorizon, setReportHorizon] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportOrderFilter, setReportOrderFilter] = useState<string>('all');
  const [reportDeptFilter, setReportDeptFilter] = useState<string>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Open Date-Wise Production Report Sheet Modal
  const handleOpenReportModal = (horizon: 'daily' | 'weekly' | 'monthly') => {
    setReportHorizon(horizon);
    setReportDate(planningDate || new Date().toISOString().split('T')[0]);
    setIsReportModalOpen(true);
  };

  const handleReportPrevMonth = () => {
    const d = new Date(reportDate);
    d.setMonth(d.getMonth() - 1);
    setReportDate(d.toISOString().split('T')[0]);
  };

  const handleReportNextMonth = () => {
    const d = new Date(reportDate);
    d.setMonth(d.getMonth() + 1);
    setReportDate(d.toISOString().split('T')[0]);
  };

  const handleReportPrevDay = () => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() - 1);
    setReportDate(d.toISOString().split('T')[0]);
  };

  const handleReportNextDay = () => {
    const d = new Date(reportDate);
    d.setDate(d.getDate() + 1);
    setReportDate(d.toISOString().split('T')[0]);
  };

  // Monthly Plan tab state
  const [mpPeriodType, setMpPeriodType] = useState<'15days' | '1month' | '2months' | '3months' | 'custom'>('1month');
  const [mpStartDate, setMpStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [mpCustomEndDate, setMpCustomEndDate] = useState<string>(() => calcPeriodEnd(new Date().toISOString().split('T')[0], '1month'));
  const [mpSearchQuery, setMpSearchQuery] = useState('');
  // Per-order custom period targets: { orderId: { deptName: periodTarget } }
  const [mpOrderTargets, setMpOrderTargets] = useState<Record<string, Record<string, number>>>({});
  const [mpEditingOrder, setMpEditingOrder] = useState<BuyerOrder | null>(null);
  const [mpEditTargets, setMpEditTargets] = useState<Record<string, number>>({});
  const [mpIsSaving, setMpIsSaving] = useState(false);

  // Load and subscribe data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [ordersData, flowsData, deptsData, plansData, manpowerData] = await Promise.all([
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
          apiService.getDepartments(),
          apiService.getProductionPlans(),
          firebaseService.getDailyManpowerRecords ? firebaseService.getDailyManpowerRecords() : Promise.resolve([]),
        ]);
        setBuyerOrders(ordersData);
        setProductionFlows(flowsData);
        setDepartments(deptsData.filter((d) => d.name.toLowerCase() !== 'warehouse'));
        setPlans(plansData);
        if (manpowerData && manpowerData.length > 0) {
          setDailyManpowerRecords(manpowerData);
        }

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
    const unsubManpower = firebaseService.subscribeDailyManpower((live) => {
      if (live && Array.isArray(live) && live.length > 0) {
        setDailyManpowerRecords(live);
        mockRepository.setDailyManpowerRecords(live);
      }
    });

    const handleSync = () => {
      setPlans(erpService.getProductionPlans());
      setProductionFlows(erpService.getProductionFlows());
      setBuyerOrders(erpService.getBuyerOrders());
      setDailyManpowerRecords(mockRepository.getDailyManpowerRecords());
    };
    window.addEventListener('erp:productionPlansUpdated', handleSync);
    window.addEventListener('erp:productionFlowsUpdated', handleSync);
    window.addEventListener('erp:buyerOrdersUpdated', handleSync);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubDepts();
      unsubPlans();
      unsubManpower();
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
    const existing = plans.find(
      (p) =>
        (order.id && (p.orderId === order.id || p.orderNumber === order.id || p.id === `plan_${order.id}` || p.id === order.id)) ||
        (order.orderNumber && (p.orderNumber === order.orderNumber || p.orderId === order.orderNumber))
    );
    const reqDepts = order.requiredDepartments && order.requiredDepartments.length > 0
      ? order.requiredDepartments
      : validDeptNames;

    const sections: Record<string, SectionPlanTarget> = {};

    reqDepts.forEach((dept) => {
      const maxOrderQty = order.quantity || 0;
      if (existing?.sections?.[dept]) {
        const sec = existing.sections[dept];
        const rawTarget = sec.totalTarget || maxOrderQty;
        const clampedTarget = maxOrderQty > 0 ? Math.min(maxOrderQty, rawTarget) : rawTarget;
        sections[dept] = {
          ...sec,
          totalTarget: clampedTarget,
          monthlyTarget: maxOrderQty > 0 ? Math.min(clampedTarget, sec.monthlyTarget || clampedTarget) : sec.monthlyTarget,
          dailyTarget: maxOrderQty > 0 ? Math.min(clampedTarget, sec.dailyTarget || 0) : sec.dailyTarget,
        };
      } else {
        const totalQty = maxOrderQty;
        const deptObj = departments.find((d) => d.name === dept);
        sections[dept] = {
          department: dept,
          dailyTarget: 0,
          weeklyTarget: 0,
          monthlyTarget: totalQty,
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
      dateWiseTargets: existing?.dateWiseTargets || {},
      status: existing?.status || 'In Progress',
      updatedAt: existing?.updatedAt || new Date().toISOString(),
    };
  };

  // Helper to map department names to HR Manpower sections
  const getHRSectionName = (dept: string): string => {
    const d = dept.toLowerCase();
    if (d.includes('cut')) return 'Cutting';
    if (d.includes('sew') || d.includes('stitch')) return 'Sewing';
    if (d.includes('last') || d.includes('dip')) return 'Lasting & DIP';
    if (d.includes('pack')) return 'Packing';
    if (d.includes('store') || d.includes('fg')) return 'Goods Store';
    if (d.includes('ware')) return 'Warehouse';
    if (d.includes('lam') || d.includes('prep') || d.includes('skyv')) return 'Lamination & Preparation';
    if (d.includes('print') || d.includes('emboss')) return 'Printing & Embossing';
    if (d.includes('qual') || d.includes('qc') || d.includes('finish')) return 'Quality Assurance';
    return dept;
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

  // Computed dates list for the Date-Wise Planner
  const dwDatesList = useMemo(() => {
    return getDatesInRange(dwStartDate, dwEndDate);
  }, [dwStartDate, dwEndDate]);

  const dwWorkingDaysCount = useMemo(() => {
    return dwDatesList.filter(d => !d.isFriday).length;
  }, [dwDatesList]);

  // Selected order for Date-Wise planner modal
  const dwCurrentOrder = useMemo(() => {
    return uniqueOrders.find(o => o.id === dwSelectedOrderId) || selectedOrder || uniqueOrders[0] || null;
  }, [uniqueOrders, dwSelectedOrderId, selectedOrder]);

  // Helper to open the full Date-Wise Excel Planner Modal
  const handleOpenDateWisePlanner = (order?: BuyerOrder | null, preset: '15days' | '1month' | '2months' | 'custom' = '1month') => {
    const targetOrder = order || selectedOrder || uniqueOrders[0];
    if (!targetOrder) {
      showAlert({ title: 'No Order Available', message: 'Please add a buyer order before creating a production plan.', type: 'info' });
      return;
    }

    setDwSelectedOrderId(targetOrder.id);
    const plan = getOrderPlan(targetOrder);
    const reqDepts = targetOrder.requiredDepartments && targetOrder.requiredDepartments.length > 0
      ? targetOrder.requiredDepartments
      : validDeptNames;

    // Load existing date-wise targets if present
    const existingSched: Record<string, Record<string, number>> = {};
    reqDepts.forEach((dept) => {
      existingSched[dept] = { ...(plan.dateWiseTargets?.[dept] || plan.sections[dept]?.dailyBreakdown || {}) };
    });

    setDwSchedule(existingSched);

    // Compute dates based on preset, starting strictly from current selected planningDate or today (never old order creation dates)
    const start = planningDate || new Date().toISOString().split('T')[0];
    const end = calcPeriodEnd(start, preset);

    setDwStartDate(start);
    setDwEndDate(end);
    setDwRangePreset(preset);

    const totalQty = targetOrder.quantity || 1000;
    const estWorkDays = getWorkingDaysBetween(start, end);
    const pace = Math.ceil(totalQty / Math.max(1, estWorkDays));
    setDwQuickDailyPace(pace);

    setIsDateWiseModalOpen(true);
  };

  // Preset changer within modal
  const handleDwChangePreset = (preset: '15days' | '1month' | '2months' | 'custom') => {
    setDwRangePreset(preset);
    if (preset !== 'custom') {
      const end = calcPeriodEnd(dwStartDate, preset);
      setDwEndDate(end);
    }
  };

  // Cell edit in Date-Wise Planner with Order Quantity capping
  const handleDwCellChange = (dept: string, dateStr: string, value: number) => {
    const numVal = Math.max(0, value);
    if (!dwCurrentOrder) {
      setDwSchedule((prev) => ({
        ...prev,
        [dept]: {
          ...(prev[dept] || {}),
          [dateStr]: numVal,
        },
      }));
      return;
    }

    const maxOrderQty = dwCurrentOrder.quantity || 0;
    const currentMap = dwSchedule[dept] || {};
    
    // Sum other dates in this dept
    let otherSum = 0;
    Object.entries(currentMap).forEach(([dStr, v]) => {
      if (dStr !== dateStr) otherSum += (v || 0);
    });

    let finalVal = numVal;
    if (maxOrderQty > 0 && otherSum + numVal > maxOrderQty) {
      finalVal = Math.max(0, maxOrderQty - otherSum);
      toast.warning(`Total scheduled plan cannot exceed Order Quantity (${maxOrderQty.toLocaleString()})! Clamped to ${finalVal}.`);
    }

    setDwSchedule((prev) => ({
      ...prev,
      [dept]: {
        ...(prev[dept] || {}),
        [dateStr]: finalVal,
      },
    }));
  };

  // Helper for Excel-like Arrow Key & Enter navigation across the grid
  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    deptIdx: number,
    dateIdx: number,
    totalDepts: number,
    totalDates: number,
    cellPrefix = 'dw-cell'
  ) => {
    let targetDeptIdx = deptIdx;
    let targetDateIdx = dateIdx;

    if (e.key === 'ArrowRight') {
      if (dateIdx + 1 < totalDates) {
        targetDateIdx = dateIdx + 1;
      } else if (deptIdx + 1 < totalDepts) {
        targetDeptIdx = deptIdx + 1;
        targetDateIdx = 0;
      }
    } else if (e.key === 'ArrowLeft') {
      if (dateIdx - 1 >= 0) {
        targetDateIdx = dateIdx - 1;
      } else if (deptIdx - 1 >= 0) {
        targetDeptIdx = deptIdx - 1;
        targetDateIdx = totalDates - 1;
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (deptIdx + 1 < totalDepts) {
        targetDeptIdx = deptIdx + 1;
      }
    } else if (e.key === 'ArrowUp') {
      if (deptIdx - 1 >= 0) {
        targetDeptIdx = deptIdx - 1;
      }
    } else {
      return;
    }

    if (targetDeptIdx !== deptIdx || targetDateIdx !== dateIdx) {
      e.preventDefault();
      const nextElem = document.getElementById(`${cellPrefix}-${targetDeptIdx}-${targetDateIdx}`) as HTMLInputElement | null;
      if (nextElem) {
        nextElem.focus();
        nextElem.select();
      }
    }
  };

  // Auto distribute order qty evenly across all working days (Bangladesh off-day: Friday)
  const handleDwAutoDistribute = (targetDept?: string) => {
    if (!dwCurrentOrder) return;
    const totalQty = dwCurrentOrder.quantity || 1000;
    const workDays = dwDatesList.filter(d => !d.isFriday);
    if (workDays.length === 0) return;

    const basePerDay = Math.floor(totalQty / workDays.length);
    const remainder = totalQty - (basePerDay * workDays.length);

    setDwSchedule((prev) => {
      const next = { ...prev };
      const deptsToUpdate = targetDept ? [targetDept] : Object.keys(getOrderPlan(dwCurrentOrder).sections);

      deptsToUpdate.forEach((dept) => {
        const deptMap: Record<string, number> = {};
        let rem = remainder;
        dwDatesList.forEach((d) => {
          if (d.isFriday) {
            deptMap[d.dateStr] = 0;
          } else {
            const add = rem > 0 ? 1 : 0;
            if (rem > 0) rem--;
            deptMap[d.dateStr] = basePerDay + add;
          }
        });
        next[dept] = deptMap;
      });

      return next;
    });

    toast.success(`Distributed ${totalQty} ${dwCurrentOrder.unit || defaultProductionUnit} evenly across ${workDays.length} working days (Fridays excluded)!`);
  };

  // Pipeline Cascade (Staggered department starts: Cutting -> Sewing -> Lasting -> Packing)
  const handleDwCascadePipeline = () => {
    if (!dwCurrentOrder) return;
    const totalQty = dwCurrentOrder.quantity || 1000;
    const workDays = dwDatesList.filter(d => !d.isFriday);
    if (workDays.length < 4) {
      handleDwAutoDistribute();
      return;
    }

    const depts = Object.keys(getOrderPlan(dwCurrentOrder).sections);
    const durationDays = Math.max(2, Math.floor(workDays.length * 0.65));
    const pace = Math.ceil(totalQty / durationDays);

    setDwSchedule((prev) => {
      const next = { ...prev };
      depts.forEach((dept, deptIdx) => {
        const deptOffset = Math.min(deptIdx * 2, Math.max(0, workDays.length - durationDays));
        const deptMap: Record<string, number> = {};
        let allocated = 0;

        workDays.forEach((wd, wdIdx) => {
          if (wdIdx >= deptOffset && allocated < totalQty) {
            const qty = Math.min(pace, totalQty - allocated);
            deptMap[wd.dateStr] = qty;
            allocated += qty;
          } else {
            deptMap[wd.dateStr] = 0;
          }
        });

        // Ensure Friday off-days are 0
        dwDatesList.filter(d => d.isFriday).forEach(d => {
          deptMap[d.dateStr] = 0;
        });

        next[dept] = deptMap;
      });
      return next;
    });

    toast.success('Generated cascaded pipeline schedule with department lead-times (Fridays off)!');
  };

  // Fill Fixed Daily Pace (Fridays off)
  const handleDwFillDailyPace = (targetDept?: string) => {
    if (!dwCurrentOrder || dwQuickDailyPace <= 0) return;
    setDwSchedule((prev) => {
      const next = { ...prev };
      const deptsToUpdate = targetDept ? [targetDept] : Object.keys(getOrderPlan(dwCurrentOrder).sections);
      deptsToUpdate.forEach((dept) => {
        const deptMap: Record<string, number> = {};
        dwDatesList.forEach((d) => {
          deptMap[d.dateStr] = d.isFriday ? 0 : dwQuickDailyPace;
        });
        next[dept] = deptMap;
      });
      return next;
    });
    toast.success(`Applied ${dwQuickDailyPace}/day across working days (Fridays excluded)!`);
  };

  // Copy schedule from one dept to all other depts
  const handleDwCopyDeptSchedule = (sourceDept: string) => {
    const srcMap = dwSchedule[sourceDept] || {};
    setDwSchedule((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((dept) => {
        next[dept] = { ...srcMap };
      });
      return next;
    });
    toast.success(`Copied ${sourceDept} schedule to all departments!`);
  };

  // Clear date-wise grid
  const handleDwClearGrid = (targetDept?: string) => {
    setDwSchedule((prev) => {
      const next = { ...prev };
      if (targetDept) {
        next[targetDept] = {};
      } else if (dwCurrentOrder) {
        Object.keys(getOrderPlan(dwCurrentOrder).sections).forEach((d) => {
          next[d] = {};
        });
      }
      return next;
    });
    toast.info('Schedule cleared.');
  };

  // Export Date-Wise plan to CSV
  const handleExportDateWiseCSV = (order: BuyerOrder) => {
    const plan = getOrderPlan(order);
    const depts = Object.keys(plan.sections);
    const dates = dwDatesList.length > 0 ? dwDatesList : getDatesInRange(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    );

    let csvContent = `Date-Wise Production Plan\n`;
    csvContent += `Order Number, #${order.orderNumber}\n`;
    csvContent += `Buyer, "${order.buyerName || ''}"\n`;
    csvContent += `Article, "${order.articleName || ''}"\n`;
    csvContent += `Order Quantity, ${order.quantity} ${order.unit || defaultProductionUnit}\n`;
    csvContent += `Period, ${dates[0]?.dateStr} to ${dates[dates.length - 1]?.dateStr}\n\n`;

    // Headers
    const headerRow = ['Department', ...dates.map(d => `${d.dateStr} (${d.dayName})`), 'Total Planned', 'Order Qty', 'Balance'];
    csvContent += headerRow.join(',') + '\n';

    // Rows
    depts.forEach(dept => {
      const sched = plan.dateWiseTargets?.[dept] || plan.sections[dept]?.dailyBreakdown || dwSchedule[dept] || {};
      let rowSum = 0;
      const dateVals = dates.map(d => {
        const val = sched[d.dateStr] || 0;
        rowSum += val;
        return val;
      });
      const orderQty = order.quantity || 0;
      const balance = orderQty - rowSum;
      const row = [`"${dept}"`, ...dateVals, rowSum, orderQty, balance];
      csvContent += row.join(',') + '\n';
    });

    // Daily totals row
    const dailyTotals = dates.map(d => {
      let dSum = 0;
      depts.forEach(dept => {
        const sched = plan.dateWiseTargets?.[dept] || plan.sections[dept]?.dailyBreakdown || dwSchedule[dept] || {};
        dSum += sched[d.dateStr] || 0;
      });
      return dSum;
    });
    csvContent += ['"DAILY FACTORY TOTAL"', ...dailyTotals, '', '', ''].join(',') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Date_Wise_Production_Plan_Order_${order.orderNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported Date-Wise plan to CSV!');
  };

  // Save the full Date-Wise schedule into OrderProductionPlan
  const handleSaveDateWisePlan = async () => {
    if (!dwCurrentOrder) return;
    setDwIsSaving(true);

    try {
      const currentPlan = getOrderPlan(dwCurrentOrder);
      const updatedSections: Record<string, SectionPlanTarget> = {};

      Object.keys(currentPlan.sections).forEach((dept) => {
        const existingTarget = currentPlan.sections[dept];
        const deptDateMap = dwSchedule[dept] || {};

        // Calculate total planned in grid for this department
        let totalGridPlanned = 0;
        let activeWorkDays = 0;
        Object.entries(deptDateMap).forEach(([_, val]) => {
          if (val > 0) {
            totalGridPlanned += val;
            activeWorkDays++;
          }
        });

        const maxQty = Number(dwCurrentOrder.quantity) || 0;
        const clampedGridPlanned = maxQty > 0 ? Math.min(maxQty, totalGridPlanned) : totalGridPlanned;

        const finalTotalTarget: number = clampedGridPlanned > 0
          ? clampedGridPlanned
          : (maxQty > 0 ? Math.min(maxQty, existingTarget.totalTarget || maxQty) : (existingTarget.totalTarget || 0));

        // Compute new daily target from grid if grid has data
        const calcDaily = activeWorkDays > 0
          ? Math.ceil(finalTotalTarget / activeWorkDays)
          : Math.min(finalTotalTarget, existingTarget.dailyTarget || Math.ceil(finalTotalTarget / 10));

        const calcMonthly = Math.min(finalTotalTarget, existingTarget.monthlyTarget || finalTotalTarget);

        updatedSections[dept] = {
          ...existingTarget,
          dailyTarget: calcDaily,
          weeklyTarget: Math.min(finalTotalTarget, calcDaily * DEFAULT_WORKING_DAYS_PER_WEEK),
          monthlyTarget: calcMonthly,
          totalTarget: finalTotalTarget,
          dailyBreakdown: deptDateMap,
        };
      });

      const planPayload: OrderProductionPlan = {
        id: `plan_${dwCurrentOrder.id}`,
        orderId: dwCurrentOrder.id,
        orderNumber: dwCurrentOrder.orderNumber,
        buyerName: dwCurrentOrder.buyerName,
        articleName: dwCurrentOrder.articleName,
        totalQuantity: dwCurrentOrder.quantity,
        unit: dwCurrentOrder.unit || defaultProductionUnit,
        startDate: dwStartDate,
        targetDeliveryDate: dwCurrentOrder.deliveryDate ? dwCurrentOrder.deliveryDate.slice(0, 10) : undefined,
        sections: updatedSections,
        dateWiseTargets: dwSchedule,
        status: 'In Progress',
        updatedAt: new Date().toISOString(),
      };

      await apiService.saveProductionPlan(planPayload);

      setPlans((prev) => {
        const idx = prev.findIndex((p) => p.orderId === dwCurrentOrder.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = planPayload;
          return next;
        }
        return [planPayload, ...prev];
      });

      toast.success(`Date-wise monthly plan for Order #${dwCurrentOrder.orderNumber} saved successfully!`);
      setIsDateWiseModalOpen(false);
    } catch (e) {
      console.error('Failed to save date-wise plan:', e);
      showAlert({ title: 'Save Failed', message: 'Could not save date-wise production plan. Please try again.', type: 'error' });
    } finally {
      setDwIsSaving(false);
    }
  };

  // Monthly Plan computed values
  const mpEndDate = useMemo(() => {
    if (mpPeriodType === 'custom') return mpCustomEndDate;
    return calcPeriodEnd(mpStartDate, mpPeriodType);
  }, [mpPeriodType, mpStartDate, mpCustomEndDate]);

  const mpWorkingDays = useMemo(() => getWorkingDaysBetween(mpStartDate, mpEndDate), [mpStartDate, mpEndDate]);

  const mpPeriodLabel = useMemo(() => {
    const labels: Record<string, string> = { '15days': '15 Days', '1month': '1 Month', '2months': '2 Months', '3months': '3 Months', 'custom': 'Custom Range' };
    return labels[mpPeriodType] || '1 Month';
  }, [mpPeriodType]);

  // Filtered orders for Monthly Plan tab
  const mpFilteredOrders = useMemo(() => {
    let list = uniqueOrders.filter(o => o.status !== 'Completed');
    if (mpSearchQuery.trim()) {
      const q = mpSearchQuery.toLowerCase();
      list = list.filter(o =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q) ||
        o.articleName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [uniqueOrders, mpSearchQuery]);

  // Helper to compute actual production within a custom date range for a specific order+dept
  const getActualInPeriod = (orderId: string, deptName: string, startDate: string, endDate: string) => {
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);
    const orderFlows = productionFlows.filter(f => f.orderId === orderId && f.department === deptName);
    const flowsUpToEnd = orderFlows.filter(f => { if (!f.updatedAt) return false; return new Date(f.updatedAt) <= end; });
    const flowsBeforeStart = orderFlows.filter(f => { if (!f.updatedAt) return false; return new Date(f.updatedAt) < start; });
    const resEnd = calculateMultiProcessProduction(flowsUpToEnd, deptName);
    const resStart = calculateMultiProcessProduction(flowsBeforeStart, deptName);
    return Math.max(0, resEnd.totalCompleted - resStart.totalCompleted);
  };

  // Get period target for an order's department (custom override or auto-calculated from plan)
  const getMpDeptTarget = (order: BuyerOrder, dept: string): number => {
    // Check for custom override first
    if (mpOrderTargets[order.id]?.[dept] !== undefined) return mpOrderTargets[order.id][dept];
    // Auto-calculate from existing plan daily target × working days
    const plan = getOrderPlan(order);
    const dailyTarget = plan.sections[dept]?.dailyTarget || 0;
    return dailyTarget * mpWorkingDays;
  };

  // Open Monthly Plan edit modal for an order
  const handleOpenMpEdit = (order: BuyerOrder) => {
    const plan = getOrderPlan(order);
    const targets: Record<string, number> = {};
    Object.keys(plan.sections).forEach(dept => {
      targets[dept] = getMpDeptTarget(order, dept);
    });
    setMpEditTargets(targets);
    setMpEditingOrder(order);
  };

  // Save monthly plan targets
  const handleSaveMpTargets = () => {
    if (!mpEditingOrder) return;
    setMpIsSaving(true);
    setMpOrderTargets(prev => ({
      ...prev,
      [mpEditingOrder.id]: { ...mpEditTargets },
    }));
    toast.success(`Period targets for Order #${mpEditingOrder.orderNumber} saved!`);
    setMpEditingOrder(null);
    setMpIsSaving(false);
  };

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
  // Helper to compute actual production output for a specific order and department across horizons
  const getOrderDeptMetrics = (
    orderId: string,
    deptName: string,
    sectionPlan?: SectionPlanTarget,
    targetDateStr: string = planningDate
  ) => {
    const targetDate = new Date(targetDateStr || new Date().toISOString().slice(0, 10));
    targetDate.setHours(0, 0, 0, 0);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const { monday, sunday } = getWeekRange(targetDate);
    // Week start is clipped to 1st of current month
    const weekStart = new Date(monday < firstOfMonth ? firstOfMonth : monday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(sunday > lastOfMonth ? lastOfMonth : sunday);
    weekEnd.setHours(23, 59, 59, 999);

    const orderFlows = productionFlows.filter((f) => f.orderId === orderId && f.department === deptName);

    const resAll = calculateMultiProcessProduction(orderFlows, deptName);
    const totalActual = resAll.totalCompleted;

    // Actual production on targetDate (Local Bangladesh timezone safe)
    const targetDateLocalStr = targetDateStr || getFlowLocalDate(targetDate);

    const todayFlows = orderFlows.filter((f) => isFlowOnDate(f.updatedAt, targetDateLocalStr));
    const resToday = calculateMultiProcessProduction(todayFlows, deptName);
    const todayActual = resToday.totalCompleted;

    const weekStartStr = getFlowLocalDate(weekStart);
    const weekEndStr = getFlowLocalDate(weekEnd);
    const weekFlows = orderFlows.filter((f) => {
      const fDate = getFlowLocalDate(f.updatedAt);
      return fDate >= weekStartStr && fDate <= weekEndStr;
    });
    const resWeek = calculateMultiProcessProduction(weekFlows, deptName);
    const weekActual = resWeek.totalCompleted;

    const monthStartStr = getFlowLocalDate(firstOfMonth);
    const monthEndStr = getFlowLocalDate(lastOfMonth);
    const monthFlows = orderFlows.filter((f) => {
      const fDate = getFlowLocalDate(f.updatedAt);
      return fDate >= monthStartStr && fDate <= monthEndStr;
    });
    const resMonth = calculateMultiProcessProduction(monthFlows, deptName);
    const monthActual = resMonth.totalCompleted;

    // Retrieve Date-Wise Production Schedule map
    const orderPlan = plans.find((p) => p.orderId === orderId || p.orderNumber === orderId);
    const matchedOrder = uniqueOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const maxOrderQty = matchedOrder?.quantity || orderPlan?.totalQuantity || 0;

    const orderHasDateWiseSchedule = Boolean(
      orderPlan?.dateWiseTargets &&
      Object.values(orderPlan.dateWiseTargets).some((dMap) =>
        dMap && Object.values(dMap).some((v) => typeof v === 'number' && v > 0)
      )
    );

    const dateMap = orderPlan?.dateWiseTargets?.[deptName] || sectionPlan?.dailyBreakdown;
    const hasSectionSchedule = Boolean(dateMap && Object.values(dateMap).some((v) => typeof v === 'number' && v > 0));

    // Calculate sum of all scheduled dates in grid for this section
    let totalScheduleSum = 0;
    let daySumFromSchedule = 0;
    let weekSumFromSchedule = 0;
    let monthSumFromSchedule = 0;

    if (dateMap && typeof dateMap === 'object') {
      Object.entries(dateMap).forEach(([dStr, val]) => {
        if (typeof val === 'number' && val > 0) {
          totalScheduleSum += val;
          if (dStr === targetDateLocalStr) daySumFromSchedule += val;
          if (dStr >= weekStartStr && dStr <= weekEndStr) weekSumFromSchedule += val;
          if (dStr >= monthStartStr && dStr <= monthEndStr) monthSumFromSchedule += val;
        }
      });
    }

    let dailyTarget = 0;
    let weeklyTarget = 0;
    let monthlyTarget = 0;
    let totalTarget = 0;
    let isDateWiseDaily = false;

    if (orderHasDateWiseSchedule || hasSectionSchedule) {
      // Strictly use date-wise plan schedule from sheet
      totalTarget = maxOrderQty > 0 ? Math.min(maxOrderQty, totalScheduleSum) : totalScheduleSum;
      dailyTarget = Math.min(totalTarget, daySumFromSchedule);
      weeklyTarget = Math.min(totalTarget, weekSumFromSchedule);
      monthlyTarget = Math.min(totalTarget, monthSumFromSchedule);
      isDateWiseDaily = true;
    } else {
      // Fallback to section base target only if no date-wise sheet is configured
      const rawTotal = sectionPlan?.totalTarget && sectionPlan.totalTarget > 0 ? sectionPlan.totalTarget : maxOrderQty;
      totalTarget = maxOrderQty > 0 ? Math.min(maxOrderQty, rawTotal) : rawTotal;
      dailyTarget = sectionPlan?.dailyTarget && sectionPlan.dailyTarget > 0 ? Math.min(totalTarget, sectionPlan.dailyTarget) : (totalTarget > 0 ? Math.ceil(totalTarget / 10) : 0);
      weeklyTarget = sectionPlan?.weeklyTarget && sectionPlan.weeklyTarget > 0 ? Math.min(totalTarget, sectionPlan.weeklyTarget) : Math.min(totalTarget, dailyTarget * 6);
      monthlyTarget = sectionPlan?.monthlyTarget && sectionPlan.monthlyTarget > 0 ? Math.min(totalTarget, sectionPlan.monthlyTarget) : totalTarget;
    }

    const todayDue = Math.max(0, dailyTarget - todayActual);
    const weekDue = Math.max(0, weeklyTarget - weekActual);
    const monthDue = Math.max(0, monthlyTarget - monthActual);
    const totalDue = Math.max(0, totalTarget - totalActual);

    const dailyPct = dailyTarget > 0 ? Math.min(100, Math.round((todayActual / dailyTarget) * 100)) : (todayActual > 0 ? 100 : 0);
    const weeklyPct = weeklyTarget > 0 ? Math.min(100, Math.round((weekActual / weeklyTarget) * 100)) : (weekActual > 0 ? 100 : 0);
    const monthlyPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthActual / monthlyTarget) * 100)) : (monthActual > 0 ? 100 : 0);
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
      monthlyPct,
      totalPct,
      status,
      isDateWiseDaily,
      hasDateWiseSchedule: Boolean(orderHasDateWiseSchedule || hasSectionSchedule),
    };
  };

  // Executive Factory-Wide KPI Summary
  const factorySummary = useMemo(() => {
    let plannedDailyTotal = 0;
    let plannedWeeklyTotal = 0;
    let plannedMonthlyTotal = 0;
    let dailyRemainingTotal = 0;
    let weeklyRemainingTotal = 0;
    let monthlyRemainingTotal = 0;
    let actualTodayTotal = 0;
    let actualWeekTotal = 0;
    let totalFactoryDue = 0;
    let behindSectionsCount = 0;

    const targetDate = new Date(planningDate || new Date().toISOString().slice(0, 10));
    targetDate.setHours(0, 0, 0, 0);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const { monday, sunday } = getWeekRange(targetDate);
    const weekStart = new Date(monday < firstOfMonth ? firstOfMonth : monday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(sunday > lastOfMonth ? lastOfMonth : sunday);
    weekEnd.setHours(23, 59, 59, 999);

    uniqueOrders.forEach((order) => {
      if (order.status === 'Completed') return;
      const plan = getOrderPlan(order);
      Object.entries(plan.sections).forEach(([dept, sTarget]) => {
        const metrics = getOrderDeptMetrics(order.id, dept, sTarget, planningDate);
        plannedDailyTotal += metrics.dailyTarget;
        plannedWeeklyTotal += metrics.weeklyTarget;
        plannedMonthlyTotal += metrics.monthlyTarget;
        dailyRemainingTotal += metrics.todayDue;
        weeklyRemainingTotal += metrics.weekDue;
        monthlyRemainingTotal += metrics.monthDue;

        if (metrics.todayDue > 0) behindSectionsCount++;
        totalFactoryDue += metrics.totalDue;
      });
    });

    const planDateLocalStr = planningDate || getFlowLocalDate(targetDate);
    const weekStartStr = getFlowLocalDate(weekStart);
    const weekEndStr = getFlowLocalDate(weekEnd);
    const monthStartStr = getFlowLocalDate(firstOfMonth);
    const monthEndStr = getFlowLocalDate(lastOfMonth);

    actualTodayTotal = productionFlows
      .filter((f) => isFlowOnDate(f.updatedAt, planDateLocalStr))
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    actualWeekTotal = productionFlows
      .filter((f) => {
        const fDate = getFlowLocalDate(f.updatedAt);
        return fDate >= weekStartStr && fDate <= weekEndStr;
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const actualMonthTotal = productionFlows
      .filter((f) => {
        const fDate = getFlowLocalDate(f.updatedAt);
        return fDate >= monthStartStr && fDate <= monthEndStr;
      })
      .reduce((sum, f) => sum + (f.completed || 0), 0);

    const todayFillRate = plannedDailyTotal > 0 ? Math.min(100, Math.round((actualTodayTotal / plannedDailyTotal) * 100)) : 0;
    const weekFillRate = plannedWeeklyTotal > 0 ? Math.min(100, Math.round((actualWeekTotal / plannedWeeklyTotal) * 100)) : 0;
    const monthFillRate = plannedMonthlyTotal > 0 ? Math.min(100, Math.round((actualMonthTotal / plannedMonthlyTotal) * 100)) : 0;

    return {
      plannedDailyTotal,
      plannedWeeklyTotal,
      plannedMonthlyTotal,
      dailyRemainingTotal,
      weeklyRemainingTotal,
      monthlyRemainingTotal,
      actualTodayTotal,
      actualWeekTotal,
      actualMonthTotal,
      todayFillRate,
      weekFillRate,
      monthFillRate,
      totalFactoryDue,
      behindSectionsCount,
      activeOrdersCount: uniqueOrders.filter((o) => o.status !== 'Completed').length,
    };
  }, [uniqueOrders, plans, productionFlows, validDeptNames, departments, planningDate]);

  // Section-Wise Target & Production Rollup for All Factory Departments
  const factorySectionSummary = useMemo(() => {
    const targetDate = new Date(planningDate || new Date().toISOString().slice(0, 10));
    targetDate.setHours(0, 0, 0, 0);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const { monday, sunday } = getWeekRange(targetDate);
    const weekStart = new Date(monday < firstOfMonth ? firstOfMonth : monday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(sunday > lastOfMonth ? lastOfMonth : sunday);
    weekEnd.setHours(23, 59, 59, 999);

    const planDateLocalStr = planningDate || getFlowLocalDate(targetDate);
    const weekStartStr = getFlowLocalDate(weekStart);
    const weekEndStr = getFlowLocalDate(weekEnd);
    const monthStartStr = getFlowLocalDate(firstOfMonth);
    const monthEndStr = getFlowLocalDate(lastOfMonth);

    return validDeptNames.map((dept) => {
      let plannedDaily = 0;
      let plannedWeekly = 0;
      let plannedMonthly = 0;
      let totalPlanned = 0;
      let activeOrdersForDept = 0;

      uniqueOrders.forEach((order) => {
        if (order.status === 'Completed') return;
        const reqDepts = (order.requiredDepartments && order.requiredDepartments.length > 0)
          ? order.requiredDepartments
          : validDeptNames;

        if (!reqDepts.includes(dept)) return;
        activeOrdersForDept++;

        const plan = getOrderPlan(order);
        const sTarget = plan.sections[dept];
        if (sTarget) {
          const metrics = getOrderDeptMetrics(order.id, dept, sTarget, planningDate);
          plannedDaily += metrics.dailyTarget;
          plannedWeekly += metrics.weeklyTarget;
          plannedMonthly += metrics.monthlyTarget;
          totalPlanned += metrics.totalTarget;
        } else {
          const defaultDaily = Math.ceil((order.quantity || 0) / 10);
          plannedDaily += defaultDaily;
          plannedWeekly += defaultDaily * 6;
          plannedMonthly += (order.quantity || 0);
          totalPlanned += (order.quantity || 0);
        }
      });

      const deptFlows = productionFlows.filter((f) => f.department === dept);

      const actualToday = deptFlows
        .filter((f) => isFlowOnDate(f.updatedAt, planDateLocalStr))
        .reduce((sum, f) => sum + (f.completed || 0), 0);

      const actualWeek = deptFlows
        .filter((f) => {
          const fDate = getFlowLocalDate(f.updatedAt);
          return fDate >= weekStartStr && fDate <= weekEndStr;
        })
        .reduce((sum, f) => sum + (f.completed || 0), 0);

      const actualMonth = deptFlows
        .filter((f) => {
          const fDate = getFlowLocalDate(f.updatedAt);
          return fDate >= monthStartStr && fDate <= monthEndStr;
        })
        .reduce((sum, f) => sum + (f.completed || 0), 0);

      const actualTotal = deptFlows.reduce((sum, f) => sum + (f.completed || 0), 0);

      let targetVal = plannedDaily;
      let actualVal = actualToday;
      if (overviewSectionHorizon === 'weekly') {
        targetVal = plannedWeekly;
        actualVal = actualWeek;
      } else if (overviewSectionHorizon === 'monthly') {
        targetVal = plannedMonthly;
        actualVal = actualMonth;
      } else if (overviewSectionHorizon === 'total') {
        targetVal = totalPlanned;
        actualVal = actualTotal;
      }

      const remainingDue = Math.max(0, targetVal - actualVal);
      const fillRate = targetVal > 0 ? Math.min(100, Math.round((actualVal / targetVal) * 100)) : (actualVal > 0 ? 100 : 0);
      const isDone = remainingDue === 0 && targetVal > 0;

      return {
        department: dept,
        plannedDaily,
        plannedWeekly,
        plannedMonthly,
        totalPlanned,
        actualToday,
        actualWeek,
        actualMonth,
        actualTotal,
        targetVal,
        actualVal,
        remainingDue,
        fillRate,
        isDone,
        activeOrdersForDept,
      };
    });
  }, [uniqueOrders, plans, productionFlows, validDeptNames, departments, planningDate, overviewSectionHorizon]);

  // Aggregate targets across all sections for the currently selected order
  const orderAggregateTargets = useMemo(() => {
    if (!selectedOrder) {
      return { daily: 0, weekly: 0, monthly: 0, dailyRemaining: 0, weeklyRemaining: 0, monthlyRemaining: 0, total: 0, todayActual: 0, weekActual: 0, monthActual: 0, totalActual: 0 };
    }
    const orderPlan = getOrderPlan(selectedOrder);
    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    let dailyRemaining = 0;
    let weeklyRemaining = 0;
    let monthlyRemaining = 0;
    let total = 0;
    let todayActual = 0;
    let weekActual = 0;
    let monthActual = 0;
    let totalActual = 0;

    Object.entries(orderPlan.sections).forEach(([dept, sTarget]) => {
      const m = getOrderDeptMetrics(selectedOrder.id, dept, sTarget, planningDate);
      daily += m.dailyTarget;
      weekly += m.weeklyTarget;
      monthly += m.monthlyTarget;
      dailyRemaining += m.todayDue;
      weeklyRemaining += m.weekDue;
      monthlyRemaining += m.monthDue;
      total += m.totalTarget;
      todayActual += m.todayActual;
      weekActual += m.weekActual;
      monthActual += m.monthActual;
      totalActual += m.totalActual;
    });

    return { daily, weekly, monthly, dailyRemaining, weeklyRemaining, monthlyRemaining, total, todayActual, weekActual, monthActual, totalActual };
  }, [selectedOrder, plans, planningDate, productionFlows]);

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

  // Save modified plan with strict bounds on order quantity
  const handleSavePlan = async () => {
    if (!editingPlanOrder) return;
    setIsSavingPlan(true);

    const maxOrderQty = editingPlanOrder.quantity || 0;
    const validatedSections: Record<string, SectionPlanTarget> = {};

    Object.entries(editSections).forEach(([dept, sTarget]) => {
      const rawTarget = typeof sTarget.totalTarget === 'number' ? sTarget.totalTarget : maxOrderQty;
      const clampedTotal: number = maxOrderQty > 0 ? Math.min(maxOrderQty, rawTarget || maxOrderQty) : (rawTarget || 0);
      const clampedDaily: number = Math.min(clampedTotal, sTarget.dailyTarget || 0);
      const clampedMonthly: number = Math.min(clampedTotal, sTarget.monthlyTarget || clampedTotal);
      validatedSections[dept] = {
        ...sTarget,
        totalTarget: clampedTotal,
        dailyTarget: clampedDaily,
        weeklyTarget: Math.min(clampedTotal, sTarget.weeklyTarget || (clampedDaily * DEFAULT_WORKING_DAYS_PER_WEEK)),
        monthlyTarget: clampedMonthly,
      };
    });

    try {
      const existingPlan = plans.find((p) => p.orderId === editingPlanOrder.id || p.orderNumber === editingPlanOrder.orderNumber);
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
        sections: validatedSections,
        dateWiseTargets: existingPlan?.dateWiseTargets || {},
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
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-6 shadow-sm space-y-3.5 sm:space-y-5">
        {/* Top title and View Mode tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25 flex-shrink-0">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-700 block truncate">
                EASYCALC FACTORY ERP
              </span>
              <h1 className="text-base sm:text-2xl font-black text-black tracking-tight truncate">
                Production Planning & Target Control
              </h1>
            </div>
          </div>

          {/* 4-Tab Segmented Switcher */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl sm:rounded-2xl w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('order-plans')}
              className={`py-1.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 ${activeTab === 'order-plans'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                : 'text-slate-700 hover:text-black'
                }`}
            >
              <Target className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Orders</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`py-1.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 ${activeTab === 'matrix'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                : 'text-slate-700 hover:text-black'
                }`}
            >
              <Layers className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('monthly-plan')}
              className={`py-1.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 ${activeTab === 'monthly-plan'
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm'
                : 'text-slate-700 hover:text-black'
                }`}
            >
              <CalendarRange className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Monthly Plan</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`py-1.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition flex items-center justify-center gap-1 sm:gap-1.5 ${activeTab === 'simulator'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                : 'text-slate-700 hover:text-black'
                }`}
            >
              <Zap className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Timeline</span>
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Cards (Clickable to view detailed Target-Wise Production Entries) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 pt-3 border-t border-slate-200">
          {/* Today's Target vs Produced */}
          <Link
            href="/planning/target-status?view=daily"
            className="bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-400 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5 shadow-xs transition group cursor-pointer"
            title="Click to view Today's Target-Wise Production Entries"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-blue-700 uppercase tracking-wider flex items-center gap-1">
                <span>Today&apos;s Target</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full ${factorySummary.todayFillRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                {factorySummary.todayFillRate}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-blue-700">
                {factorySummary.actualTodayTotal.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-600 font-semibold">
                / {factorySummary.plannedDailyTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full"
                style={{ width: `${factorySummary.todayFillRate}%` }}
              />
            </div>
          </Link>

          {/* This Week's Target vs Produced */}
          <Link
            href="/planning/target-status?view=weekly"
            className="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5 shadow-xs transition group cursor-pointer"
            title="Click to view Weekly Target-Wise Production Entries"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                <span>Weekly Target</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {factorySummary.weekFillRate}%
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-emerald-700">
                {factorySummary.actualWeekTotal.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-600 font-semibold">
                / {factorySummary.plannedWeeklyTotal.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 h-full rounded-full"
                style={{ width: `${factorySummary.weekFillRate}%` }}
              />
            </div>
          </Link>

          {/* Factory Total Due / Backlog */}
          <Link
            href="/planning/target-status?view=due"
            className="bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-400 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5 shadow-xs transition group cursor-pointer"
            title="Click to view Total Factory Due & Backlog by Section"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-rose-700 uppercase tracking-wider flex items-center gap-1">
                <span>Total Factory Due</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Backlog
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-xl font-black text-rose-700">
                {factorySummary.totalFactoryDue.toLocaleString()}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-600 font-semibold">{defaultProductionUnit}</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 truncate">
              Uncompleted target work
            </p>
          </Link>

          {/* Active Orders & Behind Sections */}
          <Link
            href="/planning/target-status?view=operations"
            className="bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-400 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1.5 shadow-xs transition group cursor-pointer"
            title="Click to view Active Operations with pending section work"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 group-hover:text-amber-700 uppercase tracking-wider flex items-center gap-1">
                <span>Active Operations</span>
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {factorySummary.activeOrdersCount} Orders
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-base sm:text-xl font-black text-amber-700">
                {factorySummary.behindSectionsCount}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-600 font-semibold">Sections Due</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-600 truncate">
              Across running departments
            </p>
          </Link>
        </div>

        {/* Section-Wise Target & Production Breakdown Grid */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-blue-700" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Section-Wise Production Targets & Live Output
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                {validDeptNames.length} Sections
              </span>
            </div>

            {/* Horizon Filter Switcher & Link to full page */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setOverviewSectionHorizon('daily')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    overviewSectionHorizon === 'daily' ? 'bg-white text-blue-700 shadow-2xs font-black' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewSectionHorizon('weekly')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    overviewSectionHorizon === 'weekly' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewSectionHorizon('monthly')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    overviewSectionHorizon === 'monthly' ? 'bg-white text-purple-700 shadow-2xs font-black' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewSectionHorizon('total')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    overviewSectionHorizon === 'total' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-black'
                  }`}
                >
                  Total Due
                </button>
              </div>

              <Link
                href={`/planning/target-status?view=${overviewSectionHorizon === 'total' ? 'due' : overviewSectionHorizon}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition"
                title="Open detailed target entries and logs page"
              >
                <span>View Full Entries</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Section Target Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
            {factorySectionSummary.map((sec) => (
              <Link
                key={sec.department}
                href={`/planning/target-status?view=${overviewSectionHorizon === 'total' ? 'due' : overviewSectionHorizon}`}
                className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition group cursor-pointer shadow-2xs ${
                  sec.isDone
                    ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-400'
                    : sec.fillRate > 0
                    ? 'bg-slate-50 hover:bg-blue-50/50 border-slate-200 hover:border-blue-300'
                    : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                }`}
                title={`Click to view target entries for ${sec.department}`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-black text-xs text-black group-hover:text-blue-700 truncate">
                    {sec.department}
                  </span>
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                    sec.isDone
                      ? 'bg-emerald-100 text-emerald-800'
                      : sec.fillRate > 0
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {sec.fillRate}%
                  </span>
                </div>

                <div className="space-y-0.5 text-[11px]">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-500 font-semibold">Target:</span>
                    <strong className="text-black font-bold">{sec.targetVal.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-500 font-semibold">Produced:</span>
                    <strong className="text-emerald-700 font-black">+{sec.actualVal.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] text-slate-500 font-semibold">Due:</span>
                    <strong className={sec.remainingDue > 0 ? 'text-rose-700 font-black' : 'text-slate-400'}>
                      {sec.remainingDue.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      sec.isDone ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${sec.fillRate}%` }}
                  />
                </div>
              </Link>
            ))}
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
                className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-semibold text-[var(--ec-foreground)] focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Order Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>

              {/* Mobile Order Dropdown Selector & Quick Add Plan */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-blue-500 appearance-none cursor-pointer pr-8 truncate"
                  >
                    {filteredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber} - {o.buyerName} ({o.quantity} {o.unit || defaultProductionUnit})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ec-muted)] pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenDateWisePlanner(selectedOrder, '1month')}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs flex-shrink-0"
                  title="Create or edit date-wise production schedule"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Create Plan</span>
                </button>
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
                const hasDateWise = Boolean(plan.dateWiseTargets && Object.keys(plan.dateWiseTargets).length > 0);

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl border text-left transition flex items-center gap-2.5 ${isSelected
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold ring-1 ring-blue-500 shadow-xs'
                      : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs">#{order.orderNumber}</span>
                        {hasDateWise && (
                          <span className="text-[9px] font-black px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Excel
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{overallPct}%</span>
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
            <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 shadow-xs space-y-4 sm:space-y-5">
              {/* Order Header Summary Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[var(--ec-border)]">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--ec-foreground)] truncate">
                      Order #{selectedOrder.orderNumber}
                    </h2>
                    <span className="text-xs text-[var(--ec-muted)] font-medium truncate">
                      ({selectedOrder.buyerName})
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                      {selectedOrder.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ec-muted)]">
                    Article: <strong className="text-[var(--ec-foreground)] font-semibold">{selectedOrder.articleName || 'Standard'}</strong> • Total Planned: <strong className="text-[var(--ec-foreground)] font-bold">{selectedOrder.quantity} {selectedOrder.unit || defaultProductionUnit}</strong>
                  </p>
                </div>

                {/* Primary CTA: Create Date-wise Plan + Quick Targets */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenDateWisePlanner(selectedOrder, '1month')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-black transition shadow-md shadow-blue-500/20 w-full sm:w-auto"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Create / Edit Date-Wise Plan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditPlan(selectedOrder)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--ec-foreground)] text-xs font-semibold transition shadow-xs w-full sm:w-auto"
                    title="Quick daily targets"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--ec-muted)]" />
                    <span className="hidden md:inline">Quick Targets</span>
                  </button>
                </div>
              </div>

              {/* 4 TARGET HORIZON OPTIONS (Daily Target | Weekly Target | Monthly Target | Total Target) + MANPOWER DATE SELECTOR */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 border border-[var(--ec-border)] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('daily')}
                    className={`py-2 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 sm:gap-1.5 ${targetHorizonFilter === 'daily'
                      ? 'bg-white dark:bg-slate-900 text-[var(--ec-foreground)] shadow-xs font-bold'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                      }`}
                  >
                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="truncate">Daily Target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('weekly')}
                    className={`py-2 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 sm:gap-1.5 ${targetHorizonFilter === 'weekly'
                      ? 'bg-white dark:bg-slate-900 text-[var(--ec-foreground)] shadow-xs font-bold'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                      }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="truncate">Weekly Target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('monthly')}
                    className={`py-2 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 sm:gap-1.5 ${targetHorizonFilter === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-[var(--ec-foreground)] shadow-xs font-bold'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                      }`}
                  >
                    <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="truncate">Monthly Target</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetHorizonFilter('total')}
                    className={`py-2 px-1.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 sm:gap-1.5 ${targetHorizonFilter === 'total'
                      ? 'bg-white dark:bg-slate-900 text-[var(--ec-foreground)] shadow-xs font-bold'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                      }`}
                  >
                    <Target className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                    <span className="truncate">Total Target</span>
                  </button>
                </div>

                {/* Manpower Date Selector & HR Sync Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-[var(--ec-border)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-[var(--ec-foreground)]">Production & Roll-Call Date:</span>
                    <input
                      type="date"
                      value={planningDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlanningDate(val);
                        setDwStartDate(val);
                        setDwEndDate(calcPeriodEnd(val, dwRangePreset));
                      }}
                      className="px-2.5 py-1 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] text-xs font-bold text-[var(--ec-foreground)] outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[var(--ec-muted)] font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live HR Manpower Synced</span>
                  </div>
                </div>
              </div>

              {/* GRAND FACTORY & ORDER MULTI-HORIZON TARGETS SHOWCASE (When Total Target is selected) */}
              {targetHorizonFilter === 'total' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 text-white shadow-xl space-y-4 animate-fadeIn">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-indigo-500/30">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-500/20 text-cyan-300 border border-indigo-500/40">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                            ALL-SECTIONS COMBINED TARGETS
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                            Live Date-Wise Synced
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          Factory-Wide & Order Multi-Horizon Targets Overview
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <Link
                        href="/planning/target-status"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 text-xs font-bold transition shadow-xs"
                        title="Open full Target-Wise Production Status & Entry Logs page"
                      >
                        <Target className="h-3.5 w-3.5" />
                        <span>Target Entries Page</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <div className="text-xs text-indigo-200">
                        Selected Date: <strong className="text-cyan-300">{planningDate}</strong>
                      </div>
                    </div>
                  </div>

                  {/* 3 Grand Metric Cards: Today's Target | This Week Target | Monthly Target (Clickable to open detailed report) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                    {/* 1. Today's Total Target */}
                    <div
                      onClick={() => handleOpenReportModal('daily')}
                      className="p-4 rounded-xl bg-slate-800/90 border border-cyan-500/40 space-y-2.5 shadow-md hover:border-cyan-400 hover:shadow-cyan-500/10 cursor-pointer group hover:scale-[1.01] transition transform"
                      title="Click to view full Date-Wise Daily Production Report Sheet"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wide group-hover:text-cyan-200">
                          <Clock className="h-4 w-4 text-cyan-400" />
                          Today&apos;s Target
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-500/30">
                            {factorySummary.todayFillRate}% Filled
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition transform" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          {factorySummary.dailyRemainingTotal === 0 && factorySummary.plannedDailyTotal > 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              0 <span className="text-xs font-bold text-emerald-300">✓ All Completed</span>
                            </span>
                          ) : (
                            <span>
                              {factorySummary.dailyRemainingTotal.toLocaleString()} <span className="text-xs font-normal text-indigo-200">Due ({factorySummary.plannedDailyTotal.toLocaleString()} Plan)</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-indigo-200">
                          Produced Today: <strong className="text-emerald-400 font-bold">{factorySummary.actualTodayTotal.toLocaleString()}</strong> {defaultProductionUnit}
                        </div>
                      </div>
                      {selectedOrder && (
                        <div className="pt-2 border-t border-slate-700/60 text-[11px] text-cyan-200 flex items-center justify-between">
                          <span>Order #{selectedOrder.orderNumber}:</span>
                          <strong className="text-white font-bold">
                            {orderAggregateTargets.dailyRemaining === 0 && orderAggregateTargets.daily > 0
                              ? '✓ Done (0 Due)'
                              : `${orderAggregateTargets.dailyRemaining.toLocaleString()} Due (${orderAggregateTargets.daily.toLocaleString()} Plan)`}
                          </strong>
                        </div>
                      )}
                      <div className="pt-1 text-[10px] text-cyan-300/80 font-bold group-hover:text-cyan-200 flex items-center gap-1">
                        <span>📊 View Daily Report Sheet</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>

                    {/* 2. This Week Target */}
                    <div
                      onClick={() => handleOpenReportModal('weekly')}
                      className="p-4 rounded-xl bg-slate-800/90 border border-blue-500/40 space-y-2.5 shadow-md hover:border-blue-400 hover:shadow-blue-500/10 cursor-pointer group hover:scale-[1.01] transition transform"
                      title="Click to view full Date-Wise Weekly Production Report Sheet"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-blue-300 flex items-center gap-1.5 uppercase tracking-wide group-hover:text-blue-200">
                          <CalendarDays className="h-4 w-4 text-blue-400" />
                          This Week Target
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/30">
                            {factorySummary.weekFillRate}% Filled
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-blue-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition transform" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          {factorySummary.weeklyRemainingTotal === 0 && factorySummary.plannedWeeklyTotal > 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              0 <span className="text-xs font-bold text-emerald-300">✓ All Completed</span>
                            </span>
                          ) : (
                            <span>
                              {factorySummary.weeklyRemainingTotal.toLocaleString()} <span className="text-xs font-normal text-indigo-200">Due ({factorySummary.plannedWeeklyTotal.toLocaleString()} Plan)</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-indigo-200">
                          Produced This Week: <strong className="text-emerald-400 font-bold">{factorySummary.actualWeekTotal.toLocaleString()}</strong> {defaultProductionUnit}
                        </div>
                      </div>
                      {selectedOrder && (
                        <div className="pt-2 border-t border-slate-700/60 text-[11px] text-blue-200 flex items-center justify-between">
                          <span>Order #{selectedOrder.orderNumber}:</span>
                          <strong className="text-white font-bold">
                            {orderAggregateTargets.weeklyRemaining === 0 && orderAggregateTargets.weekly > 0
                              ? '✓ Done (0 Due)'
                              : `${orderAggregateTargets.weeklyRemaining.toLocaleString()} Due (${orderAggregateTargets.weekly.toLocaleString()} Plan)`}
                          </strong>
                        </div>
                      )}
                      <div className="pt-1 text-[10px] text-blue-300/80 font-bold group-hover:text-blue-200 flex items-center gap-1">
                        <span>📊 View Weekly Report Sheet</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>

                    {/* 3. Monthly Total Target */}
                    <div
                      onClick={() => handleOpenReportModal('monthly')}
                      className="p-4 rounded-xl bg-slate-800/90 border border-violet-500/40 space-y-2.5 shadow-md hover:border-violet-400 hover:shadow-violet-500/10 cursor-pointer group hover:scale-[1.01] transition transform"
                      title="Click to view full Date-Wise Monthly Production Report Sheet"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-violet-300 flex items-center gap-1.5 uppercase tracking-wide group-hover:text-violet-200">
                          <Calendar className="h-4 w-4 text-violet-400" />
                          Monthly Target
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/30">
                            {factorySummary.monthFillRate}% Filled
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-violet-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition transform" />
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          {factorySummary.monthlyRemainingTotal === 0 && factorySummary.plannedMonthlyTotal > 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1.5">
                              0 <span className="text-xs font-bold text-emerald-300">✓ All Completed</span>
                            </span>
                          ) : (
                            <span>
                              {factorySummary.monthlyRemainingTotal.toLocaleString()} <span className="text-xs font-normal text-indigo-200">Due ({factorySummary.plannedMonthlyTotal.toLocaleString()} Plan)</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-indigo-200">
                          Produced This Month: <strong className="text-emerald-400 font-bold">{factorySummary.actualMonthTotal.toLocaleString()}</strong> {defaultProductionUnit}
                        </div>
                      </div>
                      {selectedOrder && (
                        <div className="pt-2 border-t border-slate-700/60 text-[11px] text-violet-200 flex items-center justify-between">
                          <span>Order #{selectedOrder.orderNumber}:</span>
                          <strong className="text-white font-bold">
                            {orderAggregateTargets.monthlyRemaining === 0 && orderAggregateTargets.monthly > 0
                              ? '✓ Done (0 Due)'
                              : `${orderAggregateTargets.monthlyRemaining.toLocaleString()} Due (${orderAggregateTargets.monthly.toLocaleString()} Plan)`}
                          </strong>
                        </div>
                      )}
                      <div className="pt-1 text-[10px] text-violet-300/80 font-bold group-hover:text-violet-200 flex items-center gap-1">
                        <span>📊 View Monthly Report Sheet</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section Targets Grid */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ec-foreground)] flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>
                      {targetHorizonFilter === 'daily' && 'Daily Section Targets & Today\'s Due'}
                      {targetHorizonFilter === 'weekly' && 'Weekly Section Targets & Week\'s Due'}
                      {targetHorizonFilter === 'monthly' && 'Monthly Section Targets & Month\'s Due'}
                      {targetHorizonFilter === 'total' && 'Total Section Targets & Backlog'}
                    </span>
                  </h3>
                  <span className="text-[11px] text-[var(--ec-muted)] capitalize font-medium">
                    {targetHorizonFilter} View
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {Object.entries(selectedOrderPlan.sections).map(([dept, sTarget]) => {
                    const metrics = getOrderDeptMetrics(selectedOrder.id, dept, sTarget, planningDate);

                    // Dynamic Horizon values according to selected option
                    const horizonTarget = targetHorizonFilter === 'daily' ? metrics.dailyTarget : targetHorizonFilter === 'weekly' ? metrics.weeklyTarget : targetHorizonFilter === 'monthly' ? metrics.monthlyTarget : metrics.totalTarget;
                    const horizonActual = targetHorizonFilter === 'daily' ? metrics.todayActual : targetHorizonFilter === 'weekly' ? metrics.weekActual : targetHorizonFilter === 'monthly' ? metrics.monthActual : metrics.totalActual;
                    const horizonPct = targetHorizonFilter === 'daily' ? metrics.dailyPct : targetHorizonFilter === 'weekly' ? metrics.weeklyPct : targetHorizonFilter === 'monthly' ? metrics.monthlyPct : metrics.totalPct;
                    const horizonDue = targetHorizonFilter === 'daily' ? metrics.todayDue : targetHorizonFilter === 'weekly' ? metrics.weekDue : targetHorizonFilter === 'monthly' ? metrics.monthDue : metrics.totalDue;
                    const horizonLabel = targetHorizonFilter === 'daily' ? "Today's Target" : targetHorizonFilter === 'weekly' ? "Week's Target" : targetHorizonFilter === 'monthly' ? "Month's Target" : "Total Target";
                    const horizonDueLabel = targetHorizonFilter === 'daily' ? "Today's Due" : targetHorizonFilter === 'weekly' ? "Week's Due" : targetHorizonFilter === 'monthly' ? "Month's Due" : "Total Due";

                    // Extract Live Manpower from HR Section
                    const hrSecName = getHRSectionName(dept);
                    const currentDayRecord = dailyManpowerRecords.find((r) => r.date === planningDate) || dailyManpowerRecords[0];
                    const secManpower = currentDayRecord?.sections?.[hrSecName] || {
                      section: hrSecName,
                      managers: 0,
                      incharges: 0,
                      supervisors: 0,
                      workers: 0,
                      total: sTarget.manpower || 0,
                    };
                    const actualManpowerCount = secManpower.total || sTarget.manpower || 0;
                    const productivityPerHead = actualManpowerCount > 0 && horizonActual > 0
                      ? (horizonActual / actualManpowerCount).toFixed(1)
                      : null;

                    return (
                      <div
                        key={dept}
                        className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition"
                      >
                        {/* Section Name & Status Pill */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {dept.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-[var(--ec-foreground)] truncate">{dept}</h4>
                              <p className="text-[11px] text-[var(--ec-muted)]">
                                Target Plan: {sTarget.manpower ? `${sTarget.manpower} men` : 'Standard'} • {sTarget.workingHours || 8}h
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${metrics.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : metrics.status === 'Ahead'
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                                : metrics.status === 'Behind Due'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}>
                              {metrics.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditPlan(selectedOrder, dept)}
                              className="p-1.5 rounded-lg text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title="Edit target"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Live Floor Manpower from HR */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {actualManpowerCount} Floor Manpower
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                            {secManpower.workers || actualManpowerCount} Workers • {secManpower.supervisors || 0} Supv
                          </span>
                        </div>

                        {/* Selected Horizon Primary Output Highlight */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-[var(--ec-muted)]">
                              {horizonLabel} Fill:
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${horizonPct >= 100
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                              }`}>
                              {horizonPct}% Filled
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between gap-1">
                            <span className="text-2xl font-black text-[var(--ec-foreground)] tracking-tight">
                              {horizonActual.toLocaleString()}
                            </span>
                            <span className="text-xs text-[var(--ec-muted)] font-medium">
                              Target: <strong className="text-[var(--ec-foreground)] font-bold">{horizonTarget.toLocaleString()}</strong> {selectedOrder.unit || defaultProductionUnit}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${horizonPct >= 100 ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-blue-600 dark:bg-blue-500'
                                }`}
                              style={{ width: `${Math.min(100, horizonPct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Output & Manpower Correlation Banner */}
                        <div className="p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-[var(--ec-border)] text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-[11px] text-[var(--ec-foreground)]">
                              ⚡ {horizonActual.toLocaleString()} {selectedOrder.unit || defaultProductionUnit} produced
                            </span>
                            {productivityPerHead && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                {productivityPerHead} / worker
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--ec-muted)]">
                            Produced by <strong>{actualManpowerCount}</strong> manpower • Remaining Due: <strong className="text-rose-600 dark:text-rose-400">{horizonDue.toLocaleString()}</strong>
                          </p>
                        </div>

                        {/* Quick 3-Horizon Mini Reference Grid */}
                        <div className="grid grid-cols-4 gap-1 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--ec-border)] text-center text-[11px]">
                          <div className={`p-1.5 rounded-lg ${targetHorizonFilter === 'daily' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-[var(--ec-foreground)]' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--ec-muted)]">Daily</span>
                            <span className="font-semibold">{metrics.todayActual}/{metrics.dailyTarget}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg ${targetHorizonFilter === 'weekly' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-[var(--ec-foreground)]' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--ec-muted)]">Weekly</span>
                            <span className="font-semibold">{metrics.weekActual}/{metrics.weeklyTarget}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg ${targetHorizonFilter === 'monthly' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-[var(--ec-foreground)]' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--ec-muted)]">Monthly</span>
                            <span className="font-semibold">{metrics.monthActual}/{metrics.monthlyTarget}</span>
                          </div>

                          <div className={`p-1.5 rounded-lg ${targetHorizonFilter === 'total' ? 'bg-slate-100 dark:bg-slate-800 font-bold text-[var(--ec-foreground)]' : 'text-[var(--ec-muted)]'}`}>
                            <span className="block text-[8px] uppercase tracking-wider text-[var(--ec-muted)]">Total</span>
                            <span className="font-semibold">{metrics.totalActual}/{metrics.totalTarget}</span>
                          </div>
                        </div>

                        {/* Due & Shortfall Box */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 text-xs">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                              {horizonDueLabel}:
                            </span>
                            <span className={`text-xs font-bold ${horizonDue > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                              {horizonDue > 0 ? `${horizonDue.toLocaleString()} ${selectedOrder.unit || defaultProductionUnit} due` : '✓ Target Reached'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Total Due:</span>
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                              {metrics.totalDue.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* EXCEL-STYLE DATE-WISE PRODUCTION SCHEDULE MATRIX (IN-PAGE)   */}
              {/* ------------------------------------------------------------- */}
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3.5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--ec-border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm sm:text-base text-[var(--ec-foreground)]">
                          Excel Date-Wise Production Schedule
                        </h3>
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Spreadsheet View
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-[var(--ec-muted)]">
                        {scheduleViewMode === 'all_orders'
                          ? 'Aggregated day-by-day factory schedule across ALL active orders and departments'
                          : `Day-by-day target schedule for Order #${selectedOrder.orderNumber} (${selectedOrder.buyerName})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Mode Toggle: All Orders vs Current Order */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-[var(--ec-border)]">
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('all_orders')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${scheduleViewMode === 'all_orders'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                          }`}
                      >
                        <Building2 className="h-3 w-3" />
                        <span>All Orders (Factory)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleViewMode('selected_order')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${scheduleViewMode === 'selected_order'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                          }`}
                      >
                        <Package className="h-3 w-3" />
                        <span>Order #{selectedOrder.orderNumber}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExportDateWiseCSV(selectedOrder)}
                      className="px-3 py-1.5 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-[var(--ec-foreground)] transition flex items-center gap-1.5 shadow-xs"
                      title="Export schedule to CSV/Excel"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenDateWisePlanner(selectedOrder, '1month')}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit in Excel Planner</span>
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Table Container */}
                {(() => {
                  const sDates = dwDatesList;
                  const isAllOrdersMode = scheduleViewMode === 'all_orders';
                  const activeOrders = uniqueOrders;

                  // In all-orders mode, list all unique active departments from active orders; in single order mode, list selected order's sections
                  const depts = isAllOrdersMode
                    ? Array.from(new Set([
                      ...activeOrders.flatMap(o => {
                        const plan = getOrderPlan(o);
                        const req = o.requiredDepartments && o.requiredDepartments.length > 0
                          ? o.requiredDepartments
                          : Object.keys(plan.sections);
                        return req;
                      })
                    ])).filter(Boolean)
                    : Object.keys(selectedOrderPlan.sections);

                  const deptsToUse = depts.length > 0 ? depts : validDeptNames;

                  // Helper to get target on a specific date for an order+dept (strictly what the user actually scheduled)
                  const getOrderDateTarget = (order: BuyerOrder, deptName: string, dateStr: string) => {
                    const plan = getOrderPlan(order);
                    const sched = plan.dateWiseTargets?.[deptName] || plan.sections[deptName]?.dailyBreakdown;
                    if (sched && typeof sched[dateStr] === 'number' && sched[dateStr] > 0) {
                      return sched[dateStr];
                    }
                    return 0;
                  };

                  const deptRows = deptsToUse.map((dept) => {
                    let rowPlannedTotal = 0;
                    const dateValues = sDates.map((d) => {
                      let plannedVal = 0;
                      if (isAllOrdersMode) {
                        activeOrders.forEach((o) => {
                          plannedVal += getOrderDateTarget(o, dept, d.dateStr);
                        });
                      } else {
                        plannedVal = getOrderDateTarget(selectedOrder, dept, d.dateStr);
                      }

                      rowPlannedTotal += plannedVal;

                      // Actual production output on that specific date (Local Bangladesh timezone safe)
                      const actualOnDate = productionFlows
                        .filter(f => {
                          const orderMatch = isAllOrdersMode ? true : f.orderId === selectedOrder.id;
                          return orderMatch && f.department === dept && isFlowOnDate(f.updatedAt, d.dateStr);
                        })
                        .reduce((sum, f) => sum + (f.completed || 0), 0);

                      const remainingDue = Math.max(0, plannedVal - actualOnDate);
                      const isCompleted = plannedVal > 0 && actualOnDate >= plannedVal;

                      return {
                        dateItem: d,
                        plannedVal,
                        actualOnDate,
                        remainingDue,
                        isCompleted,
                      };
                    });

                    // Total active factory qty or order qty for this department
                    const deptOrderTargetSum = isAllOrdersMode
                      ? activeOrders.reduce((sum, o) => {
                        const req = o.requiredDepartments && o.requiredDepartments.length > 0 ? o.requiredDepartments : validDeptNames;
                        if (req.includes(dept)) return sum + (o.quantity || 0);
                        return sum;
                      }, 0)
                      : (selectedOrder.quantity || 0);

                    // Total actual completed production for this department
                    const deptCompleted = isAllOrdersMode
                      ? productionFlows
                        .filter(f => activeOrders.some(o => o.id === f.orderId) && f.department === dept)
                        .reduce((sum, f) => sum + (f.completed || 0), 0)
                      : productionFlows
                        .filter(f => f.orderId === selectedOrder.id && f.department === dept)
                        .reduce((sum, f) => sum + (f.completed || 0), 0);

                    const deptBalance = Math.max(0, deptOrderTargetSum - deptCompleted);

                    return {
                      dept,
                      dateValues,
                      rowPlannedTotal,
                      deptOrderTargetSum,
                      deptCompleted,
                      deptBalance,
                    };
                  });

                  // Grand totals for the factory / order
                  const grandOrderTotal = isAllOrdersMode
                    ? activeOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
                    : (selectedOrder.quantity || 0);

                  const grandPlanTotal = deptRows.length > 0 ? Math.max(...deptRows.map(r => r.rowPlannedTotal), 0) : 0;
                  const grandCompletedTotal = deptRows.length > 0 ? Math.max(...deptRows.map(r => r.deptCompleted), 0) : 0;
                  const grandBalanceTotal = Math.max(0, grandOrderTotal - grandCompletedTotal);

                  return (
                    <div className="overflow-x-auto rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] shadow-xs">
                      <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-[var(--ec-border)] text-[10px] font-extrabold text-[var(--ec-muted)] uppercase tracking-wider">
                            <th className="p-2.5 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[140px]">
                              {isAllOrdersMode ? 'Factory Department' : 'Department'}
                            </th>
                            {sDates.map((d) => (
                              <th
                                key={d.dateStr}
                                className={`p-1.5 text-center border-r border-[var(--ec-border)] min-w-[54px] ${d.isFriday
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black border-rose-200 dark:border-rose-800'
                                  : 'text-[var(--ec-foreground)]'
                                  }`}
                              >
                                <div className="font-mono text-[11px] font-black">{d.dayNum}</div>
                                <div className="text-[8px] font-bold opacity-75">{d.dayName}</div>
                              </th>
                            ))}
                            <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px]">
                              Total Plan
                            </th>
                            <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px]">
                              {isAllOrdersMode ? 'Factory Orders Qty' : 'Order Qty'}
                            </th>
                            <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px] text-emerald-700 dark:text-emerald-300">
                              Completed
                            </th>
                            <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px] text-amber-700 dark:text-amber-300">
                              Balance
                            </th>
                            <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 min-w-[85px]">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--ec-border)]">
                          {deptRows.map((r) => (
                            <tr key={r.dept} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                              <td className="p-2.5 font-bold text-xs text-[var(--ec-foreground)] sticky left-0 z-10 bg-[var(--ec-surface)] border-r border-[var(--ec-border)] truncate">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black flex items-center justify-center">
                                    {r.dept.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span>{r.dept}</span>
                                </div>
                              </td>

                              {r.dateValues.map((dv) => (
                                <td
                                  key={dv.dateItem.dateStr}
                                  className={`p-1.5 text-center border-r border-[var(--ec-border)] text-xs font-mono ${dv.dateItem.isFriday
                                    ? 'bg-rose-50/40 dark:bg-rose-950/15 text-rose-500 dark:text-rose-400 font-bold'
                                    : dv.isCompleted
                                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40'
                                      : dv.remainingDue > 0 && dv.actualOnDate > 0
                                        ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                        : dv.plannedVal > 0
                                          ? 'bg-blue-50/30 dark:bg-blue-950/20 font-bold text-blue-700 dark:text-cyan-300'
                                          : 'text-[var(--ec-muted)]'
                                    }`}
                                >
                                  {dv.isCompleted ? (
                                    <div className="flex flex-col items-center justify-center">
                                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                                        ✓ Done
                                      </span>
                                      <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300">
                                        {dv.actualOnDate.toLocaleString()}
                                      </span>
                                    </div>
                                  ) : dv.actualOnDate > 0 && dv.remainingDue > 0 ? (
                                    <div className="space-y-0.5">
                                      <span className="font-bold text-amber-700 dark:text-amber-300">{dv.remainingDue.toLocaleString()} Due</span>
                                      <span className="block text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                        ✓{dv.actualOnDate.toLocaleString()}
                                      </span>
                                    </div>
                                  ) : dv.plannedVal > 0 ? (
                                    <span className="font-bold text-blue-700 dark:text-cyan-300">{dv.plannedVal.toLocaleString()}</span>
                                  ) : dv.actualOnDate > 0 ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">✓{dv.actualOnDate.toLocaleString()}</span>
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </td>
                              ))}

                              {/* Total Plan */}
                              <td className="p-2 text-center font-black text-xs text-blue-700 dark:text-blue-300 border-r border-[var(--ec-border)]">
                                {r.rowPlannedTotal.toLocaleString()}
                              </td>

                              {/* Order Qty */}
                              <td className="p-2 text-center font-bold text-xs text-[var(--ec-foreground)] border-r border-[var(--ec-border)]">
                                {r.deptOrderTargetSum.toLocaleString()}
                              </td>

                              {/* Completed */}
                              <td className="p-2 text-center font-black text-xs text-emerald-600 dark:text-emerald-400 border-r border-[var(--ec-border)] bg-emerald-50/20 dark:bg-emerald-950/10">
                                {r.deptCompleted.toLocaleString()}
                              </td>

                              {/* Balance */}
                              <td className="p-2 text-center font-black text-xs text-amber-600 dark:text-amber-400 border-r border-[var(--ec-border)] bg-amber-50/20 dark:bg-amber-950/10">
                                {r.deptBalance.toLocaleString()}
                              </td>

                              {/* Status */}
                              <td className="p-2 text-center">
                                {r.deptCompleted >= r.deptOrderTargetSum && r.deptOrderTargetSum > 0 ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    100% Done
                                  </span>
                                ) : r.deptCompleted > 0 ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    {Math.round((r.deptCompleted / Math.max(1, r.deptOrderTargetSum)) * 100)}%
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-[var(--ec-muted)] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {/* Daily Factory Totals Row */}
                          <tr className="bg-slate-100/95 dark:bg-slate-800/95 font-black text-xs border-t-2 border-[var(--ec-border)]">
                            <td className="p-2.5 sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] text-xs text-[var(--ec-foreground)] uppercase tracking-wider">
                              Daily Total
                            </td>
                            {sDates.map((d) => {
                              let dayPlanSum = 0;
                              let dayActSum = 0;

                              if (isAllOrdersMode) {
                                activeOrders.forEach((o) => {
                                  deptsToUse.forEach((dept) => {
                                    dayPlanSum += getOrderDateTarget(o, dept, d.dateStr);
                                    const act = productionFlows
                                      .filter(f => f.orderId === o.id && f.department === dept && isFlowOnDate(f.updatedAt, d.dateStr))
                                      .reduce((sum, f) => sum + (f.completed || 0), 0);
                                    dayActSum += act;
                                  });
                                });
                              } else {
                                deptsToUse.forEach((dept) => {
                                  dayPlanSum += getOrderDateTarget(selectedOrder, dept, d.dateStr);
                                  const act = productionFlows
                                    .filter(f => f.orderId === selectedOrder.id && f.department === dept && isFlowOnDate(f.updatedAt, d.dateStr))
                                    .reduce((sum, f) => sum + (f.completed || 0), 0);
                                  dayActSum += act;
                                });
                              }

                              const dayRemaining = Math.max(0, dayPlanSum - dayActSum);
                              const dayDone = dayPlanSum > 0 && dayActSum >= dayPlanSum;

                              return (
                                <td key={d.dateStr} className="p-1.5 text-center font-mono text-[11px] border-r border-[var(--ec-border)]">
                                  {dayDone ? (
                                    <div className="text-emerald-700 dark:text-emerald-300 font-black text-[10px]">
                                      ✓ Done ({dayActSum.toLocaleString()})
                                    </div>
                                  ) : dayRemaining > 0 && dayActSum > 0 ? (
                                    <div>
                                      <div className="text-amber-700 dark:text-amber-300 font-bold">{dayRemaining.toLocaleString()} Due</div>
                                      <div className="text-[8px] text-emerald-600">✓{dayActSum.toLocaleString()}</div>
                                    </div>
                                  ) : dayPlanSum > 0 ? (
                                    <div className="text-blue-700 dark:text-cyan-300 font-bold">{dayPlanSum.toLocaleString()}</div>
                                  ) : dayActSum > 0 ? (
                                    <div className="text-emerald-600 font-bold text-[10px]">✓{dayActSum.toLocaleString()}</div>
                                  ) : (
                                    <span className="opacity-30 font-normal">—</span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Grand Planned Sum */}
                            <td className="p-2 text-center font-black text-xs text-blue-700 dark:text-blue-300 border-r border-[var(--ec-border)]">
                              {grandPlanTotal.toLocaleString()}
                            </td>

                            {/* Grand Order Sum */}
                            <td className="p-2 text-center font-bold text-xs text-[var(--ec-foreground)] border-r border-[var(--ec-border)]">
                              {grandOrderTotal.toLocaleString()}
                            </td>

                            {/* Grand Completed Sum */}
                            <td className="p-2 text-center font-black text-xs text-emerald-600 dark:text-emerald-400 border-r border-[var(--ec-border)] bg-emerald-50/40 dark:bg-emerald-950/20">
                              {grandCompletedTotal.toLocaleString()}
                            </td>

                            {/* Grand Balance Sum */}
                            <td className="p-2 text-center font-black text-xs text-amber-600 dark:text-amber-400 border-r border-[var(--ec-border)] bg-amber-50/40 dark:bg-amber-950/20">
                              {grandBalanceTotal.toLocaleString()}
                            </td>

                            {/* Grand Overall Status */}
                            <td className="p-2 text-center">
                              {grandOrderTotal > 0 ? (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${grandCompletedTotal >= grandOrderTotal
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : grandCompletedTotal > 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                                  }`}>
                                  {Math.round((grandCompletedTotal / grandOrderTotal) * 100)}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-[var(--ec-muted)]">—</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
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
                  {validDeptNames.map((dept) => {
                    const hrSec = getHRSectionName(dept);
                    const curRec = dailyManpowerRecords.find((r) => r.date === planningDate) || dailyManpowerRecords[0];
                    const count = curRec?.sections?.[hrSec]?.total || 0;
                    return (
                      <th key={dept} className="p-3 text-center">
                        <div>{dept}</div>
                        <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 capitalize">
                          {count > 0 ? `${count} Men` : '—'}
                        </div>
                      </th>
                    );
                  })}
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
                              <div className={`p-1.5 rounded-lg border text-[10px] space-y-0.5 ${metrics.status === 'Completed'
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
      {/* TAB 4: MONTHLY PRODUCTION PLAN (Custom Period Targets) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'monthly-plan' && (
        <div className="space-y-4 sm:space-y-5">
          {/* Period Selector Card */}
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-[var(--ec-foreground)] flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-violet-500" />
                  <span>Monthly Production Plan</span>
                </h3>
                <p className="text-[10px] sm:text-xs text-[var(--ec-muted)] mt-0.5">
                  Order-wise production target set করুন — 15 দিন, 1 মাস, 2 মাস, বা Custom range এ
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--ec-muted)] font-medium">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <span>{mpWorkingDays} Working Days in Period</span>
              </div>
            </div>

            {/* Period Type Buttons */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 border border-[var(--ec-border)] rounded-xl">
              {(['15days', '1month', '2months', '3months', 'custom'] as const).map((pt) => {
                const labels: Record<string, string> = { '15days': '15 Days', '1month': '1 Month', '2months': '2 Months', '3months': '3 Months', 'custom': 'Custom' };
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setMpPeriodType(pt)}
                    className={`py-2 px-1.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-semibold transition flex items-center justify-center gap-1 ${mpPeriodType === pt
                      ? 'bg-white dark:bg-slate-900 text-[var(--ec-foreground)] shadow-xs font-bold'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                      }`}
                  >
                    <span className="truncate">{labels[pt]}</span>
                  </button>
                );
              })}
            </div>

            {/* Date Range Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-900/40">
              <div className="flex items-center gap-2 flex-1">
                <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                <span className="text-xs font-bold text-[var(--ec-foreground)]">Start:</span>
                <input
                  type="date"
                  value={mpStartDate}
                  onChange={(e) => setMpStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] text-xs font-bold text-[var(--ec-foreground)] outline-none"
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <ArrowRight className="h-4 w-4 text-violet-400 flex-shrink-0 hidden sm:block" />
                <span className="text-xs font-bold text-[var(--ec-foreground)]">End:</span>
                <input
                  type="date"
                  value={mpEndDate}
                  onChange={(e) => { if (mpPeriodType === 'custom') setMpCustomEndDate(e.target.value); }}
                  disabled={mpPeriodType !== 'custom'}
                  className={`px-2.5 py-1 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] text-xs font-bold text-[var(--ec-foreground)] outline-none ${mpPeriodType !== 'custom' ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-800">
                <span className="text-[11px] font-black text-violet-700 dark:text-violet-300">{mpWorkingDays} days</span>
                <span className="text-[9px] text-violet-500">({mpPeriodLabel})</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-violet-400" />
              <input
                type="text"
                value={mpSearchQuery}
                onChange={(e) => setMpSearchQuery(e.target.value)}
                placeholder="Search Order #, Buyer, Article..."
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] pl-9 pr-3 py-2 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          {/* Summary KPI Row */}
          {(() => {
            let totalPeriodTarget = 0;
            let totalPeriodActual = 0;
            let ordersWithTargets = 0;
            mpFilteredOrders.forEach(order => {
              const plan = getOrderPlan(order);
              let orderTarget = 0;
              let orderActual = 0;
              Object.keys(plan.sections).forEach(dept => {
                const t = getMpDeptTarget(order, dept);
                const a = getActualInPeriod(order.id, dept, mpStartDate, mpEndDate);
                orderTarget = Math.max(orderTarget, t);
                orderActual = Math.max(orderActual, a);
              });
              totalPeriodTarget += orderTarget;
              totalPeriodActual += orderActual;
              if (orderTarget > 0) ordersWithTargets++;
            });
            const fillRate = totalPeriodTarget > 0 ? Math.min(100, Math.round((totalPeriodActual / totalPeriodTarget) * 100)) : 0;
            const dailyRate = mpWorkingDays > 0 ? Math.round(totalPeriodTarget / mpWorkingDays) : 0;

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1 shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Period Target</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-black text-violet-700 dark:text-violet-400">{totalPeriodTarget.toLocaleString()}</span>
                    <span className="text-[10px] text-[var(--ec-muted)] font-semibold">{defaultProductionUnit}</span>
                  </div>
                </div>
                <div className="bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1 shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Period Actual</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400">{totalPeriodActual.toLocaleString()}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${fillRate >= 80 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{fillRate}%</span>
                  </div>
                </div>
                <div className="bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1 shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Daily Rate Needed</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-black text-blue-700 dark:text-blue-400">{dailyRate.toLocaleString()}</span>
                    <span className="text-[10px] text-[var(--ec-muted)] font-semibold">/ day</span>
                  </div>
                </div>
                <div className="bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1 shadow-xs">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--ec-muted)] uppercase tracking-wider">Active Orders</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base sm:text-xl font-black text-[var(--ec-foreground)]">{ordersWithTargets}</span>
                    <span className="text-[10px] text-[var(--ec-muted)] font-semibold">/ {mpFilteredOrders.length} orders</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Order-wise Target Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ec-foreground)] flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-violet-500" />
                <span>Order-wise Period Targets ({mpFilteredOrders.length} orders)</span>
              </h3>
              <span className="text-[10px] text-[var(--ec-muted)] font-medium">
                {new Date(mpStartDate).toLocaleDateString([], { day: 'numeric', month: 'short' })} — {new Date(mpEndDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}
              </span>
            </div>

            {mpFilteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-8 text-center text-xs text-[var(--ec-muted)]">
                No active orders found. Add orders first.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {mpFilteredOrders.map((order) => {
                  const plan = getOrderPlan(order);
                  const depts = Object.keys(plan.sections);

                  // Calculate totals per order across departments (take max across sequential depts)
                  let orderPeriodTarget = 0;
                  let orderPeriodActual = 0;
                  const deptMetrics = depts.map(dept => {
                    const target = getMpDeptTarget(order, dept);
                    const actual = getActualInPeriod(order.id, dept, mpStartDate, mpEndDate);
                    const dailyRate = mpWorkingDays > 0 ? Math.round(target / mpWorkingDays) : 0;
                    const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
                    const due = Math.max(0, target - actual);
                    orderPeriodTarget = Math.max(orderPeriodTarget, target);
                    orderPeriodActual = Math.max(orderPeriodActual, actual);
                    return { dept, target, actual, dailyRate, pct, due };
                  });
                  const orderPct = orderPeriodTarget > 0 ? Math.min(100, Math.round((orderPeriodActual / orderPeriodTarget) * 100)) : 0;
                  const hasCustomTarget = !!mpOrderTargets[order.id];

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-5 space-y-3.5 shadow-sm hover:border-violet-300 dark:hover:border-violet-700 transition"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 border border-violet-200 dark:border-violet-800 flex items-center justify-center flex-shrink-0">
                            <Hash className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-black text-sm text-violet-600 dark:text-violet-400">#{order.orderNumber}</span>
                              <span className="font-bold text-sm text-[var(--ec-foreground)] truncate">{order.buyerName}</span>
                              {hasCustomTarget && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                  Custom Target
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--ec-muted)]">
                              Article: <strong className="text-[var(--ec-foreground)]">{order.articleName || 'Standard'}</strong> • Order Qty: <strong className="text-[var(--ec-foreground)]">{order.quantity?.toLocaleString()} {order.unit || defaultProductionUnit}</strong>
                              {order.deliveryDate && <> • Delivery: <strong className="text-[var(--ec-foreground)]">{new Date(order.deliveryDate).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</strong></>}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenMpEdit(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold transition shadow-xs flex-shrink-0"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Set Target</span>
                        </button>
                      </div>

                      {/* Period Progress Overview */}
                      <div className="p-3 rounded-xl bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[var(--ec-muted)]">{mpPeriodLabel} Target Progress</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${orderPct >= 100 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300' : orderPct >= 50 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'}`}>
                            {orderPct}% Complete
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-lg font-black text-violet-700 dark:text-violet-400">{orderPeriodActual.toLocaleString()}</span>
                          <span className="text-xs text-[var(--ec-muted)] font-medium">
                            / <strong className="text-[var(--ec-foreground)]">{orderPeriodTarget.toLocaleString()}</strong> {order.unit || defaultProductionUnit}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${orderPct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'}`}
                            style={{ width: `${Math.min(100, orderPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Department-wise Breakdown Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {deptMetrics.map(({ dept, target, actual, dailyRate, pct, due }) => (
                          <div
                            key={dept}
                            className="p-2.5 rounded-xl bg-[var(--ec-surface)] border border-[var(--ec-border)] space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                                  {dept.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-[11px] text-[var(--ec-foreground)] truncate">{dept}</span>
                              </div>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${pct >= 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : pct >= 50 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>{pct}%</span>
                            </div>
                            <div className="flex items-baseline justify-between text-[10px]">
                              <span className="text-[var(--ec-muted)]">Target: <strong className="text-[var(--ec-foreground)]">{target.toLocaleString()}</strong></span>
                              <span className="text-[var(--ec-muted)]">Actual: <strong className="text-emerald-600 dark:text-emerald-400">{actual.toLocaleString()}</strong></span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-[var(--ec-muted)]">
                              <span>📈 {dailyRate}/day rate</span>
                              {due > 0 ? (
                                <span className="font-bold text-rose-600 dark:text-rose-400">Due: {due.toLocaleString()}</span>
                              ) : (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Done</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly Plan Edit Modal */}
      {mpEditingOrder && (
        <div
          onClick={() => setMpEditingOrder(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-xl w-full bg-[var(--ec-card)] border border-violet-500/40 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ec-border)] flex-shrink-0">
              <div className="space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-violet-400">
                  SET PERIOD TARGET • {mpPeriodLabel}
                </span>
                <h3 className="text-base sm:text-lg font-black text-[var(--ec-foreground)] truncate">
                  Order #{mpEditingOrder.orderNumber} ({mpEditingOrder.buyerName})
                </h3>
                <p className="text-[10px] text-[var(--ec-muted)]">
                  {new Date(mpStartDate).toLocaleDateString([], { day: 'numeric', month: 'short' })} → {new Date(mpEndDate).toLocaleDateString([], { day: 'numeric', month: 'short' })} • {mpWorkingDays} Working Days • Order Qty: {mpEditingOrder.quantity?.toLocaleString()} {mpEditingOrder.unit || defaultProductionUnit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMpEditingOrder(null)}
                className="w-7 h-7 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Quick Distribution Bar */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-violet-600/10 via-fuchsia-500/10 to-purple-600/10 border border-violet-500/30 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <span className="text-xs font-black text-[var(--ec-foreground)]">Quick Fill — Set all departments at once</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[25, 50, 75, 100].map(pct => {
                  const totalQty = mpEditingOrder.quantity || 1000;
                  const target = Math.round(totalQty * (pct / 100));
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        const newTargets: Record<string, number> = {};
                        Object.keys(mpEditTargets).forEach(dept => { newTargets[dept] = target; });
                        setMpEditTargets(newTargets);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-600 dark:text-violet-300 border border-violet-500/20 text-[11px] font-bold transition"
                    >
                      {pct}% ({target.toLocaleString()})
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    const plan = getOrderPlan(mpEditingOrder);
                    const newTargets: Record<string, number> = {};
                    Object.keys(mpEditTargets).forEach(dept => {
                      const daily = plan.sections[dept]?.dailyTarget || 0;
                      newTargets[dept] = daily * mpWorkingDays;
                    });
                    setMpEditTargets(newTargets);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[var(--ec-surface)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--ec-foreground)] border border-[var(--ec-border)] text-[11px] font-bold transition"
                >
                  Auto (Daily × {mpWorkingDays}d)
                </button>
              </div>
            </div>

            {/* Department Targets Grid */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
              <span className="text-xs font-black text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Department Targets ({Object.keys(mpEditTargets).length} sections)
              </span>

              {Object.keys(mpEditTargets).map((dept) => {
                const periodTarget = mpEditTargets[dept] || 0;
                const dailyRate = mpWorkingDays > 0 ? Math.round(periodTarget / mpWorkingDays) : 0;
                const actual = getActualInPeriod(mpEditingOrder.id, dept, mpStartDate, mpEndDate);
                const pct = periodTarget > 0 ? Math.min(100, Math.round((actual / periodTarget) * 100)) : 0;

                return (
                  <div key={dept} className="p-3 rounded-2xl bg-[var(--ec-surface)] border border-[var(--ec-border)] hover:border-violet-500/40 transition space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-black text-[10px]">
                          {dept.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-extrabold text-xs sm:text-sm text-[var(--ec-foreground)] truncate">{dept}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--ec-muted)]">
                        <span>Actual: <strong className="text-emerald-500">{actual.toLocaleString()}</strong></span>
                        <span className={`font-black px-1.5 py-0.5 rounded-full ${pct >= 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>{pct}%</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Period Target ({mpPeriodLabel})
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={periodTarget || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setMpEditTargets(prev => ({ ...prev, [dept]: val }));
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-1.5 text-xs font-black text-violet-400 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-0.5">
                          Daily Rate (auto)
                        </label>
                        <div className="w-full rounded-xl border border-[var(--ec-border)] bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-xs font-black text-blue-500">
                          {dailyRate.toLocaleString()} <span className="text-[9px] font-semibold text-[var(--ec-muted)]">{mpEditingOrder.unit || defaultProductionUnit}/day</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini progress bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--ec-border)] flex-shrink-0">
              <span className="text-[11px] text-[var(--ec-muted)] hidden sm:inline">
                {mpPeriodLabel} plan for all departments.
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setMpEditingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMpTargets}
                  disabled={mpIsSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-500 hover:to-fuchsia-400 text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-violet-500/25 disabled:opacity-50"
                >
                  {mpIsSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save Period Targets</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EXCEL-STYLE DATE-WISE MONTHLY PRODUCTION PLANNER MODAL       */}
      {/* ------------------------------------------------------------- */}
      {isDateWiseModalOpen && dwCurrentOrder && (
        <div
          onClick={() => setIsDateWiseModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-6xl w-full bg-[var(--ec-card)] border border-emerald-500/40 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--ec-border)] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/25 flex-shrink-0">
                  <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                      EXCEL PRODUCTION PLANNER
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Day-by-Day Schedule
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-[var(--ec-foreground)] truncate">
                    Date-Wise Production Plan — Order #{dwCurrentOrder.orderNumber}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Switch Order inside modal */}
                <div className="relative min-w-[200px] max-w-[260px]">
                  <select
                    value={dwCurrentOrder.id}
                    onChange={(e) => {
                      const newOrd = uniqueOrders.find(o => o.id === e.target.value);
                      if (newOrd) handleOpenDateWisePlanner(newOrd, dwRangePreset);
                    }}
                    className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-1.5 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer pr-7 truncate"
                  >
                    {uniqueOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber} - {o.buyerName} ({o.quantity} {o.unit || defaultProductionUnit})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ec-muted)] pointer-events-none" />
                </div>

                <button
                  type="button"
                  onClick={() => setIsDateWiseModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--ec-surface)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-xs font-bold transition flex items-center justify-center flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Date Range & Order Summary Ribbon */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
              {/* Range Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-[var(--ec-muted)] uppercase tracking-wider mr-1">
                  Period:
                </span>
                {(['15days', '1month', '2months', 'custom'] as const).map((pr) => {
                  const labels = { '15days': '15 Days', '1month': '1 Month', '2months': '2 Months', 'custom': 'Custom' };
                  return (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => handleDwChangePreset(pr)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${dwRangePreset === pr
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-[var(--ec-surface)] text-[var(--ec-foreground)] border border-[var(--ec-border)] hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      {labels[pr]}
                    </button>
                  );
                })}
              </div>

              {/* Date Pickers */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <div className="flex items-center gap-1 bg-[var(--ec-surface)] px-2.5 py-1 rounded-xl border border-[var(--ec-border)]">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[10px] font-semibold text-[var(--ec-muted)]">From:</span>
                  <input
                    type="date"
                    value={dwStartDate}
                    onChange={(e) => {
                      setDwStartDate(e.target.value);
                      if (dwRangePreset !== 'custom') {
                        setDwEndDate(calcPeriodEnd(e.target.value, dwRangePreset));
                      }
                    }}
                    className="bg-transparent text-xs font-bold text-[var(--ec-foreground)] outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[var(--ec-surface)] px-2.5 py-1 rounded-xl border border-[var(--ec-border)]">
                  <span className="text-[10px] font-semibold text-[var(--ec-muted)]">To:</span>
                  <input
                    type="date"
                    value={dwEndDate}
                    onChange={(e) => {
                      if (dwRangePreset === 'custom') setDwEndDate(e.target.value);
                    }}
                    disabled={dwRangePreset !== 'custom'}
                    className={`bg-transparent text-xs font-bold text-[var(--ec-foreground)] outline-none ${dwRangePreset !== 'custom' ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                  />
                </div>

                <div className="px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                  {dwWorkingDaysCount} Working Days
                </div>
              </div>
            </div>

            {/* Smart Excel Automation Tools Toolbar */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[var(--ec-border)] flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Wand2 className="h-3.5 w-3.5" />
                  Excel Auto Tools:
                </span>

                {/* Auto distribute evenly */}
                <button
                  type="button"
                  onClick={() => handleDwAutoDistribute()}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                  title="Evenly divides order quantity across all working days for each section"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Auto Distribute Evenly</span>
                </button>

                {/* Cascaded pipeline staging */}
                <button
                  type="button"
                  onClick={handleDwCascadePipeline}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                  title="Staggers department starts (Cutting Day 1, Sewing Day 3, Lasting Day 6, Packing Day 8) to create realistic factory flow"
                >
                  <Layers className="h-3 w-3" />
                  <span>Staggered Pipeline</span>
                </button>

                {/* Quick Fixed Daily Pace input */}
                <div className="flex items-center gap-1 bg-[var(--ec-card)] px-2 py-0.5 rounded-lg border border-[var(--ec-border)]">
                  <span className="text-[10px] text-[var(--ec-muted)] font-semibold">Pace:</span>
                  <input
                    type="number"
                    min="1"
                    value={dwQuickDailyPace}
                    onChange={(e) => setDwQuickDailyPace(Number(e.target.value) || 1)}
                    className="w-11 bg-transparent text-xs font-black text-blue-600 dark:text-blue-400 outline-none text-center"
                  />
                  <button
                    type="button"
                    onClick={() => handleDwFillDailyPace()}
                    className="px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px]"
                  >
                    Fill All
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportDateWiseCSV(dwCurrentOrder)}
                  className="px-2.5 py-1 rounded-lg bg-[var(--ec-card)] hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--ec-foreground)] border border-[var(--ec-border)] text-[11px] font-bold transition flex items-center gap-1"
                >
                  <Download className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDwClearGrid()}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[11px] font-bold transition flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear Grid</span>
                </button>
              </div>
            </div>

            {/* INTERACTIVE SPREADSHEET MATRIX TABLE */}
            <div className="flex-1 overflow-auto rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] shadow-inner">
              <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100 dark:bg-slate-800 border-b border-[var(--ec-border)] text-[10px] font-extrabold text-[var(--ec-muted)] uppercase tracking-wider">
                    <th className="p-2.5 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[140px] shadow-xs">
                      Department / Section
                    </th>
                    {dwDatesList.map((d) => (
                      <th
                        key={d.dateStr}
                        className={`p-1.5 text-center border-r border-[var(--ec-border)] min-w-[54px] ${d.isFriday
                          ? 'bg-rose-100/70 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-black border-rose-200 dark:border-rose-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-[var(--ec-foreground)]'
                          }`}
                      >
                        <div className="font-mono text-xs font-black">{d.dayNum}</div>
                        <div className="text-[8px] font-bold opacity-80">{d.dayName}</div>
                      </th>
                    ))}
                    <th className="p-2.5 text-center sticky right-[170px] z-30 bg-slate-100 dark:bg-slate-800 border-l border-r border-[var(--ec-border)] min-w-[90px]">
                      Row Sum
                    </th>
                    <th className="p-2.5 text-center sticky right-[85px] z-30 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px]">
                      Order Target
                    </th>
                    <th className="p-2.5 text-center sticky right-0 z-30 bg-slate-100 dark:bg-slate-800 min-w-[85px]">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ec-border)]">
                  {(() => {
                    const deptsList = Object.keys(getOrderPlan(dwCurrentOrder).sections);
                    return deptsList.map((dept, deptIdx) => {
                      const deptMap = dwSchedule[dept] || {};
                      let rowSum = 0;
                      dwDatesList.forEach((d) => {
                        rowSum += deptMap[d.dateStr] || 0;
                      });
                      const orderQty = dwCurrentOrder.quantity || 1000;
                      const diff = orderQty - rowSum;

                      return (
                        <tr key={dept} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                          {/* Sticky Dept Header */}
                          <td className="p-2 font-bold text-xs text-[var(--ec-foreground)] sticky left-0 z-10 bg-[var(--ec-card)] border-r border-[var(--ec-border)] truncate shadow-xs">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[9px] flex items-center justify-center flex-shrink-0">
                                  {dept.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="truncate">{dept}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDwCopyDeptSchedule(dept)}
                                title={`Copy ${dept} schedule to all sections`}
                                className="p-1 rounded text-[var(--ec-muted)] hover:text-emerald-600 transition"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* Editable Date Target Cells with Arrow Key / Enter navigation */}
                          {dwDatesList.map((d, dateIdx) => {
                            const val = deptMap[d.dateStr] || 0;

                            return (
                              <td
                                key={d.dateStr}
                                className={`p-0.5 text-center border-r border-[var(--ec-border)] ${d.isFriday ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                                  }`}
                              >
                                <input
                                  id={`dw-cell-${deptIdx}-${dateIdx}`}
                                  type="number"
                                  min="0"
                                  value={val || ''}
                                  onChange={(e) => {
                                    const num = Number(e.target.value) || 0;
                                    handleDwCellChange(dept, d.dateStr, num);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) =>
                                    handleGridKeyDown(
                                      e,
                                      deptIdx,
                                      dateIdx,
                                      deptsList.length,
                                      dwDatesList.length,
                                      'dw-cell'
                                    )
                                  }
                                  placeholder="0"
                                  className={`w-full text-center py-1.5 px-0.5 rounded-lg text-xs font-mono font-bold outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${d.isFriday
                                    ? 'text-rose-500 font-black bg-rose-50/40 dark:bg-rose-950/20 placeholder-rose-300/40'
                                    : val > 0
                                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400/30'
                                      : 'bg-transparent text-[var(--ec-foreground)] placeholder-slate-300 dark:placeholder-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                />
                              </td>
                            );
                          })}

                          {/* Sticky Row Sum */}
                          <td className="p-2 text-center font-mono font-black text-xs text-blue-600 dark:text-blue-400 sticky right-[170px] z-10 bg-[var(--ec-card)] border-l border-r border-[var(--ec-border)]">
                            {rowSum.toLocaleString()}
                          </td>

                          {/* Sticky Order Target */}
                          <td className="p-2 text-center font-bold text-xs text-[var(--ec-foreground)] sticky right-[85px] z-10 bg-[var(--ec-card)] border-r border-[var(--ec-border)]">
                            {orderQty.toLocaleString()}
                          </td>

                          {/* Sticky Variance */}
                          <td className="p-2 text-center sticky right-0 z-10 bg-[var(--ec-card)]">
                            {rowSum === orderQty ? (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                ✓ 100%
                              </span>
                            ) : diff > 0 ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                -{diff}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                +{Math.abs(diff)}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                  {/* Daily Factory Totals Row */}
                  <tr className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-[var(--ec-border)] font-black text-xs shadow-md">
                    <td className="p-2.5 sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] text-xs text-[var(--ec-foreground)] uppercase tracking-wider">
                      Factory Daily Total
                    </td>
                    {dwDatesList.map((d) => {
                      const depts = Object.keys(getOrderPlan(dwCurrentOrder).sections);
                      const daySum = depts.reduce((sum, dept) => {
                        return sum + (dwSchedule[dept]?.[d.dateStr] || 0);
                      }, 0);

                      return (
                        <td
                          key={d.dateStr}
                          className="p-1.5 text-center font-mono text-xs border-r border-[var(--ec-border)] text-emerald-700 dark:text-emerald-300"
                        >
                          {daySum > 0 ? daySum : <span className="opacity-30 font-normal">—</span>}
                        </td>
                      );
                    })}
                    <td colSpan={3} className="p-2 text-center text-[10px] text-[var(--ec-muted)] font-bold sticky right-0 z-30 bg-slate-100 dark:bg-slate-800">
                      All Sections Daily Sum
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--ec-border)] flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-[var(--ec-muted)]">
                <CheckCheck className="h-4 w-4 text-emerald-500" />
                <span>
                  Dates are automatically synced with daily targets and factory summary KPIs.
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsDateWiseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] text-xs font-bold text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveDateWisePlan}
                  disabled={dwIsSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {dwIsSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Save Date-Wise Plan</span>
                </button>
              </div>
            </div>
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

                    {/* Inputs in a clean responsive 3-column grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Daily Target */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-1">
                          Base Daily Target (/day)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={editingPlanOrder.quantity || undefined}
                          value={s.dailyTarget || ''}
                          onChange={(e) => {
                            const rawVal = Number(e.target.value) || 0;
                            const maxQty = editingPlanOrder.quantity || 0;
                            const val = maxQty > 0 ? Math.min(maxQty, Math.max(0, rawVal)) : Math.max(0, rawVal);
                            const curTotal = s.totalTarget || maxQty;
                            setEditSections((prev) => ({
                              ...prev,
                              [dept]: {
                                ...prev[dept],
                                dailyTarget: val,
                                weeklyTarget: Math.min(curTotal, val * DEFAULT_WORKING_DAYS_PER_WEEK),
                                monthlyTarget: curTotal,
                              },
                            }));
                          }}
                          placeholder="0"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-xs font-black text-cyan-400 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Total Target */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-1">
                          Total Order Target (Max: {editingPlanOrder.quantity?.toLocaleString()})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={editingPlanOrder.quantity || undefined}
                          value={s.totalTarget || ''}
                          onChange={(e) => {
                            const rawVal = Number(e.target.value) || 0;
                            const maxQty = editingPlanOrder.quantity || 0;
                            const val = maxQty > 0 ? Math.min(maxQty, Math.max(0, rawVal)) : Math.max(0, rawVal);
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
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-3 py-2 text-xs font-black text-emerald-400 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {/* Manpower & Shift */}
                      <div>
                        <label className="block text-[9px] font-bold text-[var(--ec-muted)] uppercase mb-1">
                          Floor Workers • Shift Hrs
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={s.manpower || ''}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditSections((prev) => ({
                                ...prev,
                                [dept]: {
                                  ...prev[dept],
                                  manpower: val,
                                },
                              }));
                            }}
                            placeholder="Manpower"
                            className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 text-center"
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
                            placeholder="8 hrs"
                            className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] px-2.5 py-2 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 pt-0.5">
                      <Sparkles className="h-3 w-3 flex-shrink-0" />
                      <span>
                        Weekly & Monthly targets are dynamically auto-calculated from the Excel Date-Wise Production Schedule.
                      </span>
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

      {/* ------------------------------------------------------------- */}
      {/* FULL-PAGE DATE-WISE PRODUCTION & TARGET REPORT SHEET MODAL     */}
      {/* ------------------------------------------------------------- */}
      {isReportModalOpen && (() => {
        const repDateObj = new Date(reportDate || new Date().toISOString().slice(0, 10));
        repDateObj.setHours(0, 0, 0, 0);

        const repYear = repDateObj.getFullYear();
        const repMonth = repDateObj.getMonth();
        const firstOfRepMonth = new Date(repYear, repMonth, 1);
        const lastOfRepMonth = new Date(repYear, repMonth + 1, 0);

        // Determine date range for the active report horizon
        let repStartDateStr = '';
        let repEndDateStr = '';

        if (reportHorizon === 'daily') {
          // Show 7-day range ending on reportDate for rich day-by-day context
          const start7 = new Date(repDateObj);
          start7.setDate(start7.getDate() - 6);
          repStartDateStr = start7.toISOString().split('T')[0];
          repEndDateStr = repDateObj.toISOString().split('T')[0];
        } else if (reportHorizon === 'weekly') {
          const { monday, sunday } = getWeekRange(repDateObj);
          const wStart = monday < firstOfRepMonth ? firstOfRepMonth : monday;
          const wEnd = sunday > lastOfRepMonth ? lastOfRepMonth : sunday;
          repStartDateStr = wStart.toISOString().split('T')[0];
          repEndDateStr = wEnd.toISOString().split('T')[0];
        } else {
          // monthly
          repStartDateStr = firstOfRepMonth.toISOString().split('T')[0];
          repEndDateStr = lastOfRepMonth.toISOString().split('T')[0];
        }

        const repDates = getDatesInRange(repStartDateStr, repEndDateStr);
        const monthName = repDateObj.toLocaleString('default', { month: 'long' });

        // Filter orders based on user selection in modal
        const activeOrders = uniqueOrders.filter(o => o.status !== 'Completed');
        const ordersToDisplay = reportOrderFilter === 'all'
          ? activeOrders
          : activeOrders.filter(o => o.id === reportOrderFilter || o.orderNumber === reportOrderFilter);

        // Filter depts
        const deptsToDisplay = reportDeptFilter === 'all'
          ? validDeptNames
          : validDeptNames.filter(d => d === reportDeptFilter);

        // Helper to get target on a date
        const getRepOrderDateTarget = (order: BuyerOrder, deptName: string, dateStr: string) => {
          const plan = getOrderPlan(order);
          const sched = plan.dateWiseTargets?.[deptName] || plan.sections[deptName]?.dailyBreakdown;
          if (sched && typeof sched[dateStr] === 'number' && sched[dateStr] > 0) {
            return sched[dateStr];
          }
          return 0;
        };

        // Helper to get actual production on a date (Local Bangladesh timezone safe)
        const getRepActualOnDate = (orderId: string | 'all', deptName: string, dateStr: string) => {
          return productionFlows
            .filter(f => {
              const orderMatch = orderId === 'all' ? true : f.orderId === orderId;
              return orderMatch && f.department === deptName && isFlowOnDate(f.updatedAt, dateStr);
            })
            .reduce((sum, f) => sum + (f.completed || 0), 0);
        };

        // Compute overall grand metrics for the modal KPI cards
        let modalGrandTarget = 0;
        let modalGrandActual = 0;

        deptsToDisplay.forEach(dept => {
          ordersToDisplay.forEach(order => {
            repDates.forEach(d => {
              modalGrandTarget += getRepOrderDateTarget(order, dept, d.dateStr);
              modalGrandActual += getRepActualOnDate(order.id, dept, d.dateStr);
            });
          });
        });

        const modalGrandVariance = Math.max(0, modalGrandTarget - modalGrandActual);
        const modalGrandFillRate = modalGrandTarget > 0 ? Math.min(100, Math.round((modalGrandActual / modalGrandTarget) * 100)) : 0;

        // Export to CSV handler
        const handleExportReportCSV = () => {
          let csv = `Date-Wise Production & Target Report (${reportHorizon.toUpperCase()})\n`;
          csv += `Period, ${repStartDateStr} to ${repEndDateStr}\n`;
          csv += `Generated On, ${new Date().toLocaleString()}\n\n`;

          const header = ['Department', 'Order #', 'Buyer', ...repDates.map(d => `${d.dateStr} (${d.dayName})`), 'Total Planned', 'Total Actual', 'Variance', 'Fill Rate %'];
          csv += header.join(',') + '\n';

          deptsToDisplay.forEach(dept => {
            ordersToDisplay.forEach(order => {
              let rPlan = 0;
              let rAct = 0;
              const dateCols = repDates.map(d => {
                const p = getRepOrderDateTarget(order, dept, d.dateStr);
                const a = getRepActualOnDate(order.id, dept, d.dateStr);
                rPlan += p;
                rAct += a;
                return `"${p > 0 ? p : 0}${a > 0 ? ` (✓${a})` : ''}"`;
              });
              const variance = rPlan - rAct;
              const fillPct = rPlan > 0 ? Math.round((rAct / rPlan) * 100) : 0;
              csv += [`"${dept}"`, `"#${order.orderNumber}"`, `"${order.buyerName || ''}"`, ...dateCols, rPlan, rAct, variance, `"${fillPct}%"`].join(',') + '\n';
            });
          });

          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', `Date_Wise_Production_Report_${reportHorizon}_${repStartDateStr}_to_${repEndDateStr}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success('Report exported to CSV successfully!');
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-[96vw] max-h-[94vh] flex flex-col rounded-3xl border-2 border-indigo-500/40 bg-[var(--ec-card)] shadow-2xl overflow-hidden">
              {/* Modal Top Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/30 text-white flex-shrink-0 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-cyan-300 shadow-md">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-xl font-black text-white tracking-tight">
                          {reportHorizon === 'daily' && `📅 Daily Date-Wise Production Report Sheet (${repDateObj.toISOString().slice(0, 10)})`}
                          {reportHorizon === 'weekly' && `📊 Weekly Date-Wise Production Report Sheet (${repStartDateStr} to ${repEndDateStr})`}
                          {reportHorizon === 'monthly' && `🏢 Monthly Date-Wise Production Report Sheet (${monthName} ${repYear})`}
                        </h2>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                          Live Report Matrix
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200">
                        Detailed Day-by-Day Target vs Actual Output across sections with month navigation & historical archive
                      </p>
                    </div>
                  </div>

                  {/* Actions: Export & Close */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={handleExportReportCSV}
                      className="px-3.5 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-900/40 hover:bg-indigo-800/60 text-xs font-bold text-cyan-200 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition border border-slate-700"
                    >
                      Close ✕
                    </button>
                  </div>
                </div>

                {/* Second Navigation Row: Horizon Switcher + Month / Date Navigator */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-500/20">
                  {/* Horizon Tabs Switcher */}
                  <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-indigo-500/30">
                    <button
                      type="button"
                      onClick={() => setReportHorizon('daily')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${reportHorizon === 'daily'
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                        : 'text-indigo-200 hover:text-white'
                        }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Daily View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportHorizon('weekly')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${reportHorizon === 'weekly'
                        ? 'bg-blue-500 text-white shadow-md font-black'
                        : 'text-indigo-200 hover:text-white'
                        }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Weekly View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportHorizon('monthly')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${reportHorizon === 'monthly'
                        ? 'bg-violet-500 text-white shadow-md font-black'
                        : 'text-indigo-200 hover:text-white'
                        }`}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Monthly View</span>
                    </button>
                  </div>

                  {/* Previous / Next Month & Date Navigator (Allows accessing past/previous months freely) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleReportPrevMonth}
                      className="px-2.5 py-1 rounded-lg bg-indigo-900/40 hover:bg-indigo-800 border border-indigo-500/40 text-xs font-bold text-cyan-300 transition flex items-center gap-1"
                      title="View previous month data"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>Prev Month</span>
                    </button>

                    {/* Date / Month Picker input */}
                    <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-indigo-500/30 text-xs text-white">
                      <CalendarRange className="h-3.5 w-3.5 text-cyan-400" />
                      <input
                        type="date"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleReportNextMonth}
                      className="px-2.5 py-1 rounded-lg bg-indigo-900/40 hover:bg-indigo-800 border border-indigo-500/40 text-xs font-bold text-cyan-300 transition flex items-center gap-1"
                      title="View next month data"
                    >
                      <span>Next Month</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setReportDate(new Date().toISOString().split('T')[0])}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition border border-slate-700"
                    >
                      Current Month / Today
                    </button>
                  </div>
                </div>

                {/* Third Row: Filters (Order Filter & Department Filter) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-indigo-500/20 text-xs">
                  {/* Order Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-indigo-500/30">
                    <Package className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                    <select
                      value={reportOrderFilter}
                      onChange={(e) => setReportOrderFilter(e.target.value)}
                      className="bg-transparent text-white font-bold text-xs outline-none w-full"
                    >
                      <option value="all" className="bg-slate-900 text-white">All Active Orders ({activeOrders.length})</option>
                      {activeOrders.map(o => (
                        <option key={o.id} value={o.id} className="bg-slate-900 text-white">
                          #{o.orderNumber} - {o.buyerName || o.articleName || 'Order'} ({o.quantity} {o.unit || defaultProductionUnit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-indigo-500/30">
                    <Layers className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    <select
                      value={reportDeptFilter}
                      onChange={(e) => setReportDeptFilter(e.target.value)}
                      className="bg-transparent text-white font-bold text-xs outline-none w-full"
                    >
                      <option value="all" className="bg-slate-900 text-white">All Departments ({validDeptNames.length})</option>
                      {validDeptNames.map(dept => (
                        <option key={dept} value={dept} className="bg-slate-900 text-white">{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 sm:col-span-2">
                    <Search className="h-3.5 w-3.5 text-indigo-300 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Search section, order, buyer..."
                      value={reportSearchQuery}
                      onChange={(e) => setReportSearchQuery(e.target.value)}
                      className="bg-transparent text-white placeholder-indigo-300/60 font-bold text-xs outline-none w-full"
                    />
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards inside Modal */}
              <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-[var(--ec-border)] grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-shrink-0">
                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-cyan-500/30 space-y-0.5">
                  <div className="text-[10px] font-bold text-cyan-300 uppercase">Period Target Planned</div>
                  <div className="text-lg sm:text-xl font-black text-white">
                    {modalGrandTarget.toLocaleString()} <span className="text-xs font-normal text-[var(--ec-muted)]">{defaultProductionUnit}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-emerald-500/30 space-y-0.5">
                  <div className="text-[10px] font-bold text-emerald-300 uppercase">Total Actual Produced</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-400">
                    {modalGrandActual.toLocaleString()} <span className="text-xs font-normal text-[var(--ec-muted)]">{defaultProductionUnit}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-amber-500/30 space-y-0.5">
                  <div className="text-[10px] font-bold text-amber-300 uppercase">Balance / Due</div>
                  <div className="text-lg sm:text-xl font-black text-amber-400">
                    {modalGrandVariance.toLocaleString()} <span className="text-xs font-normal text-[var(--ec-muted)]">{defaultProductionUnit}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-800/80 border border-violet-500/30 space-y-0.5">
                  <div className="text-[10px] font-bold text-violet-300 uppercase">Period Fill Rate</div>
                  <div className="text-lg sm:text-xl font-black text-violet-300">
                    {modalGrandFillRate}%
                  </div>
                </div>
              </div>

              {/* Main Spreadsheet Matrix Area */}
              <div className="flex-1 overflow-auto p-3 sm:p-4 bg-[var(--ec-surface)]">
                <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] shadow-xs overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-[var(--ec-border)] text-[10px] font-extrabold text-[var(--ec-muted)] uppercase tracking-wider">
                        <th className="p-2.5 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[130px]">
                          Department
                        </th>
                        <th className="p-2.5 sticky left-[130px] z-20 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[120px]">
                          Order / Buyer
                        </th>
                        {repDates.map((d) => (
                          <th
                            key={d.dateStr}
                            className={`p-1.5 text-center border-r border-[var(--ec-border)] min-w-[56px] ${d.isFriday
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-black border-rose-200 dark:border-rose-800'
                              : 'text-[var(--ec-foreground)]'
                              }`}
                          >
                            <div className="font-mono text-[11px] font-black">{d.dayNum}</div>
                            <div className="text-[8px] font-bold opacity-75">{d.dayName}</div>
                          </th>
                        ))}
                        <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px]">
                          Total Target
                        </th>
                        <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[85px]">
                          Actual Done
                        </th>
                        <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] min-w-[80px]">
                          Balance
                        </th>
                        <th className="p-2.5 text-center bg-slate-100 dark:bg-slate-800 min-w-[85px]">
                          Achievement
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ec-border)]">
                      {deptsToDisplay.map((dept) => {
                        return ordersToDisplay.map((order, orderIdx) => {
                          // Search query filter check
                          if (reportSearchQuery.trim()) {
                            const q = reportSearchQuery.toLowerCase();
                            const match = dept.toLowerCase().includes(q) ||
                              order.orderNumber?.toLowerCase().includes(q) ||
                              order.buyerName?.toLowerCase().includes(q) ||
                              order.articleName?.toLowerCase().includes(q);
                            if (!match) return null;
                          }

                          let rowPlanSum = 0;
                          let rowActSum = 0;

                          return (
                            <tr key={`${dept}_${order.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                              {/* Department (only show label on first order if multiple) */}
                              <td className="p-2 font-bold text-xs text-[var(--ec-foreground)] sticky left-0 z-10 bg-[var(--ec-card)] border-r border-[var(--ec-border)] truncate">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black flex items-center justify-center">
                                    {dept.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="truncate">{dept}</span>
                                </div>
                              </td>

                              {/* Order & Buyer */}
                              <td className="p-2 text-xs sticky left-[130px] z-10 bg-[var(--ec-card)] border-r border-[var(--ec-border)] truncate">
                                <div className="font-bold text-[var(--ec-foreground)]">#{order.orderNumber}</div>
                                <div className="text-[10px] text-[var(--ec-muted)] truncate">{order.buyerName || order.articleName || '—'}</div>
                              </td>

                              {/* Day-by-Day Columns */}
                              {repDates.map((d) => {
                                const targetVal = getRepOrderDateTarget(order, dept, d.dateStr);
                                const actualVal = getRepActualOnDate(order.id, dept, d.dateStr);
                                rowPlanSum += targetVal;
                                rowActSum += actualVal;

                                const repRemaining = Math.max(0, targetVal - actualVal);
                                const isRepDone = targetVal > 0 && actualVal >= targetVal;

                                return (
                                  <td
                                    key={d.dateStr}
                                    className={`p-1 text-center border-r border-[var(--ec-border)] text-xs font-mono ${d.isFriday
                                      ? 'bg-rose-50/40 dark:bg-rose-950/15 text-rose-500 dark:text-rose-400 font-bold'
                                      : isRepDone
                                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40'
                                        : repRemaining > 0 && actualVal > 0
                                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                          : targetVal > 0
                                            ? 'bg-blue-50/20 dark:bg-blue-950/15'
                                            : 'text-[var(--ec-muted)]'
                                      }`}
                                  >
                                    {isRepDone ? (
                                      <div className="flex flex-col items-center justify-center">
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                                          ✓ Done
                                        </span>
                                        <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                                          {actualVal.toLocaleString()}
                                        </span>
                                      </div>
                                    ) : actualVal > 0 && repRemaining > 0 ? (
                                      <div className="space-y-0.5">
                                        <span className="font-bold text-amber-700 dark:text-amber-300">{repRemaining.toLocaleString()} Due</span>
                                        <span className="block text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                                          ✓{actualVal.toLocaleString()}
                                        </span>
                                      </div>
                                    ) : targetVal > 0 ? (
                                      <span className="font-bold text-blue-700 dark:text-cyan-300">{targetVal.toLocaleString()}</span>
                                    ) : actualVal > 0 ? (
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">✓{actualVal.toLocaleString()}</span>
                                    ) : (
                                      <span className="opacity-30">—</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Summary Columns */}
                              <td className="p-2 text-center font-black text-xs text-cyan-600 dark:text-cyan-400 border-r border-[var(--ec-border)]">
                                {rowPlanSum.toLocaleString()}
                              </td>

                              <td className="p-2 text-center font-bold text-xs text-emerald-600 dark:text-emerald-400 border-r border-[var(--ec-border)]">
                                {rowActSum.toLocaleString()}
                              </td>

                              <td className="p-2 text-center font-bold text-xs text-amber-600 dark:text-amber-400 border-r border-[var(--ec-border)]">
                                {Math.max(0, rowPlanSum - rowActSum).toLocaleString()}
                              </td>

                              <td className="p-2 text-center">
                                {rowPlanSum > 0 ? (
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${rowActSum >= rowPlanSum
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : rowActSum > 0
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                    }`}>
                                    {Math.round((rowActSum / rowPlanSum) * 100)}%
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-[var(--ec-muted)]">No Target</span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })}

                      {/* Daily Factory Totals Row at the bottom */}
                      <tr className="bg-slate-100/95 dark:bg-slate-800/95 font-black text-xs border-t-2 border-[var(--ec-border)]">
                        <td colSpan={2} className="p-2.5 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-[var(--ec-border)] text-xs text-[var(--ec-foreground)] uppercase tracking-wider">
                          Daily Factory Total
                        </td>
                        {repDates.map((d) => {
                          let dayPlanSum = 0;
                          let dayActSum = 0;

                          deptsToDisplay.forEach(dept => {
                            ordersToDisplay.forEach(order => {
                              dayPlanSum += getRepOrderDateTarget(order, dept, d.dateStr);
                              dayActSum += getRepActualOnDate(order.id, dept, d.dateStr);
                            });
                          });

                          return (
                            <td key={d.dateStr} className="p-1.5 text-center font-mono text-[11px] border-r border-[var(--ec-border)]">
                              {dayPlanSum > 0 || dayActSum > 0 ? (
                                <div>
                                  <div className="text-cyan-700 dark:text-cyan-300 font-bold">{dayPlanSum.toLocaleString()}</div>
                                  {dayActSum > 0 && <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">✓{dayActSum.toLocaleString()}</div>}
                                </div>
                              ) : (
                                <span className="opacity-30 font-normal">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-black text-cyan-600 dark:text-cyan-400 border-r border-[var(--ec-border)]">
                          {modalGrandTarget.toLocaleString()}
                        </td>
                        <td className="p-2 text-center font-black text-emerald-600 dark:text-emerald-400 border-r border-[var(--ec-border)]">
                          {modalGrandActual.toLocaleString()}
                        </td>
                        <td className="p-2 text-center font-black text-amber-600 dark:text-amber-400 border-r border-[var(--ec-border)]">
                          {modalGrandVariance.toLocaleString()}
                        </td>
                        <td className="p-2 text-center font-black text-violet-600 dark:text-violet-400">
                          {modalGrandFillRate}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
