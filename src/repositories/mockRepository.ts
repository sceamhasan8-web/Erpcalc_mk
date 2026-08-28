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
  OrderProductionPlan,
  DailyManpowerRecord,
  Employee,
} from '@/types';

const defaultProductionPlans: OrderProductionPlan[] = [];

const initialEmployees: Employee[] = [
  // Cutting
  { id: 'emp_1', employeeCode: 'CUT-01', name: 'Md. Rafiqul Islam', section: 'Cutting', designation: 'Manager', phone: '01711000001', status: 'Active', shift: 'Day', createdAt: '2024-01-10' },
  { id: 'emp_2', employeeCode: 'CUT-02', name: 'Al-Amin Hossain', section: 'Cutting', designation: 'Incharge', phone: '01711000002', status: 'Active', shift: 'Day', createdAt: '2024-02-15' },
  { id: 'emp_3', employeeCode: 'CUT-03', name: 'Kamal Uddin', section: 'Cutting', designation: 'Supervisor', phone: '01711000003', status: 'Active', shift: 'Day', createdAt: '2024-03-01' },
  { id: 'emp_4', employeeCode: 'CUT-04', name: 'Sumon Mia', section: 'Cutting', designation: 'Worker', phone: '01711000004', status: 'Active', shift: 'Day', createdAt: '2024-03-05' },
  { id: 'emp_5', employeeCode: 'CUT-05', name: 'Jahangir Alam', section: 'Cutting', designation: 'Worker', phone: '01711000005', status: 'Active', shift: 'Day', createdAt: '2024-03-10' },
];

