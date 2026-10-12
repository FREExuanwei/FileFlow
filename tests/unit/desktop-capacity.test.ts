import {it,expect} from 'vitest';
import {validateSize} from '../../src/core/files/detect';
import {installFileEnvironment,fileLimitMiB} from '../../src/core/files/policy';
import {detectAiFormat} from '../../src/converters/ai-ready/extract';
it('desktop PDF and image limits are separate from Web and do not remove decoded pixel limits',()=>{
 expect(fileLimitMiB('pdf')).toBe(40);expect(()=>validateSize(41*1024**2,'pdf')).toThrow();expect(fileLimitMiB('png')).toBe(20);
 installFileEnvironment('desktop');try{expect(fileLimitMiB('pdf')).toBe(100);expect(fileLimitMiB('png')).toBe(100);expect(()=>validateSize(100*1024**2,'pdf')).not.toThrow();expect(()=>validateSize(100*1024**2+1,'pdf')).toThrow();expect(fileLimitMiB('docx')).toBe(10);}finally{installFileEnvironment('web');}
 expect(fileLimitMiB('pdf')).toBe(40);expect(fileLimitMiB('png')).toBe(20);
});
it('ordinary desktop expansion does not silently expand AI Ready input or result reservations',async()=>{
 installFileEnvironment('desktop');try{const blob=new Blob(['%PDF-1.7 fictional']);await expect(detectAiFormat({name:'fictional.pdf',type:'application/pdf',size:41*1024**2,blob})).rejects.toThrow('input-limit');}finally{installFileEnvironment('web');}
});
