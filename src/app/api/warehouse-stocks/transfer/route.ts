import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { WarehouseStock } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function POST(request: NextRequest) {
  try {
    const { itemId, fromSection, toSection, quantity } = await request.json();

    if (!itemId || !fromSection || !toSection || !quantity) {
      return new Response(JSON.stringify({ message: 'Missing transfer payload' }), { status: 400 });
    }

    if (fromSection === toSection) {
      return new Response(JSON.stringify({ message: 'Source and destination must differ.' }), { status: 400 });
    }

    // Process in mockRepository / local state
    const localStock = mockRepository.getWarehouseStocks().find((s) => s.id === itemId);
    if (localStock) {
      mockRepository.updateWarehouseStock(itemId, {
        quantity: Math.max(0, (localStock.quantity ?? 0) - quantity),
      });

      const existingTarget = mockRepository.getWarehouseStocks().find(
        (s) => s.item === localStock.item && s.location === toSection
      );

      if (existingTarget) {
        mockRepository.updateWarehouseStock(existingTarget.id, {
          quantity: (existingTarget.quantity ?? 0) + quantity,
        });
      } else {
        mockRepository.addWarehouseStock({
          id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sku: localStock.sku,
          item: localStock.item,
          quantity,
          unit: localStock.unit,
          reorderLevel: localStock.reorderLevel ?? 50,
          location: toSection,
          category: localStock.category,
        });
      }
    }

    // Try MongoDB sync if available
    try {
      const conn = await connectToDatabase();
      if (conn) {
        const stock: any = await WarehouseStock.findOne({ id: itemId }).lean();
        if (stock) {
          await WarehouseStock.findOneAndUpdate(
            { id: itemId },
            { quantity: Math.max(0, (stock.quantity ?? 0) - quantity) }
          );

          const existingTarget: any = await WarehouseStock.findOne({
            item: stock.item,
            location: toSection,
          }).lean();

          if (existingTarget) {
            await WarehouseStock.findOneAndUpdate(
              { id: existingTarget.id },
              { quantity: (existingTarget.quantity ?? 0) + quantity }
            );
          } else {
            const transferStock = new WarehouseStock({
              id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              sku: stock.sku,
              item: stock.item,
              quantity,
              unit: stock.unit,
              reorderLevel: stock.reorderLevel ?? 50,
              location: toSection,
              category: stock.category,
            });
            await transferStock.save();
          }
        }
      }
    } catch (dbErr) {
      console.warn('MongoDB transfer sync warning:', dbErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.warn('API /api/warehouse-stocks/transfer error:', err);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
