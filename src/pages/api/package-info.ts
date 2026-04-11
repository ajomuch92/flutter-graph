import type { APIRoute } from 'astro';
import { cache } from '../../lib/cache';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  if (!pkg) return new Response('Package required', { status: 400 });

  const cacheKey = `package-info:${pkg}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }

  const res = await fetch(`https://pub.dev/api/packages/${pkg}`);
  if (res.status === 404) return new Response('Package not found', { status: 404 });
  if (!res.ok) return new Response('Error fetching package info', { status: 500 });
  
  const data = await res.json();
  
  cache.set(cacheKey, data);

  return new Response(JSON.stringify(data), {
    headers: { 
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
};