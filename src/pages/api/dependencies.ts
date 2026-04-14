import type { APIRoute } from 'astro';
import { cache } from '../../lib/cache';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  if (!pkg ) return new Response('Package and version required', { status: 400 });

  const cacheKey = `dependencies:${pkg}`;
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
  
  if (res.status === 404) {
    return new Response('Package not found', { status: 404 });
  }
  const json = await res.json();
  
  const { latest } = json;
  const { version, pubspec, archive_url: archiveUrl } = latest;

  const headRes = await fetch(archiveUrl, { method: 'HEAD' });
    
  if (!headRes.ok) {
    throw new Error('Archive not found');
  }

  const contentLength = headRes.headers.get('content-length');
  const sizeInBytes = contentLength ? parseInt(contentLength, 10) : 0;

  const { description, dependencies } = pubspec;

  const result = { dependencies: Object.keys(dependencies || {}).filter((dep) => !['flutter', 'flutter_test', 'sky_engine', 'flutter_driver'].includes(dep)), version, description, size: sizeInBytes };
  
  cache.set(cacheKey, result);

  return new Response(JSON.stringify(result), {
    headers: { 
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
};
