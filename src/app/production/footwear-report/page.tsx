"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import FootwearProductionReportPage from '@/features/production/FootwearProductionReportPage';
import { getProductionMode } from '@/lib/productionMode';

export default function FootwearReportRoute() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const mode = getProductionMode();
    if (mode !== 'footwear') {
      router.replace('/production');
      return;
    }
    setIsAllowed(true);
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return <FootwearProductionReportPage />;
}
