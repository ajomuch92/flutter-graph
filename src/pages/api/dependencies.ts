import type { APIRoute } from 'astro';
import { cache } from '../../lib/cache';
import { get } from 'complete-js-utils';
import { marked } from 'marked';

marked.setOptions({ async: false });

export const GET: APIRoute = async ({ url }) => {
  const pkg = url.searchParams.get('package');
  const version = url.searchParams.get('version');
  if (!pkg || !version) return new Response('Package and version required', { status: 400 });

  const cacheKey = `dependencies:${pkg}:${version}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'HIT'
      }
    });
  }

  const res = await fetch(`https://pub.dev/api/packages/${pkg}/metrics`);
  const json = await res.json();

  const sections = get(json, 'scorecard.panaReport.report.sections', []);
  const dependencySection = sections.find((s: any) => s.id === 'dependency');
  
  if (!dependencySection) {
    return new Response('Dependencies section not found', { status: 404 });
  }

  const summary: string = get(dependencySection, 'summary', '');

  if (!summary) {
    return new Response('No dependencies found', { status: 404 });
  }

  if (summary.includes('No dependencies')) {
    const result = { dependencies: [] };
    cache.set(cacheKey, result);
    return new Response(JSON.stringify(result), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    });
  }

  const firstColumn = extractFirstTableFirstColumn(summary);
  const result = { dependencies: firstColumn };
  
  cache.set(cacheKey, result);

  return new Response(JSON.stringify(result), {
    headers: { 
      'Content-Type': 'application/json',
      'X-Cache': 'MISS'
    }
  });
};

function extractFirstTableFirstColumn(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const cleanString = (text: string): string => {
    const match = text.match(/\w+/g);
    return match ? match.join('') : '';
  };
  for (const token of tokens) {
    if (token.type === 'table') {
      const firstColumnCells: string[] = [];
      if (token.rows) {
        for (const row of token.rows) {
          if (row.length > 0) {
            firstColumnCells.push(cleanString(`${row[0].text ?? ''}`));
          }
        }
      }
      return [...new Set(firstColumnCells)];
    }
  }
  return [];
}