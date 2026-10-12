import {safeOutputName} from '../../core/files/names';
import {getDesktopPlatform} from '../platform';
export class Phase5OutputAdapter{
  private urls=new Map<string,ReturnType<typeof setTimeout>>();
  private cancellations:Array<()=>void>=[];
  save(blob:Blob,filename:string){const desktop=getDesktopPlatform();if(desktop){this.cancellations.push(desktop.save(blob,filename));return;}const url=URL.createObjectURL(blob),anchor=document.createElement('a'),release=()=>{const timer=this.urls.get(url);if(timer!==undefined){clearTimeout(timer);this.urls.delete(url);URL.revokeObjectURL(url);}};this.urls.set(url,setTimeout(release,1000));try{anchor.href=url;anchor.download=safeOutputName(filename,filename.split('.').pop()??'txt');document.body.append(anchor);anchor.click();}catch(error){release();throw error;}finally{anchor.remove();}}
  dispose(){this.cancellations.forEach(cancel=>cancel());this.cancellations=[];for(const [url,timer]of this.urls){clearTimeout(timer);URL.revokeObjectURL(url);}this.urls.clear();}
}
