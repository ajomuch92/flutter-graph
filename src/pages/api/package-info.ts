import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  if (!pkg) return new Response('Package required', { status: 400 });

  const res = await fetch(`https://pub.dev/api/packages/${pkg}`);
  if (res.status === 404) return new Response('Package not found', { status: 404 });
  if (!res.ok) return new Response('Error fetching package info', { status: 500 });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
};