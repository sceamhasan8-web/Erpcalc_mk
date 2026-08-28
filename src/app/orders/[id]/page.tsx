"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Factory,
  Layers,
  Package,
  TrendingUp,
  Trash2,
  PlusCircle,
  AlertTriangle,
  User,
  Shield,
  FileText,
} from 'lucide-react';
import { firebaseService } from '@/services/firebaseService';
import { mockRepository } from '@/repositories/mockRepository';
import { erpService } from '@/services/erpService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit } from '@/lib/unitSettings';
import { calculateMultiProcessProduction } from '@/lib/productionUtils';
import type { BuyerOrder, ProductionFlow } from '@/types';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderIdOrNumber = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';

  const defaultProductionUnit = useProductionUnit();
  const { showAlert, showConfirm, toast } = useModal();

  const [orders, setOrders] = useState<BuyerOrder[]>(() => mockRepository.getBuyerOrders());
  const [flows, setFlows] = useState<ProductionFlow[]>(() => mockRepository.getProductionFlows());
  const [departments, setDepartments] = useState<string[]>(() =>
    erpService.getDepartments().filter((d) => d.name.toLowerCase() !== 'warehouse').map((d) => d.name)
  );

  useEffect(() => {
    const unsubOrders = firebaseService.subscribeOrders((live) => {
      if (live && Array.isArray(live)) setOrders(live);
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((live) => {
      if (live && Array.isArray(live)) setFlows(live);
    });
    return () => {
      unsubOrders();
      unsubFlows();
    };
  }, []);

  // Match order by ID or orderNumber
  const order = useMemo(() => {
    if (!orderIdOrNumber) return null;
    return (
      orders.find((o) => o.id === orderIdOrNumber || o.orderNumber === orderIdOrNumber) ||
      orders.find((o) => o.orderNumber?.toLowerCase() === orderIdOrNumber.toLowerCase()) ||
      null
    );
  }, [orders, orderIdOrNumber]);

  // Production flows specifically for this order
  const orderFlows = useMemo(() => {
    if (!order) return [];
    return flows
      .filter((f) => f.orderId === order.id || f.orderId === order.orderNumber)
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [flows, order]);

  // Handle Delete Flow entry
  const handleDeleteFlow = async (flow: ProductionFlow) => {
    const ok = await showConfirm({
      title: 'Delete Production Entry?',
      message: `Delete ${flow.completed} ${order?.unit || defaultProductionUnit} logged under ${flow.department}?`,
      type: 'danger',
    });
    if (!ok) return;

    try {
      await firebaseService.deleteProductionFlow(flow.id);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
      toast.success('Production entry deleted successfully.');
    } catch (e) {
      console.error(e);
      showAlert({ title: 'Delete Failed', message: 'Could not delete production flow log.', type: 'error' });
    }
  };

  // Calculate section progress for each article item
  const articleBreakdowns = useMemo(() => {
    if (!order) return [];
    const items = order.items && order.items.length > 0
      ? order.items
      : [
          {
            id: 'item_default',
            articleId: '',
            articleName: order.articleName || 'Standard Article',
            color: order.color || 'Standard',
            genderCategory: 'mens' as const,
            quantity: String(order.quantity || 0),
            sizeBreakdown: order.sizeBreakdown || {},
            requiredDepartments: (order.requiredDepartments && order.requiredDepartments.length > 0)
              ? order.requiredDepartments
              : departments,
          },
        ];

    return items.map((item) => {
      const targetQty = Number(item.quantity) || 0;
      const itemFlows = orderFlows.filter((f) => !f.itemId || f.itemId === item.id);

      // Determine applicable departments strictly for this item/order:
      // 1. If this specific item has custom required departments configured:
      const validItemDepts = (item.requiredDepartments || []).filter((d) =>
        departments.length === 0 || departments.includes(d)
      );

      // 2. If no item-specific custom departments, use order's required departments:
      const validOrderDepts = (order.requiredDepartments || []).filter((d) =>
        departments.length === 0 || departments.includes(d)
      );

      const targetDepts = validItemDepts.length > 0
        ? validItemDepts
        : validOrderDepts.length > 0
          ? validOrderDepts
          : departments;

      // Section by section completed (strictly for selected required departments)
      const deptProgress = targetDepts.map((dept) => {
        const res = calculateMultiProcessProduction(itemFlows, dept, [], targetQty);
        const completed = res.totalCompleted;
        const due = Math.max(0, targetQty - completed);
        const percent = targetQty > 0 ? Math.min(100, Math.round((completed / targetQty) * 100)) : 0;
        return {
          dept,
          completed,
          due,
          percent,
          isDone: completed >= targetQty && targetQty > 0,
        };
      });

      // Overall completed (bottleneck or last stage e.g. Packing or minimum across required depts)
      const packingProgress = deptProgress.find((d) => d.dept.toLowerCase() === 'packing');
      const finishedCompleted = packingProgress
        ? packingProgress.completed
        : deptProgress.length > 0
          ? Math.min(...deptProgress.map((d) => d.completed))
          : 0;
      const finishedDue = Math.max(0, targetQty - finishedCompleted);
      const overallPercent = targetQty > 0 ? Math.min(100, Math.round((finishedCompleted / targetQty) * 100)) : 0;

      return {
        item,
        targetQty,
        finishedCompleted,
        finishedDue,
        overallPercent,
        deptProgress,
        itemFlows,
      };
    });
  }, [order, orderFlows, departments]);

  // Grand total stats across all items
  const orderSummary = useMemo(() => {
    if (!order) return { totalTarget: 0, totalCompleted: 0, totalDue: 0, percent: 0 };
    const totalTarget = Number(order.quantity) || articleBreakdowns.reduce((sum, a) => sum + a.targetQty, 0);
    const totalCompleted = articleBreakdowns.reduce((sum, a) => sum + a.finishedCompleted, 0);
    const totalDue = Math.max(0, totalTarget - totalCompleted);
    const percent = totalTarget > 0 ? Math.min(100, Math.round((totalCompleted / totalTarget) * 100)) : 0;
    return { totalTarget, totalCompleted, totalDue, percent };
  }, [order, articleBreakdowns]);

  if (!order) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4 text-black">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <Box className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-black">Order Not Found</h2>
          <p className="text-sm text-slate-600 mt-1">
            Could not find order details for "{orderIdOrNumber}".
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Orders List</span>
        </Link>
      </div>
    );
  }

  const unit = order.unit || defaultProductionUnit;

  return (
    <div className="w-full space-y-6 pb-24 max-w-7xl mx-auto text-black">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Orders Overview</span>
            </Link>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-bold text-slate-600">Production & Balance Sheet</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
              Order #{order.orderNumber}
            </h1>
            <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 font-black text-xs border border-blue-200 shadow-xs">
              Buyer: {order.buyerName || 'GJ'}
            </span>
            <span className={`px-3 py-1 rounded-xl font-bold text-xs border ${
              order.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              {order.priority || 'Medium'} Priority
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/production?orderId=${order.id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Record Production Entry</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition"
          >
            <FileText className="h-4 w-4 text-slate-700" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* KPI Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Target */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Total Order Target</span>
          <p className="text-2xl font-black text-black">
            {orderSummary.totalTarget.toLocaleString()} <span className="text-xs font-semibold text-slate-600">{unit}</span>
          </p>
          <span className="text-[11px] text-slate-500 font-medium">Original buyer order requirement</span>
        </div>

        {/* Completed Output */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Finished Output</span>
          <p className="text-2xl font-black text-emerald-700">
            +{orderSummary.totalCompleted.toLocaleString()} <span className="text-xs font-semibold text-slate-600">{unit}</span>
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${orderSummary.percent}%` }} />
          </div>
        </div>

        {/* Remaining Balance Due */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Remaining Balance Due</span>
          <p className="text-2xl font-black text-rose-700">
            {orderSummary.totalDue.toLocaleString()} <span className="text-xs font-semibold text-slate-600">{unit} due</span>
          </p>
          <span className="text-[11px] font-bold text-rose-800">
            {orderSummary.totalDue === 0 ? '✓ Order Fully Completed!' : `${orderSummary.percent}% completed`}
          </span>
        </div>

        {/* Delivery & Timeline */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Delivery Date</span>
          <p className="text-lg font-black text-black">
            {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not Set'}
          </p>
          <span className="text-[11px] text-slate-600">
            Total {articleBreakdowns.length} Article Item(s)
          </span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: ARTICLE-WISE PRODUCTION & BALANCE PROGRESS            */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold text-black">Article-Wise Production & Balance Breakdown</h2>
          </div>
        </div>

        <div className="space-y-4">
          {articleBreakdowns.map(({ item, targetQty, finishedCompleted, finishedDue, overallPercent, deptProgress }, idx) => {
            const hasSizes = item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0;

            return (
              <div
                key={item.id || idx}
                className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5"
              >
                {/* Article Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center font-black text-blue-700 text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-black">
                          {item.articleName || 'Standard Article'}
                        </h3>
                        {item.color && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                            Color: {item.color}
                          </span>
                        )}
                        {item.genderCategory && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 text-xs font-bold border border-purple-200">
                            {item.genderCategory}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Target: <strong className="text-black">{targetQty.toLocaleString()} {unit}</strong> • Completed: <strong className="text-emerald-700">+{finishedCompleted.toLocaleString()} {unit}</strong> • Balance Due: <strong className="text-rose-700">{finishedDue.toLocaleString()} {unit}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Article Completion Badge */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-600 block">Article Progress</span>
                      <span className="text-base font-black text-black">{overallPercent}%</span>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-slate-100 flex items-center justify-center font-black text-xs bg-slate-50">
                      {overallPercent}%
                    </div>
                  </div>
                </div>

                {/* Size-Wise Target Grid (if sizes configured) */}
                {hasSizes && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-black text-blue-800 uppercase tracking-wider block">
                      Target Sizes for this Article:
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                      {Object.entries(item.sizeBreakdown!).map(([sz, qty]) => (
                        <div key={sz} className="p-2.5 rounded-xl bg-white border border-slate-200 text-center shadow-2xs">
                          <span className="text-[11px] font-bold text-slate-600 block">{sz}#</span>
                          <span className="text-sm font-black text-black">{qty} <span className="text-[10px] text-slate-500 font-normal">{unit}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section-by-Section Progress Matrix */}
                <div className="space-y-2.5">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Section-Wise Production Status & Remaining Due:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deptProgress.map((dp) => (
                      <div
                        key={dp.dept}
                        className={`p-3.5 rounded-2xl border transition ${
                          dp.isDone
                            ? 'bg-emerald-50/50 border-emerald-200 text-black'
                            : 'bg-slate-50 border-slate-200 text-black'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-black text-xs text-black flex items-center gap-1.5">
                            <Factory className="h-3.5 w-3.5 text-blue-700" />
                            <span>{dp.dept}</span>
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            dp.isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'
                          }`}>
                            {dp.percent}%
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between text-xs pt-1">
                          <span>Produced: <strong className="text-emerald-700 font-black">+{dp.completed} {unit}</strong></span>
                          <span>Due: <strong className={dp.due > 0 ? 'text-rose-700 font-black' : 'text-slate-600 font-bold'}>{dp.due} {unit}</strong></span>
                        </div>

                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full rounded-full ${dp.isDone ? 'bg-emerald-600' : 'bg-blue-600'}`}
                            style={{ width: `${dp.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: PRODUCTION ENTRY HISTORY LOG FOR THIS ORDER            */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold text-black">
              Production Entry Logs for Order #{order.orderNumber} ({orderFlows.length})
            </h2>
          </div>

          <Link
            href={`/production?orderId=${order.id}`}
            className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Add New Entry</span>
          </Link>
        </div>

        {orderFlows.length === 0 ? (
          <div className="p-8 rounded-3xl border border-slate-200 bg-white text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <Factory className="h-6 w-6 opacity-50" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              No production entries recorded yet for Order #{order.orderNumber}.
            </p>
            <Link
              href={`/production?orderId=${order.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Record First Production Log</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orderFlows.map((f) => {
              const d = f.updatedAt ? new Date(f.updatedAt) : new Date();
              const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
              const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              const hasSizes = f.sizeBreakdown && Object.keys(f.sizeBreakdown).length > 0;

              return (
                <div
                  key={f.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-black hover:border-slate-300 transition"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-black text-xs border border-blue-200">
                        {f.department}
                      </span>
                      {f.processName && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold text-xs border border-purple-200">
                          ⚙️ {f.processName}
                        </span>
                      )}
                      <span className="font-bold text-sm text-black">
                        {f.articleName || 'Standard'} {f.color ? `(${f.color})` : ''}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        • {dateStr} at {timeStr}
                      </span>
                    </div>

                    {/* Size breakdown badges if logged */}
                    {hasSizes && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Sizes:</span>
                        {Object.entries(f.sizeBreakdown!).map(([sz, qty]) => {
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

                    {f.notes && (
                      <p className="text-xs text-slate-600 italic">
                        "{f.notes}"
                      </p>
                    )}
                  </div>

                  {/* Quantity & Delete */}
                  <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-sm">
                      +{f.completed} {unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteFlow(f)}
                      className="p-1.5 rounded-xl bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200 transition"
                      title="Delete this entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
