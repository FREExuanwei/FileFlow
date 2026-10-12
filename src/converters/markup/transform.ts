import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','strong','b','em','i','s','del','ul','ol','li','blockquote','pre','code','a','table','thead','tbody','tfoot','tr','th','td','div','span','sup','sub'],
    ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan', 'start'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
  });
}
const parser = new MarkdownIt({ html: false, linkify: false, typographer: false });
export function markdownToHtml(markdown: string): string { return sanitizeHtml(parser.render(markdown)); }
export function htmlToMarkdown(html: string, options: { preserveCodeLanguage?: boolean } = {}): string {
  const service = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  if (options.preserveCodeLanguage) {
    const source = new DOMParser().parseFromString(html, 'text/html');
    const languages = [...source.querySelectorAll('pre')].map(pre => /^language-([a-zA-Z0-9_+-]{1,32})$/.exec(pre.querySelector('code')?.className ?? '')?.[1] ?? '');
    let codeIndex = 0;
    service.addRule('ai-code', { filter: 'pre', replacement: (_content, node) => {
      const content = node.textContent ?? '', language = languages[codeIndex++] ?? '';
      const maxFence = Math.max(2, ...[...content.matchAll(/`+/g)].map(m => m[0].length));
      const fence = '`'.repeat(maxFence + 1);
      return `\n\n${fence}${language}\n${content}${content.endsWith('\n') ? '' : '\n'}${fence}\n\n`;
    } });
  }
  service.addRule('simple-table', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = node as HTMLTableElement;
      const rows = Array.from(table.rows);
      if (!rows.length) return '';
      const cells = rows.map(row => Array.from(row.cells));
      if (cells.some(row => row.some(cell => cell.colSpan > 1 || cell.rowSpan > 1))) return `\n\n${rows.map(row => Array.from(row.cells).map(cell => cell.textContent?.trim()).join(' — ')).join('\n')}\n\n`;
      const width = Math.max(...cells.map(row => row.length));
      const lines = cells.map(row => `| ${Array.from({ length: width }, (_, i) => service.turndown(row[i]?.innerHTML ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ')).join(' | ')} |`);
      lines.splice(1, 0, `| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
      return `\n\n${lines.join('\n')}\n\n`;
    },
  });
  return service.turndown(sanitizeHtml(html)).trim() + '\n';
}
