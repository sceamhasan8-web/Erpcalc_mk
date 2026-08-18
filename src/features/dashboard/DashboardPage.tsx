"use client";

import { useEffect, useState, useMemo } from 'react';
import { erpService } from '@/services/erpService';
import { mockRepository } from '@/repositories/mockRepository';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useProductionUnit } from '@/lib/unitSettings';
import { BarChart, Bar, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
  ArrowRight, 
  Boxes, 
  Factory, 
  PackageCheck, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Layers, 
  Search, 
  ExternalLink,
  ChevronRight,
  Filter,
  Calendar,
  X
} from 'lucide-react';
import Link from 'next/link';
import type { BuyerOrder, ProductionFlow, Department } from '@/types';

const chartData = [
  { name: 'Mon', production: 4200 },
  { name: 'Tue', production: 5100 },
  { name: 'Wed', production: 4700 },
  { name: 'Thu', production: 5900 },
  { name: 'Fri', production: 6400 },
  { name: 'Sat', production: 6100 },
];

const departmentData = [
  { name: 'Cutting', value: 94 },
  { name: 'Sewing', value: 89 },
  { name: 'Packing', value: 96 },
  { name: 'Printing', value: 91 },
];

export function DashboardPage() {
  const productionUnit = useProductionUnit();
  const [orders, setOrders] = useState(erpService.getOrders());
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>(() => mockRepository.getBuyerOrders());
  const [departments, setDepartments] = useState(erpService.getDepartments());
  const [notifications, setNotifications] = useState(erpService.getNotifications());
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>(() => mockRepository.getProductionFlows());
  const [warehouseStocks, setWarehouseStocks] = useState(erpService.getWarehouseStocks());

  // Modal State for Production Details
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'today_orders' | 'month_orders' | 'all_orders' | 'sections'>('today_orders');
  const [modalSearch, setModalSearch] = useState('');
  const [selectedModalOrderId, setSelectedModalOrderId] = useState<string | null>(null);

  // Initial Load from API & Firebase
  useEffect(() => {
    async function loadData() {
      try {
        const [ordersData, flowsData, deptsData, stockData] = await Promise.all([
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
          apiService.getDepartments(),
          apiService.getWarehouseStocks(),
        ]);
        if (ordersData && ordersData.length > 0) setBuyerOrders(ordersData);
        if (flowsData && flowsData.length > 0) setProductionFlows(flowsData);
        if (deptsData && deptsData.length > 0) setDepartments(deptsData);
        if (stockData && stockData.length > 0) setWarehouseStocks(stockData);
      } catch (err) {
        console.error('Failed loading dashboard data', err);
      }
    }
    loadData();

    // Firebase real-time listeners
    const unsubOrders = firebaseService.subscribeOrders((live) => {
      if (live && Array.isArray(live)) setBuyerOrders(live);
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((live) => {
      if (live && Array.isArray(live)) setProductionFlows(live);
    });
    const unsubDepts = firebaseService.subscribeDepartments((live) => {
      if (live && Array.isArray(live)) setDepartments(live);
    });
    const unsubStocks = firebaseService.subscribeWarehouseStocks((live) => {
      if (live && Array.isArray(live)) setWarehouseStocks(live);
    });

    function handleDataUpdate() {
      apiService.getBuyerOrders().then(setBuyerOrders).catch(() => {});
      apiService.getProductionFlows().then(setProductionFlows).catch(() => {});
      apiService.getDepartments().then(setDepartments).catch(() => {});
      apiService.getWarehouseStocks().then(setWarehouseStocks).catch(() => {});
      setNotifications(erpService.getNotifications());
    }

    window.addEventListener('erp:buyerOrdersUpdated', handleDataUpdate);
    window.addEventListener('erp:buyersUpdated', handleDataUpdate);
    window.addEventListener('erp:productionFlowsUpdated', handleDataUpdate);
    window.addEventListener('erp:departmentsUpdated', handleDataUpdate);
    window.addEventListener('erp:finishedGoodsUpdated', handleDataUpdate);
    window.addEventListener('erp:warehouseStocksUpdated', handleDataUpdate);

    return () => {
      unsubOrders();
      unsubFlows();
      unsubDepts();
      unsubStocks();
      window.removeEventListener('erp:buyerOrdersUpdated', handleDataUpdate);
      window.removeEventListener('erp:buyersUpdated', handleDataUpdate);
      window.removeEventListener('erp:productionFlowsUpdated', handleDataUpdate);
      window.removeEventListener('erp:departmentsUpdated', handleDataUpdate);
      window.removeEventListener('erp:finishedGoodsUpdated', handleDataUpdate);
      window.removeEventListener('erp:warehouseStocksUpdated', handleDataUpdate);
    };
  }, []);

  // Calculate production metrics (Today, This Month, Total, Weekly)
  const productionMetrics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let productionTodayValue = 0;
    let productionThisMonthValue = 0;
    let productionTotalValue = 0;
    let weeklyProductionValue = 0;

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    productionFlows.forEach((flow) => {
      const qty = Number(flow.completed) || 0;
      productionTotalValue += qty;

      if (flow.updatedAt) {
        const flowDate = new Date(flow.updatedAt);

        // Today Check
        const dCheck = new Date(flowDate.getFullYear(), flowDate.getMonth(), flowDate.getDate());
        if (dCheck.getTime() === today.getTime()) {
          productionTodayValue += qty;
        }

        // This Month Check
        if (flowDate.getMonth() === currentMonth && flowDate.getFullYear() === currentYear) {
          productionThisMonthValue += qty;
        }

        // Last 7 Days Check
        if (dCheck >= sevenDaysAgo && dCheck <= today) {
          weeklyProductionValue += qty;
        }
      }
    });

    const activeOrdersCount = buyerOrders.filter((o) => o.status !== 'Completed').length;
    const inventoryItemsCount = warehouseStocks.length;

    return {
      productionTodayValue,
      productionThisMonthValue,
      productionTotalValue,
      weeklyProductionValue,
      activeOrdersCount,
      inventoryItemsCount,
    };
  }, [productionFlows, buyerOrders, warehouseStocks]);

  // Distinct system departments dynamically aggregated from settings, flows, and orders
  const departmentNames = useMemo(() => {
    const defaultDepts = ['Cutting', 'Sewing', 'Lasting', 'DIP', 'Packing', 'Goods Store'];
    const dynamicDepts = departments
      .filter((d) => d.name && d.name.toLowerCase() !== 'warehouse')
      .map((d) => d.name);
    const flowDepts = productionFlows.map((f) => f.department).filter(Boolean);
    const orderDepts = buyerOrders.flatMap((o) => o.requiredDepartments || []).filter(Boolean);
    return Array.from(new Set([...defaultDepts, ...dynamicDepts, ...flowDepts, ...orderDepts]));
  }, [departments, productionFlows, buyerOrders]);

  // Today's flows
  const todayFlows = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return productionFlows.filter((f) => {
      if (!f.updatedAt) return false;
      const d = new Date(f.updatedAt);
      const dCheck = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return dCheck.getTime() === today.getTime();
    });
  }, [productionFlows]);

  // This month's flows
  const thisMonthFlows = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return productionFlows.filter((f) => {
      if (!f.updatedAt) return false;
      const d = new Date(f.updatedAt);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    });
  }, [productionFlows]);

  // Detailed calculations for Today's Orders
  const todayOrdersDetails = useMemo(() => {
    const orderMap = new Map<string, {
      order: BuyerOrder | null;
      orderId: string;
      orderNumber: string;
      buyerName: string;
      totalOrderQty: number;
      unit: string;
      todayTotal: number;
      monthTotal: number;
      allTimeTotal: number;
      sectionBreakdownToday: Record<string, number>;
      sectionBreakdownMonth: Record<string, number>;
      sectionBreakdownAllTime: Record<string, number>;
      logsToday: ProductionFlow[];
    }>();

    todayFlows.forEach((flow) => {
      const orderId = flow.orderId;
      const matchedOrder = buyerOrders.find((o) => o.id === orderId || o.orderNumber === orderId);

      if (!orderMap.has(orderId)) {
        const orderFlowsAll = productionFlows.filter((f) => f.orderId === orderId);
        const allTimeTotal = orderFlowsAll.reduce((sum, f) => sum + f.completed, 0);

        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        const orderFlowsMonth = orderFlowsAll.filter((f) => {
          if (!f.updatedAt) return false;
          const d = new Date(f.updatedAt);
          return d.getMonth() === curMonth && d.getFullYear() === curYear;
        });
        const monthTotal = orderFlowsMonth.reduce((sum, f) => sum + f.completed, 0);

        const sectionBreakdownAllTime: Record<string, number> = {};
        orderFlowsAll.forEach((f) => {
          sectionBreakdownAllTime[f.department] = (sectionBreakdownAllTime[f.department] || 0) + f.completed;
        });

        const sectionBreakdownMonth: Record<string, number> = {};
        orderFlowsMonth.forEach((f) => {
          sectionBreakdownMonth[f.department] = (sectionBreakdownMonth[f.department] || 0) + f.completed;
        });

        orderMap.set(orderId, {
          order: matchedOrder || null,
          orderId,
          orderNumber: matchedOrder?.orderNumber || flow.orderId,
          buyerName: matchedOrder?.buyerName || 'Unknown Buyer',
          totalOrderQty: matchedOrder?.quantity || 0,
          unit: matchedOrder?.unit || productionUnit,
          todayTotal: 0,
          monthTotal,
          allTimeTotal,
          sectionBreakdownToday: {},
          sectionBreakdownMonth,
          sectionBreakdownAllTime,
          logsToday: [],
        });
      }

      const item = orderMap.get(orderId)!;
      item.todayTotal += flow.completed;
      item.sectionBreakdownToday[flow.department] = (item.sectionBreakdownToday[flow.department] || 0) + flow.completed;
      item.logsToday.push(flow);
    });

    return Array.from(orderMap.values());
  }, [todayFlows, buyerOrders, productionFlows, productionUnit]);

  // Detailed calculations for This Month's Orders
  const monthOrdersDetails = useMemo(() => {
    const orderMap = new Map<string, {
      order: BuyerOrder | null;
      orderId: string;
      orderNumber: string;
      buyerName: string;
      totalOrderQty: number;
      unit: string;
      todayTotal: number;
      monthTotal: number;
      allTimeTotal: number;
      sectionBreakdownToday: Record<string, number>;
      sectionBreakdownMonth: Record<string, number>;
      sectionBreakdownAllTime: Record<string, number>;
      logsMonth: ProductionFlow[];
    }>();

    thisMonthFlows.forEach((flow) => {
      const orderId = flow.orderId;
      const matchedOrder = buyerOrders.find((o) => o.id === orderId || o.orderNumber === orderId);

      if (!orderMap.has(orderId)) {
        const orderFlowsAll = productionFlows.filter((f) => f.orderId === orderId);
        const allTimeTotal = orderFlowsAll.reduce((sum, f) => sum + f.completed, 0);

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const orderFlowsToday = orderFlowsAll.filter((f) => {
          if (!f.updatedAt) return false;
          const d = new Date(f.updatedAt);
          const dCheck = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return dCheck.getTime() === today.getTime();
        });
        const todayTotal = orderFlowsToday.reduce((sum, f) => sum + f.completed, 0);

        const sectionBreakdownAllTime: Record<string, number> = {};
        orderFlowsAll.forEach((f) => {
          sectionBreakdownAllTime[f.department] = (sectionBreakdownAllTime[f.department] || 0) + f.completed;
        });

        const sectionBreakdownToday: Record<string, number> = {};
        orderFlowsToday.forEach((f) => {
          sectionBreakdownToday[f.department] = (sectionBreakdownToday[f.department] || 0) + f.completed;
        });

        orderMap.set(orderId, {
          order: matchedOrder || null,
          orderId,
          orderNumber: matchedOrder?.orderNumber || flow.orderId,
          buyerName: matchedOrder?.buyerName || 'Unknown Buyer',
          totalOrderQty: matchedOrder?.quantity || 0,
          unit: matchedOrder?.unit || productionUnit,
          todayTotal,
          monthTotal: 0,
          allTimeTotal,
          sectionBreakdownToday,
          sectionBreakdownMonth: {},
          sectionBreakdownAllTime,
          logsMonth: [],
        });
      }

      const item = orderMap.get(orderId)!;
      item.monthTotal += flow.completed;
      item.sectionBreakdownMonth[flow.department] = (item.sectionBreakdownMonth[flow.department] || 0) + flow.completed;
      item.logsMonth.push(flow);
    });

    return Array.from(orderMap.values());
  }, [thisMonthFlows, buyerOrders, productionFlows, productionUnit]);

  // Section-wise summary for today, this month, and overall
  const sectionSummary = useMemo(() => {
    const map: Record<string, { name: string; todayQty: number; monthQty: number; totalQty: number; todayOrdersCount: Set<string>; monthOrdersCount: Set<string> }> = {};

    departmentNames.forEach((name) => {
      map[name] = { name, todayQty: 0, monthQty: 0, totalQty: 0, todayOrdersCount: new Set(), monthOrdersCount: new Set() };
    });

    productionFlows.forEach((f) => {
      if (!map[f.department]) {
        map[f.department] = { name: f.department, todayQty: 0, monthQty: 0, totalQty: 0, todayOrdersCount: new Set(), monthOrdersCount: new Set() };
      }
      map[f.department].totalQty += f.completed;
    });

    thisMonthFlows.forEach((f) => {
      if (map[f.department]) {
        map[f.department].monthQty += f.completed;
        map[f.department].monthOrdersCount.add(f.orderId);
      }
    });

    todayFlows.forEach((f) => {
      if (map[f.department]) {
        map[f.department].todayQty += f.completed;
        map[f.department].todayOrdersCount.add(f.orderId);
      }
    });

    return Object.values(map);
  }, [departmentNames, productionFlows, thisMonthFlows, todayFlows]);

  // Filtered orders for modal
  const filteredTodayOrders = useMemo(() => {
    if (!modalSearch.trim()) return todayOrdersDetails;
    const q = modalSearch.toLowerCase();
    return todayOrdersDetails.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.buyerName.toLowerCase().includes(q) ||
        Object.keys(o.sectionBreakdownToday).some((s) => s.toLowerCase().includes(q))
    );
  }, [todayOrdersDetails, modalSearch]);

  const filteredMonthOrders = useMemo(() => {
    if (!modalSearch.trim()) return monthOrdersDetails;
    const q = modalSearch.toLowerCase();
    return monthOrdersDetails.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.buyerName.toLowerCase().includes(q) ||
        Object.keys(o.sectionBreakdownMonth).some((s) => s.toLowerCase().includes(q))
    );
  }, [monthOrdersDetails, modalSearch]);

  const filteredAllOrders = useMemo(() => {
    const list = buyerOrders.map((o) => {
      const orderFlows = productionFlows.filter((f) => f.orderId === o.id || f.orderId === o.orderNumber);
      const totalProduced = orderFlows.reduce((s, f) => s + f.completed, 0);
      const todayOrderFlows = todayFlows.filter((f) => f.orderId === o.id || f.orderId === o.orderNumber);
      const todayProduced = todayOrderFlows.reduce((s, f) => s + f.completed, 0);
      const monthOrderFlows = thisMonthFlows.filter((f) => f.orderId === o.id || f.orderId === o.orderNumber);
      const monthProduced = monthOrderFlows.reduce((s, f) => s + f.completed, 0);

      const sectionBreakdown: Record<string, number> = {};
      orderFlows.forEach((f) => {
        sectionBreakdown[f.department] = (sectionBreakdown[f.department] || 0) + f.completed;
      });

      return {
        ...o,
        totalProduced,
        monthProduced,
        todayProduced,
        sectionBreakdown,
        pctCompleted: Math.min(100, Math.round((totalProduced / (o.quantity || 1)) * 100)),
      };
    });

    if (!modalSearch.trim()) return list;
    const q = modalSearch.toLowerCase();
    return list.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.buyerName?.toLowerCase().includes(q) ||
        o.articleName?.toLowerCase().includes(q)
    );
  }, [buyerOrders, productionFlows, todayFlows, thisMonthFlows, modalSearch]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-6">
        <header className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 p-5 sm:p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/80 font-bold">EasyCalc Factory ERP</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-extrabold text-white">Production Command Center</h1>
            <p className="mt-1 max-w-xl text-xs sm:text-sm text-white/85">Monitor buyers, orders, departments, inventory, and factory performance.</p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/15 backdrop-blur-md px-4 py-2.5 text-white shadow-sm flex sm:flex-col justify-between items-center sm:items-start flex-shrink-0">
            <p className="text-xs text-white/80 font-medium">Daily target status</p>
            <p className="text-base sm:text-lg font-bold text-white">93% on track</p>
          </div>
        </header>

        {/* KPI Cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Production Today (Clickable with Details Modal) */}
          <div
            onClick={() => {
              setModalTab('today_orders');
              setIsProductionModalOpen(true);
            }}
            className="kpi cursor-pointer group hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/10 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted">Production Today</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-white transition">
                  Details 🔍
                </span>
              </div>
              <Factory className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition" />
            </div>
            <p className="mt-4 text-2xl font-black text-foreground">
              {productionMetrics.productionTodayValue.toLocaleString()} <span className="text-sm font-semibold text-muted">{productionUnit}</span>
            </p>
            <div className="text-[11px] text-[var(--ec-muted)] mt-1 flex items-center justify-between">
              <span>Month: <strong className="text-cyan-400">{productionMetrics.productionThisMonthValue.toLocaleString()}</strong></span>
              <span>Total: <strong className="text-emerald-400">{productionMetrics.productionTotalValue.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Card 2: Monthly Production (Clickable) */}
          <div
            onClick={() => {
              setModalTab('month_orders');
              setIsProductionModalOpen(true);
            }}
            className="kpi cursor-pointer group hover:border-emerald-500/50 hover:shadow-md hover:shadow-emerald-500/10 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-muted">This Month Output</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  Month
                </span>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition" />
            </div>
            <p className="mt-4 text-2xl font-black text-foreground">
              {productionMetrics.productionThisMonthValue.toLocaleString()} <span className="text-sm font-semibold text-muted">{productionUnit}</span>
            </p>
            <p className="text-[11px] text-emerald-400 font-medium mt-1">
              Total cumulative: {productionMetrics.productionTotalValue.toLocaleString()} {productionUnit} &rarr;
            </p>
          </div>

          {/* Card 3: Active Orders */}
          <Link href="/orders" className="kpi group hover:border-amber-500/50 transition">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">Active Orders</p>
              <PackageCheck className="h-5 w-5 text-amber-400 group-hover:scale-110 transition" />
            </div>
            <p className="mt-4 text-2xl font-black text-foreground">{productionMetrics.activeOrdersCount}</p>
            <p className="text-[11px] text-amber-400 font-medium mt-1">
              View orders list &rarr;
            </p>
          </Link>

          {/* Card 4: Inventory Items */}
          <Link href="/warehouse" className="kpi group hover:border-rose-500/50 transition">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">Inventory Items</p>
              <Boxes className="h-5 w-5 text-rose-400 group-hover:scale-110 transition" />
            </div>
            <p className="mt-4 text-2xl font-black text-foreground">
              {productionMetrics.inventoryItemsCount} <span className="text-sm font-semibold text-muted">items</span>
            </p>
            <p className="text-[11px] text-rose-400 font-medium mt-1">
              Warehouse materials &rarr;
            </p>
          </Link>
        </section>

        {/* Charts & Trends */}
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="ec-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ec-muted)]">Daily Production</p>
                <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Factory output trend</h2>
              </div>
              <button 
                onClick={() => {
                  setModalTab('today_orders');
                  setIsProductionModalOpen(true);
                }}
                className="rounded-full border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-1 text-sm font-semibold text-[var(--ec-primary)] hover:bg-[var(--ec-card)]"
              >
                View report
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Line type="monotone" dataKey="production" stroke="#22d3ee" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ec-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ec-muted)]">Notifications</p>
                <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Live alerts</h2>
              </div>
            </div>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3">
                  <p className="font-medium text-[var(--ec-foreground)]">{notification.title}</p>
                  <p className="mt-1 text-sm text-[var(--ec-muted)]">{notification.message}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Orders & Department Overview */}
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="ec-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ec-muted)]">Orders</p>
                <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Active production orders</h2>
              </div>
              <Link href="/production" className="text-xs font-bold text-cyan-400 hover:underline">
                Open Production Page &rarr;
              </Link>
            </div>
            <div className="space-y-3">
              {buyerOrders.slice(0, 4).map((order) => {
                const totalFlow = productionFlows
                  .filter((f) => f.orderId === order.id || f.orderId === order.orderNumber)
                  .reduce((s, f) => s + f.completed, 0);
                const pct = Math.min(100, Math.round((totalFlow / (order.quantity || 1)) * 100));

                return (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-3.5 hover:border-cyan-500/40 transition">
                    <div>
                      <p className="font-bold text-sm text-[var(--ec-foreground)]">
                        <span className="font-mono text-cyan-400">{order.orderNumber}</span> &bull; {order.buyerName}
                      </p>
                      <p className="text-xs text-[var(--ec-muted)] mt-0.5">
                        {order.articleName || 'General Style'} &bull; Target: <strong className="text-[var(--ec-foreground)]">{order.quantity} {order.unit || productionUnit}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-sm text-cyan-400">{pct}%</span>
                      <p className="text-[10px] text-[var(--ec-muted)]">{totalFlow} / {order.quantity} done</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ec-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--ec-muted)]">Department Performance</p>
                <h2 className="text-xl font-semibold text-[var(--ec-foreground)]">Efficiency by section</h2>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {departmentData.map((entry, index) => (
                      <Cell key={entry.name} fill={index % 2 === 0 ? '#22d3ee' : '#34d399'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Link Footer */}
        <section className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-[var(--ec-muted)]">Production Logs & Size Matrix</p>
              <h2 className="text-lg sm:text-xl font-bold text-[var(--ec-foreground)]">Manage daily output and size breakdowns</h2>
            </div>
            <Link
              href="/production"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 transition"
            >
              Open Production Hub <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TODAY'S, THIS MONTH'S & OVERALL PRODUCTION DETAILS MODAL */}
      {/* ------------------------------------------------------------- */}
      {isProductionModalOpen && (
        <div
          onClick={() => setIsProductionModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full max-h-[90vh] bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Modal Header with 3-Metric Summary (Today, This Month, Total) */}
            <div className="p-4 sm:p-5 border-b border-[var(--ec-border)] bg-[var(--ec-surface)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Factory className="h-5 w-5 text-cyan-400" />
                  <h2 className="text-base sm:text-xl font-black text-[var(--ec-foreground)]">
                    Production Output Details
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProductionModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--ec-card)] hover:bg-red-500/20 text-[var(--ec-muted)] hover:text-red-400 text-sm font-bold transition flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 3 Metrics Summary Cards (Today, This Month, Total Output) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--ec-card)] border border-cyan-500/25">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">Today's Output</p>
                  <p className="text-sm sm:text-lg font-black text-cyan-400 mt-0.5 truncate">
                    {productionMetrics.productionTodayValue.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                  </p>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--ec-card)] border border-emerald-500/25">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">This Month</p>
                  <p className="text-sm sm:text-lg font-black text-emerald-400 mt-0.5 truncate">
                    {productionMetrics.productionThisMonthValue.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                  </p>
                </div>

                <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--ec-card)] border border-amber-500/25">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">Total Cumulative</p>
                  <p className="text-sm sm:text-lg font-black text-amber-400 mt-0.5 truncate">
                    {productionMetrics.productionTotalValue.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Tabs & Search */}
            <div className="p-3 sm:p-4 border-b border-[var(--ec-border)] bg-[var(--ec-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 p-1 rounded-xl bg-[var(--ec-surface)] border border-[var(--ec-border)] w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModalTab('today_orders')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                    modalTab === 'today_orders'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                  }`}
                >
                  📅 Today ({todayOrdersDetails.length})
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('month_orders')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                    modalTab === 'month_orders'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                  }`}
                >
                  🗓️ This Month ({monthOrdersDetails.length})
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('all_orders')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                    modalTab === 'all_orders'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                  }`}
                >
                  📦 All Orders ({buyerOrders.length})
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('sections')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                    modalTab === 'sections'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm'
                      : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]'
                  }`}
                >
                  🏭 Sections ({departmentNames.length})
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ec-muted)]" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Filter orders..."
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] pl-9 pr-3 py-1.5 text-xs text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* TAB 1: TODAY'S ORDERS */}
              {modalTab === 'today_orders' && (
                <div className="space-y-4">
                  {filteredTodayOrders.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Factory className="h-8 w-8 text-[var(--ec-muted)] mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-[var(--ec-muted)]">
                        No production records found for today.
                      </p>
                      <Link
                        href="/production"
                        onClick={() => setIsProductionModalOpen(false)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:underline mt-2"
                      >
                        Go to Production Entry &rarr;
                      </Link>
                    </div>
                  ) : (
                    filteredTodayOrders.map((item) => (
                      <div
                        key={item.orderId}
                        className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 space-y-3.5"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                                {item.orderNumber}
                              </span>
                              <span className="font-bold text-sm text-[var(--ec-foreground)]">
                                Buyer: {item.buyerName}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--ec-muted)] mt-1">
                              Target: <strong className="text-[var(--ec-foreground)]">{item.totalOrderQty} {item.unit}</strong> &bull; Month: <strong className="text-emerald-400">{item.monthTotal} {item.unit}</strong> &bull; Total: <strong className="text-cyan-400">{item.allTimeTotal} {item.unit}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-sm">
                              Today: +{item.todayTotal} {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Section-Wise / Department Breakdown for This Order */}
                        <div className="space-y-2 pt-2 border-t border-[var(--ec-border)]/60">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                            Section-Wise Output for this Order (Today, Month & Total):
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {departmentNames.map((dept) => {
                              const todayQty = item.sectionBreakdownToday[dept] || 0;
                              const monthQty = item.sectionBreakdownMonth[dept] || 0;
                              const totalQty = item.sectionBreakdownAllTime[dept] || 0;
                              const isWorkedToday = todayQty > 0;
                              const isWorkedEver = totalQty > 0;

                              return (
                                <div
                                  key={dept}
                                  className={`rounded-xl p-2.5 text-xs border transition ${
                                    isWorkedToday
                                      ? 'border-cyan-500/50 bg-cyan-500/10'
                                      : isWorkedEver
                                      ? 'border-[var(--ec-border)] bg-[var(--ec-card)]'
                                      : 'border-[var(--ec-border)]/50 bg-[var(--ec-card)]/50 opacity-60'
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-bold">
                                    <span className="truncate">{dept}</span>
                                    {isWorkedToday && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-extrabold">
                                        +{todayQty}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-0.5 text-[10px] text-[var(--ec-muted)] mt-1.5 border-t border-[var(--ec-border)]/50 pt-1">
                                    <div className="flex justify-between">
                                      <span>Today:</span>
                                      <strong className={isWorkedToday ? 'text-emerald-400' : 'text-[var(--ec-foreground)]'}>{todayQty}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Month:</span>
                                      <strong className="text-cyan-400">{monthQty}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Total:</span>
                                      <strong className="text-[var(--ec-foreground)]">{totalQty}</strong>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Today's Entries Time Logs */}
                        {item.logsToday.length > 0 && (
                          <div className="pt-2 border-t border-[var(--ec-border)]/60 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)]">
                              Today's Entry Timestamps:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.logsToday.map((log) => {
                                const timeStr = log.updatedAt
                                  ? new Date(log.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                                  : 'N/A';

                                return (
                                  <span
                                    key={log.id}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[var(--ec-card)] border border-[var(--ec-border)]"
                                  >
                                    <Clock className="h-3 w-3 text-cyan-400" />
                                    <strong className="text-cyan-400">{timeStr}</strong> &bull;{' '}
                                    <span>{log.completed} {item.unit} in <strong className="text-[var(--ec-foreground)]">{log.department}</strong></span>
                                    {log.notes && <span className="text-[var(--ec-muted)] italic">({log.notes})</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: THIS MONTH'S ORDERS */}
              {modalTab === 'month_orders' && (
                <div className="space-y-4">
                  {filteredMonthOrders.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <Calendar className="h-8 w-8 text-[var(--ec-muted)] mx-auto opacity-40" />
                      <p className="text-sm font-semibold text-[var(--ec-muted)]">
                        No production records recorded this month.
                      </p>
                    </div>
                  ) : (
                    filteredMonthOrders.map((item) => (
                      <div
                        key={item.orderId}
                        className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 space-y-3.5"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                                {item.orderNumber}
                              </span>
                              <span className="font-bold text-sm text-[var(--ec-foreground)]">
                                Buyer: {item.buyerName}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--ec-muted)] mt-1">
                              Target: <strong className="text-[var(--ec-foreground)]">{item.totalOrderQty} {item.unit}</strong> &bull; Today: <strong className="text-emerald-400">+{item.todayTotal} {item.unit}</strong> &bull; Total: <strong className="text-cyan-400">{item.allTimeTotal} {item.unit}</strong>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-black text-sm">
                              This Month: {item.monthTotal} {item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Section Breakdown for This Month */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2 border-t border-[var(--ec-border)]/60">
                          {departmentNames.map((dept) => {
                            const monthQty = item.sectionBreakdownMonth[dept] || 0;
                            const totalQty = item.sectionBreakdownAllTime[dept] || 0;
                            if (totalQty === 0 && monthQty === 0) return null;

                            return (
                              <div key={dept} className="rounded-xl p-2.5 text-xs bg-[var(--ec-card)] border border-[var(--ec-border)]">
                                <span className="font-bold block truncate">{dept}</span>
                                <div className="flex justify-between text-[10px] text-[var(--ec-muted)] mt-1">
                                  <span>Month: <strong className="text-cyan-400">{monthQty}</strong></span>
                                  <span>Total: <strong>{totalQty}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: ALL ORDERS OVERVIEW WITH SECTION BREAKDOWN */}
              {modalTab === 'all_orders' && (
                <div className="space-y-3">
                  {filteredAllOrders.length === 0 ? (
                    <p className="text-center text-sm text-[var(--ec-muted)] py-8">No orders found.</p>
                  ) : (
                    filteredAllOrders.map((order) => {
                      return (
                        <div
                          key={order.id}
                          className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/25">
                                  {order.orderNumber}
                                </span>
                                <span className="font-bold text-sm text-[var(--ec-foreground)]">
                                  Buyer: {order.buyerName}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--ec-muted)] mt-0.5">
                                {order.articleName} &bull; Target: <strong className="text-[var(--ec-foreground)]">{order.quantity} {order.unit || productionUnit}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {order.todayProduced > 0 && (
                                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                  Today: +{order.todayProduced}
                                </span>
                              )}
                              <span className="text-xs font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                                Month: {order.monthProduced || 0}
                              </span>
                              <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                Total: {order.totalProduced} ({order.pctCompleted}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-[var(--ec-card)] h-2 rounded-full overflow-hidden border border-[var(--ec-border)]/60">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${order.pctCompleted}%` }}
                            />
                          </div>

                          {/* Section-wise total for this order */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            {(order.requiredDepartments && order.requiredDepartments.length > 0 ? order.requiredDepartments : departmentNames.slice(0, 4)).map((dept) => {
                              const done = order.sectionBreakdown[dept] || 0;
                              return (
                                <div key={dept} className="rounded-lg bg-[var(--ec-card)] p-2 text-xs border border-[var(--ec-border)]/50">
                                  <span className="font-bold text-[var(--ec-foreground)] block truncate">{dept}</span>
                                  <span className="text-[11px] text-cyan-400 font-mono font-bold">{done} / {order.quantity}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: SECTION / DEPARTMENT BREAKDOWN */}
              {modalTab === 'sections' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {sectionSummary.map((sec) => {
                      const isHot = sec.todayQty > 0;
                      return (
                        <div
                          key={sec.name}
                          className={`rounded-2xl border p-4 space-y-2.5 transition ${
                            isHot
                              ? 'border-cyan-500/50 bg-cyan-500/10 shadow-sm'
                              : 'border-[var(--ec-border)] bg-[var(--ec-surface)]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-black text-sm text-[var(--ec-foreground)] flex items-center gap-2">
                              <Layers className="h-4 w-4 text-cyan-400" />
                              <span>{sec.name}</span>
                            </h4>
                            {isHot && (
                              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Active Today
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--ec-border)]/60">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--ec-muted)] font-semibold">Today</p>
                              <p className="text-sm sm:text-base font-black text-emerald-400 mt-0.5">
                                {sec.todayQty.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--ec-muted)] font-semibold">This Month</p>
                              <p className="text-sm sm:text-base font-black text-cyan-400 mt-0.5">
                                {sec.monthQty.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                              </p>
                            </div>

                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--ec-muted)] font-semibold">Total All-Time</p>
                              <p className="text-sm sm:text-base font-black text-amber-400 mt-0.5">
                                {sec.totalQty.toLocaleString()} <span className="text-[10px] font-normal text-[var(--ec-muted)]">{productionUnit}</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-[10px] text-[var(--ec-muted)] flex justify-between">
                            <span>Today's active orders: <strong className="text-[var(--ec-foreground)]">{sec.todayOrdersCount.size}</strong></span>
                            <span>Monthly active orders: <strong className="text-[var(--ec-foreground)]">{sec.monthOrdersCount.size}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--ec-border)] bg-[var(--ec-surface)] flex items-center justify-between flex-wrap gap-2">
              <Link
                href="/production"
                onClick={() => setIsProductionModalOpen(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 transition"
              >
                <span>Go to Production Manager</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              <button
                type="button"
                onClick={() => setIsProductionModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)] text-xs font-bold text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
