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
} from '@/types';
import { firebaseService } from './firebaseService';
import { mockRepository } from '@/repositories/mockRepository';

async function fetchJson<T>(url: string, init?: RequestInit, fallback?: T): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (fallback !== undefined) return fallback;
    }

    return await response.json();
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export const apiService = {
  // Buyers
  getBuyers: async (): Promise<Buyer[]> => {
    try {
      const fbData = await firebaseService.getBuyers();
      if (fbData && fbData.length > 0) {
        mockRepository.setBuyers(fbData);
        return fbData;
      }
    } catch (e) {}
    return mockRepository.getBuyers();
  },
  createBuyer: async (payload: Omit<Buyer, 'id'>) => {
    const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const fullBuyer: Buyer = { id, createdAt: new Date().toISOString(), ...payload } as Buyer;
    
    // Save to local persistent repository
    mockRepository.addBuyer(fullBuyer);

    // Save to Firebase Firestore cloud database
    try {
      await firebaseService.saveBuyer(fullBuyer);
    } catch (e) {
      console.warn('Firebase buyer save warning:', e);
    }

    // Sync with MongoDB API
    try {
      await fetchJson<Buyer>('/api/buyers', { method: 'POST', body: JSON.stringify(fullBuyer) }, fullBuyer);
    } catch (e) {}

    return fullBuyer;
  },
  deleteBuyer: async (id: string) => {
    // Delete from LocalStorage
    mockRepository.deleteBuyer(id);

    // Delete from Firebase Firestore
    try {
      await firebaseService.deleteBuyer(id);
    } catch (e) {
      console.warn('Firebase buyer delete warning:', e);
    }

    // Delete from MongoDB
    try {
      await fetchJson<{ success: boolean }>('/api/buyers', { method: 'DELETE', body: JSON.stringify({ id }) }, { success: true });
    } catch (e) {}

    return { success: true };
  },
  patchBuyer: async (id: string, updates: Partial<Buyer>) => {
    mockRepository.updateBuyer(id, updates);
    try {
      await firebaseService.updateBuyer(id, updates);
    } catch (e) {}
    try {
      await fetchJson<Buyer>('/api/buyers', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as Buyer);
    } catch (e) {}
    return { id, ...updates } as Buyer;
  },

  // Departments
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
    try {
      await fetchJson<Department>('/api/departments', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as Department);
    } catch (e) {}
    return { id, ...updates } as Department;
  },

  // Articles
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

  // Orders
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

    // Save to local persistent repository
    mockRepository.addBuyerOrder(fullOrder);

    // Save to Firebase Firestore cloud database
    try {
      await firebaseService.saveOrder(fullOrder);
    } catch (e) {
      console.warn('Firebase order save warning:', e);
    }

    // Sync with MongoDB API
    try {
      await fetchJson<BuyerOrder>('/api/orders', { method: 'POST', body: JSON.stringify(fullOrder) }, fullOrder);
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return fullOrder;
  },
  updateBuyerOrder: async (id: string, updates: Partial<BuyerOrder>) => {
    mockRepository.updateBuyerOrder(id, updates);
    try {
      await firebaseService.updateOrder(id, updates);
    } catch (e) {}
    try {
      await fetchJson<BuyerOrder>('/api/orders', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as BuyerOrder);
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return { id, ...updates } as BuyerOrder;
  },
  deleteBuyerOrder: async (id: string) => {
    // Delete from LocalStorage
    mockRepository.deleteBuyerOrder(id);

    // Delete from Firebase Firestore
    try {
      await firebaseService.deleteOrder(id);
    } catch (e) {
      console.warn('Firebase order delete warning:', e);
    }

    // Delete from MongoDB API
    try {
      await fetchJson<{ success: boolean }>('/api/orders', { method: 'DELETE', body: JSON.stringify({ id }) }, { success: true });
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:buyerOrdersUpdated'));
    }

    return { success: true };
  },

  // Production Orders & Flows
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

    try {
      await fetchJson<ProductionFlow>('/api/production-flows', { method: 'POST', body: JSON.stringify(fullFlow) }, fullFlow);
    } catch (e) {}

    return fullFlow;
  },
  updateProductionFlow: async (id: string, updates: Partial<ProductionFlow>) => {
    mockRepository.updateProductionFlow(id, updates);
    try {
      await firebaseService.updateProductionFlow(id, updates);
    } catch (e) {}
    try {
      await fetchJson<ProductionFlow>('/api/production-flows', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as ProductionFlow);
    } catch (e) {}
    return { id, ...updates } as ProductionFlow;
  },
  deleteProductionFlow: async (id: string) => {
    mockRepository.deleteProductionFlow(id);
    try {
      await firebaseService.deleteProductionFlow(id);
    } catch (e) {}
    try {
      await fetchJson<{ success: boolean }>('/api/production-flows', { method: 'DELETE', body: JSON.stringify({ id }) }, { success: true });
    } catch (e) {}
    return { success: true };
  },
  clearProductionFlows: async () => {
    mockRepository.clearProductionFlows();
    return 0;
  },

  // Finished Goods
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

    try {
      await fetchJson<FinishedGoods>('/api/finished-goods', { method: 'POST', body: JSON.stringify(fullFg) }, fullFg);
    } catch (e) {}

    return fullFg;
  },
  updateFinishedGood: async (id: string, updates: Partial<FinishedGoods>) => {
    mockRepository.updateFinishedGood(id, updates);
    try {
      await firebaseService.updateFinishedGood(id, updates);
    } catch (e) {}
    try {
      await fetchJson<FinishedGoods>('/api/finished-goods', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as FinishedGoods);
    } catch (e) {}
    return { id, ...updates } as FinishedGoods;
  },
  deleteFinishedGood: async (id: string) => {
    mockRepository.deleteFinishedGood(id);
    try {
      await firebaseService.deleteFinishedGood(id);
    } catch (e) {}
    try {
      await fetchJson<{ success: boolean }>('/api/finished-goods', { method: 'DELETE', body: JSON.stringify({ id }) }, { success: true });
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

  // Warehouse Stocks
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

    try {
      await fetchJson<WarehouseStock>('/api/warehouse-stocks', { method: 'POST', body: JSON.stringify(fullStock) }, fullStock);
    } catch (e) {}

    return fullStock;
  },
  updateWarehouseStock: async (id: string, updates: Partial<WarehouseStock>) => {
    mockRepository.updateWarehouseStock(id, updates);
    try {
      await firebaseService.updateWarehouseStock(id, updates);
    } catch (e) {}
    try {
      await fetchJson<WarehouseStock>('/api/warehouse-stocks', { method: 'PATCH', body: JSON.stringify({ id, updates }) }, { id, ...updates } as WarehouseStock);
    } catch (e) {}
    return { id, ...updates } as WarehouseStock;
  },
  deleteWarehouseStock: async (id: string) => {
    mockRepository.deleteWarehouseStock(id);
    try {
      await firebaseService.deleteWarehouseStock(id);
    } catch (e) {}
    try {
      await fetchJson<{ success: boolean }>('/api/warehouse-stocks', { method: 'DELETE', body: JSON.stringify({ id }) }, { success: true });
    } catch (e) {}
    return { success: true };
  },

  // Material Receivals
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

    try {
      await fetchJson<MaterialReceival>('/api/material-receivals', { method: 'POST', body: JSON.stringify(fullReceival) }, fullReceival);
    } catch (e) {}

    return fullReceival;
  },

  transferWarehouseStock: async (payload: { itemId: string; fromSection: string; toSection: string; quantity: number }) => {
    try {
      return await fetchJson<{ success: boolean }>('/api/warehouse-stocks/transfer', { method: 'POST', body: JSON.stringify(payload) }, { success: true });
    } catch (e) {
      return { success: true };
    }
  },

  clearFinishedGoods: async () => {
    mockRepository.clearFinishedGoods();
    return 0;
  },
};
