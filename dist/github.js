"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgRepos = getOrgRepos;
exports.getEnterpriseRepos = getEnterpriseRepos;
exports.getSecurityAlertCount = getSecurityAlertCount;
exports.getCodeScanningAlertCount = getCodeScanningAlertCount;
exports.getDependabotAlertCount = getDependabotAlertCount;
exports.getExistingLabels = getExistingLabels;
exports.upsertLabel = upsertLabel;
const core = __importStar(require("@actions/core"));
async function getOrgRepos(octokit, org) {
    core.info(`Fetching repositories for organization: ${org}`);
    const repos = [];
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
async function getEnterpriseRepos(octokit, enterprise) {
    core.info(`Fetching repositories for enterprise: ${enterprise}`);
    const repos = [];
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
    let cursor = null;
    const orgs = [];
    while (hasNextPage) {
        const result = await octokit.graphql(query, { enterprise, cursor });
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
async function getSecurityAlertCount(octokit, owner, repo) {
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
    }
    catch (error) {
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
async function getCodeScanningAlertCount(octokit, owner, repo) {
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
    }
    catch (error) {
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
async function getDependabotAlertCount(octokit, owner, repo) {
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
    }
    catch (error) {
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
async function getExistingLabels(octokit, owner, repo) {
    try {
        const labels = [];
        const iterator = octokit.paginate.iterator(octokit.rest.issues.listLabelsForRepo, {
            owner,
            repo,
            per_page: 100
        });
        for await (const response of iterator) {
            for (const label of response.data) {
                labels.push(label.name);
            }
        }
        return labels;
    }
    catch (error) {
        core.warning(`Failed to get labels for ${owner}/${repo}: ${error.message}`);
        return [];
    }
}
async function upsertLabel(octokit, owner, repo, name, color, description) {
    try {
        // Try to get the label first
        await octokit.rest.issues.getLabel({
            owner,
            repo,
            name
        });
        // Label exists, update it
        await octokit.rest.issues.updateLabel({
            owner,
            repo,
            name,
            color,
            description
        });
        core.debug(`Updated label ${name} on ${owner}/${repo}`);
    }
    catch (error) {
        if (error.status === 404) {
            // Label doesn't exist, create it
            await octokit.rest.issues.createLabel({
                owner,
                repo,
                name,
                color,
                description
            });
            core.debug(`Created label ${name} on ${owner}/${repo}`);
        }
        else {
            throw error;
        }
    }
}
//# sourceMappingURL=github.js.map