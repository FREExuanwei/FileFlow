import type {ReadyTransferStage} from '../queue/transfer';
export function transferReady(from:ReadyTransferStage,to:ReadyTransferStage):boolean{
  if(from.value.input!==to.value.input||from.value.sourceLease!==to.value.sourceLease||from.value.taskLease!==to.value.taskLease)return false;
  try{from.commit();to.commit();}catch{try{to.rollback();}finally{from.rollback();}return false;}
  // Ownership is committed. A subscriber's exception must never undo the transaction.
  try{from.publish();}catch{/* destination still needs publication */}try{to.publish();}catch{/* immutable state already committed */}return true;
}
