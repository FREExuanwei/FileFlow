export function privacyViolations(requests,storage){
  const errors=[];
  for(const record of requests){let url;try{url=new URL(record.url);}catch{errors.push('invalid-url');continue;}
    if(url.origin!=='http://127.0.0.1:4174')errors.push('external');
    if(record.method!=='GET')errors.push('non-get');
    if(['websocket','eventsource','ping'].includes(record.type))errors.push('transport');
    if(url.search||!(/^(?:\/$|\/assets\/[^/]+\.(?:js|mjs|css)$|\/favicon\.svg$|\/pdf-assets\/[\w./-]+$)/.test(url.pathname)))errors.push('non-static');
  }
  if(storage){if(Object.entries(storage.local).some(([key,value])=>key==='fileflow-theme'?!['light','dark','system'].includes(value):key==='fileflow.language'?!['en','zh-CN'].includes(value):true))errors.push('local-storage');if(Object.keys(storage.session).length)errors.push('session-storage');if(storage.databases.length)errors.push('indexed-db');if(storage.caches.length)errors.push('cache-storage');if(storage.cookies)errors.push('cookies');}
  return errors;
}
