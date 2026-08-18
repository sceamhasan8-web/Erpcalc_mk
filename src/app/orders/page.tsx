"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProductionMode } from '@/lib/productionMode';
import { FootwearProductionPage } from '@/features/orders/FootwearProductionPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { PageSkeleton } from '@/components/PageSkeleton';

export default function OrdersRoute() {
  const router = useRouter();
  const [mode, setMode] = useState<'normal' | 'footwear'>(() => getProductionMode());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMode(getProductionMode());
    const handleChange = () => setMode(getProductionMode());
    window.addEventListener('productionModeChange', handleChange);
    setIsReady(true);
    return () => window.removeEventListener('productionModeChange', handleChange);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (mode === 'footwear') {
      router.replace('/orders/footwear-production');
    }
  }, [isReady, mode, router]);

  if (!isReady) {
    return <PageSkeleton />;
  }

  return mode === 'footwear' ? <PageSkeleton /> : <OrdersPage />;
}
