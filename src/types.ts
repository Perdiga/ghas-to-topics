export interface ActionInputs {
  token: string;
  organization?: string;
  enterprise?: string;
  dryRun: boolean;
}

export interface Repository {
  owner: string;
  name: string;
  full_name: string;
  id: number;
  archived: boolean;
  visibility: string;
}

export interface AlertCounts {
  security: number;
  codeScanning: number;
  dependabot: number;
}

export interface TopicConfig {
  prefix: string;
  description: string;
}
