#!/usr/bin/env node

/**
 * mcp-gov-wrap - Generic MCP Server Wrapper
 * Auto-discovers MCP servers and wraps them with governance proxy
 */

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';

const execAsync = promisify(exec);

/**
 * Parse command line arguments
 * @returns {{ config: string, rules: string, tool: string, help: boolean }}
 */
function parseCliArgs() {
  try {
    const { values } = parseArgs({
      options: {
        config: {
          type: 'string',
          short: 'c',
        },
        rules: {
          type: 'string',
          short: 'r',
        },
        tool: {
          type: 'string',
          short: 't',
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
Usage: mcp-gov-wrap --config <config.json> --rules <rules.json> --tool <command>

Options:
  --config, -c    Path to MCP config file (e.g., ~/.config/claude/config.json)
  --rules, -r     Path to governance rules file (e.g., ~/.mcp-gov/rules.json)
  --tool, -t      Tool command to execute after wrapping (e.g., "claude chat")
  --help, -h      Show this help message

Description:
  Auto-discovers unwrapped MCP servers in config and wraps them with governance proxy.
  Creates a timestamped backup of the config file before modification.
  Supports both Claude Code format (projects.mcpServers) and flat format (mcpServers).

Examples:
  # Wrap servers and launch Claude Code
  mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"

  # Check what would be wrapped (dry run - not yet implemented)
  mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "echo Done"
`);
  process.exit(0);
}

/**
 * Validate required arguments
 * @param {{ config?: string, rules?: string, tool?: string }} args
 */
function validateArgs(args) {
  const errors = [];

  if (!args.config) {
    errors.push('--config argument is required');
  }

  if (!args.rules) {
    errors.push('--rules argument is required');
  }

  if (!args.tool) {
    errors.push('--tool argument is required');
  }

  if (errors.length > 0) {
    console.error('Error: Missing required arguments\n');
    errors.forEach(err => console.error(`  ${err}`));
    console.error('\nUse --help for usage information');
    process.exit(1);
  }
}

/**
 * Load and parse config file with format detection
 * @param {string} configPath - Path to config.json
 * @returns {{ mcpServers: Object, format: string }} Config data and detected format
 */
function loadConfig(configPath) {
  // Check if file exists
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  // Read and parse JSON
  let configData;
  try {
    const content = readFileSync(configPath, 'utf8');
    configData = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw new Error(`Failed to read config file: ${error.message}`);
  }

  // Detect format and extract mcpServers
  let mcpServers;
  let format;

  if (configData.projects && configData.projects.mcpServers) {
    // Claude Code format: { projects: { mcpServers: {...} } }
    mcpServers = configData.projects.mcpServers;
    format = 'claude-code';
  } else if (configData.mcpServers) {
    // Flat format: { mcpServers: {...} }
    mcpServers = configData.mcpServers;
    format = 'flat';
  } else {
    throw new Error('mcpServers not found in config. Config must contain "mcpServers" (flat format) or "projects.mcpServers" (Claude Code format)');
  }

  return { mcpServers, format, rawConfig: configData };
}

/**
 * Load and validate rules file
 * @param {string} rulesPath - Path to rules.json
 * @returns {Object} Parsed rules object
 */
function loadAndValidateRules(rulesPath) {
  // Check if file exists
  if (!existsSync(rulesPath)) {
    throw new Error(`Rules file not found: ${rulesPath}`);
  }

  // Read and parse JSON
  let rulesData;
  try {
    const content = readFileSync(rulesPath, 'utf8');
    rulesData = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in rules file: ${error.message}`);
    }
    throw new Error(`Failed to read rules file: ${error.message}`);
  }

  // Validate rules structure
  if (!rulesData.rules || !Array.isArray(rulesData.rules)) {
    throw new Error('Rules file must contain a "rules" array');
  }

  // Validate each rule
  rulesData.rules.forEach((rule, index) => {
    if (!rule.service) {
      throw new Error(`Rule at index ${index}: "service" field is required`);
    }

    if (!rule.operations || !Array.isArray(rule.operations)) {
      throw new Error(`Rule at index ${index}: "operations" field is required and must be an array`);
    }

    if (!rule.permission) {
      throw new Error(`Rule at index ${index}: "permission" field is required`);
    }

    if (rule.permission !== 'allow' && rule.permission !== 'deny') {
      throw new Error(`Rule at index ${index}: "permission" must be "allow" or "deny", got "${rule.permission}"`);
    }
  });

  return rulesData;
}

/**
 * Check if a server is already wrapped with mcp-gov-proxy
 * @param {Object} serverConfig - Server configuration object
 * @returns {boolean} True if already wrapped
 */
function isServerWrapped(serverConfig) {
  if (!serverConfig.command) {
    return false;
  }
  return serverConfig.command.includes('mcp-gov-proxy');
}

/**
 * Detect unwrapped servers in config
 * @param {Object} mcpServers - MCP servers configuration
 * @returns {{ wrapped: string[], unwrapped: string[] }} Lists of wrapped and unwrapped server names
 */
function detectUnwrappedServers(mcpServers) {
  const wrapped = [];
  const unwrapped = [];

  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    if (isServerWrapped(serverConfig)) {
      wrapped.push(serverName);
    } else {
      unwrapped.push(serverName);
    }
  }

  return { wrapped, unwrapped };
}

/**
 * Wrap a server configuration with mcp-gov-proxy
 * @param {Object} serverConfig - Original server configuration
 * @param {string} rulesPath - Absolute path to rules.json
 * @returns {Object} Wrapped server configuration
 */
function wrapServer(serverConfig, rulesPath) {
  // Build target command from original config
  let targetCommand = serverConfig.command || '';

  // Append original args if they exist
  if (serverConfig.args && Array.isArray(serverConfig.args)) {
    targetCommand += ' ' + serverConfig.args.join(' ');
  }

  targetCommand = targetCommand.trim();

  // Create wrapped configuration
  const wrappedConfig = {
    command: 'mcp-gov-proxy',
    args: [
      '--target', targetCommand,
      '--rules', rulesPath
    ]
  };

  // Preserve environment variables if they exist
  if (serverConfig.env) {
    wrappedConfig.env = { ...serverConfig.env };
  }

  return wrappedConfig;
}

/**
 * Create a timestamped backup of the config file
 * @param {string} configPath - Path to config file
 * @returns {string} Path to backup file
 */
function createBackup(configPath) {
  const now = new Date();

  // Format: YYYYMMDD-HHMMSS
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${year}${month}${day}-${hour}${minute}${second}`;
  const backupPath = `${configPath}.backup-${timestamp}`;

  copyFileSync(configPath, backupPath);

  return backupPath;
}

/**
 * Wrap unwrapped servers in the config
 * @param {Object} config - Full config object with mcpServers
 * @param {string[]} unwrappedNames - Names of servers to wrap
 * @param {string} rulesPath - Absolute path to rules.json
 * @returns {Object} Modified config with wrapped servers
 */
function wrapServers(config, unwrappedNames, rulesPath) {
  const modifiedConfig = JSON.parse(JSON.stringify(config.rawConfig));

  // Get reference to mcpServers in the modified config
  let mcpServers;
  if (config.format === 'claude-code') {
    mcpServers = modifiedConfig.projects.mcpServers;
  } else {
    mcpServers = modifiedConfig.mcpServers;
  }

  // Wrap each unwrapped server
  for (const serverName of unwrappedNames) {
    const originalConfig = mcpServers[serverName];
    mcpServers[serverName] = wrapServer(originalConfig, rulesPath);
  }

  return modifiedConfig;
}

/**
 * Main entry point
 */
async function main() {
  const args = parseCliArgs();

  if (args.help) {
    showUsage();
  }

  validateArgs(args);

  // Load config file
  let config;
  try {
    config = loadConfig(args.config);
    console.log(`Loaded config in ${config.format} format`);
    console.log(`Found ${Object.keys(config.mcpServers).length} MCP servers`);
  } catch (error) {
    console.error(`Error loading config: ${error.message}`);
    process.exit(1);
  }

  // Validate rules file
  let rules;
  try {
    rules = loadAndValidateRules(args.rules);
    console.log(`Loaded ${rules.rules.length} rules from ${args.rules}`);
  } catch (error) {
    console.error(`Error loading rules: ${error.message}`);
    process.exit(1);
  }

  // Detect unwrapped servers
  const { wrapped, unwrapped } = detectUnwrappedServers(config.mcpServers);

  const totalServers = wrapped.length + unwrapped.length;

  if (totalServers === 0) {
    console.log('No servers found in config');
  } else {
    console.log(`\nServer status:`);
    console.log(`  Total: ${totalServers}`);
    console.log(`  Already wrapped: ${wrapped.length}`);
    console.log(`  Need wrapping: ${unwrapped.length}`);

    if (wrapped.length > 0) {
      console.log(`\nAlready wrapped servers:`);
      wrapped.forEach(name => console.log(`  - ${name}`));
    }

    if (unwrapped.length > 0) {
      console.log(`\nServers to wrap:`);
      unwrapped.forEach(name => console.log(`  - ${name}`));
    } else {
      console.log(`\nAll servers already wrapped, no action needed`);
    }
  }

  // Wrap servers if needed
  if (unwrapped.length > 0) {
    console.log(`\nWrapping ${unwrapped.length} server(s)...`);

    // Create backup before modifying
    try {
      const backupPath = createBackup(args.config);
      console.log(`✓ Created backup: ${backupPath}`);
    } catch (error) {
      console.error(`Error creating backup: ${error.message}`);
      process.exit(1);
    }

    // Get absolute path for rules
    const absoluteRulesPath = resolve(args.rules);

    // Wrap servers
    const wrappedConfig = wrapServers(config, unwrapped, absoluteRulesPath);

    // Write updated config
    try {
      writeFileSync(args.config, JSON.stringify(wrappedConfig, null, 2) + '\n');
      console.log(`✓ Updated config file: ${args.config}`);
    } catch (error) {
      console.error(`Error writing config file: ${error.message}`);
      process.exit(1);
    }
  }

  // TODO: Execute tool command (subtask 2.9)
  console.log(`\nTool command: ${args.tool}`);
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
