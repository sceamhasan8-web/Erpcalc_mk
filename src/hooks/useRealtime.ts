"use client";

import { useEffect, useState } from 'react';
import { subscribeToCollection, firebaseService } from '@/services/firebaseService';
import type {
  Buyer,
  Department,
  BuyerOrder,
  ProductionFlow,
  FinishedGoods,
  WarehouseStock,
} from '@/types';

export function useRealtimeCollection<T>(
  collectionName: string,
  fallbackData: T[] = []
): { data: T[]; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T[]>(fallbackData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToCollection<T>(
      collectionName,
      (items) => {
        if (isMounted) {
          if (items.length > 0) {
            setData(items);
          }
          setLoading(false);
        }
      },
      (err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [collectionName]);

  return { data, loading, error };
}

export function useRealtimeOrders(fallback: BuyerOrder[] = []) {
  return useRealtimeCollection<BuyerOrder>('orders', fallback);
}

export function useRealtimeBuyers(fallback: Buyer[] = []) {
  return useRealtimeCollection<Buyer>('buyers', fallback);
}

export function useRealtimeProductionFlows(fallback: ProductionFlow[] = []) {
  return useRealtimeCollection<ProductionFlow>('productionFlows', fallback);
}

export function useRealtimeWarehouseStocks(fallback: WarehouseStock[] = []) {
  return useRealtimeCollection<WarehouseStock>('warehouseStocks', fallback);
}

export function useRealtimeFinishedGoods(fallback: FinishedGoods[] = []) {
  return useRealtimeCollection<FinishedGoods>('finishedGoods', fallback);
}

export function useRealtimeDepartments(fallback: Department[] = []) {
  return useRealtimeCollection<Department>('departments', fallback);
}
