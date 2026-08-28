import type {
  Buyer,
  Department,
  Article,
  BuyerOrder,
  ProductionFlow,
  FinishedGoods,
  WarehouseStock,
  MaterialReceival,
  Order,
  OrderProductionPlan,
} from '@/types';
import { firebaseService } from './firebaseService';
import { mockRepository } from '@/repositories/mockRepository';

export const apiService = {
  // ── Buyers ──────────────────────────────────────────────────────────────────
  getBuyers: async (): Promise<Buyer[]> => {
    try {
      const fbData = await firebaseService.getBuyers();
      if (fbData && fbData.length > 0) {
        mockRepository.setBuyers(fbData);
        return fbData;
      }
    } catch (e) {
      console.warn('Firestore getBuyers fallback to local:', e);
    }
    return mockRepository.getBuyers();
  },

  createBuyer: async (payload: Omit<Buyer, 'id'>) => {
    const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullBuyer: Buyer = { id, createdAt: new Date().toISOString(), ...payload } as Buyer;
    
    mockRepository.addBuyer(fullBuyer);

    try {
      await firebaseService.saveBuyer(fullBuyer);
    } catch (e) {
      console.warn('Firebase buyer save error:', e);
    }

    return fullBuyer;
  },

  deleteBuyer: async (id: string) => {
    mockRepository.deleteBuyer(id);

    try {
      await firebaseService.deleteBuyer(id);
    } catch (e) {
      console.warn('Firebase buyer delete error:', e);
    }

    return { success: true };
  },

  patchBuyer: async (id: string, updates: Partial<Buyer>) => {
    mockRepository.updateBuyer(id, updates);
    try {
      await firebaseService.updateBuyer(id, updates);
    } catch (e) {
      console.warn('Firebase buyer update error:', e);
    }
    return { id, ...updates } as Buyer;
  },

  // ── Departments ─────────────────────────────────────────────────────────────
  getDepartments: async (): Promise<Department[]> => {
    try {
      const fbData = await firebaseService.getDepartments();
      if (fbData && fbData.length > 0) {
        mockRepository.setDepartments(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getDepartments();
  },

  patchDepartment: async (id: string, updates: Partial<Department>) => {
    mockRepository.updateDepartment(id, updates);
    try {
      await firebaseService.updateDepartment(id, updates);
    } catch (e) {}
    return { id, ...updates } as Department;
  },

  // ── Articles ────────────────────────────────────────────────────────────────
  getArticles: async (): Promise<Article[]> => {
    try {
      const fbData = await firebaseService.getArticles();
      if (fbData && fbData.length > 0) {
        mockRepository.setArticles(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getArticles();
  },

  // ── Orders ──────────────────────────────────────────────────────────────────
  getBuyerOrders: async (): Promise<BuyerOrder[]> => {
    try {
      const fbData = await firebaseService.getOrders();
      if (fbData && fbData.length > 0) {
        mockRepository.setBuyerOrders(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getBuyerOrders();
  },

  createBuyerOrder: async (payload: Omit<BuyerOrder, 'id'>) => {
    const id = `bo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullOrder: BuyerOrder = { id, createdAt: new Date().toISOString(), status: 'Pending', ...payload } as BuyerOrder;

    mockRepository.addBuyerOrder(fullOrder);

    try {
      await firebaseService.saveOrder(fullOrder);
    } catch (e) {
      console.warn('Firebase order save error:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return fullOrder;
  },

  updateBuyerOrder: async (id: string, updates: Partial<BuyerOrder>) => {
    mockRepository.updateBuyerOrder(id, updates);
    try {
      await firebaseService.updateOrder(id, updates);
    } catch (e) {
      console.warn('Firebase order update error:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return { id, ...updates } as BuyerOrder;
  },

  deleteBuyerOrder: async (id: string) => {
    mockRepository.deleteBuyerOrder(id);

    try {
      await firebaseService.deleteOrder(id);
    } catch (e) {
      console.warn('Firebase order delete error:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return { success: true };
  },

  // ── Production Orders & Flows ───────────────────────────────────────────────
  getOrders: async (): Promise<Order[]> => {
    return mockRepository.getOrders();
  },

  getProductionFlows: async (): Promise<ProductionFlow[]> => {
    try {
      const fbData = await firebaseService.getProductionFlows();
      if (fbData && fbData.length > 0) {
        mockRepository.setProductionFlows(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getProductionFlows();
  },

  createProductionFlow: async (payload: Omit<ProductionFlow, 'id'>) => {
    const id = `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullFlow: ProductionFlow = { id, updatedAt: new Date().toISOString(), ...payload } as ProductionFlow;

    mockRepository.addProductionFlow(fullFlow);

    try {
      await firebaseService.saveProductionFlow(fullFlow);
    } catch (e) {}

    return fullFlow;
  },

  updateProductionFlow: async (id: string, updates: Partial<ProductionFlow>) => {
    mockRepository.updateProductionFlow(id, updates);
    try {
      await firebaseService.updateProductionFlow(id, updates);
    } catch (e) {}
    return { id, ...updates } as ProductionFlow;
  },

  deleteProductionFlow: async (id: string) => {
    mockRepository.deleteProductionFlow(id);
    try {
      await firebaseService.deleteProductionFlow(id);
    } catch (e) {}
    return { success: true };
  },

  clearProductionFlows: async () => {
    mockRepository.clearProductionFlows();
    return 0;
  },

  // ── Finished Goods ──────────────────────────────────────────────────────────
  getFinishedGoods: async (): Promise<FinishedGoods[]> => {
    try {
      const fbData = await firebaseService.getFinishedGoods();
      if (fbData && fbData.length > 0) {
        mockRepository.setFinishedGoods(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getFinishedGoods();
  },

  createFinishedGood: async (payload: Omit<FinishedGoods, 'id'>) => {
    const id = `fg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullFg: FinishedGoods = { id, ...payload } as FinishedGoods;

    mockRepository.addFinishedGood(fullFg);

    try {
      await firebaseService.saveFinishedGood(fullFg);
    } catch (e) {}

    return fullFg;
  },

  updateFinishedGood: async (id: string, updates: Partial<FinishedGoods>) => {
    mockRepository.updateFinishedGood(id, updates);
    try {
      await firebaseService.updateFinishedGood(id, updates);
    } catch (e) {}
    return { id, ...updates } as FinishedGoods;
  },

  deleteFinishedGood: async (id: string) => {
    mockRepository.deleteFinishedGood(id);
    try {
      await firebaseService.deleteFinishedGood(id);
    } catch (e) {}
    return { success: true };
  },

  markFinishedGoodShipped: async (id: string) => {
    const finished = await apiService.updateFinishedGood(id, { status: 'Shipped' });
    if (finished?.orderId) {
      await apiService.updateBuyerOrder(finished.orderId, { status: 'Completed' });
    }
    return { finished };
  },

  clearFinishedGoods: async () => {
    mockRepository.clearFinishedGoods();
    return 0;
  },

  // ── Warehouse Stocks ────────────────────────────────────────────────────────
  getWarehouseStocks: async (): Promise<WarehouseStock[]> => {
    try {
      const fbData = await firebaseService.getWarehouseStocks();
      if (fbData && fbData.length > 0) {
        mockRepository.setWarehouseStocks(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getWarehouseStocks();
  },

  createWarehouseStock: async (payload: Omit<WarehouseStock, 'id'>) => {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullStock: WarehouseStock = { id, ...payload } as WarehouseStock;

    mockRepository.addWarehouseStock(fullStock);

    try {
      await firebaseService.saveWarehouseStock(fullStock);
    } catch (e) {}

    return fullStock;
  },

  updateWarehouseStock: async (id: string, updates: Partial<WarehouseStock>) => {
    mockRepository.updateWarehouseStock(id, updates);
    try {
      await firebaseService.updateWarehouseStock(id, updates);
    } catch (e) {}
    return { id, ...updates } as WarehouseStock;
  },

  deleteWarehouseStock: async (id: string) => {
    mockRepository.deleteWarehouseStock(id);
    try {
      await firebaseService.deleteWarehouseStock(id);
    } catch (e) {}
    return { success: true };
  },

  // ── Material Receivals ──────────────────────────────────────────────────────
  getMaterialReceivals: async (): Promise<MaterialReceival[]> => {
    try {
      const fbData = await firebaseService.getMaterialReceivals();
      if (fbData && fbData.length > 0) {
        mockRepository.setMaterialReceivals(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getMaterialReceivals();
  },

  createMaterialReceival: async (payload: Omit<MaterialReceival, 'id'>) => {
    const id = `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullReceival: MaterialReceival = { id, receivedAt: new Date().toISOString(), ...payload } as MaterialReceival;

    mockRepository.addMaterialReceival(fullReceival);

    try {
      await firebaseService.saveMaterialReceival(fullReceival);
    } catch (e) {}

    return fullReceival;
  },

  transferWarehouseStock: async (payload: { itemId: string; fromSection: string; toSection: string; quantity: number }) => {
    try {
      const stock = mockRepository.getWarehouseStocks().find((s) => s.id === payload.itemId);
      if (stock && stock.quantity >= payload.quantity) {
        const remaining = stock.quantity - payload.quantity;
        mockRepository.updateWarehouseStock(payload.itemId, { quantity: remaining });
        try {
          await firebaseService.updateWarehouseStock(payload.itemId, { quantity: remaining });
        } catch (e) {}
      }
      return { success: true };
    } catch (e) {
      return { success: true };
    }
  },

  // ── Production Plans ────────────────────────────────────────────────────────
  getProductionPlans: async (): Promise<OrderProductionPlan[]> => {
    try {
      const fbData = await firebaseService.getProductionPlans();
      if (fbData && fbData.length > 0) {
        mockRepository.setProductionPlans(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getProductionPlans();
  },

  saveProductionPlan: async (plan: OrderProductionPlan): Promise<OrderProductionPlan> => {
    const saved = mockRepository.saveProductionPlan(plan);
    try {
      await firebaseService.saveProductionPlan(saved);
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:productionPlansUpdated', { detail: saved }));
      }
    } catch (e) {}
    return saved;
  },

  deleteProductionPlan: async (id: string): Promise<{ success: boolean }> => {
    mockRepository.deleteProductionPlan(id);
    try {
      await firebaseService.deleteProductionPlan(id);
    } catch (e) {}
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('erp:productionPlansUpdated'));
      }
    } catch (e) {}
    return { success: true };
  },
};
