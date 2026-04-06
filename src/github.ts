import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { Repository } from './types';

export async function getOrgRepos(octokit: Octokit, org: string): Promise<Repository[]> {
  core.info(`Fetching repositories for organization: ${org}`);
  
  const repos: Repository[] = [];
  const iterator = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
    org,
    per_page: 100,
    type: 'all'
  });

  for await (const response of iterator) {
    for (const repo of response.data) {
      repos.push({
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        id: repo.id,
        archived: repo.archived || false,
        visibility: repo.visibility || 'public'
      });
    }
  }

  core.info(`Found ${repos.length} repositories in organization ${org}`);
  return repos;
}

export async function getEnterpriseRepos(octokit: Octokit, enterprise: string): Promise<Repository[]> {
  core.info(`Fetching repositories for enterprise: ${enterprise}`);
  
  const repos: Repository[] = [];
  
  // Use GraphQL to fetch enterprise repos since REST API has limitations
  // GraphQL query to get all orgs in enterprise, then all repos in each org
  const query = `
    query($enterprise: String!, $cursor: String) {
      enterprise(slug: $enterprise) {
        organizations(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            login
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let cursor: string | null = null;
  const orgs: string[] = [];

  while (hasNextPage) {
    const result: any = await octokit.graphql(query, { enterprise, cursor });
    
    for (const org of result.enterprise.organizations.nodes) {
      orgs.push(org.login);
    }

    hasNextPage = result.enterprise.organizations.pageInfo.hasNextPage;
    cursor = result.enterprise.organizations.pageInfo.endCursor;
  }

  core.info(`Found ${orgs.length} organizations in enterprise ${enterprise}`);

  // Now fetch repos for each org
  for (const org of orgs) {
    const orgRepos = await getOrgRepos(octokit, org);
    repos.push(...orgRepos);
  }

  core.info(`Found ${repos.length} total repositories in enterprise ${enterprise}`);
  return repos;
}

export async function getSecurityAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number> {
  try {
    let totalCount = 0;
    const iterator = octokit.paginate.iterator(octokit.rest.secretScanning.listAlertsForRepo, {
      owner,
      repo,
      state: 'open',
      per_page: 100
    });

    for await (const response of iterator) {
      totalCount += response.data.length;
    }

    return totalCount;
  } catch (error: any) {
    if (error.status === 404) {
      core.debug(`Secret scanning not enabled for ${owner}/${repo}`);
      return 0;
    }
    if (error.status === 403) {
      core.warning(`No permission to access secret scanning alerts for ${owner}/${repo}`);
      return 0;
    }
    throw error;
  }
}

export async function getCodeScanningAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number> {
  try {
    let totalCount = 0;
    const iterator = octokit.paginate.iterator(octokit.rest.codeScanning.listAlertsForRepo, {
      owner,
      repo,
      state: 'open',
      per_page: 100
    });

    for await (const response of iterator) {
      totalCount += response.data.length;
    }

    return totalCount;
  } catch (error: any) {
    if (error.status === 404) {
      core.debug(`Code scanning not enabled for ${owner}/${repo}`);
      return 0;
    }
    if (error.status === 403) {
      core.warning(`No permission to access code scanning alerts for ${owner}/${repo}`);
      return 0;
    }
    throw error;
  }
}

export async function getDependabotAlertCount(octokit: Octokit, owner: string, repo: string): Promise<number> {
  try {
    let totalCount = 0;
    const iterator = octokit.paginate.iterator(octokit.rest.dependabot.listAlertsForRepo, {
      owner,
      repo,
      state: 'open',
      per_page: 100
    });

    for await (const response of iterator) {
      totalCount += response.data.length;
    }

    return totalCount;
  } catch (error: any) {
    if (error.status === 404) {
      core.debug(`Dependabot alerts not enabled for ${owner}/${repo}`);
      return 0;
    }
    if (error.status === 403) {
      core.warning(`No permission to access Dependabot alerts for ${owner}/${repo}`);
      return 0;
    }
    throw error;
  }
}

export async function getRepoTopics(octokit: Octokit, owner: string, repo: string): Promise<string[]> {
  try {
    const response = await octokit.rest.repos.getAllTopics({ owner, repo });
    return response.data.names;
  } catch (error: any) {
    core.warning(`Failed to get topics for ${owner}/${repo}: ${error.message}`);
    return [];
  }
}

export async function replaceRepoTopics(
  octokit: Octokit,
  owner: string,
  repo: string,
  names: string[]
): Promise<void> {
  await octokit.rest.repos.replaceAllTopics({ owner, repo, names });
}
