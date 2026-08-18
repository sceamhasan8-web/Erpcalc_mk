import { connectToDatabase } from '@/lib/mongoose';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (!conn) {
      return new Response(JSON.stringify({ ok: false, message: 'MongoDB is disabled or not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, message: 'MongoDB connection successful' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ ok: false, message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
