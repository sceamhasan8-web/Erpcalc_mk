import { mockRepository } from '@/repositories/mockRepository';
import { firebaseService } from '@/services/firebaseService';
import { apiService } from '@/services/apiService';
import type { Buyer, CostTracking, Department, FinishedGoods, Notification, Order, ProductionFlow, Report, User, WarehouseStock, MaterialReceival, Article, BuyerOrder } from '@/types';

export interface InventoryTransferPayload {
  itemId: string;
  fromSection: string;
  toSection: string;
  quantity: number;
}

export interface InventoryTransferResult {
  ok: boolean;
  message?: string;
}

export interface GoodsReceivePayload {
  item: string;
  quantity: number;
  unit?: string;
  section: string;
  source: 'Buyer' | 'Own Purchase';
  buyerName?: string;
  notes?: string;
}

export interface GoodsReceiveResult {
  ok: boolean;
  message?: string;
}

export class ErpService {
  getDashboardSummary() {
    const orders = mockRepository.getOrders();
    const buyers = mockRepository.getBuyers();
    const departments = mockRepository.getDepartments();
    const warehouseStocks = mockRepository.getWarehouseStocks();

    const productionToday = orders.reduce((sum, order) => sum + order.completedQuantity, 0);
    const weeklyProduction = productionToday + 1800;
    const monthlyProduction = productionToday + 15600;
    const activeOrders = orders.filter((order) => order.status === 'In Progress').length;
    const delayedOrders = orders.filter((order) => order.status === 'Delayed').length;
    const totalBuyers = buyers.length;
    const productionCosts = orders.reduce((sum, order) => sum + (order.cost ?? 0), 0);
    const inventoryStatus = warehouseStocks.filter((stock) => stock.quantity <= (stock.reorderLevel ?? 0)).length;

    return {
      productionToday,
      weeklyProduction,
      monthlyProduction,
      activeOrders,
      delayedOrders,
      totalBuyers,
      productionCosts,
      inventoryStatus,
    };
  }

  getBuyers(): Buyer[] {
    return mockRepository.getBuyers();
  }

  getOrders(): Order[] {
    return mockRepository.getOrders();
  }

  getDepartments(): Department[] {
    return mockRepository.getDepartments();
  }

