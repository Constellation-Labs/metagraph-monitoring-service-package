export class NodeSummaryDto {
  index: number;
  ip: string;
  ml0Status: string;
  cl1Status: string;
  dl1Status: string;
}

export class NodeDetailDto extends NodeSummaryDto {
  instanceId: string | null;
  ml0Port: number;
  cl1Port: number;
  dl1Port: number;
  sshUsername: string;
}
