import ForceMetagraphRestart from './ForceMetagraphRestart';
import SnapshotsStopped from './SnapshotsStopped';
import UnhealthyNodes from './UnhealthyNodes';

export interface ConditionMap {
  [key: string]:
    | typeof ForceMetagraphRestart
    | typeof SnapshotsStopped
    | typeof UnhealthyNodes;
}

export default {
  ForceMetagraphRestart: ForceMetagraphRestart,
  SnapshotsStopped: SnapshotsStopped,
  UnhealthyNodes: UnhealthyNodes,
} as ConditionMap;
