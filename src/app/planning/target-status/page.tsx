"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Clock,
  Target,
  Factory,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  Download,
  FileText,
  Printer,
  ChevronRight,
  BarChart3,
  Hash,
  Package,
  Sparkles,
  SlidersHorizontal,
  ArrowUpRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { firebaseService } from '@/services/firebaseService';
import { mockRepository } from '@/repositories/mockRepository';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import { calculateMultiProcessProduction, isMultiProcessDept } from '@/lib/productionUtils';
import type { Department, ProductionFlow, BuyerOrder, OrderProductionPlan, SectionPlanTarget } from '@/types';

// Helper to get flow local date string
function getFlowLocalDate(updatedAt?: string | Date | null): string {
  if (!updatedAt) return '';
  const d = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper to get Monday and Sunday of current week
function getWeekRange(dateInput: string | Date) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    monday: getFlowLocalDate(monday),
    sunday: getFlowLocalDate(sunday),
  };
}

// Helper to get Month Start and End
function getMonthRange(dateInput: string | Date) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: getFlowLocalDate(start),
    end: getFlowLocalDate(end),
  };
}

function TargetProductionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = (searchParams.get('view') || 'daily') as 'daily' | 'weekly' | 'monthly' | 'due' | 'operations';

  const defaultProductionUnit = useProductionUnit();
  const { showAlert, toast } = useModal();

  const [orders, setOrders] = useState<BuyerOrder[]>(() => mockRepository.getBuyerOrders());
  const [flows, setFlows] = useState<ProductionFlow[]>(() => mockRepository.getProductionFlows());
  const [departments, setDepartments] = useState<Department[]>(() =>
    erpService.getDepartments().filter((d) => d.name.toLowerCase() !== 'warehouse')
  );
  const [plans, setPlans] = useState<OrderProductionPlan[]>(() => erpService.getProductionPlans());

  // Filter States
  const [selectedHorizon, setSelectedHorizon] = useState<'daily' | 'weekly' | 'monthly' | 'due' | 'operations'>(initialView);
  const [targetDate, setTargetDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'matrix' | 'logs'>('matrix');

  // Custom Weekly Range controls
  const [weekRangeStart, setWeekRangeStart] = useState<string>(() => {
    const r = getWeekRange(new Date());
    return r.monday;
  });
  const [weekRangeEnd, setWeekRangeEnd] = useState<string>(() => {
    const r = getWeekRange(new Date());
    return r.sunday;
  });

  // Custom Monthly Range controls
  const [monthRangeStart, setMonthRangeStart] = useState<string>(() => {
    const r = getMonthRange(new Date());
    return r.start;
  });
  const [monthRangeEnd, setMonthRangeEnd] = useState<string>(() => {
    const r = getMonthRange(new Date());
    return r.end;
  });

  // Helper formatter for user-facing dates
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleTargetDateChange = (newDateStr: string) => {
    setTargetDate(newDateStr);
    const d = new Date(newDateStr || new Date().toISOString().slice(0, 10));
    const w = getWeekRange(d);
    setWeekRangeStart(w.monday);
    setWeekRangeEnd(w.sunday);
    const m = getMonthRange(d);
    setMonthRangeStart(m.start);
    setMonthRangeEnd(m.end);
  };

  // Sync with Firestore & Custom Events
  useEffect(() => {
    const unsubOrders = firebaseService.subscribeOrders((data) => {
      if (data && Array.isArray(data)) setOrders(data);
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((data) => {
      if (data && Array.isArray(data)) setFlows(data);
    });
    const unsubPlans = firebaseService.subscribeProductionPlans((data) => {
      if (data && Array.isArray(data)) setPlans(data);
    });

    const handleSync = () => {
      setOrders(mockRepository.getBuyerOrders());
      setFlows(mockRepository.getProductionFlows());
      setPlans(erpService.getProductionPlans());
    };
    window.addEventListener('erp:buyerOrdersUpdated', handleSync);
    window.addEventListener('erp:productionFlowsUpdated', handleSync);
    window.addEventListener('erp:productionPlansUpdated', handleSync);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubPlans();
      window.removeEventListener('erp:buyerOrdersUpdated', handleSync);
      window.removeEventListener('erp:productionFlowsUpdated', handleSync);
      window.removeEventListener('erp:productionPlansUpdated', handleSync);
    };
  }, []);

  // Update horizon if query param changes
  useEffect(() => {
    const v = searchParams.get('view') as 'daily' | 'weekly' | 'monthly' | 'due' | 'operations' | null;
    if (v && ['daily', 'weekly', 'monthly', 'due', 'operations'].includes(v)) {
      setSelectedHorizon(v);
    }
  }, [searchParams]);

  const validDeptNames = useMemo(() => departments.map((d) => d.name), [departments]);

  const activeDateRangeLabel = useMemo(() => {
    if (selectedHorizon === 'daily' || selectedHorizon === 'operations') {
      return formatDateDisplay(targetDate);
    } else if (selectedHorizon === 'weekly') {
      return `${formatDateDisplay(weekRangeStart)} — ${formatDateDisplay(weekRangeEnd)}`;
    } else if (selectedHorizon === 'monthly') {
      return `${formatDateDisplay(monthRangeStart)} — ${formatDateDisplay(monthRangeEnd)}`;
    }
    return 'Total Order Targets';
  }, [selectedHorizon, targetDate, weekRangeStart, weekRangeEnd, monthRangeStart, monthRangeEnd]);

  // Target-Wise Order Calculations
  const targetRows = useMemo(() => {
    return orders.map((order) => {
      const orderPlan = plans.find(
        (p) =>
          p.orderId === order.id ||
          p.orderNumber === order.id ||
          p.orderId === order.orderNumber ||
          p.orderNumber === order.orderNumber
      );

      const orderFlows = flows.filter(
        (f) => f.orderId === order.id || f.orderId === order.orderNumber
      );

      // Filter applicable departments for this order
      const reqDepts = (order.requiredDepartments && order.requiredDepartments.length > 0)
        ? order.requiredDepartments.filter((d) => validDeptNames.includes(d))
        : validDeptNames;

      const orderHasDateWiseSchedule = Boolean(
        orderPlan?.dateWiseTargets &&
        Object.values(orderPlan.dateWiseTargets).some((dMap) =>
          dMap && Object.values(dMap).some((v) => typeof v === 'number' && v > 0)
        )
      );

      const sectionRows = reqDepts.map((dept) => {
        const sPlan = orderPlan?.sections?.[dept];
        const dateMap = orderPlan?.dateWiseTargets?.[dept] || sPlan?.dailyBreakdown;
        
        let totalGridPlanned = 0;
        let dayGridPlanned = 0;
        let weekGridPlanned = 0;
        let monthGridPlanned = 0;
        let hasSectionDateWisePlanned = false;

        if (dateMap && typeof dateMap === 'object') {
          Object.entries(dateMap).forEach(([dStr, val]) => {
            if (typeof val === 'number' && val > 0) {
              totalGridPlanned += val;
              hasSectionDateWisePlanned = true;
              if (dStr === targetDate) dayGridPlanned += val;
              if (dStr >= weekRangeStart && dStr <= weekRangeEnd) weekGridPlanned += val;
              if (dStr >= monthRangeStart && dStr <= monthRangeEnd) monthGridPlanned += val;
            }
          });
        }

        const maxOrderQty = order.quantity || 0;

        let dailyTarget = 0;
        let weeklyTarget = 0;
        let monthlyTarget = 0;
        let totalTarget = 0;

        if (orderHasDateWiseSchedule || hasSectionDateWisePlanned) {
          // Strictly use date-wise plan schedule from sheet
          totalTarget = maxOrderQty > 0 ? Math.min(maxOrderQty, totalGridPlanned) : totalGridPlanned;
          dailyTarget = Math.min(totalTarget, dayGridPlanned);
          weeklyTarget = Math.min(totalTarget, weekGridPlanned);
          monthlyTarget = Math.min(totalTarget, monthGridPlanned);
        } else {
          // Fallback to section base target only if no date-wise sheet is configured
          const rawTotal = sPlan?.totalTarget && sPlan.totalTarget > 0 ? sPlan.totalTarget : maxOrderQty;
          totalTarget = maxOrderQty > 0 ? Math.min(maxOrderQty, rawTotal) : rawTotal;
          dailyTarget = sPlan?.dailyTarget && sPlan.dailyTarget > 0 ? Math.min(totalTarget, sPlan.dailyTarget) : (totalTarget > 0 ? Math.ceil(totalTarget / 10) : 0);
          weeklyTarget = sPlan?.weeklyTarget && sPlan.weeklyTarget > 0 ? Math.min(totalTarget, sPlan.weeklyTarget) : Math.min(totalTarget, dailyTarget * 6);
          monthlyTarget = sPlan?.monthlyTarget && sPlan.monthlyTarget > 0 ? Math.min(totalTarget, sPlan.monthlyTarget) : totalTarget;
        }

        // Determine target based on selected horizon
        let horizonTarget = dailyTarget;
        if (selectedHorizon === 'weekly') horizonTarget = weeklyTarget;
        else if (selectedHorizon === 'monthly') horizonTarget = monthlyTarget;
        else if (selectedHorizon === 'due') horizonTarget = totalTarget;
        else if (selectedHorizon === 'operations') horizonTarget = dailyTarget;

        // Production Flows filtering according to horizon
        const deptFlows = orderFlows.filter((f) => f.department === dept);

        // Daily Actual
        const flowsToday = deptFlows.filter((f) => getFlowLocalDate(f.updatedAt) === targetDate);
        const actualDaily = calculateMultiProcessProduction(flowsToday, dept, [], dailyTarget).totalCompleted;

        // Weekly Actual (flows within weekRangeStart and weekRangeEnd)
        const flowsWeek = deptFlows.filter((f) => {
          const dStr = getFlowLocalDate(f.updatedAt);
          return dStr >= weekRangeStart && dStr <= weekRangeEnd;
        });
        const actualWeekly = calculateMultiProcessProduction(flowsWeek, dept, [], weeklyTarget).totalCompleted;

        // Monthly Actual (flows within monthRangeStart and monthRangeEnd)
        const flowsMonth = deptFlows.filter((f) => {
          const dStr = getFlowLocalDate(f.updatedAt);
          return dStr >= monthRangeStart && dStr <= monthRangeEnd;
        });
        const actualMonthly = calculateMultiProcessProduction(flowsMonth, dept, [], monthlyTarget).totalCompleted;

        // Total All-Time Actual
        const actualTotal = calculateMultiProcessProduction(deptFlows, dept, [], totalTarget).totalCompleted;

        // Current horizon values
        let currentActual = actualDaily;
        if (selectedHorizon === 'weekly') currentActual = actualWeekly;
        else if (selectedHorizon === 'monthly') currentActual = actualMonthly;
        else if (selectedHorizon === 'due') currentActual = actualTotal;
        else if (selectedHorizon === 'operations') currentActual = actualDaily;

        const currentDue = Math.max(0, horizonTarget - currentActual);
        const totalDue = Math.max(0, totalTarget - actualTotal);
        const fillRate = horizonTarget > 0 ? Math.min(100, Math.round((currentActual / horizonTarget) * 100)) : (currentActual > 0 ? 100 : 0);
        const isDone = currentDue === 0 && horizonTarget > 0;

        return {
          department: dept,
          dailyTarget,
          weeklyTarget,
          monthlyTarget,
          totalTarget,
          horizonTarget,
          actualDaily,
          actualWeekly,
          actualMonthly,
          actualTotal,
          currentActual,
          currentDue,
          totalDue,
          fillRate,
          isDone,
          itemFlowsCount: deptFlows.length,
        };
      });

      const totalOrderTarget = order.quantity || 0;
      const orderDailyPlan = sectionRows.reduce((sum, s) => sum + s.dailyTarget, 0);
      const orderWeeklyPlan = sectionRows.reduce((sum, s) => sum + s.weeklyTarget, 0);
      const orderDailyActual = sectionRows.reduce((sum, s) => sum + s.actualDaily, 0);
      const orderWeeklyActual = sectionRows.reduce((sum, s) => sum + s.actualWeekly, 0);
      const orderTotalActual = sectionRows.reduce((sum, s) => sum + s.actualTotal, 0);
      const orderTotalDue = sectionRows.reduce((sum, s) => sum + s.totalDue, 0);

      const hasBehindSection = sectionRows.some((s) => s.currentDue > 0 && s.horizonTarget > 0);

      return {
        order,
        orderPlan,
        reqDepts,
        sectionRows,
        totalOrderTarget,
        orderDailyPlan,
        orderWeeklyPlan,
        orderDailyActual,
        orderWeeklyActual,
        orderTotalActual,
        orderTotalDue,
        hasBehindSection,
      };
    });
  }, [orders, plans, flows, validDeptNames, selectedHorizon, targetDate, weekRangeStart, weekRangeEnd, monthRangeStart, monthRangeEnd]);

  // Overall KPI Summaries
  const kpiSummary = useMemo(() => {
    let todayTargetSum = 0;
    let todayActualSum = 0;
    let weeklyTargetSum = 0;
    let weeklyActualSum = 0;
    let monthlyTargetSum = 0;
    let monthlyActualSum = 0;
    let totalDueSum = 0;
    let activeOpsCount = 0;
    let behindOpsCount = 0;

    targetRows.forEach((row) => {
      row.sectionRows.forEach((s) => {
        todayTargetSum += s.dailyTarget;
        todayActualSum += s.actualDaily;
        weeklyTargetSum += s.weeklyTarget;
        weeklyActualSum += s.actualWeekly;
        monthlyTargetSum += s.monthlyTarget;
        monthlyActualSum += s.actualMonthly;
        totalDueSum += s.totalDue;
        if (s.horizonTarget > 0) activeOpsCount++;
        if (s.currentDue > 0 && s.horizonTarget > 0) behindOpsCount++;
      });
    });

    const todayRate = todayTargetSum > 0 ? Math.min(100, Math.round((todayActualSum / todayTargetSum) * 100)) : 0;
    const weeklyRate = weeklyTargetSum > 0 ? Math.min(100, Math.round((weeklyActualSum / weeklyTargetSum) * 100)) : 0;
    const monthlyRate = monthlyTargetSum > 0 ? Math.min(100, Math.round((monthlyActualSum / monthlyTargetSum) * 100)) : 0;

    return {
      todayTargetSum,
      todayActualSum,
      todayRate,
      weeklyTargetSum,
      weeklyActualSum,
      weeklyRate,
      monthlyTargetSum,
      monthlyActualSum,
      monthlyRate,
      totalDueSum,
      activeOpsCount,
      behindOpsCount,
    };
  }, [targetRows]);

  // Filtered Rows according to Search, Department, and Order filters
  const filteredRows = useMemo(() => {
    return targetRows.filter((row) => {
      if (selectedOrderId !== 'all' && row.order.id !== selectedOrderId && row.order.orderNumber !== selectedOrderId) {
        return false;
      }
      if (selectedHorizon === 'operations' && !row.hasBehindSection) {
        return false;
      }
      if (selectedDept !== 'all') {
        const hasDept = row.sectionRows.some((s) => s.department === selectedDept);
        if (!hasDept) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = row.order.orderNumber?.toLowerCase().includes(q);
        const matchBuyer = row.order.buyerName?.toLowerCase().includes(q);
        const matchArticle = row.order.articleName?.toLowerCase().includes(q);
        const matchDept = row.reqDepts.some((d) => d.toLowerCase().includes(q));
        if (!matchNumber && !matchBuyer && !matchArticle && !matchDept) return false;
      }
      return true;
    });
  }, [targetRows, selectedOrderId, selectedHorizon, selectedDept, searchQuery]);

  // Filtered Production Entry Logs
  const filteredLogs = useMemo(() => {
    return flows
      .filter((f) => {
        if (selectedOrderId !== 'all' && f.orderId !== selectedOrderId) return false;
        if (selectedDept !== 'all' && f.department !== selectedDept) return false;

        const fDate = getFlowLocalDate(f.updatedAt);
        if (selectedHorizon === 'daily') {
          if (fDate !== targetDate) return false;
        } else if (selectedHorizon === 'weekly') {
          if (fDate < weekRangeStart || fDate > weekRangeEnd) return false;
        } else if (selectedHorizon === 'monthly') {
          if (fDate < monthRangeStart || fDate > monthRangeEnd) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchOrder = f.orderId?.toLowerCase().includes(q);
          const matchArticle = f.articleName?.toLowerCase().includes(q);
          const matchDept = f.department?.toLowerCase().includes(q);
          const matchProcess = f.processName?.toLowerCase().includes(q);
          const matchNotes = f.notes?.toLowerCase().includes(q);
          if (!matchOrder && !matchArticle && !matchDept && !matchProcess && !matchNotes) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [flows, selectedOrderId, selectedDept, selectedHorizon, targetDate, weekRangeStart, weekRangeEnd, monthRangeStart, monthRangeEnd, searchQuery]);

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Order #', 'Buyer', 'Article', 'Total Qty', 'Department', 'Target Horizon', 'Target Qty', 'Actual Produced', 'Remaining Due', 'Fill Rate %']
    ];

    filteredRows.forEach((r) => {
      r.sectionRows.forEach((s) => {
        rows.push([
          r.order.orderNumber || '',
          r.order.buyerName || '',
          r.order.articleName || '',
          String(r.totalOrderTarget),
          s.department,
          selectedHorizon,
          String(s.horizonTarget),
          String(s.currentActual),
          String(s.currentDue),
          `${s.fillRate}%`,
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `target_status_report_${selectedHorizon}_${targetDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Target report exported to CSV!');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-7 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/planning"
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Return to Planning"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-blue-700 uppercase tracking-wider">
                  Target-Wise Production Entries
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  {selectedHorizon.toUpperCase()}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-black">
                Target Status & Production Logs
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Active Date Period: <strong className="text-black font-bold">{activeDateRangeLabel}</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition"
              title="Export as CSV Spreadsheet"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition"
              title="Print Target Report"
            >
              <Printer className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* 5 Interactive Target Horizon Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 pt-2">
          {/* 1. Today's Target Card */}
          <div
            onClick={() => setSelectedHorizon('daily')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              selectedHorizon === 'daily'
                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-700" />
                Today&apos;s Target
              </span>
              <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full ${
                kpiSummary.todayRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {kpiSummary.todayRate}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-blue-700 font-bold truncate">
              {formatDateDisplay(targetDate)}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-blue-700">
                {kpiSummary.todayActualSum.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                / {kpiSummary.todayTargetSum.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full"
                style={{ width: `${kpiSummary.todayRate}%` }}
              />
            </div>
          </div>

          {/* 2. Weekly Target Card */}
          <div
            onClick={() => setSelectedHorizon('weekly')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              selectedHorizon === 'weekly'
                ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-emerald-700" />
                Weekly Target
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {kpiSummary.weeklyRate}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-800 font-bold truncate">
              {formatDateDisplay(weekRangeStart)} — {formatDateDisplay(weekRangeEnd)}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-emerald-700">
                {kpiSummary.weeklyActualSum.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                / {kpiSummary.weeklyTargetSum.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 h-full rounded-full"
                style={{ width: `${kpiSummary.weeklyRate}%` }}
              />
            </div>
          </div>

          {/* 3. Monthly Target Card */}
          <div
            onClick={() => setSelectedHorizon('monthly')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              selectedHorizon === 'monthly'
                ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-500/20'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-700" />
                Monthly Target
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {kpiSummary.monthlyRate}%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-purple-800 font-bold truncate">
              {formatDateDisplay(monthRangeStart)} — {formatDateDisplay(monthRangeEnd)}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-purple-700">
                {kpiSummary.monthlyActualSum.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 font-semibold">
                / {kpiSummary.monthlyTargetSum.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full"
                style={{ width: `${kpiSummary.monthlyRate}%` }}
              />
            </div>
          </div>

          {/* 4. Total Factory Due Card */}
          <div
            onClick={() => setSelectedHorizon('due')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              selectedHorizon === 'due'
                ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-rose-700" />
                Total Factory Due
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Backlog
              </span>
            </div>
            <div className="mt-1 text-[10px] text-rose-800 font-semibold truncate">
              All Orders Uncompleted
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-rose-700">
                {kpiSummary.totalDueSum.toLocaleString()}
              </span>
              <span className="text-xs text-slate-600 font-semibold">{defaultProductionUnit}</span>
            </div>
            <p className="text-[10px] text-slate-600 truncate mt-2">
              Click to view balance due
            </p>
          </div>

          {/* 5. Active Operations Card */}
          <div
            onClick={() => setSelectedHorizon('operations')}
            className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
              selectedHorizon === 'operations'
                ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20'
                : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Factory className="h-3.5 w-3.5 text-amber-700" />
                Active Operations
              </span>
              <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                {orders.length} Orders
              </span>
            </div>
            <div className="mt-1 text-[10px] text-amber-800 font-semibold truncate">
              Sections Running
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-base sm:text-xl font-black text-amber-700">
                {kpiSummary.behindOpsCount}
              </span>
              <span className="text-xs text-slate-600 font-semibold">Sections Pending</span>
            </div>
            <p className="text-[10px] text-slate-600 truncate mt-2">
              Click to filter running sections
            </p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & Tab Switcher */}
      <div className="p-4 sm:p-5 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-4">
        {/* Top Controls Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Horizon Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedHorizon('daily')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === 'daily'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Today&apos;s Target</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedHorizon('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === 'weekly'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Weekly Target</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedHorizon('monthly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === 'monthly'
                  ? 'bg-white text-purple-700 shadow-xs border border-slate-200'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Monthly Target</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedHorizon('due')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === 'due'
                  ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Total Balance Due</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedHorizon('operations')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                selectedHorizon === 'operations'
                  ? 'bg-white text-amber-700 shadow-xs border border-slate-200'
                  : 'text-slate-700 hover:text-black'
              }`}
            >
              <Factory className="h-3.5 w-3.5" />
              <span>Active Due Ops</span>
            </button>
          </div>
        </div>

        {/* Dynamic Contextual Date Range Selector Toolbar */}
        {selectedHorizon === 'weekly' && (
          <div className="flex items-center gap-2 flex-wrap bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 text-xs">
            <div className="flex items-center gap-1.5 font-black text-emerald-900">
              <CalendarDays className="h-4 w-4 text-emerald-700" />
              <span>Weekly Target Date Range:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={weekRangeStart}
                onChange={(e) => setWeekRangeStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
              <span className="font-black text-emerald-700">to</span>
              <input
                type="date"
                value={weekRangeEnd}
                onChange={(e) => setWeekRangeEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
            </div>
            <div className="flex items-center gap-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => {
                  const s = new Date(weekRangeStart + 'T00:00:00');
                  s.setDate(s.getDate() - 7);
                  const e = new Date(weekRangeEnd + 'T00:00:00');
                  e.setDate(e.getDate() - 7);
                  setWeekRangeStart(getFlowLocalDate(s));
                  setWeekRangeEnd(getFlowLocalDate(e));
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold transition"
                title="Previous 7 Days"
              >
                ← Prev Week
              </button>
              <button
                type="button"
                onClick={() => {
                  const w = getWeekRange(new Date());
                  setWeekRangeStart(w.monday);
                  setWeekRangeEnd(w.sunday);
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-xs"
                title="Reset to Current Week"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = new Date(weekRangeStart + 'T00:00:00');
                  s.setDate(s.getDate() + 7);
                  const e = new Date(weekRangeEnd + 'T00:00:00');
                  e.setDate(e.getDate() + 7);
                  setWeekRangeStart(getFlowLocalDate(s));
                  setWeekRangeEnd(getFlowLocalDate(e));
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold transition"
                title="Next 7 Days"
              >
                Next Week →
              </button>
            </div>
          </div>
        )}

        {selectedHorizon === 'monthly' && (
          <div className="flex items-center gap-2 flex-wrap bg-purple-50/80 p-3 rounded-2xl border border-purple-200 text-xs">
            <div className="flex items-center gap-1.5 font-black text-purple-900">
              <Calendar className="h-4 w-4 text-purple-700" />
              <span>Monthly Target Date Range:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={monthRangeStart}
                onChange={(e) => setMonthRangeStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
              />
              <span className="font-black text-purple-700">to</span>
              <input
                type="date"
                value={monthRangeEnd}
                onChange={(e) => setMonthRangeEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-purple-300 bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
              />
            </div>
            <div className="flex items-center gap-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => {
                  const s = new Date(monthRangeStart + 'T00:00:00');
                  s.setMonth(s.getMonth() - 1);
                  const m = getMonthRange(s);
                  setMonthRangeStart(m.start);
                  setMonthRangeEnd(m.end);
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 border border-purple-300 text-purple-800 font-bold transition"
                title="Previous Month"
              >
                ← Prev Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const m = getMonthRange(new Date());
                  setMonthRangeStart(m.start);
                  setMonthRangeEnd(m.end);
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-xs"
                title="Reset to Current Month"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = new Date(monthRangeStart + 'T00:00:00');
                  s.setMonth(s.getMonth() + 1);
                  const m = getMonthRange(s);
                  setMonthRangeStart(m.start);
                  setMonthRangeEnd(m.end);
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 border border-purple-300 text-purple-800 font-bold transition"
                title="Next Month"
              >
                Next Month →
              </button>
            </div>
          </div>
        )}

        {(selectedHorizon === 'daily' || selectedHorizon === 'operations' || selectedHorizon === 'due') && (
          <div className="flex items-center gap-2 flex-wrap bg-blue-50/80 p-3 rounded-2xl border border-blue-200 text-xs">
            <div className="flex items-center gap-1.5 font-black text-blue-900">
              <Clock className="h-4 w-4 text-blue-700" />
              <span>Target Reference Date:</span>
            </div>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => handleTargetDateChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-blue-300 bg-white font-black text-black focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            <div className="flex items-center gap-1 sm:ml-auto">
              <button
                type="button"
                onClick={() => {
                  const d = new Date(targetDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  handleTargetDateChange(getFlowLocalDate(d));
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold transition"
              >
                ← Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleTargetDateChange(new Date().toISOString().slice(0, 10))}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date(targetDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  handleTargetDateChange(getFlowLocalDate(d));
                }}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold transition"
              >
                Tomorrow →
              </button>
            </div>
          </div>
        )}

        {/* Search & Department Dropdown Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200">
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order #, Buyer, Article, or Section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department Filter */}
          <div className="relative">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8"
            >
              <option value="all">All Sections / Depts</option>
              {validDeptNames.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* View Tab Switcher: Target Matrix vs Production Logs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 py-1 text-xs font-bold rounded-lg transition text-center ${
                activeTab === 'matrix' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              Target Matrix
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-1 text-xs font-bold rounded-lg transition text-center ${
                activeTab === 'logs' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-black'
              }`}
            >
              Entry Logs ({filteredLogs.length})
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW 1: TARGET-WISE PRODUCTION MATRIX                             */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {filteredRows.length === 0 ? (
            <div className="p-12 rounded-3xl border border-slate-200 bg-white text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
                <Target className="h-6 w-6 opacity-60" />
              </div>
              <h3 className="text-base font-bold text-black">No Orders Match the Selected Filters</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Try switching the target horizon or clearing your search term to view production targets.
              </p>
            </div>
          ) : (
            filteredRows.map(({ order, reqDepts, sectionRows, totalOrderTarget, orderDailyPlan, orderDailyActual, orderWeeklyPlan, orderWeeklyActual, orderTotalActual, orderTotalDue }) => {
              const unit = order.unit || defaultProductionUnit;
              const displayDepts = selectedDept === 'all' ? sectionRows : sectionRows.filter((s) => s.department === selectedDept);

              return (
                <div
                  key={order.id}
                  className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5"
                >
                  {/* Order Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center font-mono font-black text-blue-700 text-xs">
                        #{order.orderNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-black">
                            {order.articleName || 'Standard Article'}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-800 text-xs font-bold border border-blue-200">
                            Buyer: {order.buyerName || 'Factory'}
                          </span>
                          {order.color && (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                              {order.color}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                            order.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {order.priority || 'Medium'} Priority
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Total Order: <strong className="text-black">{totalOrderTarget.toLocaleString()} {unit}</strong> • Delivery: <strong className="text-black">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not Set'}</strong> • Active Sections: <strong className="text-blue-700">{reqDepts.length}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Order Action Buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/orders/${order.id || order.orderNumber}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition"
                      >
                        <span>Order Sheet</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>

                      <Link
                        href={`/production?orderId=${order.id}`}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Log Entry</span>
                      </Link>
                    </div>
                  </div>

                  {/* Section-Wise Target Grid */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                      Target & Output Breakdown ({selectedHorizon.toUpperCase()} VIEW):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {displayDepts.map((sec) => (
                        <div
                          key={sec.department}
                          className={`p-3.5 rounded-2xl border transition ${
                            sec.isDone
                              ? 'bg-emerald-50/60 border-emerald-300 text-black shadow-2xs'
                              : sec.currentDue > 0
                              ? 'bg-slate-50 border-slate-200 text-black hover:border-blue-300'
                              : 'bg-slate-50/50 border-slate-200 text-black'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <span className="font-black text-xs text-black flex items-center gap-1.5 truncate">
                              <Factory className="h-3.5 w-3.5 text-blue-700 flex-shrink-0" />
                              <span className="truncate">{sec.department}</span>
                            </span>

                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              sec.isDone
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : sec.fillRate > 0
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {sec.fillRate}%
                            </span>
                          </div>

                          {/* Target vs Produced Stats */}
                          <div className="space-y-1 text-xs pt-1 border-t border-slate-200/80">
                            <div className="flex justify-between items-center text-slate-600 text-[11px]">
                              <span>Target:</span>
                              <strong className="text-black font-bold">{sec.horizonTarget.toLocaleString()} {unit}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 text-[11px]">
                              <span>Produced:</span>
                              <strong className="text-emerald-700 font-black">+{sec.currentActual.toLocaleString()} {unit}</strong>
                            </div>
                            <div className="flex justify-between items-center text-slate-600 text-[11px]">
                              <span>Remaining Due:</span>
                              <strong className={sec.currentDue > 0 ? 'text-rose-700 font-black' : 'text-slate-500'}>
                                {sec.currentDue.toLocaleString()} {unit}
                              </strong>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2.5">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                sec.isDone ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${sec.fillRate}%` }}
                            />
                          </div>

                          {/* Quick Log Shortcut */}
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">
                              Total: <strong>{sec.actualTotal}</strong>
                            </span>
                            <Link
                              href={`/production?orderId=${order.id}&dept=${encodeURIComponent(sec.department)}`}
                              className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5"
                            >
                              <span>+ Add Log</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* VIEW 2: DETAILED PRODUCTION ENTRY LOGS                            */}
      {/* ───────────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-black flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-700" />
              <span>Production Entry Logs for Selected Filter ({filteredLogs.length})</span>
            </h2>

            <Link
              href="/production"
              className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Entry</span>
            </Link>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-10 rounded-3xl border border-slate-200 bg-white text-center space-y-2 shadow-sm">
              <p className="text-xs sm:text-sm font-semibold text-slate-600">
                No production entry logs found matching your criteria.
              </p>
              <Link
                href="/production"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition mt-2"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Record New Production Entry</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const d = log.updatedAt ? new Date(log.updatedAt) : new Date();
                const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
                const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                const hasSizes = log.sizeBreakdown && Object.keys(log.sizeBreakdown).length > 0;

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-black hover:border-slate-300 transition"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-black text-xs border border-blue-200">
                          {log.department}
                        </span>
                        {log.processName && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200">
                            ⚙️ {log.processName}
                          </span>
                        )}
                        <span className="font-mono font-bold text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Order #{log.orderId}
                        </span>
                        <span className="font-bold text-sm text-black">
                          {log.articleName || 'Standard'} {log.color ? `(${log.color})` : ''}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          • {dateStr} at {timeStr}
                        </span>
                      </div>

                      {/* Size breakdown badges */}
                      {hasSizes && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-600">Sizes:</span>
                          {Object.entries(log.sizeBreakdown!).map(([sz, qty]) => {
                            const num = Number(qty) || 0;
                            if (num <= 0) return null;
                            return (
                              <span key={sz} className="text-[11px] font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-900">
                                {sz}#: <strong className="text-black font-black">{num}</strong>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {log.notes && (
                        <p className="text-xs text-slate-600 italic">
                          &ldquo;{log.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                      <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-sm shadow-2xs">
                        +{log.completed} {defaultProductionUnit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TargetProductionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading Target Production Status...</span>
          </div>
        </div>
      }
    >
      <TargetProductionContent />
    </Suspense>
  );
}
