export type ShouldRestartInfo = {
  shouldRestart: boolean;
  restartType: string;
  lastMetagraphSnapshotOrdinal?: number;
};

export default interface IRestartCondition {
  name: string;
  shouldRestart(): Promise<ShouldRestartInfo>;
  triggerRestart(): Promise<void>;
}
