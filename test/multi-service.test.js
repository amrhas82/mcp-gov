/**
 * Multi-service integration tests
 * Tests governance with multiple services (GitHub, Google, Slack)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const wrapperPath = join(projectRoot, 'bin', 'mcp-gov-wrap.js');
const proxyPath = join(projectRoot, 'bin', 'mcp-gov-proxy.js');

/**
 * Helper to create temporary test directory
 */
function createTempDir() {
  const tempDir = join(projectRoot, 'test', 'temp-multiservice');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Helper to cleanup temp directory
 */
function cleanupTempDir() {
  const tempDir = join(projectRoot, 'test', 'temp-multiservice');
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Helper to run wrapper
 */
async function runWrapper(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [wrapperPath, ...args]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/**
 * Helper to run proxy with input and capture output
 */
async function runProxyWithInput(targetCommand, rulesPath, input) {
  return new Promise((resolve) => {
    const child = spawn('node', [
      proxyPath,
      '--target', targetCommand,
      '--rules', rulesPath
    ]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Send input after a short delay
    setTimeout(() => {
      child.stdin.write(input + '\n');
      child.stdin.end();
    }, 100);

    // Kill after processing
    setTimeout(() => {
      child.kill('SIGTERM');
    }, 1000);

    child.on('close', () => {
      resolve({ stdout, stderr });
    });
  });
}

describe('Multi-service governance', () => {
  test('should handle multiple services with different rules', async () => {
    const tempDir = createTempDir();

    // Create multi-service config
    const configPath = join(tempDir, 'multi-service-config.json');
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        github: {
          command: 'node',
          args: [join(projectRoot, 'test', 'mock-server.js')]
        },
        google: {
          command: 'node',
          args: [join(projectRoot, 'test', 'mock-server.js')]
        },
        slack: {
          command: 'node',
          args: [join(projectRoot, 'test', 'mock-server.js')]
        }
      }
    }, null, 2));

    // Create multi-service rules
    const rulesPath = join(tempDir, 'multi-service-rules.json');
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        {
          service: 'github',
          operations: ['delete', 'admin'],
          permission: 'deny',
          reason: 'GitHub destructive operations blocked'
        },
        {
          service: 'google',
          operations: ['delete'],
          permission: 'deny',
          reason: 'Google Drive deletion blocked'
        },
        {
          service: 'slack',
          operations: ['delete'],
          permission: 'deny',
          reason: 'Slack message deletion blocked'
        }
      ]
    }, null, 2));

    try {
      // Run wrapper to wrap all services
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesPath,
        '--tool', 'echo Done'
      ]);

      assert.strictEqual(result.exitCode, 0, 'Wrapper should succeed');
      assert.match(result.stdout, /Need wrapping: 3/, 'Should detect 3 unwrapped servers');
      assert.match(result.stdout, /Wrapping 3 server/, 'Should wrap all 3 servers');

      // Verify all services are wrapped
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.strictEqual(wrappedConfig.mcpServers.github.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.google.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.slack.command, 'mcp-gov-proxy');

    } finally {
      cleanupTempDir();
    }
  });

  test('should wrap multiple services with service-specific rules', async () => {
    const tempDir = createTempDir();

    // Create config with 3 services
    const configPath = join(tempDir, 'three-services-config.json');
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        github: { command: 'node', args: ['github-server.js'] },
        google: { command: 'node', args: ['google-server.js'] },
        slack: { command: 'node', args: ['slack-server.js'] }
      }
    }, null, 2));

    // Create rules with different permissions per service
    const rulesPath = join(tempDir, 'service-rules.json');
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        {
          service: 'github',
          operations: ['delete'],
          permission: 'deny',
          reason: 'GitHub delete blocked'
        },
        {
          service: 'google',
          operations: ['write'],
          permission: 'deny',
          reason: 'Google write blocked'
        },
        {
          service: 'slack',
          operations: ['admin'],
          permission: 'deny',
          reason: 'Slack admin blocked'
        }
      ]
    }, null, 2));

    try {
      // Wrap all services
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesPath,
        '--tool', 'echo Done'
      ]);

      assert.strictEqual(result.exitCode, 0);
      assert.match(result.stdout, /Using rules from:/, 'Should use rules file');
      assert.match(result.stdout, /Need wrapping: 3/, 'Should detect 3 services');

      // Verify all services wrapped with correct rules path
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));

      // All should use proxy
      assert.strictEqual(wrappedConfig.mcpServers.github.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.google.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.slack.command, 'mcp-gov-proxy');

      // All should have rules path
      const githubArgs = wrappedConfig.mcpServers.github.args.join(' ');
      const googleArgs = wrappedConfig.mcpServers.google.args.join(' ');
      const slackArgs = wrappedConfig.mcpServers.slack.args.join(' ');

      assert.match(githubArgs, /--rules/, 'GitHub should have rules argument');
      assert.match(googleArgs, /--rules/, 'Google should have rules argument');
      assert.match(slackArgs, /--rules/, 'Slack should have rules argument');

    } finally {
      cleanupTempDir();
    }
  });

  test('should handle partial rules (some services without rules)', async () => {
    const tempDir = createTempDir();

    // Create config with 4 services
    const configPath = join(tempDir, 'partial-rules-config.json');
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        github: { command: 'node', args: ['server.js'] },
        google: { command: 'node', args: ['server.js'] },
        slack: { command: 'node', args: ['server.js'] },
        aws: { command: 'node', args: ['server.js'] }
      }
    }, null, 2));

    // Rules only for 2 services (default allow for others)
    const rulesPath = join(tempDir, 'partial-rules.json');
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        {
          service: 'github',
          operations: ['delete'],
          permission: 'deny'
        },
        {
          service: 'google',
          operations: ['delete'],
          permission: 'deny'
        }
      ]
    }, null, 2));

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesPath,
        '--tool', 'echo Done'
      ]);

      assert.strictEqual(result.exitCode, 0);
      assert.match(result.stdout, /Found 4 MCP servers/, 'Should find all 4 servers');

      // All services should still be wrapped (even those without specific rules)
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.strictEqual(wrappedConfig.mcpServers.github.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.google.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.slack.command, 'mcp-gov-proxy');
      assert.strictEqual(wrappedConfig.mcpServers.aws.command, 'mcp-gov-proxy');

    } finally {
      cleanupTempDir();
    }
  });

  test('should correctly count operations by service', async () => {
    const tempDir = createTempDir();

    // Create config with 5 different services
    const configPath = join(tempDir, 'five-services-config.json');
    writeFileSync(configPath, JSON.stringify({
      mcpServers: {
        github: { command: 'node', args: ['server.js'] },
        google: { command: 'node', args: ['server.js'] },
        slack: { command: 'node', args: ['server.js'] },
        aws: { command: 'node', args: ['server.js'] },
        database: { command: 'node', args: ['server.js'] }
      }
    }, null, 2));

    const rulesPath = join(tempDir, 'five-services-rules.json');
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { service: 'github', operations: ['delete'], permission: 'deny' },
        { service: 'google', operations: ['delete'], permission: 'deny' },
        { service: 'slack', operations: ['delete'], permission: 'deny' },
        { service: 'aws', operations: ['admin'], permission: 'deny' },
        { service: 'database', operations: ['delete', 'admin'], permission: 'deny' }
      ]
    }, null, 2));

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesPath,
        '--tool', 'echo Done'
      ]);

      assert.strictEqual(result.exitCode, 0);
      assert.match(result.stdout, /Found 5 MCP servers/, 'Should find 5 servers');
      assert.match(result.stdout, /Using rules from:/, 'Should use rules file');
      assert.match(result.stdout, /Need wrapping: 5/, 'Should wrap all 5 servers');

    } finally {
      cleanupTempDir();
    }
  });
});
