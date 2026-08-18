import { NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Department } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const departments = await Department.find().lean();
      return new Response(JSON.stringify(departments || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/departments fallback:', err);
  }

  const fallbackDepts = mockRepository.getDepartments();
  return new Response(JSON.stringify(fallbackDepts), {
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

    mockRepository.updateDepartment(id, updates);

    const conn = await connectToDatabase();
    if (conn) {
      const updated = await Department.findOneAndUpdate({ id }, updates, { new: true }).lean();
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
