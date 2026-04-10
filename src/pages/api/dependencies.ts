import type { APIRoute } from 'astro';
import yaml from 'js-yaml';

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  const version = url.searchParams.get('version');
  if (!pkg || !version) return new Response('Package and version required', { status: 400 });

  const res = await fetch(`https://pub.dev/api/packages/${pkg}/versions/${version}/pubspec.yaml`);
  const yamlText = await res.text();
  const pubspec = yaml.load(yamlText) as any;

  const deps = { ...pubspec.dependencies, ...pubspec.dev_dependencies };
  const depNames = Object.keys(deps).filter(
    dep => !['flutter', 'flutter_test', 'sky_engine', 'flutter_driver'].includes(dep)
  );

  return new Response(JSON.stringify({ dependencies: depNames }), {
    headers: { 'Content-Type': 'application/json' }
  });
};