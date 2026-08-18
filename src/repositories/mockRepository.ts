import {
  buyers,
  costTracking,
  departments,
  finishedGoods,
  materialReceivals,
  articles,
  buyerOrders,
  notifications,
  orders,
  productionFlows,
  reports,
  users,
  warehouseStocks,
} from '@/data/mockData';
import type {
  Buyer,
  CostTracking,
  Department,
  FinishedGoods,
  Notification,
  Order,
  ProductionFlow,
  Report,
  User,
  WarehouseStock,
  MaterialReceival,
  Article,
  BuyerOrder,
} from '@/types';

const STORAGE_KEYS = {
  buyers: 'ec-buyers',
  buyerOrders: 'ec-buyer-orders',
  productionFlows: 'ec-production-flows',
  finishedGoods: 'ec-finished-goods',
  warehouseStocks: 'ec-warehouse-stocks',
  materialReceivals: 'ec-material-receivals',
  departments: 'ec-departments',
  articles: 'ec-articles',
  initialized: 'ec-storage-initialized-v2',
};

export class MockRepository {
  private hydrated = false;

  constructor() {
    // hydration is handled lazily on first client access
  }

  public ensureHydrated() {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    this.hydrateFromStorage();
  }

  private hydrateFromStorage() {
    if (typeof window === 'undefined') return;

    const hydrateList = <T>(key: string, targetList: T[]) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            targetList.length = 0;
            targetList.push(...parsed);
            return;
          }
        }
        // First run: save default list to localStorage
        window.localStorage.setItem(key, JSON.stringify(targetList));
      } catch (e) {
        console.warn(`Failed to hydrate ${key} from storage:`, e);
      }
    };

    hydrateList(STORAGE_KEYS.buyers, buyers);
    hydrateList(STORAGE_KEYS.buyerOrders, buyerOrders);
    hydrateList(STORAGE_KEYS.productionFlows, productionFlows);
    hydrateList(STORAGE_KEYS.finishedGoods, finishedGoods);
    hydrateList(STORAGE_KEYS.warehouseStocks, warehouseStocks);
    hydrateList(STORAGE_KEYS.materialReceivals, materialReceivals);
    hydrateList(STORAGE_KEYS.departments, departments);
    hydrateList(STORAGE_KEYS.articles, articles);

    // Normalize departments: Split "Lasting & DIP" into separate "Lasting" and "DIP"
    const lastingDipIdx = departments.findIndex((d) => d.name === 'Lasting & DIP');
    if (lastingDipIdx !== -1) {
      const oldDept = departments[lastingDipIdx];
      departments.splice(
        lastingDipIdx,
        1,
        { ...oldDept, id: 'd11', name: 'Lasting' },
        { ...oldDept, id: 'd14', name: 'DIP' }
      );
      this.persistDepartments();
    } else {
      if (!departments.some((d) => d.name === 'Lasting')) {
        departments.push({ id: 'd11', name: 'Lasting', efficiency: 85, capacity: 180, manpower: 14, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 5, completedToday: 60 });
      }
      if (!departments.some((d) => d.name === 'DIP')) {
        departments.push({ id: 'd14', name: 'DIP', efficiency: 83, capacity: 170, manpower: 12, workingHours: 8, productionCapability: 16000, productionCapabilityPerHour: 2000, activeOrders: 4, completedToday: 55 });
      }
    }
  }

  private persist(key: string, data: any) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`Failed to persist ${key} to storage:`, e);
    }
  }

  private persistBuyers() { this.persist(STORAGE_KEYS.buyers, buyers); }
  private persistBuyerOrders() { this.persist(STORAGE_KEYS.buyerOrders, buyerOrders); }
  private persistProductionFlows() { this.persist(STORAGE_KEYS.productionFlows, productionFlows); }
  private persistFinishedGoods() { this.persist(STORAGE_KEYS.finishedGoods, finishedGoods); }
  private persistWarehouseStocks() { this.persist(STORAGE_KEYS.warehouseStocks, warehouseStocks); }
  private persistMaterialReceivals() { this.persist(STORAGE_KEYS.materialReceivals, materialReceivals); }
  private persistDepartments() { this.persist(STORAGE_KEYS.departments, departments); }
  private persistArticles() { this.persist(STORAGE_KEYS.articles, articles); }

  getBuyers(): Buyer[] {
    this.ensureHydrated();
    return [...buyers];
  }

  setBuyers(list: Buyer[]) {
    this.ensureHydrated();
    buyers.length = 0;
    buyers.push(...list);
    this.persistBuyers();
  }

  getOrders(): Order[] {
    this.ensureHydrated();
    return [...orders];
  }

  getDepartments(): Department[] {
    this.ensureHydrated();
    return [...departments];
  }

  setDepartments(list: Department[]) {
    this.ensureHydrated();
    departments.length = 0;
    departments.push(...list);
    this.persistDepartments();
  }

  updateDepartment(departmentId: string, updates: Partial<Department>): Department | null {
    this.ensureHydrated();
    const idx = departments.findIndex((d) => d.id === departmentId);
    if (idx === -1) return null;
    departments[idx] = { ...departments[idx], ...updates };
    this.persistDepartments();
    return departments[idx];
  }

  getProductionFlows(): ProductionFlow[] {
    this.ensureHydrated();
    return [...productionFlows];
  }

  setProductionFlows(list: ProductionFlow[]) {
    this.ensureHydrated();
    productionFlows.length = 0;
    productionFlows.push(...list);
    this.persistProductionFlows();
  }

  getWarehouseStocks(): WarehouseStock[] {
    this.ensureHydrated();
    return [...warehouseStocks];
  }

  setWarehouseStocks(list: WarehouseStock[]) {
    this.ensureHydrated();
    warehouseStocks.length = 0;
    warehouseStocks.push(...list);
    this.persistWarehouseStocks();
  }

  getFinishedGoods(): FinishedGoods[] {
    this.ensureHydrated();
    return [...finishedGoods];
  }

  setFinishedGoods(list: FinishedGoods[]) {
    this.ensureHydrated();
    finishedGoods.length = 0;
    finishedGoods.push(...list);
    this.persistFinishedGoods();
  }

  getMaterialReceivals(): MaterialReceival[] {
    this.ensureHydrated();
    return [...materialReceivals];
  }

  setMaterialReceivals(list: MaterialReceival[]) {
    this.ensureHydrated();
    materialReceivals.length = 0;
    materialReceivals.push(...list);
    this.persistMaterialReceivals();
  }

  getArticles(): Article[] {
    this.ensureHydrated();
    return [...articles];
  }

  setArticles(list: Article[]) {
    this.ensureHydrated();
    articles.length = 0;
    articles.push(...list);
    this.persistArticles();
  }

  getBuyerOrders(): BuyerOrder[] {
    this.ensureHydrated();
    return [...buyerOrders];
  }

  setBuyerOrders(list: BuyerOrder[]) {
    this.ensureHydrated();
    const seen = new Set<string>();
    const deduped: BuyerOrder[] = [];
    for (const ord of list) {
      const key = ord.id || ord.orderNumber;
      if (key && !seen.has(key) && (!ord.orderNumber || !seen.has(ord.orderNumber))) {
        seen.add(key);
        if (ord.orderNumber) seen.add(ord.orderNumber);
        deduped.push(ord);
      }
    }
    buyerOrders.length = 0;
    buyerOrders.push(...deduped);
    this.persistBuyerOrders();
  }

  getCostTracking(): CostTracking[] {
    this.ensureHydrated();
    return [...costTracking];
  }

  getReports(): Report[] {
    this.ensureHydrated();
    return [...reports];
  }

  getNotifications(): Notification[] {
    this.ensureHydrated();
    return [...notifications];
  }

  getUsers(): User[] {
    this.ensureHydrated();
    return [...users];
  }

  // Mutating methods
  addProductionFlow(flow: ProductionFlow): ProductionFlow {
    this.ensureHydrated();
    try {
      const fTime = flow.updatedAt ? new Date(flow.updatedAt).getTime() : Date.now();
      const existing = productionFlows.find((f) => {
        if (f.orderId !== flow.orderId) return false;
        if (f.department !== flow.department) return false;
        if (f.completed !== flow.completed) return false;
        const existingTime = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
        return Math.abs(fTime - existingTime) < 5000;
      });
      if (existing) return existing;
    } catch (e) {}
    productionFlows.push(flow);
    this.persistProductionFlows();
    return flow;
  }

  updateProductionFlow(flowId: string, updates: Partial<ProductionFlow>): ProductionFlow | null {
    this.ensureHydrated();
    const idx = productionFlows.findIndex((f) => f.id === flowId);
    if (idx === -1) return null;
    productionFlows[idx] = { ...productionFlows[idx], ...updates };
    this.persistProductionFlows();
    return productionFlows[idx];
  }

  deleteProductionFlow(flowId: string): boolean {
    this.ensureHydrated();
    const idx = productionFlows.findIndex((f) => f.id === flowId);
    if (idx === -1) return false;
    productionFlows.splice(idx, 1);
    this.persistProductionFlows();
    return true;
  }

  addWarehouseStock(stock: WarehouseStock): WarehouseStock {
    this.ensureHydrated();
    warehouseStocks.push(stock);
    this.persistWarehouseStocks();
    return stock;
  }

  updateWarehouseStock(stockId: string, updates: Partial<WarehouseStock>): WarehouseStock | null {
    this.ensureHydrated();
    const idx = warehouseStocks.findIndex((s) => s.id === stockId);
    if (idx === -1) return null;
    warehouseStocks[idx] = { ...warehouseStocks[idx], ...updates };
    this.persistWarehouseStocks();
    return warehouseStocks[idx];
  }

  deleteWarehouseStock(stockId: string): boolean {
    this.ensureHydrated();
    const idx = warehouseStocks.findIndex((s) => s.id === stockId);
    if (idx === -1) return false;
    warehouseStocks.splice(idx, 1);
    this.persistWarehouseStocks();
    return true;
  }

  addMaterialReceival(receival: MaterialReceival): MaterialReceival {
    this.ensureHydrated();
    materialReceivals.push(receival);
    this.persistMaterialReceivals();
    return receival;
  }

  addFinishedGood(fg: FinishedGoods): FinishedGoods {
    this.ensureHydrated();
    finishedGoods.push(fg);
    this.persistFinishedGoods();
    return fg;
  }

  updateFinishedGood(fgId: string, updates: Partial<FinishedGoods>): FinishedGoods | null {
    this.ensureHydrated();
    const idx = finishedGoods.findIndex((f) => f.id === fgId);
    if (idx === -1) return null;
    finishedGoods[idx] = { ...finishedGoods[idx], ...updates };
    this.persistFinishedGoods();
    return finishedGoods[idx];
  }

  deleteFinishedGood(fgId: string): boolean {
    this.ensureHydrated();
    const idx = finishedGoods.findIndex((f) => f.id === fgId);
    if (idx === -1) return false;
    finishedGoods.splice(idx, 1);
    this.persistFinishedGoods();
    return true;
  }

  deleteFinishedGoodByOrderId(orderId: string): number {
    this.ensureHydrated();
    let removed = 0;
    for (let i = finishedGoods.length - 1; i >= 0; i--) {
      if (finishedGoods[i].orderId === orderId) {
        finishedGoods.splice(i, 1);
        removed += 1;
      }
    }
    if (removed > 0) {
      this.persistFinishedGoods();
    }
    return removed;
  }

  addBuyerOrder(order: BuyerOrder): BuyerOrder {
    this.ensureHydrated();
    const existingIdx = buyerOrders.findIndex((o) => o.id === order.id || (order.orderNumber && o.orderNumber === order.orderNumber));
    if (existingIdx !== -1) {
      buyerOrders[existingIdx] = { ...buyerOrders[existingIdx], ...order };
    } else {
      buyerOrders.unshift(order);
    }
    this.persistBuyerOrders();
    return order;
  }

  updateBuyerOrder(orderId: string, updates: Partial<BuyerOrder>): BuyerOrder | null {
    this.ensureHydrated();
    const index = buyerOrders.findIndex((order) => order.id === orderId);
    if (index === -1) return null;

    buyerOrders[index] = { ...buyerOrders[index], ...updates };
    this.persistBuyerOrders();
    return buyerOrders[index];
  }

  addBuyer(buyer: Buyer): Buyer {
    this.ensureHydrated();
    const existing = buyers.find((b) => b.id === buyer.id);
    if (existing) {
      Object.assign(existing, buyer);
    } else {
      buyers.unshift(buyer);
    }
    this.persistBuyers();
    return buyer;
  }

  updateBuyer(buyerId: string, updates: Partial<Buyer>): Buyer | null {
    this.ensureHydrated();
    const index = buyers.findIndex((b) => b.id === buyerId);
    if (index === -1) return null;
    buyers[index] = { ...buyers[index], ...updates };
    this.persistBuyers();
    return buyers[index];
  }

  deleteBuyer(buyerId: string): boolean {
    this.ensureHydrated();
    const index = buyers.findIndex((b) => b.id === buyerId);
    if (index !== -1) {
      buyers.splice(index, 1);
      this.persistBuyers();
      return true;
    }
    return false;
  }

  deleteBuyerOrder(orderId: string): boolean {
    this.ensureHydrated();
    const index = buyerOrders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      buyerOrders.splice(index, 1);
      this.persistBuyerOrders();
      return true;
    }
    return false;
  }

  clearProductionFlows(): number {
    this.ensureHydrated();
    const count = productionFlows.length;
    productionFlows.length = 0;
    this.persistProductionFlows();
    return count;
  }

  clearFinishedGoods(): number {
    this.ensureHydrated();
    const count = finishedGoods.length;
    finishedGoods.length = 0;
    this.persistFinishedGoods();
    return count;
  }
}

export const mockRepository = new MockRepository();
