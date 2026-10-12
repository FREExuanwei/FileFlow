export function safeOutputName(name: string, extension: string): string {
  const basename = name.split(/[\\/]/).pop() ?? '';
  let stem = basename.replace(/\.[^.]*$/, '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[<>:"/\\|?*]/g, '_');
  stem = Array.from(stem, char => char.charCodeAt(0) < 32 ? '_' : char).join('').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 120);
  if (!stem) stem = 'converted';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) stem = `_${stem}`;
  const suffix = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!suffix) throw new Error('Invalid output extension.');
  return `${stem}.${suffix}`;
}