  updateDepartment(departmentId: string, updates: Partial<Department>): Department | null {
    const res = mockRepository.updateDepartment(departmentId, updates);
    try {
      firebaseService.updateDepartment(departmentId, updates);
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:departmentsUpdated'));
      }
    } catch (e) {}
    return res;
  }

  getProductionFlows(): ProductionFlow[] {
    return mockRepository.getProductionFlows();
  }

  getWarehouseStocks(): WarehouseStock[] {
    return mockRepository.getWarehouseStocks();
  }

  getFinishedGoods(): FinishedGoods[] {
    return mockRepository.getFinishedGoods();
  }

  getMaterialReceivals(): MaterialReceival[] {
    return mockRepository.getMaterialReceivals();
  }

  getArticles(): Article[] {
    return mockRepository.getArticles();
  }

  getBuyerOrders(): BuyerOrder[] {
    return mockRepository.getBuyerOrders();
  }

  getCostTracking(): CostTracking[] {
    return mockRepository.getCostTracking();
  }

  getReports(): Report[] {
    return mockRepository.getReports();
  }

  getNotifications(): Notification[] {
    return mockRepository.getNotifications();
  }

  getUsers(): User[] {
    return mockRepository.getUsers();
  }

  // Create operations with multi-layer persistence (localStorage + Firebase + API)
  createProductionFlow(flow: Omit<ProductionFlow, 'id'>): ProductionFlow {
    // Prevent duplicate within 5s
    try {
      const existing = mockRepository.getProductionFlows().find((f) => {
        if (f.orderId !== flow.orderId) return false;
        if (f.department !== flow.department) return false;
        if (f.completed !== flow.completed) return false;
        const fTime = f.updatedAt ? new Date(f.updatedAt).getTime() : 0;
        const newTime = flow.updatedAt ? new Date(flow.updatedAt).getTime() : Date.now();
        return Math.abs(newTime - fTime) < 5000;
      });
      if (existing) return existing;
    } catch (e) {}

    const id = `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newFlow: ProductionFlow = { id, updatedAt: new Date().toISOString(), ...flow } as ProductionFlow;
    const created = mockRepository.addProductionFlow(newFlow);

    // Sync to Cloud Firestore
    try {
      firebaseService.saveProductionFlow(created);
    } catch (e) {}

    // Sync to API route
    try {
      apiService.createProductionFlow(flow).catch(() => {});
    } catch (e) {}

    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
    } catch (e) {}
    return created;
  }

  updateProductionFlow(flowId: string, updates: Partial<ProductionFlow>): ProductionFlow | null {
    const res = mockRepository.updateProductionFlow(flowId, updates);
    try {
      firebaseService.updateProductionFlow(flowId, updates);
    } catch (e) {}
    try {
      apiService.updateProductionFlow(flowId, updates).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
    } catch (e) {}
    return res;
  }

  deleteProductionFlow(flowId: string): boolean {
    const ok = mockRepository.deleteProductionFlow(flowId);
    try {
      firebaseService.deleteProductionFlow(flowId);
    } catch (e) {}
    try {
      apiService.deleteProductionFlow(flowId).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
    } catch (e) {}
    if (!ok) return ok;

    // Consistency check for finished goods
    try {
      const orders = mockRepository.getBuyerOrders();
      const flows = mockRepository.getProductionFlows();
      orders.forEach((order) => {
        const depts = order.requiredDepartments ?? [];
        if (depts.length === 0) return;
        const allDone = depts.every((dept) => {
          const total = flows.filter((f) => f.orderId === order.id && f.department === dept).reduce((s, f) => s + f.completed, 0);
          return total >= (order.quantity ?? 0);
        });
        if (!allDone) {
          mockRepository.deleteFinishedGoodByOrderId(order.id);
          if (order.status === 'Completed') {
            mockRepository.updateBuyerOrder(order.id, { status: 'In Production' });
          }
        }
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
        window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
      }
    } catch (e) {}

    return ok;
  }

  clearProductionFlows(): number {
    const n = mockRepository.clearProductionFlows();
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
    } catch (e) {}
    return n;
  }

  clearFinishedGoods(): number {
    const n = mockRepository.clearFinishedGoods();
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
    } catch (e) {}
    return n;
  }

  clearDemoData(): { flowsCleared: number; finishedCleared: number } {
    const flowsCleared = this.clearProductionFlows();
    const finishedCleared = this.clearFinishedGoods();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:productionFlowsUpdated'));
        window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
        window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
      }
    } catch (e) {}
    return { flowsCleared, finishedCleared };
  }

  receiveGoods(payload: GoodsReceivePayload): GoodsReceiveResult {
    if (!payload.item?.trim()) {
      return { ok: false, message: 'Enter the material name before saving.' };
    }

    if (payload.quantity <= 0) {
      return { ok: false, message: 'Quantity must be greater than zero.' };
    }

    const newReceipt: MaterialReceival = {
      id: `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sku: `MAT-${Date.now()}`,
      item: payload.item.trim(),
      quantity: payload.quantity,
      unit: (payload.unit as WarehouseStock['unit']) || 'kg',
      source: payload.source,
      buyerName: payload.buyerName,
      location: payload.section,
      category: 'Material',
      notes: payload.notes,
      receivedAt: new Date().toISOString(),
    };

    mockRepository.addMaterialReceival(newReceipt);

    // Sync Material Receival to Firebase Firestore
    try {
      firebaseService.saveMaterialReceival(newReceipt);
    } catch (e) {}

    const existingStock = mockRepository.getWarehouseStocks().find((stock) => stock.item === payload.item.trim() && stock.location === payload.section);

    if (existingStock) {
      const updated = mockRepository.updateWarehouseStock(existingStock.id, {
        quantity: (existingStock.quantity ?? 0) + payload.quantity,
      });
      if (updated) {
        try {
          firebaseService.updateWarehouseStock(updated.id, { quantity: updated.quantity });
        } catch (e) {}
      }
    } else {
      const newStock: WarehouseStock = {
        id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sku: `MAT-${Date.now()}`,
        item: payload.item.trim(),
        quantity: payload.quantity,
        unit: (payload.unit as WarehouseStock['unit']) || 'kg',
        location: payload.section,
        category: 'Material',
        reorderLevel: 50,
      };
      mockRepository.addWarehouseStock(newStock);
      try {
        firebaseService.saveWarehouseStock(newStock);
      } catch (e) {}
    }

    try {
      apiService.createMaterialReceival(newReceipt).catch(() => {});
    } catch (e) {}

    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:warehouseUpdated'));
    } catch (e) {}

    return { ok: true, message: 'Goods receive recorded.' };
  }

  transferInventory(payload: InventoryTransferPayload): InventoryTransferResult {
    const stock = mockRepository.getWarehouseStocks().find((item) => item.id === payload.itemId);

    if (!stock) {
      return { ok: false, message: 'The selected inventory item was not found.' };
    }

    if (!payload.fromSection || !payload.toSection) {
      return { ok: false, message: 'Select both source and destination sections.' };
    }

    if (payload.fromSection === payload.toSection) {
      return {
        ok: false,
        message: 'Select a different destination section. Warehouse-to-Warehouse transfers are not allowed.',
      };
    }

    if (payload.quantity <= 0) {
      return { ok: false, message: 'Transfer quantity must be greater than zero.' };
    }

    if (payload.quantity > (stock.quantity ?? 0)) {
      return { ok: false, message: `Only ${stock.quantity} ${stock.unit ?? 'pcs'} are available in ${payload.fromSection}.` };
    }

    const updatedSource = mockRepository.updateWarehouseStock(stock.id, {
      quantity: (stock.quantity ?? 0) - payload.quantity,
      location: payload.fromSection,
    });

    if (!updatedSource) {
      return { ok: false, message: 'The stock entry could not be updated.' };
    }

    try {
      firebaseService.updateWarehouseStock(stock.id, { quantity: updatedSource.quantity });
    } catch (e) {}

    const existingTarget = mockRepository.getWarehouseStocks().find((s) => s.item === stock.item && s.location === payload.toSection);

    if (existingTarget) {
      const updatedTarget = mockRepository.updateWarehouseStock(existingTarget.id, {
        quantity: (existingTarget.quantity ?? 0) + payload.quantity,
      });
      if (updatedTarget) {
        try {
          firebaseService.updateWarehouseStock(existingTarget.id, { quantity: updatedTarget.quantity });
        } catch (e) {}
      }
    } else {
      const targetStock: WarehouseStock = {
        ...stock,
        id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        quantity: payload.quantity,
        location: payload.toSection,
      };
      mockRepository.addWarehouseStock(targetStock);
      try {
        firebaseService.saveWarehouseStock(targetStock);
      } catch (e) {}
    }

    try {
      apiService.transferWarehouseStock(payload).catch(() => {});
    } catch (e) {}

    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:warehouseUpdated'));
    } catch (e) {}

    return { ok: true, message: 'Transfer completed.' };
  }

  createWarehouseStock(stock: Omit<WarehouseStock, 'id'>): WarehouseStock {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newStock: WarehouseStock = { id, ...stock } as WarehouseStock;
    mockRepository.addWarehouseStock(newStock);
    try {
      firebaseService.saveWarehouseStock(newStock);
    } catch (e) {}
    try {
      apiService.createWarehouseStock(newStock).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:warehouseUpdated'));
    } catch (e) {}
    return newStock;
  }

  updateWarehouseStock(stockId: string, updates: Partial<WarehouseStock>): WarehouseStock | null {
    const res = mockRepository.updateWarehouseStock(stockId, updates);
    try {
      firebaseService.updateWarehouseStock(stockId, updates);
    } catch (e) {}
    try {
      apiService.updateWarehouseStock(stockId, updates).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:warehouseUpdated'));
    } catch (e) {}
    return res;
  }

  deleteWarehouseStock(stockId: string): boolean {
    const ok = mockRepository.deleteWarehouseStock(stockId);
    try {
      firebaseService.deleteWarehouseStock(stockId);
    } catch (e) {}
    try {
      apiService.deleteWarehouseStock(stockId).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:warehouseUpdated'));
    } catch (e) {}
    return ok;
  }

  createMaterialReceival(receival: Omit<MaterialReceival, 'id'>): MaterialReceival {
    const id = `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newReceival: MaterialReceival = { id, ...receival, receivedAt: new Date().toISOString() } as MaterialReceival;
    mockRepository.addMaterialReceival(newReceival);
    try {
      firebaseService.saveMaterialReceival(newReceival);
    } catch (e) {}
    try {
      apiService.createMaterialReceival(newReceival).catch(() => {});
    } catch (e) {}
    return newReceival;
  }

  createBuyerOrder(order: Omit<BuyerOrder, 'id'>): BuyerOrder {
    const id = `bo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newOrder: BuyerOrder = { id, ...order, createdAt: new Date().toISOString(), status: 'Pending' } as BuyerOrder;
    const created = mockRepository.addBuyerOrder(newOrder);
    try {
      firebaseService.saveOrder(created);
    } catch (e) {}
    try {
      apiService.createBuyerOrder(newOrder).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    } catch (e) {}
    return created;
  }

  updateBuyerOrder(orderId: string, updates: Partial<BuyerOrder>): BuyerOrder | null {
    const res = mockRepository.updateBuyerOrder(orderId, updates);
    try {
      firebaseService.updateOrder(orderId, updates);
    } catch (e) {}
    try {
      apiService.updateBuyerOrder(orderId, updates).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    } catch (e) {}
    return res;
  }

  deleteBuyerOrder(orderId: string): boolean {
    const ok = mockRepository.deleteBuyerOrder(orderId);
    try {
      firebaseService.deleteOrder(orderId);
    } catch (e) {}
    try {
      apiService.deleteBuyerOrder(orderId).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    } catch (e) {}
    return ok;
  }

  addBuyer(buyer: Omit<Buyer, 'id'> | Buyer): Buyer {
    const id = (buyer as any).id || `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullBuyer: Buyer = { id, createdAt: new Date().toISOString(), ...buyer } as Buyer;
    const created = mockRepository.addBuyer(fullBuyer);
    try {
      firebaseService.saveBuyer(created);
    } catch (e) {}
    try {
      apiService.createBuyer(buyer).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyersUpdated'));
    } catch (e) {}
    return created;
  }

  updateBuyer(buyerId: string, updates: Partial<Buyer>): Buyer | null {
    const res = mockRepository.updateBuyer(buyerId, updates);
    try {
      firebaseService.updateBuyer(buyerId, updates);
    } catch (e) {}
    try {
      apiService.patchBuyer(buyerId, updates).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyersUpdated'));
    } catch (e) {}
    return res;
  }

  deleteBuyer(buyerId: string): boolean {
    const ok = mockRepository.deleteBuyer(buyerId);
    try {
      firebaseService.deleteBuyer(buyerId);
    } catch (e) {}
    try {
      apiService.deleteBuyer(buyerId).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:buyersUpdated'));
    } catch (e) {}
    return ok;
  }

  // Finished Goods methods
  createFinishedGood(fg: Omit<FinishedGoods, 'id'>): FinishedGoods {
    const id = `fg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newFg: FinishedGoods = { id, ...fg } as FinishedGoods;
    mockRepository.addFinishedGood(newFg);
    try {
      firebaseService.saveFinishedGood(newFg);
    } catch (e) {}
    try {
      apiService.createFinishedGood(newFg).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
    } catch (e) {}
    return newFg;
  }

  updateFinishedGood(fgId: string, updates: Partial<FinishedGoods>): FinishedGoods | null {
    const res = mockRepository.updateFinishedGood(fgId, updates);
    try {
      firebaseService.updateFinishedGood(fgId, updates);
    } catch (e) {}
    try {
      apiService.updateFinishedGood(fgId, updates).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
    } catch (e) {}
    return res;
  }

  deleteFinishedGood(fgId: string): boolean {
    const ok = mockRepository.deleteFinishedGood(fgId);
    try {
      firebaseService.deleteFinishedGood(fgId);
    } catch (e) {}
    try {
      apiService.deleteFinishedGood(fgId).catch(() => {});
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('erp:finishedGoodsUpdated'));
    } catch (e) {}
    return ok;
  }

  markFinishedGoodShipped(fgId: string): { finished: FinishedGoods | null } {
    const res = this.updateFinishedGood(fgId, { status: 'Shipped' });
    if (res?.orderId) {
      this.updateBuyerOrder(res.orderId, { status: 'Completed' });
    }
    return { finished: res };
  }
}

export const erpService = new ErpService();
