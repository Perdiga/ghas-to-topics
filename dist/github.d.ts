import { Octokit } from '@octokit/rest';
import { Repository } from './types';
export declare function getOrgRepos(octokit: Octokit, org: string): Promise<Repository[]>;
export declare function getEnterpriseRepos(octokit: Octokit, enterprise: string): Promise<Repository[]>;
export declare function getSecurityAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number>;
export declare function getCodeScanningAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number>;
export declare function getDependabotAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number>;
export declare function getExistingLabels(octokit: Octokit, owner: string, repo: string): Promise<string[]>;
export declare function upsertLabel(octokit: Octokit, owner: string, repo: string, name: string, color: string, description: string): Promise<void>;
