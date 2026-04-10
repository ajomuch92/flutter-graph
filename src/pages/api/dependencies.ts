import type { APIRoute } from 'astro';
import { get } from 'complete-js-utils';
import { marked } from 'marked';

marked.setOptions({ async: false });

export const GET: APIRoute = async ({ url }) => {
    const pkg = url.searchParams.get('package');
    const version = url.searchParams.get('version');
    if (!pkg || !version) return new Response('Package and version required', { status: 400 });

    const res = await fetch(`https://pub.dev/api/packages/${pkg}/metrics`);
    const json = await res.json();

    const sections = get(json, 'scorecard.panaReport.report.sections', [])
    const dependencySection = sections.find((s: any) => s.id === 'dependency');
    if (!dependencySection) {
        return new Response('Dependencies section not found', { status: 404 });
    }

    const summary: string = get(dependencySection, 'summary', '');

    if (!summary) {
        return new Response('No dependencies found', { status: 404 });
    }

    if (summary.includes('No dependencies')) {
        return new Response(JSON.stringify({ dependencies: [] }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const firstColumn = extractFirstTableFirstColumn(summary);

    const depNames = firstColumn;

    return new Response(JSON.stringify({ dependencies: depNames }), {
        headers: { 'Content-Type': 'application/json' }
    });
};

function extractFirstTableFirstColumn(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const cleanString = (text: string): string => {
    const match = text.match(/\w+/g);
    return match ? match.join('') : '';
  };
  // Find first table token
  for (const token of tokens) {
    if (token.type === 'table') {
      // token has 'header' and 'rows'
      // first column: for header, take first cell; for each row, take first cell
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