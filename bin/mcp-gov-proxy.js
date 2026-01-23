#!/usr/bin/env node

/**
 * mcp-gov-proxy - MCP Governance Proxy
 * Intercepts tool calls and checks permissions before forwarding to target MCP server
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { extractService, detectOperation } from '../src/operation-detector.js';

/**
 * Parse command line arguments
 * @returns {{ target: string, rules: string, service: string, help: boolean }}
 */
function parseCliArgs() {
  try {
    const { values } = parseArgs({
      options: {
        service: {
          type: 'string',
          short: 's',
        },
        target: {
          type: 'string',
          short: 't',
        },
        rules: {
          type: 'string',
          short: 'r',
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
      },
      allowPositionals: false,
    });

    return values;
  } catch (error) {
    console.error(`Error parsing arguments: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log(`
Usage: mcp-gov-proxy [--service <name>] --target <command> --rules <rules.json>

Options:
  --service, -s  Service name for rule matching (recommended, falls back to tool name prefix)
  --target, -t   Target MCP server command to wrap (required)
  --rules, -r    Path to rules.json file (required)
  --help, -h     Show this help message

Description:
  Intercepts MCP tool calls and checks permissions before forwarding to target server.
  Provides audit logging and permission control based on rules.json.

  IMPORTANT: Use --service to ensure correct rule matching. Without it, the service
  name is extracted from tool name prefixes, which may not match your rules.

Examples:
  mcp-gov-proxy --service filesystem --target "npx -y @modelcontextprotocol/server-filesystem" --rules rules.json
  mcp-gov-proxy -s github -t "npx github-mcp" -r ./config/rules.json
`);
}

/**
 * Parse JSON-RPC message
 * @param {string} line - Raw message line
 * @returns {object|null} Parsed message or null if not valid JSON-RPC
 */
function parseJsonRpcMessage(line) {
  try {
    const msg = JSON.parse(line);
    if (msg.jsonrpc === '2.0' && msg.method) {
      return msg;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Check if message is a tools/call method
 * @param {object} message - Parsed JSON-RPC message
 * @returns {boolean}
 */
function isToolsCallMessage(message) {
  return message && message.method === 'tools/call';
}

/**
 * Load rules from JSON file
 * @param {string} rulesPath - Path to rules.json
 * @returns {object} Parsed rules object
 */
function loadRules(rulesPath) {
  try {
    const rulesContent = readFileSync(rulesPath, 'utf-8');
    return JSON.parse(rulesContent);
  } catch (error) {
    console.error(`Error loading rules file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Check if operation is allowed based on rules
 * @param {object} rules - Loaded rules object
 * @param {string} service - Service name
 * @param {string} operation - Operation type
 * @returns {boolean} True if allowed, false if denied
 */
function isOperationAllowed(rules, service, operation) {
  // Default to allow if not specified
  if (!rules.services || !rules.services[service]) {
    return true;
  }

  const serviceRules = rules.services[service];
  if (!serviceRules.operations || !serviceRules.operations[operation]) {
    return true;
  }

  const permission = serviceRules.operations[operation];
  return permission !== 'deny';
}

/**
 * Create a JSON-RPC error response
 * @param {number|string} id - Request ID
 * @param {string} message - Error message
 * @returns {string} JSON-RPC error response
 */
function createErrorResponse(id, message) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: -32000,
      message: message
    }
  };
  return JSON.stringify(response);
}

/**
 * Log audit information to stderr
 * @param {string} toolName - Tool name
 * @param {string} service - Service name
 * @param {string} operation - Operation type
 * @param {boolean} allowed - Whether operation was allowed
 */
function logAudit(toolName, service, operation, allowed) {
  const timestamp = new Date().toISOString();
  const status = allowed ? 'ALLOWED' : 'DENIED';
  console.error(`[AUDIT] ${timestamp} | ${status} | tool=${toolName} | service=${service} | operation=${operation}`);
}

/**
 * Start the proxy server
 * @param {string} serviceName - Service name for rule matching
 * @param {string} targetCommand - Command to spawn target MCP server
 * @param {string} rulesPath - Path to rules.json file
 */
function startProxy(serviceName, targetCommand, rulesPath) {
  // Load rules file
  const rules = loadRules(rulesPath);

  // Parse the target command (handle both "node server.js" and single commands)
  const commandParts = targetCommand.split(/\s+/);
  const command = commandParts[0];
  const args = commandParts.slice(1);

  // Spawn the target MCP server
  const targetServer = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Log to stderr that proxy is ready
  console.error('Proxy ready');

  // Set up readline interface for line-by-line processing from stdin
  const rl = createInterface({
    input: process.stdin,
    terminal: false
  });

  // Set up readline interface for target server stdout
  const targetRl = createInterface({
    input: targetServer.stdout,
    terminal: false
  });

  // Forward stderr from target server to our stderr
  targetServer.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Forward stdout from target server to our stdout (line by line)
  targetRl.on('line', (line) => {
    // For now, just forward everything (interception logic comes in later tasks)
    console.log(line);
  });

  // Process stdin messages
  rl.on('line', (line) => {
    // Parse JSON-RPC message
    const message = parseJsonRpcMessage(line);

    if (isToolsCallMessage(message)) {
      // Extract tool name from params
      const toolName = message.params?.name;

      if (toolName) {
        // Use provided service name, fallback to extracting from tool name for backward compatibility
        const service = serviceName || extractService(toolName);
        const operation = detectOperation(toolName);

        // Check permissions
        const allowed = isOperationAllowed(rules, service, operation);

        // Log audit information
        logAudit(toolName, service, operation, allowed);

        if (allowed) {
          // Allowed - forward to target server
          targetServer.stdin.write(line + '\n');
        } else {
          // Denied - send error response
          const errorResponse = createErrorResponse(
            message.id,
            `Permission denied: ${service}.${operation} operation on tool ${toolName}`
          );
          console.log(errorResponse);
        }
      } else {
        // No tool name, forward anyway
        targetServer.stdin.write(line + '\n');
      }
    } else {
      // Forward non-tools/call messages directly
      targetServer.stdin.write(line + '\n');
    }
  });

  // Handle target server exit
  targetServer.on('close', (code) => {
    console.error(`Target server exited with code ${code}`);
    process.exit(code || 0);
  });

  // Handle target server errors
  targetServer.on('error', (error) => {
    console.error(`Error spawning target server: ${error.message}`);
    process.exit(1);
  });

  // Handle proxy termination
  process.on('SIGTERM', () => {
    targetServer.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    targetServer.kill('SIGINT');
  });
}

/**
 * Main entry point
 */
function main() {
  const args = parseCliArgs();

  if (args.help) {
    showUsage();
    process.exit(0);
  }

  if (!args.target) {
    console.error('Error: --target is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  if (!args.rules) {
    console.error('Error: --rules is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  startProxy(args.service, args.target, args.rules);
}

main();
