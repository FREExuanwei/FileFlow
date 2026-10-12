import type {MouseEvent} from 'react';
import type {ResourceBudget} from '../core/resources/budget';
import type {ExecutionGate} from '../core/resources/execution';
export interface DesktopPlatform {
 resources:{budget:ResourceBudget;execution:ExecutionGate};
 pick(admit:(files:readonly File[])=>Promise<unknown>|void,accept:string,multiple:boolean):Promise<void>;
 save(blob:Blob,name:string):()=>void;
 importer(admit:(files:readonly File[])=>Promise<unknown>|void):()=>void;
 report(error:unknown):void;
 preference(key:'fileflow-theme'|'fileflow-language',value:string):void;
}
let desktop:DesktopPlatform|undefined;
export function installDesktopPlatform(value:DesktopPlatform){if(desktop)throw Error('platform-already-installed');desktop=value;}
export function getDesktopPlatform(){return desktop;}
export function nativeFileClick(event:MouseEvent<HTMLInputElement>,admit:(files:readonly File[])=>Promise<unknown>|void){
 if(!desktop)return;event.preventDefault();void desktop.pick(admit,event.currentTarget.accept,event.currentTarget.multiple).catch(error=>desktop?.report(error));
}
