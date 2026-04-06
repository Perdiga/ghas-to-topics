import { Octokit } from '@octokit/rest';
import { Repository, AlertCounts, LabelConfig } from './types';
export declare function labelName(prefix: string, count: number): string;
export declare function findExistingLabelByPrefix(labels: string[], prefix: string): string | undefined;
export declare function processRepoLabels(octokit: Octokit, repo: Repository, counts: AlertCounts, configs: LabelConfig[], dryRun: boolean): Promise<number>;
