import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { MaterialReceival, WarehouseStock } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const receivals = await MaterialReceival.find().lean();
      return new Response(JSON.stringify(receivals || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/material-receivals fallback:', err);
  }

  const fallbackReceivals = mockRepository.getMaterialReceivals();
  return new Response(JSON.stringify(fallbackReceivals), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      body.id = `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    if (!body.receivedAt) {
      body.receivedAt = new Date().toISOString();
    }

    mockRepository.addMaterialReceival(body);

    // Update warehouse stock in mockRepository
    if (body.location) {
      const existing = mockRepository.getWarehouseStocks().find(
        (s) => s.item === body.item && s.location === body.location
      );
      if (existing) {
        mockRepository.updateWarehouseStock(existing.id, {
          quantity: (existing.quantity ?? 0) + body.quantity,
        });
      } else {
        mockRepository.addWarehouseStock({
          id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sku: body.sku || `MAT-${Date.now()}`,
          item: body.item,
          quantity: body.quantity,
          unit: body.unit || 'pcs',
          location: body.location,
          category: body.category || 'Material',
          reorderLevel: 50,
        });
      }
    }

    const conn = await connectToDatabase();
    if (conn) {
      const receival = new MaterialReceival(body);
      const created = await receival.save();

      if (created.location) {
        const existingStock = await WarehouseStock.findOne({ item: created.item, location: created.location }).lean();
        if (existingStock) {
          await WarehouseStock.findOneAndUpdate(
            { id: (existingStock as any).id },
            { quantity: ((existingStock as any).quantity ?? 0) + created.quantity },
          );
        } else {
          const stock = new WarehouseStock({
            id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sku: created.sku,
            item: created.item,
            quantity: created.quantity,
            unit: created.unit,
            reorderLevel: 50,
            location: created.location,
            category: 'Material',
          });
          await stock.save();
        }
      }

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
    console.warn('API POST /api/material-receivals error:', err);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
