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
exports.topicName = topicName;
exports.findExistingTopicByPrefix = findExistingTopicByPrefix;
exports.processRepoTopics = processRepoTopics;
const core = __importStar(require("@actions/core"));
const github_1 = require("./github");
const TOPIC_PREFIXES = {
    security: 'ghas-secret',
    codeScanning: 'ghas-code',
    dependabot: 'ghas-dependabot'
};
function topicName(prefix, count) {
    return `${prefix}-${count}`;
}
function findExistingTopicByPrefix(topics, prefix) {
    const pattern = new RegExp(`^${prefix}-\\d+$`);
    return topics.find(topic => pattern.test(topic));
}
async function processRepoTopics(octokit, repo, counts, dryRun) {
    let topicsChanged = 0;
    const existingTopics = await (0, github_1.getRepoTopics)(octokit, repo.owner, repo.name);
    // Strip all existing GHAS topics
    const nonGhasTopics = existingTopics.filter(t => !Object.values(TOPIC_PREFIXES).some(prefix => new RegExp(`^${prefix}-\\d+$`).test(t)));
    // Build new GHAS topics (only add when count > 0)
    const newGhasTopics = [];
    const alertMap = [
        { prefix: TOPIC_PREFIXES.security, count: counts.security },
        { prefix: TOPIC_PREFIXES.codeScanning, count: counts.codeScanning },
        { prefix: TOPIC_PREFIXES.dependabot, count: counts.dependabot }
    ];
    for (const { prefix, count } of alertMap) {
        if (count > 0) {
            newGhasTopics.push(topicName(prefix, count));
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
    }
    else {
        await (0, github_1.replaceRepoTopics)(octokit, repo.owner, repo.name, updatedTopics);
        core.info(`Updated topics on ${repo.full_name}: ${newGhasTopics.join(', ') || '(removed all GHAS topics)'}`);
    }
    topicsChanged++;
    return topicsChanged;
}
//# sourceMappingURL=topics.js.map