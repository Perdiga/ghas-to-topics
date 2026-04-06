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
exports.labelName = labelName;
exports.findExistingLabelByPrefix = findExistingLabelByPrefix;
exports.processRepoLabels = processRepoLabels;
const core = __importStar(require("@actions/core"));
const github_1 = require("./github");
function labelName(prefix, count) {
    return `${prefix}-${count}`;
}
function findExistingLabelByPrefix(labels, prefix) {
    const pattern = new RegExp(`^${prefix}-\\d+$`);
    return labels.find(label => pattern.test(label));
}
async function processRepoLabels(octokit, repo, counts, configs, dryRun) {
    let labelsApplied = 0;
    const existingLabels = await (0, github_1.getExistingLabels)(octokit, repo.owner, repo.name);
    const labelMap = {
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
                }
                else {
                    try {
                        await octokit.rest.issues.deleteLabel({
                            owner: repo.owner,
                            repo: repo.name,
                            name: existingLabel
                        });
                        core.info(`Removed label ${existingLabel} from ${repo.full_name} (0 alerts)`);
                    }
                    catch (error) {
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
            }
            else {
                try {
                    await octokit.rest.issues.deleteLabel({
                        owner: repo.owner,
                        repo: repo.name,
                        name: existingLabel
                    });
                }
                catch (error) {
                    core.warning(`Failed to delete label ${existingLabel} from ${repo.full_name}: ${error.message}`);
                }
                await (0, github_1.upsertLabel)(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
                core.info(`Updated label ${existingLabel} → ${newLabelName} on ${repo.full_name}`);
            }
            labelsApplied++;
        }
        else if (!existingLabel) {
            // No existing label — create it
            if (dryRun) {
                core.info(`[DRY RUN] Would create label ${newLabelName} on ${repo.full_name}`);
            }
            else {
                await (0, github_1.upsertLabel)(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
                core.info(`Applied label ${newLabelName} to ${repo.full_name}`);
            }
            labelsApplied++;
        }
        else {
            // existingLabel === newLabelName — already correct, sync color/description
            if (!dryRun) {
                await (0, github_1.upsertLabel)(octokit, repo.owner, repo.name, newLabelName, config.color, config.description);
                core.debug(`Verified label ${newLabelName} on ${repo.full_name}`);
            }
        }
    }
    return labelsApplied;
}
//# sourceMappingURL=labels.js.map