import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { ActionInputs, Repository } from './types';
import {
  getOrgRepos,
  getEnterpriseRepos,
  getSecurityAlertCount,
  getCodeScanningAlertCount,
  getDependabotAlertCount
} from './github';
import { processRepoTopics } from './topics';

async function parseInputs(): Promise<ActionInputs> {
  const token = core.getInput('token', { required: true });
  const organization = core.getInput('organization');
  const enterprise = core.getInput('enterprise');
  const dryRun = core.getInput('dry-run') === 'true';
  const hideCount = core.getInput('hide-count') === 'true';

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
    hideCount
  };
}

async function processRepository(
  octokit: Octokit,
  repo: Repository,
  dryRun: boolean,
  hideCount: boolean
): Promise<number> {
  core.info(`Processing ${repo.full_name}...`);

  const [security, codeScanning, dependabot] = await Promise.all([
    getSecurityAlertCount(octokit, repo.owner, repo.name),
    getCodeScanningAlertCount(octokit, repo.owner, repo.name),
    getDependabotAlertCount(octokit, repo.owner, repo.name)
  ]);

  core.info(`  Secret scanning: ${security}, Code scanning: ${codeScanning}, Dependabot: ${dependabot}`);

  return processRepoTopics(
    octokit,
    repo,
    { security, codeScanning, dependabot },
    dryRun,
    hideCount
  );
}

async function run(): Promise<void> {
  try {
    const inputs = await parseInputs();

    const octokit = new Octokit({ auth: inputs.token });

    let repos: Repository[];
    if (inputs.organization) {
      repos = await getOrgRepos(octokit, inputs.organization);
    } else if (inputs.enterprise) {
      repos = await getEnterpriseRepos(octokit, inputs.enterprise);
    } else {
      throw new Error('No organization or enterprise specified');
    }

    const activeRepos = repos.filter(repo => !repo.archived);
    core.info(`Processing ${activeRepos.length} active repositories (${repos.length - activeRepos.length} archived repos skipped)`);

    const concurrencyLimit = 10;
    let totalTopicsApplied = 0;
    let processedCount = 0;

    for (let i = 0; i < activeRepos.length; i += concurrencyLimit) {
      const batch = activeRepos.slice(i, i + concurrencyLimit);

      const results = await Promise.allSettled(
        batch.map(repo => processRepository(octokit, repo, inputs.dryRun, inputs.hideCount))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalTopicsApplied += result.value;
          processedCount++;
        } else {
          core.error(`Failed to process repository: ${result.reason}`);
        }
      }
    }

    core.setOutput('repositories-processed', processedCount.toString());
    core.setOutput('topics-applied', totalTopicsApplied.toString());

    core.info('');
    core.info('='.repeat(50));
    core.info('Summary:');
    core.info(`  Repositories processed: ${processedCount}`);
    core.info(`  Repositories with topic updates: ${totalTopicsApplied}`);
    if (inputs.dryRun) {
      core.info('  (DRY RUN - no changes were made)');
    }
    core.info('='.repeat(50));

  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();
