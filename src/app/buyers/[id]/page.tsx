"use client";

import { useParams } from 'next/navigation';
import { BuyerDetailPage } from '@/features/buyers/BuyerDetailPage';

export default function BuyerDetailRoute() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  return <BuyerDetailPage buyerId={id} />;
}
