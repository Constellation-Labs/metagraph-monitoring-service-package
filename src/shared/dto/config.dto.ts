export class ConfigSummaryDto {
  metagraphId: string;
  metagraphName: string;
  metagraphVersion: string;
  networkName: string;
  checkIntervalMinutes: number;
  restartConditions: string[];
  alertConditions: string[];
  nodeCount: number;
  layers: {
    ml0: {
      enabled: boolean;
      ports: { public: number; p2p: number; cli: number };
    };
    cl1: {
      enabled: boolean;
      ports: { public: number; p2p: number; cli: number };
    };
    dl1: {
      enabled: boolean;
      ports: { public: number; p2p: number; cli: number };
    };
  };
}
