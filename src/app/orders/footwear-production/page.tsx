"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FootwearProductionPage } from '@/features/orders/FootwearProductionPage';
import { getProductionMode } from '@/lib/productionMode';

export default function FootwearProductionRoute() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const mode = getProductionMode();
    if (mode !== 'footwear') {
      router.replace('/orders');
      return;
    }
    setIsAllowed(true);
  }, [router]);

  if (!isAllowed) {
    return null;
  }

  return <FootwearProductionPage />;
}
