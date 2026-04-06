import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { Repository, AlertCounts } from './types';
import { getRepoTopics, replaceRepoTopics } from './github';

const TOPIC_PREFIXES = {
  security: 'ghas-secret',
  codeScanning: 'ghas-code',
  dependabot: 'ghas-dependabot'
} as const;

export function topicName(prefix: string, count: number, hideCount = false): string {
  return hideCount ? prefix : `${prefix}-${count}`;
}

export function findExistingTopicByPrefix(topics: string[], prefix: string): string | undefined {
  const pattern = new RegExp(`^${prefix}(-\\d+)?$`);
  return topics.find(topic => pattern.test(topic));
}

export async function processRepoTopics(
  octokit: Octokit,
  repo: Repository,
  counts: AlertCounts,
  dryRun: boolean,
  hideCount = false
): Promise<number> {
  let topicsChanged = 0;

  const existingTopics = await getRepoTopics(octokit, repo.owner, repo.name);

  // Strip all existing GHAS topics (both with and without count suffix to handle mode switches)
  const nonGhasTopics = existingTopics.filter(
    t => !Object.values(TOPIC_PREFIXES).some(prefix => new RegExp(`^${prefix}(-\\d+)?$`).test(t))
  );

  // Build new GHAS topics (only add when count > 0)
  const newGhasTopics: string[] = [];
  const alertMap: Array<{ prefix: string; count: number }> = [
    { prefix: TOPIC_PREFIXES.security, count: counts.security },
    { prefix: TOPIC_PREFIXES.codeScanning, count: counts.codeScanning },
    { prefix: TOPIC_PREFIXES.dependabot, count: counts.dependabot }
  ];

  for (const { prefix, count } of alertMap) {
    if (count > 0) {
      newGhasTopics.push(topicName(prefix, count, hideCount));
    }
  }

  const updatedTopics = [...nonGhasTopics, ...newGhasTopics];

  // Detect if anything actually changed
  const oldGhasTopics = existingTopics.filter(t => !nonGhasTopics.includes(t)).sort();
  const changed = JSON.stringify(oldGhasTopics) !== JSON.stringify([...newGhasTopics].sort());

  if (!changed) {
    core.debug(`Topics already up-to-date for ${repo.full_name}`);
    return 0;
  }

  if (dryRun) {
    core.info(`[DRY RUN] Would set topics on ${repo.full_name}: ${newGhasTopics.join(', ') || '(none)'}`);
  } else {
    await replaceRepoTopics(octokit, repo.owner, repo.name, updatedTopics);
    core.info(`Updated topics on ${repo.full_name}: ${newGhasTopics.join(', ') || '(removed all GHAS topics)'}`);
  }

  topicsChanged++;
  return topicsChanged;
}
