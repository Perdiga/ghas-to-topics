export interface ActionInputs {
    token: string;
    organization?: string;
    enterprise?: string;
    dryRun: boolean;
    labelColorSecurity: string;
    labelColorCode: string;
    labelColorDependabot: string;
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
export interface LabelConfig {
    prefix: string;
    color: string;
    description: string;
}
