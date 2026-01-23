#!/usr/bin/env node

/**
 * Example: Multiple GitHub MCP servers with different governance rules
 *
 * Scenario:
 * - github-prod: Read-only (production safety)
 * - github-dev: Full access (development environment)
 * - github-personal: Moderate restrictions (personal projects)
 */

import { GovernedMCPServer } from '../src/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get server instance name from environment or command line
const SERVER_INSTANCE = process.env.MCP_SERVER_INSTANCE || process.argv[2] || 'github-dev';

console.error(`Starting MCP server instance: ${SERVER_INSTANCE}`);

// Load rules
const rulesFile = join(__dirname, 'multi-instance-rules.json');
const allRules = JSON.parse(readFileSync(rulesFile, 'utf-8'));

// Select rules for this server instance
let rules;
if (allRules.servers && allRules.servers[SERVER_INSTANCE]) {
  // Use instance-specific rules
  rules = allRules.servers[SERVER_INSTANCE];
  console.error(`Using instance-specific rules for: ${SERVER_INSTANCE}`);
} else {
  // Fallback to default service rules
  rules = {
    github: allRules.github || {
      read: 'allow',
      write: 'allow',
      delete: 'deny'
    }
  };
  console.error(`Using default rules (no instance-specific config found)`);
}

console.error(`Active rules: ${JSON.stringify(rules, null, 2)}`);

// Create governed server with instance name
const server = new GovernedMCPServer(
  {
    name: SERVER_INSTANCE, // Use instance name
    version: '1.0.0'
  },
  rules
);

// Register tools (same tools for all instances, but different rules)
server.registerTool(
  {
    name: 'github_list_repos',
    description: 'List repositories',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  /**
   * @param {Record<string, never>} args
   */
  async (args) => {
    return {
      content: [{
        type: 'text',
        text: `[Mock] Listed repos for ${SERVER_INSTANCE}`
      }]
    };
  }
);

server.registerTool(
  {
    name: 'github_create_issue',
    description: 'Create an issue (WRITE operation)',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' }
      },
      required: ['title']
    }
  },
  /**
   * @param {{ title: string, body?: string }} args
   */
  async (args) => {
    return {
      content: [{
        type: 'text',
        text: `[Mock] Created issue in ${SERVER_INSTANCE}: ${args.title}`
      }]
    };
  }
);

server.registerTool(
  {
    name: 'github_delete_repo',
    description: 'Delete repository (DELETE operation - destructive!)',
    inputSchema: {
      type: 'object',
      properties: {
        repo_name: { type: 'string' }
      },
      required: ['repo_name']
    }
  },
  /**
   * @param {{ repo_name: string }} args
   */
  async (args) => {
    return {
      content: [{
        type: 'text',
        text: `[Mock] Deleted repo in ${SERVER_INSTANCE}: ${args.repo_name}`
      }]
    };
  }
);

// Start server
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
