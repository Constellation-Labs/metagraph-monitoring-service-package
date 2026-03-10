export type ShouldAlertInfo = {
  shouldAlert: boolean;
  message?: string;
  alertName: string;
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
};

export default interface IAlertCondition {
  name: string;
  shouldAlert(): Promise<ShouldAlertInfo>;
}
