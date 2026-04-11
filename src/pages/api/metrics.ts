import type { APIRoute } from 'astro';
import { cache } from '../../lib/cache';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  if (!pkg) return new Response('Package required', { status: 400 });

  const cacheKey = `metrics:${pkg}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }

  try {
    const res = await fetch(`https://pub.dev/api/packages/${pkg}/metrics`);
    if (!res.ok) throw new Error();
    
    const data = await res.json();
    const result = {
      likes: data?.score?.likeCount ?? 0,
      downloads: data?.score?.downloadCount30Days ?? 0,
      pubPoints: data?.score?.grantedPoints ?? 0,
    };

    cache.set(cacheKey, result);

    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    });
  } catch {
    const fallback = { likes: '?', downloads: '?', pubPoints: '?' };
    return new Response(JSON.stringify(fallback), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};