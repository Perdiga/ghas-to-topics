import { Octokit } from '@octokit/rest';
import { Repository, AlertCounts } from './types';
export declare function topicName(prefix: string, count: number): string;
export declare function findExistingTopicByPrefix(topics: string[], prefix: string): string | undefined;
export declare function processRepoTopics(octokit: Octokit, repo: Repository, counts: AlertCounts, dryRun: boolean): Promise<number>;
