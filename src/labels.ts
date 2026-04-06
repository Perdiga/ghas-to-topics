import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { Repository, AlertCounts, LabelConfig } from './types';
import { getExistingLabels, upsertLabel } from './github';

export function labelName(prefix: string, count: number): string {
  return `${prefix}-${count}`;
}

export function findExistingLabelByPrefix(labels: string[], prefix: string): string | undefined {
  const pattern = new RegExp(`^${prefix}-\\d+$`);
  return labels.find(label => pattern.test(label));
}

export async function processRepoLabels(
  octokit: Octokit,
  repo: Repository,
  counts: AlertCounts,
  configs: LabelConfig[],
  dryRun: boolean
): Promise<number> {
  let labelsApplied = 0;

  const existingLabels = await getExistingLabels(octokit, repo.owner, repo.name);

  const labelMap: Record<string, { count: number; config: LabelConfig }> = {
    'S': { count: counts.security, config: configs[0] },
    'C': { count: counts.codeScanning, config: configs[1] },
    'D': { count: counts.dependabot, config: configs[2] }
  };

  for (const [prefix, { count, config }] of Object.entries(labelMap)) {
    const existingLabel = findExistingLabelByPrefix(existingLabels, prefix);

    if (count === 0) {
      // No alerts — remove any existing label for this prefix
      if (existingLabel) {
        if (dryRun) {
          core.info(`[DRY RUN] Would delete label ${existingLabel} from ${repo.full_name} (0 alerts)`);
        } else {
          try {
            await octokit.rest.issues.deleteLabel({
              owner: repo.owner,
              repo: repo.name,
              name: existingLabel
            });
            core.info(`Removed label ${existingLabel} from ${repo.full_name} (0 alerts)`);
          } catch (error: any) {
            core.warning(`Failed to delete label ${existingLabel} from ${repo.full_name}: ${error.message}`);
          }
        }
        labelsApplied++;
      }
      continue;
    }

    // count > 0 — create or update label
    const newLabelName = labelName(prefix, count);

    if (existingLabel && existingLabel !== newLabelName) {
      // Count changed — delete old label and create updated one
      if (dryRun) {
        core.info(`[DRY RUN] Would update label ${existingLabel} → ${newLabelName} on ${repo.full_name}`);
      } else {
        try {
          await octokit.rest.issues.deleteLabel({
            owner: repo.owner,
            repo: repo.name,
            name: existingLabel
          });
        } catch (error: any) {
          core.warning(`Failed to delete label ${existingLabel} from ${repo.full_name}: ${error.message}`);
        }
        await upsertLabel(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
        core.info(`Updated label ${existingLabel} → ${newLabelName} on ${repo.full_name}`);
      }
      labelsApplied++;
    } else if (!existingLabel) {
      // No existing label — create it
      if (dryRun) {
        core.info(`[DRY RUN] Would create label ${newLabelName} on ${repo.full_name}`);
      } else {
        await upsertLabel(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
        core.info(`Applied label ${newLabelName} to ${repo.full_name}`);
      }
      labelsApplied++;
    } else {
      // existingLabel === newLabelName — already correct, sync color/description
      if (!dryRun) {
        await upsertLabel(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
        core.debug(`Verified label ${newLabelName} on ${repo.full_name}`);
      }
    }
  }

  return labelsApplied;
}
