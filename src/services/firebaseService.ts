import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type {
  Buyer,
  Department,
  Article,
  BuyerOrder,
  ProductionFlow,
  FinishedGoods,
  WarehouseStock,
  MaterialReceival,
  OrderProductionPlan,
  Employee,
  DailyManpowerRecord,
} from '@/types';

// Generic subscription helper
export function subscribeToCollection<T>(
  collectionName: string,
  onData: (data: T[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as unknown as T[];
        onData(items);
      },
      (error) => {
        console.warn(`Firestore subscription warning on ${collectionName}:`, error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (error: any) {
    console.warn(`Failed to initialize subscription to ${collectionName}:`, error);
    return () => {};
  }
}

// Generic document subscription
export function subscribeToDocument<T>(
  collectionName: string,
  docId: string,
  onData: (data: T | null) => void
): Unsubscribe {
  try {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onData({ id: docSnap.id, ...docSnap.data() } as unknown as T);
        } else {
          onData(null);
        }
      },
      (error) => {
        console.warn(`Firestore document subscription warning on ${collectionName}/${docId}:`, error?.message || error);
      }
    );
  } catch (e) {
    return () => {};
  }
}

// Helper to recursively strip undefined values (which Firestore rejects)
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj.toISOString();
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return obj;
}

// Generic CRUD operations
export async function getCollectionData<T>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as T[];
  } catch (err) {
    console.warn(`Firestore getCollectionData error on ${collectionName}:`, err);
    return [];
  }
}

export async function saveDocument<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: T
): Promise<void> {
  try {
    if (!docId) return;
    const docRef = doc(db, collectionName, docId);
    const sanitized = sanitizeForFirestore(data);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.error(`Firestore saveDocument error on ${collectionName}/${docId}:`, err);
  }
}

export async function updateDocumentData<T extends DocumentData>(
  collectionName: string,
  docId: string,
  updates: Partial<T>
): Promise<void> {
  try {
    if (!docId) return;
    const docRef = doc(db, collectionName, docId);
    const sanitized = sanitizeForFirestore(updates);
    await updateDoc(docRef, sanitized as any);
  } catch (err) {
    console.error(`Firestore updateDocumentData error on ${collectionName}/${docId}:`, err);
  }
}

