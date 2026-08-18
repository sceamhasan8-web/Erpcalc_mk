"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToCollection, firebaseService } from '@/services/firebaseService';
import { mockRepository } from '@/repositories/mockRepository';
import type {
  Buyer,
  BuyerOrder,
  ProductionFlow,
  Department,
  Article,
  WarehouseStock,
  FinishedGoods,
  MaterialReceival,
} from '@/types';

interface RealtimeContextType {
  isLiveConnected: boolean;
  lastSyncTime: Date | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isLiveConnected: false,
  lastSyncTime: null,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dispatcher helper to inform all components
    const notifyUpdate = (eventName: string, data: any) => {
      setLastSyncTime(new Date());
      setIsLiveConnected(true);
      window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
      window.dispatchEvent(new CustomEvent('erp:dataSync', { detail: { event: eventName, data } }));
    };

    // 1. Subscribe to Buyer Orders
    const unsubOrders = subscribeToCollection<BuyerOrder>('orders', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setBuyerOrders(data);
        notifyUpdate('erp:buyerOrdersUpdated', data);
      }
    });

    // 2. Subscribe to Buyers
    const unsubBuyers = subscribeToCollection<Buyer>('buyers', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setBuyers(data);
        notifyUpdate('erp:buyersUpdated', data);
      }
    });

    // 3. Subscribe to Production Flows
    const unsubFlows = subscribeToCollection<ProductionFlow>('productionFlows', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setProductionFlows(data);
        notifyUpdate('erp:productionFlowsUpdated', data);
      }
    });

    // 4. Subscribe to Departments
    const unsubDepts = subscribeToCollection<Department>('departments', (data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        mockRepository.setDepartments(data);
        notifyUpdate('erp:departmentsUpdated', data);
      }
    });

    // 5. Subscribe to Articles
    const unsubArticles = subscribeToCollection<Article>('articles', (data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        mockRepository.setArticles(data);
        notifyUpdate('erp:articlesUpdated', data);
      }
    });

    // 6. Subscribe to Warehouse Stocks
    const unsubStocks = subscribeToCollection<WarehouseStock>('warehouseStocks', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setWarehouseStocks(data);
        notifyUpdate('erp:warehouseStocksUpdated', data);
      }
    });

    // 7. Subscribe to Finished Goods
    const unsubGoods = subscribeToCollection<FinishedGoods>('finishedGoods', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setFinishedGoods(data);
        notifyUpdate('erp:finishedGoodsUpdated', data);
      }
    });

    // 8. Subscribe to Material Receivals
    const unsubReceivals = subscribeToCollection<MaterialReceival>('materialReceivals', (data) => {
      if (data && Array.isArray(data)) {
        mockRepository.setMaterialReceivals(data);
        notifyUpdate('erp:materialReceivalsUpdated', data);
      }
    });

    // 9. Subscribe to Production Unit Settings (Multi-Device Sync)
    const unsubProdUnit = firebaseService.subscribeSettings<any>('productionUnit', (data) => {
      if (data && data.defaultUnit) {
        try {
          localStorage.setItem('ec-production-unit-settings', JSON.stringify(data));
          localStorage.setItem('ec-production-unit', data.defaultUnit);
        } catch {}
        notifyUpdate('erp:productionUnitUpdated', data);
        notifyUpdate('erp:unitSettingsUpdated', data);
      }
    });

    // 10. Subscribe to Material Unit Settings (Multi-Device Sync)
    const unsubMatUnit = firebaseService.subscribeSettings<any>('materialUnit', (data) => {
      if (data && data.defaultMaterialUnit) {
        try {
          localStorage.setItem('ec-material-unit-settings', JSON.stringify(data));
          localStorage.setItem('ec-material-unit', data.defaultMaterialUnit);
        } catch {}
        notifyUpdate('erp:materialUnitUpdated', data);
        notifyUpdate('erp:unitSettingsUpdated', data);
      }
    });

    setIsLiveConnected(true);

    return () => {
      unsubOrders();
      unsubBuyers();
      unsubFlows();
      unsubDepts();
      unsubArticles();
      unsubStocks();
      unsubGoods();
      unsubReceivals();
      unsubProdUnit();
      unsubMatUnit();
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ isLiveConnected, lastSyncTime }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeSync() {
  return useContext(RealtimeContext);
}
