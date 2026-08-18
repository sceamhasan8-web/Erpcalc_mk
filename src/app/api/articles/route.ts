import { connectToDatabase } from '@/lib/mongoose';
import { Article } from '@/models/schemas';
import { mockRepository } from '@/repositories/mockRepository';

export async function GET() {
  try {
    const conn = await connectToDatabase();
    if (conn) {
      const articles = await Article.find().lean();
      return new Response(JSON.stringify(articles || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('API GET /api/articles fallback:', err);
  }

  const fallbackArticles = mockRepository.getArticles();
  return new Response(JSON.stringify(fallbackArticles), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