const initialDailyManpower: DailyManpowerRecord[] = [
  {
    id: '2026-08-27',
    date: '2026-08-27',
    totalManagers: 6,
    totalIncharges: 8,
    totalSupervisors: 14,
    totalWorkers: 195,
    totalManpower: 223,
    notes: 'Normal full floor operations',
    updatedAt: '2026-08-27T08:30:00.000Z',
    sections: {
      'Cutting': { section: 'Cutting', managers: 1, incharges: 1, supervisors: 2, workers: 28, total: 32 },
      'Sewing': { section: 'Sewing', managers: 1, incharges: 2, supervisors: 4, workers: 65, total: 72 },
      'Lasting & DIP': { section: 'Lasting & DIP', managers: 1, incharges: 1, supervisors: 2, workers: 35, total: 39 },
      'Warehouse': { section: 'Warehouse', managers: 1, incharges: 1, supervisors: 1, workers: 12, total: 15 },
      'Goods Store': { section: 'Goods Store', managers: 0, incharges: 1, supervisors: 1, workers: 8, total: 10 },
      'Packing': { section: 'Packing', managers: 1, incharges: 1, supervisors: 2, workers: 22, total: 26 },
      'Lamination & Preparation': { section: 'Lamination & Preparation', managers: 0, incharges: 1, supervisors: 1, workers: 10, total: 12 },
      'Printing & Embossing': { section: 'Printing & Embossing', managers: 0, incharges: 0, supervisors: 1, workers: 6, total: 7 },
      'Quality Assurance': { section: 'Quality Assurance', managers: 1, incharges: 0, supervisors: 0, workers: 5, total: 6 },
      'Maintenance & Utility': { section: 'Maintenance & Utility', managers: 0, incharges: 0, supervisors: 0, workers: 4, total: 4 },
    }
  },
  {
    id: '2026-08-26',
    date: '2026-08-26',
    totalManagers: 6,
    totalIncharges: 8,
    totalSupervisors: 14,
    totalWorkers: 192,
    totalManpower: 220,
    notes: 'Overtime in sewing line 2',
    updatedAt: '2026-08-26T08:30:00.000Z',
    sections: {
      'Cutting': { section: 'Cutting', managers: 1, incharges: 1, supervisors: 2, workers: 27, total: 31 },
      'Sewing': { section: 'Sewing', managers: 1, incharges: 2, supervisors: 4, workers: 66, total: 73 },
      'Lasting & DIP': { section: 'Lasting & DIP', managers: 1, incharges: 1, supervisors: 2, workers: 34, total: 38 },
      'Warehouse': { section: 'Warehouse', managers: 1, incharges: 1, supervisors: 1, workers: 12, total: 15 },
      'Goods Store': { section: 'Goods Store', managers: 0, incharges: 1, supervisors: 1, workers: 8, total: 10 },
      'Packing': { section: 'Packing', managers: 1, incharges: 1, supervisors: 2, workers: 21, total: 25 },
      'Lamination & Preparation': { section: 'Lamination & Preparation', managers: 0, incharges: 1, supervisors: 1, workers: 10, total: 12 },
      'Printing & Embossing': { section: 'Printing & Embossing', managers: 0, incharges: 0, supervisors: 1, workers: 6, total: 7 },
      'Quality Assurance': { section: 'Quality Assurance', managers: 1, incharges: 0, supervisors: 0, workers: 4, total: 5 },
      'Maintenance & Utility': { section: 'Maintenance & Utility', managers: 0, incharges: 0, supervisors: 0, workers: 4, total: 4 },
    }
  },
  {
    id: '2026-08-25',
    date: '2026-08-25',
    totalManagers: 6,
    totalIncharges: 8,
    totalSupervisors: 13,
    totalWorkers: 188,
    totalManpower: 215,
    notes: 'Rainfall delay morning shift',
    updatedAt: '2026-08-25T08:30:00.000Z',
    sections: {
      'Cutting': { section: 'Cutting', managers: 1, incharges: 1, supervisors: 2, workers: 26, total: 30 },
      'Sewing': { section: 'Sewing', managers: 1, incharges: 2, supervisors: 4, workers: 63, total: 70 },
      'Lasting & DIP': { section: 'Lasting & DIP', managers: 1, incharges: 1, supervisors: 2, workers: 33, total: 37 },
      'Warehouse': { section: 'Warehouse', managers: 1, incharges: 1, supervisors: 1, workers: 12, total: 15 },
      'Goods Store': { section: 'Goods Store', managers: 0, incharges: 1, supervisors: 1, workers: 8, total: 10 },
      'Packing': { section: 'Packing', managers: 1, incharges: 1, supervisors: 1, workers: 22, total: 25 },
      'Lamination & Preparation': { section: 'Lamination & Preparation', managers: 0, incharges: 1, supervisors: 1, workers: 9, total: 11 },
      'Printing & Embossing': { section: 'Printing & Embossing', managers: 0, incharges: 0, supervisors: 1, workers: 6, total: 7 },
      'Quality Assurance': { section: 'Quality Assurance', managers: 1, incharges: 0, supervisors: 0, workers: 5, total: 6 },
      'Maintenance & Utility': { section: 'Maintenance & Utility', managers: 0, incharges: 0, supervisors: 0, workers: 4, total: 4 },
    }
  },
  {
    id: '2026-08-24',
    date: '2026-08-24',
    totalManagers: 6,
    totalIncharges: 8,
    totalSupervisors: 14,
    totalWorkers: 190,
    totalManpower: 218,
    updatedAt: '2026-08-24T08:30:00.000Z',
    sections: {
      'Cutting': { section: 'Cutting', managers: 1, incharges: 1, supervisors: 2, workers: 27, total: 31 },
      'Sewing': { section: 'Sewing', managers: 1, incharges: 2, supervisors: 4, workers: 64, total: 71 },
      'Lasting & DIP': { section: 'Lasting & DIP', managers: 1, incharges: 1, supervisors: 2, workers: 34, total: 38 },
      'Warehouse': { section: 'Warehouse', managers: 1, incharges: 1, supervisors: 1, workers: 12, total: 15 },
      'Goods Store': { section: 'Goods Store', managers: 0, incharges: 1, supervisors: 1, workers: 8, total: 10 },
      'Packing': { section: 'Packing', managers: 1, incharges: 1, supervisors: 2, workers: 21, total: 25 },
      'Lamination & Preparation': { section: 'Lamination & Preparation', managers: 0, incharges: 1, supervisors: 1, workers: 10, total: 12 },
      'Printing & Embossing': { section: 'Printing & Embossing', managers: 0, incharges: 0, supervisors: 1, workers: 6, total: 7 },
      'Quality Assurance': { section: 'Quality Assurance', managers: 1, incharges: 0, supervisors: 0, workers: 5, total: 6 },
      'Maintenance & Utility': { section: 'Maintenance & Utility', managers: 0, incharges: 0, supervisors: 0, workers: 3, total: 3 },
    }
  }
];

