import type {Format} from '../conversion/types';
let environment:'web'|'desktop'='web';
export function installFileEnvironment(value:'web'|'desktop'){environment=value;}
export function fileEnvironment(){return environment;}
export function fileLimitMiB(format:Format){if(environment==='desktop'&&['pdf','png','jpeg','webp'].includes(format))return 100;return format==='pdf'?40:['png','jpeg','webp'].includes(format)?20:10;}
export function imageHeader(blob:Blob){return(environment==='desktop'?blob.slice(0,1024**2):blob).arrayBuffer();}
