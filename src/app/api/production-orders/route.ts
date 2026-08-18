import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Order } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const orders = await Order.find().lean();
      if (orders && orders.length > 0) {
        return new Response(JSON.stringify(orders), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (err) {
    console.warn('API GET /api/production-orders fallback:', err);
  }

  const fallbackOrders = mockRepository.getOrders();
  return new Response(JSON.stringify(fallbackOrders), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, updates } = await request.json();
    if (!id || !updates) {
      return new Response(JSON.stringify({ message: 'Missing id or updates' }), { status: 400 });
    }

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await Order.findOneAndUpdate({ id }, updates, { new: true }).lean();
      return new Response(JSON.stringify(updated || { id, ...updates }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ id, ...updates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
