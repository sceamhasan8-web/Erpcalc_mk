import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { BuyerOrder } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const orders = await BuyerOrder.find().lean();
      return new Response(JSON.stringify(orders || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/orders fallback:', err);
  }

  const fallbackOrders = mockRepository.getBuyerOrders();
  return new Response(JSON.stringify(fallbackOrders), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      body.id = `bo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!body.createdAt) {
      body.createdAt = new Date().toISOString();
    }

    mockRepository.addBuyerOrder(body);

    const conn = await connectToDatabase();
    if (conn) {
      const order = new BuyerOrder(body);
      const created = await order.save();
      return new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.warn('API POST /api/orders fallback:', err?.message || err);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, updates } = await request.json();
    if (!id || !updates) {
      return new Response(JSON.stringify({ message: 'Missing id or updates' }), { status: 400 });
    }

    mockRepository.updateBuyerOrder(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await BuyerOrder.findOneAndUpdate({ id }, updates, { new: true }).lean();
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

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ message: 'Missing id' }), { status: 400 });
    }

    mockRepository.deleteBuyerOrder(id);

    const conn = await connectToDatabase();
    if (conn) {
      await BuyerOrder.deleteOne({ id });
    }

    return new Response(JSON.stringify({ success: true }), {
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
