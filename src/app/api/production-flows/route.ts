import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { ProductionFlow } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const flows = await ProductionFlow.find().lean();
      return new Response(JSON.stringify(flows || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/production-flows fallback:', err);
  }

  const fallbackFlows = mockRepository.getProductionFlows();
  return new Response(JSON.stringify(fallbackFlows), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      body.id = `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!body.updatedAt) {
      body.updatedAt = new Date().toISOString();
    }

    mockRepository.addProductionFlow(body);

    const conn = await connectToDatabase();
    if (conn) {
      const flow = new ProductionFlow(body);
      const created = await flow.save();
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
    console.warn('API POST /api/production-flows fallback:', err?.message || err);
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

    mockRepository.updateProductionFlow(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await ProductionFlow.findOneAndUpdate({ id }, updates, { new: true }).lean();
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

    mockRepository.deleteProductionFlow(id);

    const conn = await connectToDatabase();
    if (conn) {
      await ProductionFlow.deleteOne({ id });
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
