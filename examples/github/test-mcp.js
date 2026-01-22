#!/usr/bin/env node

/**
 * Test script to verify MCP server communication
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const server = spawn('node', [join(__dirname, 'server.js')], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize
const initialize = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0' }
  }
};

server.stdout.on('data', (data) => {
  console.log('SERVER RESPONSE:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Send initialize request
server.stdin.write(JSON.stringify(initialize) + '\n');

// Wait a bit then list tools
setTimeout(() => {
  const listTools = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };
  server.stdin.write(JSON.stringify(listTools) + '\n');
}, 1000);

// Wait then test calling github_list_repos
setTimeout(() => {
  const callTool = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'github_list_repos',
      arguments: {}
    }
  };
  server.stdin.write(JSON.stringify(callTool) + '\n');
}, 2000);

// Wait then test calling github_delete_repo (should be blocked)
setTimeout(() => {
  const deleteTool = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'github_delete_repo',
      arguments: { repo_name: 'test-repo' }
    }
  };
  server.stdin.write(JSON.stringify(deleteTool) + '\n');
}, 3000);

// Exit after tests
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 5000);
