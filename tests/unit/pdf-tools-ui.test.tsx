import {describe,it,expect,vi} from 'vitest';
import {createRoot} from 'react-dom/client';
import {act} from 'react';
import {PdfToolsStore} from '../../src/core/pdf-tools/store';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import {LanguageProvider as I18nProvider} from '../../src/i18n/Provider';
import {WorkspaceModes} from '../../src/components/WorkspaceModes';
import {PdfToolsWorkspace} from '../../src/components/pdf-tools/Workspace';
vi.mock('../../src/components/pdf-tools/Preview',()=>({PdfPreview:()=>null}));
describe('PDF tools product entry',()=>{
 it('enables a real PDF tools navigation entry',async()=>{const element=document.createElement('div'),root=createRoot(element),change=vi.fn();await act(async()=>root.render(<I18nProvider><WorkspaceModes mode="convert" onModeChange={change}/></I18nProvider>));const button=[...element.querySelectorAll('button')].find(button=>button.textContent?.includes('PDF'))!;expect(button.disabled).toBe(false);await act(async()=>button.click());expect(change).toHaveBeenCalledWith('pdf-tools');await act(async()=>root.unmount());});
 it('shows all six operations, local limits and static-output warning',async()=>{const resources={budget:new ResourceBudget(),execution:new ExecutionGate()},store=new PdfToolsStore({...resources,run:async()=>({info:[],outputs:[]})}),element=document.createElement('div'),root=createRoot(element);await act(async()=>root.render(<I18nProvider><PdfToolsWorkspace store={store} snapshot={store.getSnapshot()} resources={resources}/></I18nProvider>));expect(element.querySelector('select[data-testid="pdf-operation"]')?.querySelectorAll('option')).toHaveLength(6);expect(element.textContent).toContain('40 MiB');expect(element.textContent).toMatch(/静态|static/i);expect(element.querySelector('[data-testid="pdf-run"]')?.hasAttribute('disabled')).toBe(true);await act(async()=>root.unmount());store.dispose();});
});
