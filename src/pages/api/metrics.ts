import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  if (!pkg) return new Response('Package required', { status: 400 });

  try {
    const res = await fetch(`https://pub.dev/api/packages/${pkg}/metrics`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return new Response(JSON.stringify({
      likes: data.likes ?? 0,
      popularity: data.popularityScore?.toFixed(2) ?? 'N/A',
      pubPoints: data.grantedPubPoints ?? 0,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ likes: '?', popularity: '?', pubPoints: '?' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};