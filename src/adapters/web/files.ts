import type { FileInputAdapter, FileOutputAdapter } from '../types/files';
import { safeOutputName } from '../../core/files/names';
import {getDesktopPlatform} from '../platform';

export class WebFileInputAdapter implements FileInputAdapter<readonly File[]> {
  readMany(files: readonly File[]) { return files.map(file => ({ name: file.name, size: file.size, type: file.type, blob: file })); }
  read(files: readonly File[]) {
    const file = files[0];
    return file ? { name: file.name, size: file.size, type: file.type, blob: file } : undefined;
  }
}
export class WebFileOutputAdapter implements FileOutputAdapter {
  private urls = new Map<string, ReturnType<typeof setTimeout>>();
  private cancellations:Array<()=>void>=[];
  save(blob: Blob, filename: string) {
    const desktop=getDesktopPlatform();if(desktop){this.cancellations.push(desktop.save(blob,filename));return;}
    const extension = filename.split('.').pop() ?? 'txt';
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = safeOutputName(filename, extension);
    document.body.append(anchor); anchor.click(); anchor.remove();
    this.urls.set(url, setTimeout(() => { URL.revokeObjectURL(url); this.urls.delete(url); }, 1000));
  }
  dispose() { this.cancellations.forEach(cancel=>cancel());this.cancellations=[];for (const [url, timer] of this.urls) { clearTimeout(timer); URL.revokeObjectURL(url); } this.urls.clear(); }
}
