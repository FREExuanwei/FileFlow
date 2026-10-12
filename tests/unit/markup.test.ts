import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, markdownToHtml, sanitizeHtml } from '../../src/converters/markup/transform';

describe('safe markup conversion', () => {
  it('keeps headings, emphasis, links, code and simple tables', () => {
    const md = htmlToMarkdown('<h1>Demo</h1><p><strong>Bold</strong> <em>Italic</em> <a href="https://example.com">link</a></p><ul><li>Item</li></ul><pre><code>const x = 1;</code></pre><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>');
    expect(md).toContain('# Demo');
    expect(md).toContain('**Bold**');
    expect(md).toContain('[link](https://example.com)');
    expect(md).toContain('| A | B |');
    expect(md).toContain('const x = 1;');
  });
  it('renders Markdown as safe semantic HTML', () => {
    expect(markdownToHtml('# Demo\n\n**Bold**')).toContain('<h1>Demo</h1>');
    expect(markdownToHtml('# Demo\n\n**Bold**')).toContain('<strong>Bold</strong>');
  });
  it('strips scripts, handlers, SVG, active URLs and external resources', () => {
    const clean = sanitizeHtml('<script>alert(1)</script><img src="https://example.com/track" onerror="alert(1)"><svg onload="alert(1)"><a href="javascript:alert(1)">x</a></svg><p onclick="alert(1)" style="background:url(https://example.com)">safe</p><a href="javascript:alert(1)">bad</a><iframe src="https://example.com"></iframe>');
    expect(clean).toContain('safe');
    expect(clean).not.toMatch(/script|onerror|onclick|onload|<svg|<img|<iframe|javascript:|style=/i);
  });
  it('cannot embed unsafe raw HTML or remote images through Markdown', () => {
    const html = markdownToHtml('<script>alert(1)</script>\n\n![x](https://example.com/track)\n\n[x](javascript:alert(1))');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href="javascript:');
  });
});
