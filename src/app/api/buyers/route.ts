import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Buyer } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';
import { sanitizePayload } from '@/lib/security';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const buyers = await Buyer.find().lean();
      return new Response(JSON.stringify(buyers || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/buyers fallback:', err);
  }

  const fallbackBuyers = mockRepository.getBuyers();
  return new Response(JSON.stringify(fallbackBuyers), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const body = sanitizePayload(rawBody);
    if (!body.id) {
      body.id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!body.createdAt) {
      body.createdAt = new Date().toISOString();
    }

    // Save locally
    mockRepository.addBuyer(body);

    const conn = await connectToDatabase();
    if (conn) {
      const buyer = new Buyer(body);
      const created = await buyer.save();
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
    console.warn('API POST /api/buyers fallback:', err?.message || err);
    try {
      const fallbackBody = await request.json().catch(() => ({}));
      if (!fallbackBody.id) fallbackBody.id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      mockRepository.addBuyer(fallbackBody);
      return new Response(JSON.stringify(fallbackBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rawData = await request.json();
    const { id, updates: rawUpdates } = sanitizePayload(rawData);
    const updates = sanitizePayload(rawUpdates);
    if (!id || !updates) {
      return new Response(JSON.stringify({ message: 'Missing id or updates' }), { status: 400 });
    }

    mockRepository.updateBuyer(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await Buyer.findOneAndUpdate({ id }, updates, { new: true }).lean();
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

    mockRepository.deleteBuyer(id);

    const conn = await connectToDatabase();
    if (conn) {
      await Buyer.deleteOne({ id });
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
