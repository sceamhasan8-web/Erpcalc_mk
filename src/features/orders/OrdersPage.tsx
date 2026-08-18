"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { firebaseService } from '@/services/firebaseService';
import { useModal } from '@/context/ModalContext';
import { useProductionUnit, getProductionUnit, DEFAULT_PRODUCTION_UNITS } from '@/lib/unitSettings';
import type { Article, Buyer, BuyerOrder, ProductionFlow } from '@/types';

export function OrdersPage() {
  const router = useRouter();
  const { showAlert, showConfirm, toast } = useModal();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [productionFlows, setProductionFlows] = useState<ProductionFlow[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [buyersData, articlesData, departmentsData, ordersData, flowsData] = await Promise.all([
          apiService.getBuyers(),
          apiService.getArticles(),
          apiService.getDepartments(),
          apiService.getBuyerOrders(),
          apiService.getProductionFlows(),
        ]);

        setBuyers(buyersData);
        setArticles(articlesData);
        setDepartments(departmentsData.filter((d) => d.name.toLowerCase() !== 'warehouse').map((d) => d.name));
        setBuyerOrders(ordersData);
        setProductionFlows(flowsData);
      } catch (error) {
        console.error('Failed to load orders page data', error);
      }
    }

    loadData();

    // Direct Real-time Firestore Subscriptions for Instant Multi-Device Sync
    const updateSortedOrders = (orders: BuyerOrder[]) => {
      if (!orders || !Array.isArray(orders)) return;
      const sorted = [...orders].sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
      setBuyerOrders(sorted);
    };

    const unsubOrders = firebaseService.subscribeOrders((orders) => {
      updateSortedOrders(orders);
    });
    const unsubBuyers = firebaseService.subscribeBuyers((bList) => {
      if (bList && bList.length > 0) setBuyers(bList);
    });
    const unsubArticles = firebaseService.subscribeArticles((aList) => {
      if (aList && aList.length > 0) setArticles(aList);
    });
    const unsubDepts = firebaseService.subscribeDepartments((dList) => {
      if (dList && dList.length > 0) {
        setDepartments(dList.filter((d) => d.name.toLowerCase() !== 'warehouse').map((d) => d.name));
      }
    });
    const unsubFlows = firebaseService.subscribeProductionFlows((fList) => {
      if (fList && fList.length > 0) setProductionFlows(fList);
    });

    const handleWindowOrderSync = (e: any) => {
      if (e.detail) updateSortedOrders(e.detail);
    };
    window.addEventListener('erp:buyerOrdersUpdated', handleWindowOrderSync);

    return () => {
      unsubOrders();
      unsubBuyers();
      unsubArticles();
      unsubDepts();
      unsubFlows();
      window.removeEventListener('erp:buyerOrdersUpdated', handleWindowOrderSync);
    };
  }, []);

  const [filterBuyer, setFilterBuyer] = useState<string>('');
  const [filterArticle, setFilterArticle] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [buyerSearchQuery, setBuyerSearchQuery] = useState<string>('');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [openDeptItemIds, setOpenDeptItemIds] = useState<Set<string>>(new Set());

  function toggleOpenDeptItem(itemId: string) {
    setOpenDeptItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  const GENDER_CATEGORIES = useMemo(() => [
    { id: 'mens' as const, label: "Men's", rangeText: '40# - 46#', sizes: [40, 41, 42, 43, 44, 45, 46] },
    { id: 'womens' as const, label: "Women's", rangeText: '35# - 41#', sizes: [35, 36, 37, 38, 39, 40, 41] },
    { id: 'both' as const, label: "Men's & Women's", rangeText: '35# - 46#', sizes: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46] },
  ], []);

  const createEmptyItem = (gender: 'mens' | 'womens' | 'both' = 'mens') => ({
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    articleId: '',
    articleText: '',
    color: '',
    genderCategory: gender,
    sizeBreakdown: {} as Record<number, string>,
    quantity: '',
    image: undefined as string | undefined,
    requiredDepartments: [] as string[],
  });

  const defaultProductionUnit = useProductionUnit();

  const initialForm = {
    orderNumber: '',
    buyerId: '',
    unit: getProductionUnit(),
    deliveryDate: '',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    notes: '',
    requiredDepartments: [] as string[],
    items: [createEmptyItem()],
  };

  const [form, setForm] = useState(initialForm);

  const totalOrderQuantity = useMemo(() => {
    return form.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [form.items]);

  function getOrderCompletionStatus(order: BuyerOrder): { isComplete: boolean; completionPercent: number; completedDepts: string[]; pendingDepts: string[] } {
    if (!order.requiredDepartments || order.requiredDepartments.length === 0) {
      return { isComplete: false, completionPercent: 0, completedDepts: [], pendingDepts: [] };
    }

    const orderFlows = productionFlows.filter((pf) => pf.orderId === order.id);
    const completedDepts: string[] = [];
    const pendingDepts: string[] = [];

    order.requiredDepartments.forEach((dept) => {
      const deptFlow = orderFlows.find((pf) => pf.department === dept);
      if (deptFlow && deptFlow.completed >= order.quantity) {
        completedDepts.push(dept);
      } else {
        pendingDepts.push(dept);
      }
    });

    const isComplete = pendingDepts.length === 0 && completedDepts.length > 0;
    const completionPercent = completedDepts.length > 0 ? Math.round((completedDepts.length / order.requiredDepartments.length) * 100) : 0;

    return { isComplete, completionPercent, completedDepts, pendingDepts };
  }

  function handleFormChange<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function handleAddItem() {
    setForm((s) => ({
      ...s,
      items: [...s.items, createEmptyItem()],
    }));
  }

  function handleRemoveItem(itemId: string) {
    if (form.items.length <= 1) return;
    setForm((s) => ({
      ...s,
      items: s.items.filter((it) => it.id !== itemId),
    }));
  }

  function handleItemArticleChange(itemId: string, text: string) {
    const matched = articles.find(
      (a) =>
        a.name.toLowerCase() === text.trim().toLowerCase() ||
        a.code?.toLowerCase() === text.trim().toLowerCase() ||
        `${a.code} - ${a.name}`.toLowerCase() === text.trim().toLowerCase()
    );
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, articleText: text, articleId: matched?.id ?? '' } : it)),
    }));
  }

  function handleItemColorChange(itemId: string, color: string) {
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, color } : it)),
    }));
  }

  function handleItemImageUpload(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        message: 'Please choose an image smaller than 5MB.',
        type: 'warning',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? { ...it, image: base64 } : it)),
      }));
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveItemImage(itemId: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, image: undefined } : it)),
    }));
  }

  function handleItemGenderCategoryChange(itemId: string, category: 'mens' | 'womens' | 'both') {
    const targetConfig = GENDER_CATEGORIES.find((c) => c.id === category);
    const validSizes = targetConfig?.sizes || [];

    setForm((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== itemId) return it;
        const sum = validSizes.reduce((acc, size) => {
          const val = Number(it.sizeBreakdown[size]);
          return acc + (isNaN(val) || val < 0 ? 0 : val);
        }, 0);
        return {
          ...it,
          genderCategory: category,
          quantity: sum > 0 ? String(sum) : it.quantity,
        };
      }),
    }));
  }

  function handleItemSizeQuantityChange(itemId: string, size: number, val: string) {
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== itemId) return it;
        const updatedBreakdown = { ...it.sizeBreakdown, [size]: val };
        const config = GENDER_CATEGORIES.find((c) => c.id === it.genderCategory) || GENDER_CATEGORIES[0];
        const sum = config.sizes.reduce((acc, sNum) => {
          const num = Number(updatedBreakdown[sNum]);
          return acc + (isNaN(num) || num < 0 ? 0 : num);
        }, 0);
        return {
          ...it,
          sizeBreakdown: updatedBreakdown,
          quantity: sum > 0 ? String(sum) : '',
        };
      }),
    }));
  }

  function handleItemDirectQuantityChange(itemId: string, val: string) {
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, quantity: val } : it)),
    }));
  }

  function handleClearItemSizes(itemId: string) {
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === itemId ? { ...it, sizeBreakdown: {}, quantity: '' } : it)),
    }));
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

  function toggleItemDepartment(itemId: string, deptName: string) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id !== itemId) return it;
        const current = it.requiredDepartments || [];
        const updated = current.includes(deptName)
          ? current.filter((d) => d !== deptName)
          : [...current, deptName];
        return { ...it, requiredDepartments: updated };
      }),
    }));
  }

  function resetForm() {
    setForm({
      orderNumber: '',
      buyerId: '',
      unit: getProductionUnit(),
      deliveryDate: '',
      priority: 'Medium',
      notes: '',
      requiredDepartments: [],
      items: [createEmptyItem()],
    });
    setEditingOrderId(null);
  }

  function loadOrderIntoForm(order: BuyerOrder) {
    let loadedItems: typeof form.items = [];

    if (order.items && order.items.length > 0) {
      loadedItems = order.items.map((item, idx) => {
        const sizeMap: Record<number, string> = {};
        if (item.sizeBreakdown) {
          Object.entries(item.sizeBreakdown).forEach(([size, qty]) => {
            sizeMap[Number(size)] = String(qty);
          });
        }
        return {
          id: item.id || `item_${idx}_${Date.now()}`,
          articleId: item.articleId || '',
          articleText: item.articleName,
          color: item.color,
          genderCategory: item.genderCategory || 'mens',
          sizeBreakdown: sizeMap,
          quantity: String(item.quantity),
          image: item.image,
          requiredDepartments: item.requiredDepartments || order.requiredDepartments || [],
        };
      });
    } else {
      // Legacy single-item order
      const sizeMap: Record<number, string> = {};
      if (order.sizeBreakdown) {
        Object.entries(order.sizeBreakdown).forEach(([size, qty]) => {
          sizeMap[Number(size)] = String(qty);
        });
      }
      loadedItems = [
        {
          id: `item_${Date.now()}`,
          articleId: order.articleId || '',
          articleText: order.articleName || '',
          color: order.color || '',
          genderCategory: (order.genderCategory as any) || 'mens',
          sizeBreakdown: sizeMap,
          quantity: String(order.quantity),
          image: order.image,
          requiredDepartments: order.requiredDepartments || [],
        },
      ];
    }

    setForm({
      orderNumber: order.orderNumber || '',
      buyerId: order.buyerId,
      unit: order.unit || getProductionUnit(),
      deliveryDate: order.deliveryDate ?? '',
      priority: order.priority ?? 'Medium',
      notes: order.notes ?? '',
      requiredDepartments: order.requiredDepartments ?? [],
      items: loadedItems.length > 0 ? loadedItems : [createEmptyItem()],
    });
    setEditingOrderId(order.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.buyerId) {
      showAlert({
        title: 'Missing Buyer',
        message: 'Please choose a buyer to proceed.',
        type: 'warning',
      });
      return;
    }

    if (form.items.length === 0) {
      showAlert({
        title: 'Missing Items',
        message: 'Please add at least one article item to the order.',
        type: 'warning',
      });
      return;
    }

    // Validate each item
    for (let i = 0; i < form.items.length; i++) {
      const item = form.items[i];
      if (!item.articleText.trim()) {
        showAlert({
          title: `Missing Article in Item #${i + 1}`,
          message: `Please specify an article name or number for Item #${i + 1}.`,
          type: 'warning',
        });
        return;
      }
      if (!item.color.trim()) {
        showAlert({
          title: `Missing Color in Item #${i + 1}`,
          message: `Please specify a color for Item #${i + 1}.`,
          type: 'warning',
        });
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        showAlert({
          title: `Invalid Quantity in Item #${i + 1}`,
          message: `Please enter size quantities or total quantity greater than 0 for Item #${i + 1}.`,
          type: 'warning',
        });
        return;
      }
    }

    const buyer = buyers.find((b) => b.id === form.buyerId) as Buyer | undefined;

    const processedItems = form.items.map((item) => {
      const matched = articles.find(
        (a) =>
          a.name.toLowerCase() === item.articleText.trim().toLowerCase() ||
          a.code?.toLowerCase() === item.articleText.trim().toLowerCase() ||
          `${a.code} - ${a.name}`.toLowerCase() === item.articleText.trim().toLowerCase()
      );
      const config = GENDER_CATEGORIES.find((c) => c.id === item.genderCategory) || GENDER_CATEGORIES[0];
      const numericSizeBreakdown: Record<string, number> = {};
      config.sizes.forEach((size) => {
        const val = Number(item.sizeBreakdown[size]);
        if (!isNaN(val) && val > 0) {
          numericSizeBreakdown[String(size)] = val;
        }
      });

      return {
        id: item.id,
        articleId: matched?.id || '',
        articleName: matched?.name || item.articleText.trim(),
        color: item.color.trim(),
        genderCategory: item.genderCategory,
        sizeBreakdown: Object.keys(numericSizeBreakdown).length > 0 ? numericSizeBreakdown : undefined,
        quantity: Number(item.quantity),
        image: item.image,
        requiredDepartments: item.requiredDepartments && item.requiredDepartments.length > 0 ? item.requiredDepartments : undefined,
      };
    });

    const primaryItem = processedItems[0];
    const finalOrderNumber = form.orderNumber.trim() || (editingOrderId ? undefined : `BO-${Date.now().toString().slice(-6)}`);
    
    const orderPayload = {
      ...(finalOrderNumber ? { orderNumber: finalOrderNumber } : {}),
      buyerId: form.buyerId,
      buyerName: buyer?.name,
      items: processedItems,
      // Main level summary fields for backward compatibility:
      articleId: primaryItem.articleId,
      articleName: processedItems.map((i) => i.articleName).join(', '),
      color: processedItems.map((i) => i.color).join(', '),
      genderCategory: processedItems.length === 1 ? primaryItem.genderCategory : undefined,
      sizeBreakdown: processedItems.length === 1 ? primaryItem.sizeBreakdown : undefined,
      quantity: totalOrderQuantity,
      image: primaryItem.image,
      unit: form.unit,
      deliveryDate: form.deliveryDate || undefined,
      priority: form.priority,
      notes: form.notes || undefined,
      requiredDepartments: form.requiredDepartments && form.requiredDepartments.length > 0 ? form.requiredDepartments : undefined,
    };

    if (editingOrderId) {
      try {
        const updated = await apiService.updateBuyerOrder(editingOrderId, orderPayload);
        if (updated) {
          setBuyerOrders((s) => s.map((o) => (o.id === updated.id ? updated : o)));
          toast.success('Order updated successfully!');
        }
      } catch (error) {
        console.error('Failed to update order', error);
        showAlert({
          title: 'Update Failed',
          message: 'Unable to save order changes. Please try again.',
          type: 'error',
        });
      }
      resetForm();
      return;
    }

    try {
      const generatedNumber = form.orderNumber.trim() || `BO-${Date.now().toString().slice(-6)}`;
      const created = await apiService.createBuyerOrder({
        orderNumber: generatedNumber,
        ...orderPayload,
      });
      setBuyerOrders((s) => [created, ...s.filter((o) => o.id !== created.id && o.orderNumber !== created.orderNumber)]);
      toast.success(`Order ${created.orderNumber} created with ${processedItems.length} item(s)!`);
      resetForm();
    } catch (error) {
      console.error('Failed to create order', error);
      showAlert({
        title: 'Creation Failed',
        message: 'Unable to create order. Please check your data and try again.',
        type: 'error',
      });
    }
  }

  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  function toggleExpandOrder(orderId: string) {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  // Deduplicate orders by id and orderNumber
  const uniqueBuyerOrders = useMemo(() => {
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

  const filtered = useMemo(() => {
    return uniqueBuyerOrders
      .filter((o) => (filterBuyer ? o.buyerId === filterBuyer : true))
      .filter((o) => {
        if (!filterArticle) return true;
        if (o.articleId === filterArticle) return true;
        if (o.items && o.items.some((it) => it.articleId === filterArticle)) return true;
        return false;
      });
  }, [uniqueBuyerOrders, filterBuyer, filterArticle]);

  function toggleOrderSelection(orderId: string) {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  }

  function handleSelectAll() {
    if (selectedOrders.size === filtered.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filtered.map((o) => o.id)));
    }
  }

  async function handleDeleteSelected() {
    if (selectedOrders.size === 0) {
      showAlert({
        title: 'No Orders Selected',
        message: 'Please select at least one order to delete.',
        type: 'warning',
      });
      return;
    }
    const confirmed = await showConfirm({
      title: 'Delete Orders',
      message: `Are you sure you want to delete ${selectedOrders.size} selected order(s)? This action cannot be undone.`,
      type: 'danger',
      confirmText: `Delete ${selectedOrders.size} Order(s)`,
    });
    if (!confirmed) {
      return;
    }
    try {
      await Promise.all(Array.from(selectedOrders).map((orderId) => apiService.deleteBuyerOrder(orderId)));
      setBuyerOrders((s) => s.filter((o) => !selectedOrders.has(o.id)));
      setSelectedOrders(new Set());
      toast.success(`Deleted ${selectedOrders.size} order(s) successfully.`);
    } catch (error) {
      console.error('Failed to delete selected orders', error);
      showAlert({
        title: 'Delete Failed',
        message: 'Unable to delete selected orders. Please try again.',
        type: 'error',
      });
    }
  }

  async function handleDeleteSingleOrder(order: BuyerOrder) {
    const confirmed = await showConfirm({
      title: 'Delete Order',
      message: `Are you sure you want to delete order "${order.orderNumber}"? This action cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete Order',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteBuyerOrder(order.id);
      setBuyerOrders((prev) => prev.filter((o) => o.id !== order.id));
      setSelectedOrders((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      toast.success(`Order ${order.orderNumber} deleted successfully.`);
    } catch (error) {
      console.error('Failed to delete order', error);
      showAlert({
        title: 'Delete Failed',
        message: 'Unable to delete order. Please try again.',
        type: 'error',
      });
    }
  }

  // Calculate buyer-wise summary
  const buyerSummary = useMemo(() => {
    const summary: { [buyerId: string]: { buyerName?: string; totalOrders: number; totalQuantity: number; orderDetails: BuyerOrder[] } } = {};
    
    filtered.forEach((order) => {
      if (!summary[order.buyerId]) {
        summary[order.buyerId] = {
          buyerName: order.buyerName,
          totalOrders: 0,
          totalQuantity: 0,
          orderDetails: [],
        };
      }
      summary[order.buyerId].totalOrders += 1;
      summary[order.buyerId].totalQuantity += order.quantity;
      summary[order.buyerId].orderDetails.push(order);
    });
    
    let results = Object.entries(summary).map(([buyerId, data]) => ({ buyerId, ...data }));
    
    // Filter by search query
    if (buyerSearchQuery.trim()) {
      const query = buyerSearchQuery.toLowerCase();
      results = results.filter((item) => item.buyerName?.toLowerCase().includes(query));
    }
    
    return results;
  }, [filtered, buyerSearchQuery]);

  return (
    <div className="w-full text-[var(--ec-foreground)] space-y-6">
      <div className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-card)] p-4 sm:p-6 lg:p-7 shadow-sm">
        {/* Page Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">Orders Management</p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">Receive Buyer Orders</h1>
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <select
              value={filterBuyer}
              onChange={(e) => setFilterBuyer(e.target.value)}
              className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs sm:text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
            >
              <option value="">All buyers</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.company ?? ''})</option>
              ))}
            </select>
            <select
              value={filterArticle}
              onChange={(e) => setFilterArticle(e.target.value)}
              className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2 text-xs sm:text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
            >
              <option value="">All articles</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Order Form */}
        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          {/* Order Level Info (Order Number, Buyer, Unit, Delivery Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/50">
            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                Order Number <span className="text-[10px] text-cyan-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={form.orderNumber}
                onChange={(e) => handleFormChange('orderNumber', e.target.value)}
                placeholder="e.g. BO-468761 / PO-101"
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] placeholder-[var(--ec-muted)] font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                Buyer <span className="text-red-400">*</span>
              </label>
              <select
                value={form.buyerId}
                onChange={(e) => handleFormChange('buyerId', e.target.value)}
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select buyer...</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.company ?? ''})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Unit</label>
              <select
                value={form.unit}
                onChange={(e) => handleFormChange('unit', e.target.value)}
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 font-semibold"
              >
                {Array.from(new Set([form.unit, ...DEFAULT_PRODUCTION_UNITS])).filter(Boolean).map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Delivery Date</label>
              <input
                type="date"
                value={form.deliveryDate}
                onChange={(e) => handleFormChange('deliveryDate', e.target.value)}
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Multiple Order Items (Articles, Colors & Sizes) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[var(--ec-foreground)] flex items-center gap-2">
                  <span>Order Items (Articles & Colors)</span>
                  <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded-full font-bold">
                    {form.items.length} {form.items.length === 1 ? 'item' : 'items'}
                  </span>
                </h3>
                <p className="text-xs text-[var(--ec-muted)] mt-0.5">
                  Add multiple articles and color variants in this single order.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 px-3.5 py-2 text-xs font-bold transition shadow-sm"
              >
                <span className="text-sm font-extrabold">+</span> Add Article & Color
              </button>
            </div>

            {/* List of Article / Color Items */}
            <div className="space-y-4">
              {form.items.map((item, index) => {
                const itemCategoryConfig = GENDER_CATEGORIES.find((c) => c.id === item.genderCategory) || GENDER_CATEGORIES[0];
                const colorSuggestions = Array.from(new Set(articles.flatMap((a) => a.colors))).slice(0, 8);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[var(--ec-border)] bg-[var(--ec-surface)]/60 p-4 sm:p-5 shadow-sm space-y-4 relative"
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--ec-border)]/60">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm text-[var(--ec-foreground)]">
                          {item.articleText ? item.articleText : `Item #${index + 1}`}
                          {item.color ? ` • ${item.color}` : ''}
                        </span>
                        {Number(item.quantity) > 0 && (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md ml-1">
                            {item.quantity} {form.unit}
                          </span>
                        )}
                      </div>

                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold px-2.5 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition flex items-center gap-1"
                        >
                          <span>✕</span> Remove
                        </button>
                      )}
                    </div>

                    {/* Article & Color Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                          Article / Article Number <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.articleText}
                          onChange={(e) => handleItemArticleChange(item.id, e.target.value)}
                          placeholder="Type article name or number"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                        />
                        <p className="mt-1 text-[11px] text-[var(--ec-muted)]">Suggestions match factory catalog.</p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">
                          Color <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => handleItemColorChange(item.id, e.target.value)}
                          placeholder="Type color"
                          className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                        />
                        {colorSuggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {colorSuggestions.map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => handleItemColorChange(item.id, col)}
                                className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2 py-0.5 text-[11px] hover:border-cyan-500 hover:text-cyan-400 transition"
                              >
                                {col}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Item Photo / Sample Image Attachment */}
                    <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)]/50 p-3 sm:p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                          <span>📷</span> Item Picture / Sample Photo
                          <span className="text-[11px] font-normal text-[var(--ec-muted)]">(Optional)</span>
                        </label>
                        {item.image && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemImage(item.id)}
                            className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/10 transition"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      {item.image ? (
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setPreviewImage({ src: item.image!, title: `${item.articleText || `Item #${index + 1}`} • ${item.color || 'Sample'}` })}
                            className="relative group rounded-xl overflow-hidden border border-cyan-500/40 w-16 h-16 sm:w-20 sm:h-20 bg-black/20 flex-shrink-0 cursor-pointer shadow-sm"
                          >
                            <img
                              src={item.image}
                              alt="Item Preview"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px] font-bold">
                              🔍 View
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs font-semibold text-[var(--ec-foreground)] truncate">
                              {item.articleText ? item.articleText : `Item #${index + 1}`} photo attached
                            </p>
                            <label className="inline-block cursor-pointer text-xs font-semibold text-cyan-400 hover:underline">
                              <span>Change Picture</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleItemImageUpload(item.id, e)}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2.5 p-3 rounded-xl border border-dashed border-[var(--ec-border)] hover:border-cyan-500 bg-[var(--ec-surface)]/50 hover:bg-cyan-500/5 cursor-pointer transition text-center">
                          <span className="text-base">📷</span>
                          <div>
                            <span className="text-xs font-bold text-cyan-400 hover:underline">Click to upload picture for this item</span>
                            <span className="block text-[10px] text-[var(--ec-muted)]">JPG, PNG, WebP (Max 5MB)</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleItemImageUpload(item.id, e)}
                          />
                        </label>
                      )}
                    </div>

                    {/* Category & Size-wise Quantity Entry */}
                    <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)]/70 p-3 sm:p-4 space-y-3">
                      {/* Category Switcher */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--ec-foreground)]">
                            Select Category & Size Breakdown
                          </span>
                          {Object.values(item.sizeBreakdown).some((v) => Number(v) > 0) && (
                            <button
                              type="button"
                              onClick={() => handleClearItemSizes(item.id)}
                              className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/10 transition"
                            >
                              Clear Sizes
                            </button>
                          )}
                        </div>

                        {/* 3 Symmetrical Category Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--ec-surface)] border border-[var(--ec-border)]">
                          {GENDER_CATEGORIES.map((cat) => {
                            const isActive = item.genderCategory === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleItemGenderCategoryChange(item.id, cat.id)}
                                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all text-center ${
                                  isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/40'
                                    : 'text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:bg-[var(--ec-card)]'
                                }`}
                              >
                                <span className="text-xs sm:text-sm font-bold truncate max-w-full">{cat.label}</span>
                                <span className={`text-[10px] sm:text-[11px] mt-0.5 font-medium ${isActive ? 'text-cyan-100' : 'text-[var(--ec-muted)]'}`}>
                                  {cat.rangeText}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Size Matrix Grid */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs text-[var(--ec-muted)]">
                          <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
                            {itemCategoryConfig.label} Sizes ({itemCategoryConfig.rangeText})
                          </span>
                          <span className="text-[11px]">
                            {itemCategoryConfig.sizes.length} sizes
                          </span>
                        </div>

                        {/* Responsive Touch-Friendly Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
                          {itemCategoryConfig.sizes.map((size) => {
                            const val = item.sizeBreakdown[size] ?? '';
                            const hasValue = Number(val) > 0;
                            return (
                              <div
                                key={size}
                                className={`relative rounded-xl border p-2 transition flex flex-col items-center justify-between ${
                                  hasValue
                                    ? 'border-cyan-500 bg-cyan-500/15 ring-1 ring-cyan-500/40 shadow-sm'
                                    : 'border-[var(--ec-border)] bg-[var(--ec-surface)] hover:border-cyan-500/40 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/30'
                                }`}
                              >
                                <div className="w-full flex items-center justify-center mb-1.5">
                                  <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                                    hasValue 
                                      ? 'bg-cyan-500 text-black font-bold' 
                                      : 'bg-[var(--ec-card)] text-[var(--ec-foreground)] border border-[var(--ec-border)]'
                                  }`}>
                                    {size}#
                                  </span>
                                </div>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  placeholder="0"
                                  value={val}
                                  onChange={(e) => handleItemSizeQuantityChange(item.id, size, e.target.value)}
                                  className="w-full text-center rounded border border-[var(--ec-border)] bg-[var(--ec-card)] py-1 text-xs sm:text-sm font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Item Subtotal Quantity */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ec-border)]/50">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-[var(--ec-muted)] font-semibold">
                              Item Quantity:
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => handleItemDirectQuantityChange(item.id, e.target.value)}
                              placeholder="0"
                              className="w-24 rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] px-2 py-1 text-xs font-bold text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-xs text-[var(--ec-muted)]">{form.unit}</span>
                          </div>

                          <div className="text-xs font-semibold text-cyan-400">
                            Subtotal: <strong className="text-sm font-bold">{item.quantity || 0} {form.unit}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Optional Collapsible Per-Item Required Departments Dropdown */}
                      {(() => {
                        const isOpen = openDeptItemIds.has(item.id);
                        const selectedCount = (item.requiredDepartments || []).length;
                        return (
                          <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-card)]/40 overflow-hidden transition">
                            <button
                              type="button"
                              onClick={() => toggleOpenDeptItem(item.id)}
                              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-[var(--ec-card)]/70 transition"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[var(--ec-foreground)] flex items-center gap-1.5">
                                  <span>🏭</span> Specific Departments for this Item
                                </span>
                                <span className="text-[10px] text-[var(--ec-muted)] bg-[var(--ec-surface)] border border-[var(--ec-border)] px-1.5 py-0.5 rounded">
                                  Optional
                                </span>
                                {selectedCount > 0 && (
                                  <span className="text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded-full">
                                    {selectedCount} selected
                                  </span>
                                )}
                              </div>

                              <span className="text-xs text-cyan-400 font-semibold flex items-center gap-1 flex-shrink-0">
                                {isOpen ? 'Close ▲' : 'Set Departments ▼'}
                              </span>
                            </button>

                            {isOpen && (
                              <div className="p-3 sm:p-3.5 border-t border-[var(--ec-border)] bg-[var(--ec-surface)]/50 space-y-2.5 animate-fadeIn">
                                <p className="text-[11px] text-[var(--ec-muted)]">
                                  Select the specific production departments required for this article variant:
                                </p>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                  {departments.map((dept) => {
                                    const isChecked = (item.requiredDepartments || []).includes(dept);
                                    return (
                                      <button
                                        key={dept}
                                        type="button"
                                        onClick={() => toggleItemDepartment(item.id, dept)}
                                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition ${
                                          isChecked
                                            ? 'border-cyan-500 bg-cyan-500/15 text-cyan-400 font-bold shadow-xs'
                                            : 'border-[var(--ec-border)] bg-[var(--ec-card)] text-[var(--ec-muted)] hover:text-[var(--ec-foreground)] hover:border-cyan-500/30'
                                        }`}
                                      >
                                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                                          isChecked ? 'bg-cyan-500 border-cyan-500 text-black font-bold' : 'border-[var(--ec-border)]'
                                        }`}>
                                          {isChecked ? '✓' : ''}
                                        </div>
                                        <span className="truncate">{dept}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Item Action Button */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-[var(--ec-border)] hover:border-cyan-500 bg-[var(--ec-surface)]/40 hover:bg-cyan-500/5 text-cyan-400 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
            >
              <span className="text-base font-extrabold">+</span> Add Another Article & Color to this Order
            </button>

            {/* Grand Total Summary Card */}
            <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Order Summary</p>
                <p className="text-xs text-[var(--ec-muted)] mt-0.5">
                  Total {form.items.length} article variant(s) configured
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-[var(--ec-muted)]">Grand Total Quantity</p>
                  <p className="text-xl sm:text-2xl font-black text-cyan-400">
                    {totalOrderQuantity} <span className="text-sm font-normal text-[var(--ec-foreground)]">{form.unit}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Required Departments & Priority & Notes */}
          <div className="space-y-4 pt-2 border-t border-[var(--ec-border)]">
            <div>
              <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-2">Required Departments</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {departments.map((dept) => {
                  const isChecked = form.requiredDepartments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition ${
                        isChecked
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                          : 'border-[var(--ec-border)] bg-[var(--ec-surface)] text-[var(--ec-foreground)] hover:border-cyan-500/30'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                        isChecked ? 'bg-cyan-500 border-cyan-500 text-black font-bold' : 'border-[var(--ec-border)]'
                      }`}>
                        {isChecked ? '✓' : ''}
                      </div>
                      <span className="truncate">{dept}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value as any)}
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ec-muted)] mb-1.5">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Optional notes or buyer instructions"
                  className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3 py-2.5 text-sm text-[var(--ec-foreground)] focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-[var(--ec-border)]">
            {editingOrderId ? (
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto rounded-xl border border-[var(--ec-border)] px-4 py-2.5 text-sm font-medium text-[var(--ec-foreground)] hover:bg-[var(--ec-surface)] transition"
              >
                Cancel Edit
              </button>
            ) : null}
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-90 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition"
            >
              {editingOrderId ? 'Save Order Changes' : `Receive Order (${totalOrderQuantity} ${form.unit})`}
            </button>
          </div>
        </form>

        {/* Buyer Wise Summary Section */}
        <section className="mb-8 pt-4 border-t border-[var(--ec-border)]">
          <div className="mb-4">
            <h2 className="text-base sm:text-lg font-bold mb-2">Search Buyer Summary</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search buyer by name..."
                value={buyerSearchQuery}
                onChange={(e) => setBuyerSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] px-3.5 py-2.5 text-sm"
              />
              {buyerSearchQuery && buyerSummary.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-[var(--ec-border)] rounded-xl bg-[var(--ec-card)] shadow-xl z-10 max-h-56 overflow-y-auto">
                  {buyerSummary.map((summary) => (
                    <button
                      key={summary.buyerId}
                      onClick={() => setBuyerSearchQuery(summary.buyerName || '')}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--ec-surface)] border-b border-[var(--ec-border)] last:border-b-0 text-sm transition"
                    >
                      <p className="font-semibold text-xs sm:text-sm">{summary.buyerName}</p>
                      <p className="text-[11px] text-[var(--ec-muted)]">{summary.totalOrders} orders • {summary.totalQuantity} qty</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {buyerSearchQuery && buyerSummary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {buyerSummary.map((summary) => (
                <div key={summary.buyerId} className="border border-[var(--ec-border)] rounded-xl p-4 bg-[var(--ec-surface)]">
                  <div className="mb-3">
                    <p className="text-xs text-[var(--ec-muted)]">Buyer</p>
                    <p className="font-bold text-sm sm:text-base">{summary.buyerName || 'Unknown'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-lg bg-[var(--ec-card)] p-2.5 border border-[var(--ec-border)]">
                      <p className="text-[11px] text-[var(--ec-muted)]">Total Orders</p>
                      <p className="text-lg font-extrabold text-cyan-400">{summary.totalOrders}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--ec-card)] p-2.5 border border-[var(--ec-border)]">
                      <p className="text-[11px] text-[var(--ec-muted)]">Total Qty</p>
                      <p className="text-lg font-extrabold text-emerald-400">{summary.totalQuantity}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => router.push(`/buyers/${summary.buyerId}`)}
                      className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-600 py-2 text-white text-xs font-semibold transition"
                    >
                      View Orders
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Received Orders List */}
        <section className="pt-4 border-t border-[var(--ec-border)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold">Received Orders ({filtered.length})</h2>
            <div className="flex items-center gap-2">
              {isSelectionMode ? (
                <>
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedOrders(new Set());
                    }}
                    className="rounded-lg border border-[var(--ec-border)] px-3 py-1.5 text-xs text-[var(--ec-muted)] hover:bg-[var(--ec-surface)]"
                  >
                    Cancel
                  </button>
                  {selectedOrders.size > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="rounded-lg bg-red-500 hover:bg-red-600 px-3 py-1.5 text-white text-xs font-semibold"
                    >
                      Delete ({selectedOrders.size})
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setIsSelectionMode(true)}
                  className="rounded-lg border border-[var(--ec-border)] bg-[var(--ec-surface)] hover:bg-[var(--ec-card)] px-3 py-1.5 text-xs font-semibold text-[var(--ec-foreground)] transition"
                >
                  Select
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && <div className="text-sm text-[var(--ec-muted)] py-4 text-center">No received orders found.</div>}
            
            {isSelectionMode && filtered.length > 0 && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 border border-[var(--ec-border)] rounded-xl bg-[var(--ec-surface)]">
                <input
                  type="checkbox"
                  checked={selectedOrders.size === filtered.length && filtered.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
                <label className="text-xs text-[var(--ec-muted)] font-medium">
                  {selectedOrders.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all orders'}
                </label>
              </div>
            )}

            {filtered.map((o) => {
              const { isComplete, completionPercent, completedDepts, pendingDepts } = getOrderCompletionStatus(o);
              const hasMultipleItems = o.items && o.items.length > 0;
              const isExpanded = expandedOrderIds.has(o.id);
              const totalItemsCount = hasMultipleItems ? o.items!.length : 1;

              return (
                <div
                  key={o.id}
                  className={`border rounded-2xl transition shadow-sm overflow-hidden ${
                    isExpanded
                      ? 'border-cyan-500/50 bg-[var(--ec-surface)] ring-1 ring-cyan-500/20'
                      : 'border-[var(--ec-border)] bg-[var(--ec-surface)] hover:border-cyan-500/30'
                  }`}
                >
                  {/* Compact Header Summary (Clickable to Toggle Details) */}
                  <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(o.id)}
                          onChange={() => toggleOrderSelection(o.id)}
                          className="w-4 h-4 cursor-pointer flex-shrink-0"
                        />
                      )}
                      
                      {/* Clickable order info banner */}
                      <div
                        onClick={() => toggleExpandOrder(o.id)}
                        className="cursor-pointer flex items-center gap-2.5 sm:gap-4 flex-wrap flex-1 min-w-0"
                      >
                        <span className="text-xs sm:text-sm font-black text-cyan-400 font-mono tracking-tight bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1 rounded-lg">
                          {o.orderNumber}
                        </span>

                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--ec-foreground)] truncate">
                          <span className="text-[var(--ec-muted)] font-normal text-xs">Buyer:</span>
                          <span className="truncate">{o.buyerName || 'Unknown'}</span>
                        </div>

                        <span className="text-[11px] bg-cyan-500/15 text-cyan-400 font-bold px-2 py-0.5 rounded-full border border-cyan-500/25">
                          {totalItemsCount} {totalItemsCount === 1 ? 'Item' : 'Items'}
                        </span>

                        <div className="text-xs sm:text-sm font-extrabold text-[var(--ec-foreground)]">
                          <span className="text-cyan-400 font-black">{o.quantity}</span> {o.unit}
                        </div>

                        {o.deliveryDate && (
                          <span className="hidden md:inline-block text-[11px] text-[var(--ec-muted)]">
                            Delivery: <strong>{new Date(o.deliveryDate).toLocaleDateString()}</strong>
                          </span>
                        )}

                        <span className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          o.priority === 'High' ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-slate-500/15 text-[var(--ec-muted)]'
                        }`}>
                          {o.priority}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpandOrder(o.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 ${
                          isExpanded
                            ? 'bg-cyan-500 text-black shadow-sm'
                            : 'border border-[var(--ec-border)] text-[var(--ec-foreground)] hover:bg-[var(--ec-card)]'
                        }`}
                      >
                        <span>{isExpanded ? 'Hide ▲' : 'Details ▼'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => loadOrderIntoForm(o)}
                        className="rounded-lg border border-[var(--ec-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ec-foreground)] hover:bg-[var(--ec-card)] hover:border-cyan-500/50 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleOrder(o)}
                        className="rounded-lg border border-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expanded Full Details Breakdown */}
                  {isExpanded && (
                    <div className="p-4 border-t border-[var(--ec-border)]/60 bg-[var(--ec-card)]/40 space-y-3.5 animate-fadeIn">
                      <p className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                        <span>📋</span> Order Items & Size Breakdown Details
                      </p>

                      {/* Display Multi-Item List */}
                      {hasMultipleItems ? (
                        <div className="space-y-2.5">
                          {o.items!.map((it, idx) => (
                            <div key={it.id || idx} className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 text-xs shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {it.image && (
                                    <div
                                      onClick={() => setPreviewImage({ src: it.image!, title: `${it.articleName} • ${it.color}` })}
                                      className="relative group w-12 h-12 rounded-xl border border-cyan-500/30 overflow-hidden flex-shrink-0 cursor-pointer shadow-sm bg-black/20 hover:scale-105 transition"
                                      title="Click to view full image"
                                    >
                                      <img src={it.image} alt={it.articleName} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                                        🔍
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-sm text-[var(--ec-foreground)]">
                                        {it.articleName}
                                      </span>
                                      <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                                        Color: {it.color}
                                      </span>
                                      {it.genderCategory && (
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                                          {it.genderCategory === 'womens' ? "Women's (35#-41#)" : it.genderCategory === 'both' ? "Men & Women (35#-46#)" : "Men's (40#-46#)"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="text-[11px] text-[var(--ec-muted)] block">Item Total</span>
                                  <span className="font-black text-sm text-cyan-400">
                                    {it.quantity} {o.unit}
                                  </span>
                                </div>
                              </div>

                              {/* Size Breakdown Matrix */}
                              {it.sizeBreakdown && Object.keys(it.sizeBreakdown).length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-[var(--ec-border)]/60">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)] mb-1.5">Size-wise Quantity:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(it.sizeBreakdown)
                                      .sort(([a], [b]) => Number(a) - Number(b))
                                      .map(([size, qty]) => (
                                        <span
                                          key={size}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ec-card)] border border-[var(--ec-border)] px-2 py-1 text-[11px] shadow-xs"
                                        >
                                          <span className="text-[var(--ec-muted)] font-bold">{size}#:</span>
                                          <strong className="text-cyan-400 font-extrabold">{qty}</strong>
                                        </span>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Item Required Departments */}
                              {it.requiredDepartments && it.requiredDepartments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-[var(--ec-border)]/50 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] text-[var(--ec-muted)] font-bold uppercase tracking-wider">Depts:</span>
                                  {it.requiredDepartments.map((d) => (
                                    <span key={d} className="text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 px-2 py-0.5 rounded-md">
                                      {d}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Legacy Single-Item Breakdown */
                        <div className="rounded-xl border border-[var(--ec-border)] bg-[var(--ec-surface)] p-3 text-xs">
                          <div className="flex items-center gap-3 flex-wrap">
                            {o.image && (
                              <div
                                onClick={() => setPreviewImage({ src: o.image!, title: `${o.articleName} • ${o.color}` })}
                                className="w-12 h-12 rounded-xl border border-cyan-500/30 overflow-hidden flex-shrink-0 cursor-pointer shadow-sm bg-black/20 hover:scale-105 transition"
                                title="Click to view full image"
                              >
                                <img src={o.image} alt={o.articleName} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div>
                              <span className="font-extrabold text-sm text-[var(--ec-foreground)]">{o.articleName} &bull; {o.color}</span>
                              {o.genderCategory && (
                                <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                                  {o.genderCategory === 'womens' ? "Women's (35#-41#)" : o.genderCategory === 'both' ? "Men & Women (35#-46#)" : "Men's (40#-46#)"}
                                </span>
                              )}
                            </div>
                          </div>

                          {o.sizeBreakdown && Object.keys(o.sizeBreakdown).length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-[var(--ec-border)]/60">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ec-muted)] mb-1.5">Size-wise Quantity:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(o.sizeBreakdown)
                                  .sort(([a], [b]) => Number(a) - Number(b))
                                  .map(([size, qty]) => (
                                    <span
                                      key={size}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ec-card)] border border-[var(--ec-border)] px-2 py-1 text-[11px]"
                                    >
                                      <span className="font-bold text-[var(--ec-muted)]">{size}#:</span>
                                      <span className="font-extrabold text-cyan-400">{qty}</span>
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Required Departments Progress */}
                      {o.requiredDepartments && o.requiredDepartments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--ec-border)]/60">
                          <div className="flex items-center justify-between text-xs text-[var(--ec-muted)] mb-1.5">
                            <span className="font-semibold">Departments Progress:</span>
                            <span className="font-bold text-cyan-400">{completionPercent}%</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            {completedDepts.map((dept) => (
                              <span key={dept} className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                                {dept} ✓
                              </span>
                            ))}
                            {pendingDepts.map((dept) => (
                              <span key={dept} className="bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                {dept}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {o.notes && (
                        <div className="text-xs text-[var(--ec-muted)] pt-2 border-t border-[var(--ec-border)]/60">
                          <strong>Notes:</strong> {o.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] bg-[var(--ec-card)] border border-[var(--ec-border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ec-border)] bg-[var(--ec-surface)]">
              <span className="font-bold text-sm text-[var(--ec-foreground)] truncate">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-lg bg-[var(--ec-card)] hover:bg-[var(--ec-border)] flex items-center justify-center text-xs font-bold text-[var(--ec-foreground)] transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/30 overflow-auto max-h-[75vh]">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-[var(--ec-border)]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
