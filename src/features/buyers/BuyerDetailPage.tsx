"use client";
import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit, getProductionUnit, DEFAULT_PRODUCTION_UNITS } from '@/lib/unitSettings';
import type { Article, Buyer, BuyerOrder, Order, ProductionFlow, Department } from '@/types';
import { Star, Mail, Phone, MapPin, Building, ArrowLeft, Package, TrendingUp, Calendar } from 'lucide-react';

interface BuyerDetailPageProps {
  buyerId: string;
}

export function BuyerDetailPage({ buyerId }: BuyerDetailPageProps) {
  const { showAlert, toast } = useModal();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<BuyerOrder[]>([]);
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [buyersData, ordersData, articlesData, departmentsData, buyerOrdersData, flowsData] = await Promise.all([
          apiService.getBuyers(),
          apiService.getOrders(),
          apiService.getArticles(),
          apiService.getDepartments(),
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
        ]);
        setBuyers(buyersData);
        setOrders(ordersData);
        setArticles(articlesData);
        setDepartments(departmentsData.filter((d) => d.name.toLowerCase() !== 'warehouse'));
        setReceivedOrders(buyerOrdersData.filter((o) => o.buyerId === buyerId));
        setProductionFlows(flowsData);
      } catch (error) {
        console.error('Failed to load buyer detail data', error);
      }
    }

    loadData();

    // Live Real-Time Subscriptions
    const unsubOrders = firebaseService.subscribeOrders((liveOrders) => {
      setReceivedOrders(liveOrders.filter((o) => o.buyerId === buyerId));
    });
    const unsubBuyers = firebaseService.subscribeBuyers((liveBuyers) => {
      setBuyers(liveBuyers);
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((liveFlows) => {
      setProductionFlows(liveFlows);
    });

    return () => {
      unsubOrders();
      unsubBuyers();
      unsubFlows();
    };
  }, [buyerId]);

  const buyer = buyers.find((b) => b.id === buyerId);
  const buyerProductionOrders = orders.filter((o) => o.buyerId === buyerId);
  const buyerReceivedOrders = receivedOrders;

  // Calculate imported products summary
  const importedProducts = useMemo(() => {
    const productMap: { [articleId: string]: { article?: Article; orders: BuyerOrder[] } } = {};
    
    buyerReceivedOrders.forEach((order) => {
      const artId = order.articleId || order.items?.[0]?.articleId || 'general';
      if (!productMap[artId]) {
        const article = articles.find((a) => a.id === artId);
        productMap[artId] = { article, orders: [] };
      }
      productMap[artId].orders.push(order);
    });

    return Object.values(productMap).sort((a, b) => 
      (b.orders.reduce((sum, o) => sum + o.quantity, 0)) - (a.orders.reduce((sum, o) => sum + o.quantity, 0))
    );
  }, [buyerReceivedOrders, articles]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [form, setForm] = useState({
    articleId: '',
    color: '',
    quantity: '',
    unit: getProductionUnit(),
    deliveryDate: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    notes: '',
    requiredDepartments: [] as string[],
  });

  const selectedArticle = useMemo(() => articles.find((a) => a.id === form.articleId) ?? null, [articles, form.articleId]);

  function getOrderCompletionStatus(order: BuyerOrder): { isComplete: boolean; completionPercent: number; completedDepts: string[]; pendingDepts: string[] } {
    if (!order.requiredDepartments || order.requiredDepartments.length === 0) {
      return { isComplete: false, completionPercent: 0, completedDepts: [], pendingDepts: [] };
    }

    const orderFlows = productionFlows.filter((pf) => pf.orderId === order.id);
    const completedDepts: string[] = [];
    const pendingDepts: string[] = [];

    order.requiredDepartments.forEach((dept) => {
      const deptFlows = orderFlows.filter((pf) => pf.department === dept);
      const totalCompleted = deptFlows.reduce((sum, f) => sum + f.completed, 0);
      if (totalCompleted >= order.quantity) {
        completedDepts.push(dept);
      } else {
        pendingDepts.push(dept);
      }
    });

    const isComplete = pendingDepts.length === 0 && completedDepts.length > 0;
    const completionPercent = completedDepts.length > 0 ? Math.round((completedDepts.length / order.requiredDepartments.length) * 100) : 0;

    return { isComplete, completionPercent, completedDepts, pendingDepts };
  }

  function handleChange<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function toggleDepartment(deptName: string) {
    setForm((s) => {
      const depts = s.requiredDepartments || [];
      if (depts.includes(deptName)) {
        return { ...s, requiredDepartments: depts.filter((d) => d !== deptName) };
      } else {
        return { ...s, requiredDepartments: [...depts, deptName] };
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.articleId) {
      showAlert({ title: 'Missing Article', message: 'Please choose an article.', type: 'warning' });
      return;
    }
    if (!form.color) {
      showAlert({ title: 'Missing Color', message: 'Please choose or enter a color.', type: 'warning' });
      return;
    }
    if (!form.quantity) {
      showAlert({ title: 'Missing Quantity', message: 'Please enter a valid order quantity.', type: 'warning' });
      return;
    }

    try {
      const created = await apiService.createBuyerOrder({
        quantity: Number(form.quantity),
        orderNumber: `BO-${Date.now().toString().slice(-6)}`,
        buyerId: buyerId,
        buyerName: buyer?.name,
        articleId: form.articleId,
        articleName: selectedArticle?.name ?? '',
        color: form.color,
        unit: form.unit,
        deliveryDate: form.deliveryDate || undefined,
        priority: form.priority,
        notes: form.notes || undefined,
        requiredDepartments: form.requiredDepartments.length > 0 ? form.requiredDepartments : undefined,
      });
      setReceivedOrders((s) => [created, ...s]);
      setForm({ articleId: '', color: '', quantity: '', unit: getProductionUnit(), deliveryDate: '', priority: 'Medium', notes: '', requiredDepartments: [] });
      setShowReceiveForm(false);
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error('Failed to create buyer order', error);
      showAlert({ title: 'Order Failed', message: 'Unable to save order. Please try again.', type: 'error' });
    }
  }

  const selectedProductionOrder = selectedOrderId ? buyerProductionOrders.find((o) => o.id === selectedOrderId) : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-900/30 text-green-300 border-green-700';
      case 'In Progress':
        return 'bg-blue-900/30 text-blue-300 border-blue-700';
      case 'Delayed':
        return 'bg-red-900/30 text-red-300 border-red-700';
      case 'Cancelled':
        return 'bg-gray-900/30 text-gray-300 border-gray-700';
      default:
        return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'High':
        return 'text-red-400';
      case 'Medium':
        return 'text-yellow-400';
      default:
        return 'text-green-400';
    }
  };

  const getRatingStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}`} />
          ))}
        </div>
        <span className="text-xs text-[var(--ec-muted)]">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (!buyer) {
    return (
      <div className="w-full space-y-6 text-[var(--ec-foreground)]">
        <div className="mx-auto max-w-6xl">
          <Link href="/buyers" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Buyers
          </Link>
          <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-8 text-center text-[var(--ec-muted)]">
            Buyer not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-[var(--ec-foreground)]">
      <div className="mx-auto max-w-6xl">
        {/* Back Button */}
        <Link href="/buyers" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4 transition-colors text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          Back to Buyers
        </Link>

        {/* Buyer Info Card */}
        <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold mb-2">{buyer.name}</h1>
              <p className="text-[var(--ec-muted)] flex items-center gap-2">
                <Building className="h-4 w-4" />
                {buyer.company || 'N/A'}
              </p>
            </div>
            {buyer.tier && (
              <span
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${
                  buyer.tier === 'Strategic'
                    ? 'bg-red-900/30 text-red-300 border-red-700'
                    : buyer.tier === 'Premium'
                      ? 'bg-yellow-900/30 text-yellow-300 border-yellow-700'
                      : 'bg-blue-900/30 text-blue-300 border-blue-700'
                }`}
              >
                {buyer.tier} Tier
              </span>
            )}
          </div>

          {/* Rating */}
          {buyer.rating && <div className="mb-6">{getRatingStars(buyer.rating)}</div>}

          {/* Contact Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[var(--ec-border)]">
            {buyer.email && (
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Email</p>
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-cyan-400" />
                  {buyer.email}
                </p>
              </div>
            )}
            {buyer.phone && (
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Phone</p>
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-cyan-400" />
                  {buyer.phone}
                </p>
              </div>
            )}
            {buyer.region && (
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-500 mb-2">Region</p>
                <p className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  {buyer.region}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Orders List */}
          <div className="lg:col-span-2">
            {/* Received Orders Section */}
            <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-cyan-400" />
                  Received Orders ({receivedOrders.length})
                </h2>
                <button
                  onClick={() => setShowReceiveForm(!showReceiveForm)}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  + Receive Order
                </button>
              </div>

              {/* Receive Form */}
              {showReceiveForm && (
                <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded border border-[var(--ec-border)] bg-[var(--ec-surface)]">
                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Article</label>
                    <select value={form.articleId} onChange={(e) => handleChange('articleId', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]">
                      <option value="">Select article...</option>
                      {articles.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Color</label>
                    <select value={form.color} onChange={(e) => handleChange('color', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]" disabled={!selectedArticle}>
                      <option value="">Select color...</option>
                      {selectedArticle?.colors.map((c: string) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Quantity</label>
                    <input type="number" value={form.quantity} onChange={(e) => handleChange('quantity', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]" />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Unit</label>
                    <select value={form.unit} onChange={(e) => handleChange('unit', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)] font-semibold">
                      {Array.from(new Set([form.unit, ...DEFAULT_PRODUCTION_UNITS])).filter(Boolean).map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Delivery Date</label>
                    <input type="date" value={form.deliveryDate} onChange={(e) => handleChange('deliveryDate', e.target.value)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]" />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Priority</label>
                    <select value={form.priority} onChange={(e) => handleChange('priority', e.target.value as any)} className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[var(--ec-muted)] mb-2">Required Departments</label>
                    <div className="flex flex-wrap gap-3">
                      {departments.map((dept) => (
                        <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.requiredDepartments.includes(dept.name)}
                            onChange={() => toggleDepartment(dept.name)}
                            className="rounded"
                          />
                          <span className="text-sm">{dept.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[var(--ec-muted)] mb-1">Notes</label>
                    <input type="text" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Optional notes..." className="w-full rounded border px-2 py-1.5 text-sm bg-[var(--ec-card)]" />
                  </div>

                  <div className="sm:col-span-2 flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowReceiveForm(false)} className="rounded px-3 py-1.5 text-sm border border-[var(--ec-border)] hover:bg-[var(--ec-surface)]">
                      Cancel
                    </button>
                    <button type="submit" className="rounded bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white">
                      Receive Order
                    </button>
                  </div>
                </form>
              )}

              {/* Received Orders List */}
              <div className="space-y-3">
                {receivedOrders.length === 0 ? (
                  <div className="text-sm text-[var(--ec-muted)] py-4 text-center">No received orders yet</div>
                ) : (
                  receivedOrders.map((o) => {
                    const { isComplete, completionPercent, completedDepts, pendingDepts } = getOrderCompletionStatus(o);
                    const hasItems = o.items && o.items.length > 0;
                    return (
                      <div key={o.id} className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 hover:border-cyan-500/50 transition-colors space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                                {o.orderNumber}
                              </span>
                              {hasItems ? (
                                <span className="text-xs font-bold text-[var(--ec-foreground)]">
                                  {o.items!.length} {o.items!.length === 1 ? 'Item' : 'Items'} Configured
                                </span>
                              ) : (
                                <span className="font-semibold text-sm text-[var(--ec-foreground)]">
                                  {o.articleName} &bull; {o.color}
                                </span>
                              )}
                              {o.genderCategory && !hasItems && (
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                  {o.genderCategory === 'womens' ? "Women's (35#-41#)" : o.genderCategory === 'both' ? "Men & Women (35#-46#)" : "Men's (40#-46#)"}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded border ${getPriorityColor(o.priority)} border-current/30 bg-current/10`}>{o.priority} Priority</span>
                        </div>

                        {/* If items array exists */}
                        {hasItems ? (
                          <div className="space-y-2 pt-2 border-t border-[var(--ec-border)]">
                            {o.items!.map((it, idx) => (
                              <div key={it.id || idx} className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-2.5 text-xs">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    {it.image && (
                                      <img src={it.image} alt={it.articleName} className="w-8 h-8 rounded object-cover border border-cyan-500/30" />
                                    )}
                                    <span className="font-bold text-[var(--ec-foreground)]">{it.articleName} &bull; {it.color}</span>
                                    {it.genderCategory && (
                                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                        {it.genderCategory === 'womens' ? "Women's" : it.genderCategory === 'both' ? "Both" : "Men's"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-extrabold text-cyan-400">{it.quantity} {o.unit}</span>
                                </div>
                                {it.sizeBreakdown && Object.keys(it.sizeBreakdown).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-[var(--ec-border)]/50">
                                    {Object.entries(it.sizeBreakdown)
                                      .sort(([a], [b]) => Number(a) - Number(b))
                                      .map(([size, qty]) => (
                                        <span key={size} className="inline-flex items-center gap-1 rounded bg-[var(--ec-surface)] border border-[var(--ec-border)] px-1.5 py-0.5 text-[10px]">
                                          <span className="text-[var(--ec-muted)]">{size}#:</span>
                                          <strong className="text-cyan-400">{qty}</strong>
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          o.sizeBreakdown && Object.keys(o.sizeBreakdown).length > 0 && (
                            <div className="mb-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-[var(--ec-border)]">
                              {Object.entries(o.sizeBreakdown)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([size, qty]) => (
                                  <span key={size} className="inline-flex items-center gap-1 rounded bg-[var(--ec-card)] border border-[var(--ec-border)] px-1.5 py-0.5 text-[10px]">
                                    <span className="text-[var(--ec-muted)]">{size}#:</span>
                                    <strong className="text-cyan-400">{qty}</strong>
                                  </span>
                                ))}
                            </div>
                          )
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--ec-muted)] pt-2 border-t border-[var(--ec-border)]">
                          <div>
                            <p className="text-[var(--ec-muted)] text-[11px]">Total Quantity</p>
                            <p className="font-extrabold text-[var(--ec-foreground)]">{o.quantity} {o.unit}</p>
                          </div>
                          <div>
                            <p className="text-[var(--ec-muted)] text-[11px]">Status</p>
                            <p className="font-semibold text-cyan-400">{o.status}</p>
                          </div>
                          {o.deliveryDate && (
                            <div>
                              <p className="text-[var(--ec-muted)] text-[11px]">Delivery</p>
                              <p className="font-semibold text-[var(--ec-foreground)]">{new Date(o.deliveryDate).toLocaleDateString()}</p>
                            </div>
                          )}
                          {o.createdAt && (
                            <div>
                              <p className="text-[var(--ec-muted)] text-[11px]">Created</p>
                              <p className="font-semibold text-[var(--ec-foreground)]">{new Date(o.createdAt).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>

                        {o.requiredDepartments && o.requiredDepartments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-[var(--ec-border)]">
                            <div className="text-xs text-[var(--ec-muted)] mb-1.5">Required Departments: {completionPercent}%</div>
                            <div className="flex flex-wrap gap-1.5">
                              {completedDepts.map((dept) => (
                                <span key={dept} className="text-[11px] bg-green-600/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-medium">{dept} ✓</span>
                              ))}
                              {pendingDepts.map((dept) => (
                                <span key={dept} className="text-[11px] bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded">{dept}</span>
                              ))}
                            </div>
                            {isComplete && <p className="text-xs text-green-500 font-medium mt-1">✓ Order Complete</p>}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Production Orders Section */}
            <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Production Orders ({buyerProductionOrders.length})
              </h2>

              <div className="space-y-3">
                {buyerProductionOrders.length === 0 ? (
                  <div className="text-sm text-[var(--ec-muted)] py-4 text-center">No production orders</div>
                ) : (
                  buyerProductionOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id === selectedOrderId ? null : order.id)}
                      className="w-full text-left rounded border border-[var(--ec-border)] bg-[var(--ec-surface)] p-4 hover:border-cyan-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">{order.orderNumber} — {order.style}</p>
                          <p className="text-xs text-[var(--ec-muted)]">Current: {order.currentDepartment}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium px-2 py-1 rounded border border-current/30 bg-current/10 ${getStatusColor(order.status)}`}>{order.status}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[var(--ec-muted)]">Progress</span>
                          <span className="text-xs font-semibold text-cyan-400">{order.productionPercentage}%</span>
                        </div>
                        <div className="h-2 bg-[var(--ec-card)] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400" style={{ width: `${order.productionPercentage}%` }}></div>
                        </div>
                      </div>

                      {/* Quantity Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-[var(--ec-muted)] pt-2 border-t border-[var(--ec-border)]">
                        <div>
                          <p className="text-[var(--ec-muted)]">Total</p>
                          <p className="font-semibold text-[var(--ec-foreground)]">{order.quantity}</p>
                        </div>
                        <div>
                          <p className="text-[var(--ec-muted)]">Completed</p>
                          <p className="font-semibold text-green-400">{order.completedQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[var(--ec-muted)]">Pending</p>
                          <p className="font-semibold text-yellow-400">{order.pendingQuantity}</p>
                        </div>
                        <div>
                          <p className="text-[var(--ec-muted)]">Rejected</p>
                          <p className="font-semibold text-red-400">{order.rejectedQuantity}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Order Details */}
          <div className="lg:col-span-1">
            {selectedProductionOrder ? (
              <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Order Details</h3>
                  <button onClick={() => setSelectedOrderId(null)} className="text-[var(--ec-muted)] hover:text-[var(--ec-foreground)]">
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Order Number */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Order Number</p>
                    <p className="font-semibold">{selectedProductionOrder.orderNumber}</p>
                  </div>

                  {/* Style */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Style</p>
                    <p className="font-semibold">{selectedProductionOrder.style || 'N/A'}</p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Status</p>
                    <span className={`inline-block text-xs font-medium px-2 py-1 rounded border border-current/30 bg-current/10 ${getStatusColor(selectedProductionOrder.status)}`}>
                      {selectedProductionOrder.status}
                    </span>
                  </div>

                  {/* Priority */}
                  <div>
                    <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Priority</p>
                    <span className={`text-sm font-semibold ${getPriorityColor(selectedProductionOrder.priority)}`}>{selectedProductionOrder.priority}</span>
                  </div>

                  <div className="border-t border-[var(--ec-border)] pt-4">
                    {/* Quantities */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[var(--ec-surface)] rounded p-2">
                        <p className="text-xs text-[var(--ec-muted)] mb-1">Total</p>
                        <p className="font-semibold text-sm">{selectedProductionOrder.quantity}</p>
                      </div>
                      <div className="bg-[var(--ec-surface)] rounded p-2">
                        <p className="text-xs text-[var(--ec-muted)] mb-1">Completed</p>
                        <p className="font-semibold text-sm text-green-400">{selectedProductionOrder.completedQuantity}</p>
                      </div>
                      <div className="bg-[var(--ec-surface)] rounded p-2">
                        <p className="text-xs text-[var(--ec-muted)] mb-1">Pending</p>
                        <p className="font-semibold text-sm text-yellow-400">{selectedProductionOrder.pendingQuantity}</p>
                      </div>
                      <div className="bg-[var(--ec-surface)] rounded p-2">
                        <p className="text-xs text-[var(--ec-muted)] mb-1">Rejected</p>
                        <p className="font-semibold text-sm text-red-400">{selectedProductionOrder.rejectedQuantity}</p>
                      </div>
                    </div>

                    {/* Dates */}
                    {selectedProductionOrder.startDate && (
                      <div className="mb-3">
                        <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Started</p>
                        <p className="text-sm flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedProductionOrder.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {selectedProductionOrder.eta && (
                      <div className="mb-3">
                        <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Expected Completion</p>
                        <p className="text-sm flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedProductionOrder.eta).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Cost & Revenue */}
                    {selectedProductionOrder.cost && (
                      <div className="mb-3">
                        <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Production Cost</p>
                        <p className="text-sm font-semibold">${selectedProductionOrder.cost.toLocaleString()}</p>
                      </div>
                    )}

                    {selectedProductionOrder.revenue && (
                      <div>
                        <p className="text-xs uppercase tracking-wider text-cyan-500 mb-1">Revenue</p>
                        <p className="text-sm font-semibold text-green-400">${selectedProductionOrder.revenue.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 text-center text-[var(--ec-muted)]">
                <p>Select a production order to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Imported Products Section */}
        <div className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-card)] p-6 mt-8">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-cyan-400" />
            Imported Products ({importedProducts.length})
          </h2>

          {importedProducts.length === 0 ? (
            <div className="text-sm text-[var(--ec-muted)] py-4 text-center">No imported products</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ec-border)]">
                    <th className="text-left py-3 px-3 font-semibold text-[var(--ec-muted)]">Product</th>
                    <th className="text-left py-3 px-3 font-semibold text-[var(--ec-muted)]">Colors Ordered</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--ec-muted)]">Total Orders</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--ec-muted)]">Total Quantity</th>
                    <th className="text-center py-3 px-3 font-semibold text-[var(--ec-muted)]">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {importedProducts.map((product, idx) => {
                    const totalQty = product.orders.reduce((sum, o) => sum + o.quantity, 0);
                    const colors = Array.from(new Set(product.orders.map(o => o.color)));
                    const unit = product.orders[0]?.unit || getProductionUnit();

                    return (
                      <tr key={product.article?.id || idx} className="border-b border-[var(--ec-border)] hover:bg-[var(--ec-surface)] transition-colors">
                        <td className="py-3 px-3 font-medium">{product.article?.name || 'Unknown'}</td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {colors.map((color) => (
                              <span
                                key={color}
                                className="px-2 py-1 rounded text-xs bg-[var(--ec-surface)] text-[var(--ec-foreground)] border border-[var(--ec-border)]"
                              >
                                {color}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block bg-blue-900/30 text-blue-300 px-3 py-1 rounded font-semibold">
                            {product.orders.length}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-cyan-400">{totalQty}</td>
                        <td className="py-3 px-3 text-center text-[var(--ec-muted)]">{unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
