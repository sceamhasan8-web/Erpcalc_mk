import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { WarehouseStock } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const stocks = await WarehouseStock.find().lean();
      return new Response(JSON.stringify(stocks || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/warehouse-stocks fallback:', err);
  }

  const fallbackStocks = mockRepository.getWarehouseStocks();
  return new Response(JSON.stringify(fallbackStocks), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      body.id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    mockRepository.addWarehouseStock(body);

    const conn = await connectToDatabase();
    if (conn) {
      const stock = new WarehouseStock(body);
      const created = await stock.save();
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
    console.warn('API POST /api/warehouse-stocks fallback:', err?.message || err);
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

    mockRepository.updateWarehouseStock(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await WarehouseStock.findOneAndUpdate({ id }, updates, { new: true }).lean();
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

    mockRepository.deleteWarehouseStock(id);

    const conn = await connectToDatabase();
    if (conn) {
      await WarehouseStock.deleteOne({ id });
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
