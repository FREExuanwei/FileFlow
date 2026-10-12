import type {InputFile} from '../conversion/types';
import type {MemoryLease,ReleaseHandle} from '../resources/budget';
export interface ReadyTransfer{input:InputFile;taskLease:ReleaseHandle;sourceLease:MemoryLease;basename:string;format:'csv'|'json'}
export interface ReadyTransferStage{value:ReadyTransfer;commit():void;rollback():void;publish():void}
