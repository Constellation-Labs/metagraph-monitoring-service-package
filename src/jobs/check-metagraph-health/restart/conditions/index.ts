import SnapshotsStopped from './SnapshotsStopped';
import UnhealthyNodes from './UnhealthyNodes';

export interface ConditionMap {
  [key: string]: typeof SnapshotsStopped | typeof UnhealthyNodes;
}

export default {
  SnapshotsStopped: SnapshotsStopped,
  UnhealthyNodes: UnhealthyNodes,
} as ConditionMap;