export async function removeDocument(collectionName: string, docId: string): Promise<void> {
  try {
    if (!docId) return;
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Firestore removeDocument error on ${collectionName}/${docId}:`, err);
  }
}

// Specialized ERP Real-time Subscriptions
export const firebaseService = {
  isConfigured: isFirebaseConfigured,

  // Buyers
  getBuyers: () => getCollectionData<Buyer>('buyers'),
  subscribeBuyers: (callback: (data: Buyer[]) => void) =>
    subscribeToCollection<Buyer>('buyers', callback),
  saveBuyer: (buyer: Buyer) => {
    const id = buyer.id || `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('buyers', id, { ...buyer, id });
  },
  updateBuyer: (id: string, updates: Partial<Buyer>) =>
    updateDocumentData('buyers', id, updates),
  deleteBuyer: (id: string) => removeDocument('buyers', id),

  // Orders
  getOrders: () => getCollectionData<BuyerOrder>('orders'),
  subscribeOrders: (callback: (data: BuyerOrder[]) => void) =>
    subscribeToCollection<BuyerOrder>('orders', callback),
  saveOrder: (order: BuyerOrder) => {
    const id = order.id || `bo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('orders', id, { ...order, id });
  },
  updateOrder: (id: string, updates: Partial<BuyerOrder>) =>
    updateDocumentData('orders', id, updates),
  deleteOrder: (id: string) => removeDocument('orders', id),

  // Production Flows
  getProductionFlows: () => getCollectionData<ProductionFlow>('productionFlows'),
  subscribeProductionFlows: (callback: (data: ProductionFlow[]) => void) =>
    subscribeToCollection<ProductionFlow>('productionFlows', callback),
  saveProductionFlow: (flow: ProductionFlow) => {
    const id = flow.id || `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('productionFlows', id, { ...flow, id });
  },
  updateProductionFlow: (id: string, updates: Partial<ProductionFlow>) =>
    updateDocumentData('productionFlows', id, updates),
  deleteProductionFlow: (id: string) => removeDocument('productionFlows', id),

  // Departments
  getDepartments: () => getCollectionData<Department>('departments'),
  subscribeDepartments: (callback: (data: Department[]) => void) =>
    subscribeToCollection<Department>('departments', callback),
  saveDepartment: (dept: Department) => {
    const id = dept.id || `dept_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('departments', id, { ...dept, id });
  },
  updateDepartment: (id: string, updates: Partial<Department>) =>
    updateDocumentData('departments', id, updates),

  // Articles
  getArticles: () => getCollectionData<Article>('articles'),
  subscribeArticles: (callback: (data: Article[]) => void) =>
    subscribeToCollection<Article>('articles', callback),
  saveArticle: (art: Article) => {
    const id = art.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('articles', id, { ...art, id });
  },

  // Warehouse Stocks
  getWarehouseStocks: () => getCollectionData<WarehouseStock>('warehouseStocks'),
  subscribeWarehouseStocks: (callback: (data: WarehouseStock[]) => void) =>
    subscribeToCollection<WarehouseStock>('warehouseStocks', callback),
  saveWarehouseStock: (stock: WarehouseStock) => {
    const id = stock.id || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('warehouseStocks', id, { ...stock, id });
  },
  updateWarehouseStock: (id: string, updates: Partial<WarehouseStock>) =>
    updateDocumentData('warehouseStocks', id, updates),
  deleteWarehouseStock: (id: string) => removeDocument('warehouseStocks', id),

  // Finished Goods
  getFinishedGoods: () => getCollectionData<FinishedGoods>('finishedGoods'),
  subscribeFinishedGoods: (callback: (data: FinishedGoods[]) => void) =>
    subscribeToCollection<FinishedGoods>('finishedGoods', callback),
  saveFinishedGood: (fg: FinishedGoods) => {
    const id = fg.id || `fg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('finishedGoods', id, { ...fg, id });
  },
  updateFinishedGood: (id: string, updates: Partial<FinishedGoods>) =>
    updateDocumentData('finishedGoods', id, updates),
  deleteFinishedGood: (id: string) => removeDocument('finishedGoods', id),

  // Material Receivals
  getMaterialReceivals: () => getCollectionData<MaterialReceival>('materialReceivals'),
  subscribeMaterialReceivals: (callback: (data: MaterialReceival[]) => void) =>
    subscribeToCollection<MaterialReceival>('materialReceivals', callback),
  saveMaterialReceival: (rec: MaterialReceival) => {
    const id = rec.id || `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return saveDocument('materialReceivals', id, { ...rec, id });
  },

  // Production Plans
  getProductionPlans: () => getCollectionData<OrderProductionPlan>('productionPlans'),
  subscribeProductionPlans: (callback: (data: OrderProductionPlan[]) => void) =>
    subscribeToCollection<OrderProductionPlan>('productionPlans', callback),
  saveProductionPlan: (plan: OrderProductionPlan) => {
    const id = plan.id || `plan_${plan.orderId || Date.now()}`;
    return saveDocument('productionPlans', id, { ...plan, id });
  },
  deleteProductionPlan: (id: string) => removeDocument('productionPlans', id),

  // Settings
  subscribeSettings: <T>(settingKey: string, callback: (data: T | null) => void) =>
    subscribeToDocument<T>('settings', settingKey, callback),
  saveSettings: <T extends DocumentData>(settingKey: string, data: T) =>
    saveDocument('settings', settingKey, data),

  // HR Employees (Manpower)
  getEmployees: () => getCollectionData<Employee>('hr_employees'),
  subscribeEmployees: (callback: (data: Employee[]) => void) =>
    subscribeToCollection<Employee>('hr_employees', callback),
  saveEmployee: (emp: Employee) => {
    const id = emp.id || `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return saveDocument('hr_employees', id, { ...emp, id });
  },
  updateEmployee: (id: string, updates: Partial<Employee>) =>
    updateDocumentData('hr_employees', id, updates),
  deleteEmployee: (id: string) => removeDocument('hr_employees', id),

  // HR Daily Section-Wise Manpower Records
  getDailyManpowerRecords: () => getCollectionData<DailyManpowerRecord>('hr_daily_manpower'),
  subscribeDailyManpower: (callback: (data: DailyManpowerRecord[]) => void) =>
    subscribeToCollection<DailyManpowerRecord>('hr_daily_manpower', callback),
  saveDailyManpower: (record: DailyManpowerRecord) => {
    const id = record.date || record.id || new Date().toISOString().split('T')[0];
    return saveDocument('hr_daily_manpower', id, { ...record, id, date: id, updatedAt: new Date().toISOString() });
  },
  deleteDailyManpower: (date: string) => removeDocument('hr_daily_manpower', date),
};
