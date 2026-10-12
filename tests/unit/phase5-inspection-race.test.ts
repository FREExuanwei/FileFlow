// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {Settings} from '../../src/components/phase5/Settings';
import {LanguageProvider} from '../../src/i18n/Provider';
import {WorkspaceCoordinator,type WorkspaceRow} from '../../src/core/phase5/workspace';
import {ConversionQueue} from '../../src/core/queue/store';
import {Phase5Queue} from '../../src/core/phase5/queue';
import {ResourceBudget} from '../../src/core/resources/budget';
import {ExecutionGate} from '../../src/core/resources/execution';
import type {WorkbookInfo} from '../../src/converters/phase5/xlsx/parser';
it('inspection completion is bound to input and generation, never overwrites newer utility',async()=>{Reflect.set(globalThis,'IS_REACT_ACT_ENVIRONMENT',true);localStorage.setItem('fileflow.language','en');const budget=new ResourceBudget(),execution=new ExecutionGate(),legacy=new ConversionQueue({budget,execution}),queue=new Phase5Queue({budget,execution,run:vi.fn()}),coordinator=new WorkspaceCoordinator(legacy,queue,{yaml:true,xlsx:true}),blob=new Blob(['fiction']);await coordinator.add([{name:'fiction.xlsx',type:'application/octet-stream',size:blob.size,blob}]);let resolve!:(info:WorkbookInfo)=>void;const inspect=()=>new Promise<WorkbookInfo>(r=>{resolve=r;}),host=document.createElement('div'),root=createRoot(host);document.body.append(host);const render=()=>root.render(createElement(LanguageProvider,null,createElement(Settings,{row:coordinator.getSnapshot().items[0] as Extract<WorkspaceRow,{owner:'phase5'}>,coordinator,inspect,browse:()=>{}})));try{await act(render);await act(()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='Read worksheets')!.click();});await act(()=>{coordinator.configure(coordinator.getSnapshot().items[0]!.workspaceId,{kind:'hash',algorithm:'SHA-256'});render();});await act(async()=>resolve({sheets:[{id:'rId1',name:'Fiction',visibility:'visible'}],dateSystem:'1900'} as WorkbookInfo));expect(queue.getSnapshot().items[0]!.operation.kind).toBe('hash');}finally{await act(()=>root.unmount());host.remove();coordinator.dispose();legacy.dispose();queue.dispose();Reflect.deleteProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT');}});
