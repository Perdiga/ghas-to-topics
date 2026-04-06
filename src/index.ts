import * as core from '@actions/core';
import * as github from '@actions/github';
import { Octokit } from '@octokit/rest';
import { ActionInputs, LabelConfig, Repository } from './types';
import {
  getOrgRepos,
  getEnterpriseRepos,
  getSecurityAlertCount,
  getCodeScanningAlertCount,
  getDependabotAlertCount
} from './github';
import { processRepoLabels } from './labels';

async function parseInputs(): Promise<ActionInputs> {
  const token = core.getInput('token', { required: true });
  const organization = core.getInput('organization');
  const enterprise = core.getInput('enterprise');
  const dryRunInput = core.getInput('dry-run');
  const dryRun = dryRunInput === 'true';

  const labelColorSecurity = core.getInput('label-color-security') || 'd73a4a';
  const labelColorCode = core.getInput('label-color-code') || 'e4e669';
  const labelColorDependabot = core.getInput('label-color-dependabot') || '0075ca';

  if (!organization && !enterprise) {
    throw new Error('Must provide either organization or enterprise input');
  }

  if (organization && enterprise) {
    throw new Error('Cannot provide both organization and enterprise inputs');
  }

  return {
    token,
    organization: organization || undefined,
    enterprise: enterprise || undefined,
    dryRun,
    labelColorSecurity,
    labelColorCode,
    labelColorDependabot
  };
}

async function processRepository(
  octokit: Octokit,
  repo: Repository,
  labelConfigs: LabelConfig[],
  dryRun: boolean
): Promise<number> {
  core.info(`Processing ${repo.full_name}...`);

  const [security, codeScanning, dependabot] = await Promise.all([
    getSecurityAlertCount(octokit, repo.owner, repo.name),
    getCodeScanningAlertCount(octokit, repo.owner, repo.name),
    getDependabotAlertCount(octokit, repo.owner, repo.name)
  ]);

  core.info(`  Secret scanning: ${security}, Code scanning: ${codeScanning}, Dependabot: ${dependabot}`);

  const labelsApplied = await processRepoLabels(
    octokit,
    repo,
    { security, codeScanning, dependabot },
    labelConfigs,
    dryRun
  );

  return labelsApplied;
}

async function run(): Promise<void> {
  try {
    const inputs = await parseInputs();

    const octokit = new Octokit({
      auth: inputs.token
    });

    // Get repositories
    let repos: Repository[];
    if (inputs.organization) {
      repos = await getOrgRepos(octokit, inputs.organization);
    } else if (inputs.enterprise) {
      repos = await getEnterpriseRepos(octokit, inputs.enterprise);
    } else {
      throw new Error('No organization or enterprise specified');
    }

    // Filter out archived repos
    const activeRepos = repos.filter(repo => !repo.archived);
    core.info(`Processing ${activeRepos.length} active repositories (${repos.length - activeRepos.length} archived repos skipped)`);

    // Configure labels
    const labelConfigs: LabelConfig[] = [
      {
        prefix: 'S',
        color: inputs.labelColorSecurity,
        description: 'Secret scanning alert count'
      },
      {
        prefix: 'C',
        color: inputs.labelColorCode,
        description: 'Code scanning alert count'
      },
      {
        prefix: 'D',
        color: inputs.labelColorDependabot,
        description: 'Dependabot alert count'
      }
    ];

    // Process repos with concurrency limit
    const concurrencyLimit = 10;
    let totalLabelsApplied = 0;
    let processedCount = 0;

    for (let i = 0; i < activeRepos.length; i += concurrencyLimit) {
      const batch = activeRepos.slice(i, i + concurrencyLimit);
      
      const results = await Promise.allSettled(
        batch.map(repo => processRepository(octokit, repo, labelConfigs, inputs.dryRun))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalLabelsApplied += result.value;
          processedCount++;
        } else {
          core.error(`Failed to process repository: ${result.reason}`);
        }
      }
    }

    // Set outputs
    core.setOutput('repositories-processed', processedCount.toString());
    core.setOutput('labels-applied', totalLabelsApplied.toString());

    // Summary
    core.info('');
    core.info('='.repeat(50));
    core.info(`Summary:`);
    core.info(`  Repositories processed: ${processedCount}`);
    core.info(`  Labels applied/updated: ${totalLabelsApplied}`);
    if (inputs.dryRun) {
      core.info('  (DRY RUN - no changes were made)');
    }
    core.info('='.repeat(50));

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