const STORAGE_KEYS = {
  buyers: 'ec-buyers',
  buyerOrders: 'ec-buyer-orders',
  productionFlows: 'ec-production-flows',
  productionPlans: 'ec-production-plans',
  finishedGoods: 'ec-finished-goods',
  warehouseStocks: 'ec-warehouse-stocks',
  materialReceivals: 'ec-material-receivals',
  departments: 'ec-departments',
  articles: 'ec-articles',
  employees: 'ec-employees-v1',
  dailyManpower: 'ec-daily-manpower-v2',
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
    hydrateList(STORAGE_KEYS.productionPlans, defaultProductionPlans);
    hydrateList(STORAGE_KEYS.finishedGoods, finishedGoods);
    hydrateList(STORAGE_KEYS.warehouseStocks, warehouseStocks);
    hydrateList(STORAGE_KEYS.materialReceivals, materialReceivals);
    hydrateList(STORAGE_KEYS.departments, departments);
    hydrateList(STORAGE_KEYS.articles, articles);
    hydrateList(STORAGE_KEYS.employees, initialEmployees);
    hydrateList(STORAGE_KEYS.dailyManpower, initialDailyManpower);
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
  private persistProductionPlans() { this.persist(STORAGE_KEYS.productionPlans, defaultProductionPlans); }
  private persistFinishedGoods() { this.persist(STORAGE_KEYS.finishedGoods, finishedGoods); }
  private persistWarehouseStocks() { this.persist(STORAGE_KEYS.warehouseStocks, warehouseStocks); }
  private persistMaterialReceivals() { this.persist(STORAGE_KEYS.materialReceivals, materialReceivals); }
  private persistDepartments() { this.persist(STORAGE_KEYS.departments, departments); }
  private persistArticles() { this.persist(STORAGE_KEYS.articles, articles); }
  private persistEmployees() { this.persist(STORAGE_KEYS.employees, initialEmployees); }
  private persistDailyManpower() { this.persist(STORAGE_KEYS.dailyManpower, initialDailyManpower); }

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
    const seen = new Set<string>();
    const deduped: ProductionFlow[] = [];
    for (const f of list) {
      if (f.id && !seen.has(f.id)) {
        seen.add(f.id);
        deduped.push(f);
      }
    }
    productionFlows.length = 0;
    productionFlows.push(...deduped);
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
    
    // 1. Check if same ID already exists
    const existingIndex = productionFlows.findIndex((f) => f.id === flow.id);
    if (existingIndex !== -1) {
      productionFlows[existingIndex] = flow;
      this.persistProductionFlows();
      return flow;
    }

    // 2. Check for duplicate submission within 3 seconds
    try {
      const fTime = flow.updatedAt ? new Date(flow.updatedAt).getTime() : Date.now();
      const duplicate = productionFlows.find((f) => {
        if (f.orderId !== flow.orderId) return false;
        if (f.department !== flow.department) return false;
        if ((f.processName || '') !== (flow.processName || '')) return false;
        if (f.completed !== flow.completed) return false;
        const existingTime = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
        return Math.abs(fTime - existingTime) < 3000;
      });
      if (duplicate) return duplicate;
    } catch (e) {}

    productionFlows.unshift(flow);
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

  getProductionPlans(): OrderProductionPlan[] {
    this.ensureHydrated();
    return [...defaultProductionPlans];
  }

  setProductionPlans(list: OrderProductionPlan[]) {
    this.ensureHydrated();
    defaultProductionPlans.length = 0;
    defaultProductionPlans.push(...list);
    this.persistProductionPlans();
  }

  saveProductionPlan(plan: OrderProductionPlan): OrderProductionPlan {
    this.ensureHydrated();
    const idx = defaultProductionPlans.findIndex((p) => p.id === plan.id || p.orderId === plan.orderId);
    if (idx !== -1) {
      defaultProductionPlans[idx] = { ...defaultProductionPlans[idx], ...plan, updatedAt: new Date().toISOString() };
    } else {
      defaultProductionPlans.unshift({ ...plan, updatedAt: new Date().toISOString() });
    }
    this.persistProductionPlans();
    return idx !== -1 ? defaultProductionPlans[idx] : defaultProductionPlans[0];
  }

  deleteProductionPlan(idOrOrderId: string): boolean {
    this.ensureHydrated();
    const idx = defaultProductionPlans.findIndex((p) => p.id === idOrOrderId || p.orderId === idOrOrderId);
    if (idx !== -1) {
      defaultProductionPlans.splice(idx, 1);
      this.persistProductionPlans();
      return true;
    }
    return false;
  }

  // ── Employee (Manpower) Methods ──────────────────────────────────────────
  getEmployees(): Employee[] {
    this.ensureHydrated();
    return [...initialEmployees];
  }

  setEmployees(list: Employee[]) {
    this.ensureHydrated();
    initialEmployees.length = 0;
    initialEmployees.push(...list);
    this.persistEmployees();
  }

  addEmployee(employee: Employee): Employee {
    this.ensureHydrated();
    initialEmployees.unshift(employee);
    this.persistEmployees();
    return employee;
  }

  updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
    this.ensureHydrated();
    const idx = initialEmployees.findIndex((e) => e.id === id);
    if (idx !== -1) {
      initialEmployees[idx] = { ...initialEmployees[idx], ...updates };
      this.persistEmployees();
      return initialEmployees[idx];
    }
    return null;
  }

  deleteEmployee(id: string): boolean {
    this.ensureHydrated();
    const idx = initialEmployees.findIndex((e) => e.id === id);
    if (idx !== -1) {
      initialEmployees.splice(idx, 1);
      this.persistEmployees();
      return true;
    }
    return false;
  }

  // ── Daily Section Manpower Methods ──────────────────────────────────────
  getDailyManpowerRecords(): DailyManpowerRecord[] {
    this.ensureHydrated();
    return [...initialDailyManpower];
  }

  setDailyManpowerRecords(list: DailyManpowerRecord[]) {
    this.ensureHydrated();
    initialDailyManpower.length = 0;
    initialDailyManpower.push(...list);
    this.persistDailyManpower();
  }

  getDailyManpowerByDate(date: string): DailyManpowerRecord | undefined {
    this.ensureHydrated();
    return initialDailyManpower.find((r) => r.date === date);
  }

  saveDailyManpower(record: DailyManpowerRecord): DailyManpowerRecord {
    this.ensureHydrated();
    const idx = initialDailyManpower.findIndex((r) => r.date === record.date);
    if (idx !== -1) {
      initialDailyManpower[idx] = { ...initialDailyManpower[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      initialDailyManpower.unshift({ ...record, id: record.date, updatedAt: new Date().toISOString() });
    }
    this.persistDailyManpower();
    return idx !== -1 ? initialDailyManpower[idx] : initialDailyManpower[0];
  }

  deleteDailyManpower(date: string): boolean {
    this.ensureHydrated();
    const idx = initialDailyManpower.findIndex((r) => r.date === date);
    if (idx !== -1) {
      initialDailyManpower.splice(idx, 1);
      this.persistDailyManpower();
      return true;
    }
    return false;
  }
}

export const mockRepository = new MockRepository();
