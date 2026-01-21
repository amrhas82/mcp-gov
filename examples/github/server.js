#!/usr/bin/env node

/**
 * GitHub MCP Server with Governance
 * Demonstrates permission control for GitHub operations.
 */

import { GovernedMCPServer } from '../../src/index.js';
import axios from 'axios';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Check for required token
if (!process.env.GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN is required');
  console.error('Please create a .env file with your GitHub token:');
  console.error('  cp .env.example .env');
  console.error('  # Edit .env and add your token from https://github.com/settings/tokens');
  process.exit(1);
}

// Load permission rules
const rules = JSON.parse(readFileSync(join(__dirname, 'rules.json'), 'utf-8'));

// Create governed server
const server = new GovernedMCPServer(
  {
    name: 'github-governed',
    version: '1.0.0'
  },
  rules
);

// GitHub API configuration
const GITHUB_API = 'https://api.github.com';
const headers = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'MCP-Governance-Example'
};

// Tool: List repositories
server.registerTool(
  {
    name: 'github_list_repos',
    description: 'List all repositories for the authenticated user',
    inputSchema: {
      type: 'object',
      properties: {
        visibility: {
          type: 'string',
          description: 'Filter by visibility: all, public, or private',
          enum: ['all', 'public', 'private'],
          default: 'all'
        },
        sort: {
          type: 'string',
          description: 'Sort by: created, updated, pushed, or full_name',
          enum: ['created', 'updated', 'pushed', 'full_name'],
          default: 'updated'
        }
      }
    }
  },
  async (args) => {
    const params = {
      visibility: args.visibility || 'all',
      sort: args.sort || 'updated',
      per_page: 30
    };

    const response = await axios.get(`${GITHUB_API}/user/repos`, {
      headers,
      params
    });

    const repos = response.data.map(repo => ({
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      description: repo.description,
      url: repo.html_url,
      updated_at: repo.updated_at
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${repos.length} repositories:\n\n` +
                repos.map(r => `- ${r.full_name}${r.private ? ' (private)' : ''}\n  ${r.description || 'No description'}\n  ${r.url}`).join('\n\n')
        }
      ]
    };
  }
);

// Tool: Delete repository
server.registerTool(
  {
    name: 'github_delete_repo',
    description: 'Delete a repository (WARNING: This is destructive and irreversible)',
    inputSchema: {
      type: 'object',
      properties: {
        repo_name: {
          type: 'string',
          description: 'Repository name in format "owner/repo"'
        }
      },
      required: ['repo_name']
    }
  },
  async (args) => {
    // First get authenticated user to construct full repo path
    const userResponse = await axios.get(`${GITHUB_API}/user`, { headers });
    const owner = userResponse.data.login;

    // Parse repo name (handle both "owner/repo" and "repo" formats)
    const repoName = args.repo_name.includes('/')
      ? args.repo_name.split('/')[1]
      : args.repo_name;

    const fullName = `${owner}/${repoName}`;

    // Attempt to delete
    await axios.delete(`${GITHUB_API}/repos/${fullName}`, { headers });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted repository: ${fullName}`
        }
      ]
    };
  }
);

// Start server
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
