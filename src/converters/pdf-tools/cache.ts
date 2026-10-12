import type {ResourceBudget,MemoryLease} from '../../core/resources/budget';
/** Only small rendered pixels; never document bytes or persistent storage. */
export class PdfPixelCache{
 private pages=new Map<number,{pixels:ImageData;lease:MemoryLease}>();private bytes=0;
 constructor(private budget:ResourceBudget){}
 get(page:number){const value=this.pages.get(page);if(value){this.pages.delete(page);this.pages.set(page,value);}return value?.pixels;}
 private remove(page:number){const value=this.pages.get(page);if(!value)return;this.pages.delete(page);this.bytes-=value.pixels.data.byteLength;value.pixels.data.fill(0);value.lease.release();}
 set(page:number,pixels:ImageData){const bytes=pixels.data.byteLength;if(bytes>6*1024**2||!bytes)return false;this.remove(page);while(this.pages.size>=3||this.bytes+bytes>6*1024**2)this.remove(this.pages.keys().next().value!);let lease:MemoryLease;try{lease=this.budget.reserve('transient',bytes,'pdf-preview-pixel-cache');}catch{return false;}this.pages.set(page,{pixels,lease});this.bytes+=bytes;return true;}
 clear(){for(const page of [...this.pages.keys()])this.remove(page);}
}
