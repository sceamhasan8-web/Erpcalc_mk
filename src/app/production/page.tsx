"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProductionPage from '@/features/production/ProductionPage';
import FootwearProductionReportPage from '@/features/production/FootwearProductionReportPage';
import { getProductionMode } from '@/lib/productionMode';

export default function Page() {
  const router = useRouter();
  const [mode, setMode] = useState<'normal' | 'footwear'>(() => getProductionMode());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setMode(getProductionMode());
    const handleModeChange = () => setMode(getProductionMode());
    window.addEventListener('productionModeChange', handleModeChange);
    setIsReady(true);
    return () => window.removeEventListener('productionModeChange', handleModeChange);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (mode === 'footwear') {
      router.replace('/production/footwear-report');
    }
  }, [isReady, mode, router]);

  if (!isReady) {
    return null;
  }

  return mode === 'footwear' ? null : <ProductionPage />;
}
