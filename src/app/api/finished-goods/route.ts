import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { FinishedGood } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const finishedGoods = await FinishedGood.find().lean();
      return new Response(JSON.stringify(finishedGoods || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/finished-goods fallback:', err);
  }

  const fallbackFinished = mockRepository.getFinishedGoods();
  return new Response(JSON.stringify(fallbackFinished), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      body.id = `fg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    mockRepository.addFinishedGood(body);

    const conn = await connectToDatabase();
    if (conn) {
      const finishedGood = new FinishedGood(body);
      const created = await finishedGood.save();
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
    console.warn('API POST /api/finished-goods error:', err);
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

    mockRepository.updateFinishedGood(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await FinishedGood.findOneAndUpdate({ id }, updates, { new: true }).lean();
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

    mockRepository.deleteFinishedGood(id);

    const conn = await connectToDatabase();
    if (conn) {
      await FinishedGood.deleteOne({ id });
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
