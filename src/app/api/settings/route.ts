import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { AppSettings } from '@/models/schemas';

// In-memory fallback if MongoDB is not connected
const memorySettings: Record<string, any> = {};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  try {
    const conn = await connectToDatabase();
    if (conn) {
      if (key) {
        const item: any = await AppSettings.findOne({ key }).lean();
        if (item) {
          return new Response(JSON.stringify(item.value), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          });
        }
      } else {
        const all: any[] = (await AppSettings.find().lean()) || [];
        const mapped = all.reduce((acc: any, cur: any) => {
          acc[cur.key] = cur.value;
          return acc;
        }, {});
        return new Response(JSON.stringify(mapped), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
    }
  } catch (err) {
    console.warn('API GET /api/settings error, using fallback:', err);
  }

  // Fallback to in-memory store
  if (key) {
    return new Response(JSON.stringify(memorySettings[key] || null), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify(memorySettings), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing key' }), { status: 400 });
    }

    // Save in memory
    memorySettings[key] = value;

    try {
      const conn = await connectToDatabase();
      if (conn) {
        const updated: any = await AppSettings.findOneAndUpdate(
          { key },
          { key, value, updatedAt: new Date().toISOString() },
          { upsert: true, new: true }
        ).lean();

        return new Response(JSON.stringify(updated?.value ?? value), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (dbErr) {
      console.warn('MongoDB save settings fallback:', dbErr);
    }

    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Failed to save settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
