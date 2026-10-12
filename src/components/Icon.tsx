type Name = 'flow' | 'upload' | 'shield' | 'file' | 'image' | 'code' | 'data' | 'arrow' | 'download' | 'check' | 'close' | 'sun' | 'lock' | 'globe' | 'moon' | 'device' | 'alert' | 'info';
const paths: Record<Name, string> = {
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11', device: 'M3 4h18v13H3zM8 21h8M12 17v4',
  alert: 'm12 3 10 18H2zM12 9v5m0 3h.01', info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 11v6m0-10h.01',
  flow: 'M5 5h14v4H9v4h8v4H9v4H5z', upload: 'M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4',
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6', file: 'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6',
  image: 'M3 4h18v16H3zM3 16l6-6 5 5 3-3 4 4M16 8h.01', code: 'm8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16',
  data: 'M4 4h16v16H4zM4 9h16M9 4v16M4 14h16', arrow: 'M4 12h16m-6-6 6 6-6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1', lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
};
export function Icon({ name, size = 20 }: { name: Name; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
