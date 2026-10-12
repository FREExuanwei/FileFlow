import { useEffect, useState, useSyncExternalStore } from 'react';
import { ConversionQueue } from '../core/queue/store';
import type { ResourceBudget } from '../core/resources/budget';
import type { ExecutionGate } from '../core/resources/execution';
export function useQueue(resources?: { budget: ResourceBudget; execution: ExecutionGate }) {
  const [queue] = useState(() => new ConversionQueue(resources));
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  useEffect(() => { queue.activate(); return () => queue.dispose(); }, [queue]);
  return { queue, snapshot };
}
