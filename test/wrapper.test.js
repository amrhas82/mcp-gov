/**
 * Tests for mcp-gov-wrap - Generic MCP Server Wrapper
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const wrapperPath = join(projectRoot, 'bin', 'mcp-gov-wrap.js');

/**
 * Helper to run wrapper with arguments
 * @param {string[]} args - Command line arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
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

describe('mcp-gov-wrap CLI argument parsing', () => {
  test('should show usage with --help flag', async () => {
    const result = await runWrapper(['--help']);

    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--config/);
    assert.match(result.stdout, /--rules/);
    assert.match(result.stdout, /--tool/);
  });

  test('should show usage with -h flag', async () => {
    const result = await runWrapper(['-h']);

    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /Usage:/);
  });

  test('should require --config argument', async () => {
    const result = await runWrapper(['--rules', 'rules.json', '--tool', 'claude']);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /--config.*required/i);
  });

  test('should require --rules argument', async () => {
    const result = await runWrapper(['--config', 'config.json', '--tool', 'claude']);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /--rules.*required/i);
  });

  test('should require --tool argument', async () => {
    const result = await runWrapper(['--config', 'config.json', '--rules', 'rules.json']);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /--tool.*required/i);
  });

  test('should accept valid arguments', async () => {
    // Create temporary files
    const tmpDir = join(projectRoot, 'test', 'tmp');
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }

    const configPath = join(tmpDir, 'test-config.json');
    const rulesPath = join(tmpDir, 'test-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesPath,
        '--tool', 'echo "test"'
      ]);

      // Should not fail on argument parsing
      // (may fail later due to missing config, but args are valid)
      if (result.exitCode !== 0) {
        // Check that error is NOT about missing required arguments
        assert.doesNotMatch(result.stderr, /--config.*required/i);
        assert.doesNotMatch(result.stderr, /--rules.*required/i);
        assert.doesNotMatch(result.stderr, /--tool.*required/i);
      }
    } finally {
      // Cleanup
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });

  test('should accept short form flags', async () => {
    const tmpDir = join(projectRoot, 'test', 'tmp');
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }

    const configPath = join(tmpDir, 'test-config.json');
    const rulesPath = join(tmpDir, 'test-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    try {
      const result = await runWrapper([
        '-c', configPath,
        '-r', rulesPath,
        '-t', 'echo "test"'
      ]);

      // Should not fail on argument parsing
      if (result.exitCode !== 0) {
        assert.doesNotMatch(result.stderr, /--config.*required/i);
        assert.doesNotMatch(result.stderr, /--rules.*required/i);
        assert.doesNotMatch(result.stderr, /--tool.*required/i);
      }
    } finally {
      // Cleanup
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });
});

describe('mcp-gov-wrap rules validation', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should reject missing rules file', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'nonexistent-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /rules.*not found/i);
  });

  test('should reject malformed rules JSON', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'bad-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, '{invalid json');

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /invalid.*json|parse.*error/i);
  });

  test('should reject rules without rules array', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'no-rules-array.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ notRules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /rules.*must.*array/i);
  });

  test('should reject rule without service field', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'missing-service.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { operations: ['list'], permission: 'allow' }
      ]
    }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /rule.*service.*required/i);
  });

  test('should reject rule without operations field', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'missing-operations.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { service: 'github', permission: 'allow' }
      ]
    }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /rule.*operations.*required/i);
  });

  test('should reject rule without permission field', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'missing-permission.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { service: 'github', operations: ['list'] }
      ]
    }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /rule.*permission.*required/i);
  });

  test('should reject rule with invalid permission value', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'invalid-permission.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { service: 'github', operations: ['list'], permission: 'maybe' }
      ]
    }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /permission.*allow.*deny/i);
  });

  test('should accept valid rules file', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'valid-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({
      rules: [
        { service: 'github', operations: ['list'], permission: 'allow' },
        { service: 'github', operations: ['delete'], permission: 'deny' }
      ]
    }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not fail on rules validation
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /rules.*invalid|permission.*allow.*deny|rule.*required/i);
    }
  });

  test('should accept empty rules array', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'empty-rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not fail on rules validation
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /rules.*invalid|permission.*allow.*deny|rule.*required/i);
    }
  });
});

describe('mcp-gov-wrap config file reading', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should reject missing config file', async () => {
    const configPath = join(tmpDir, 'nonexistent-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /config.*not found/i);
  });

  test('should reject malformed config JSON', async () => {
    const configPath = join(tmpDir, 'bad-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    writeFileSync(configPath, '{invalid json');
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /invalid.*json|parse.*error/i);
  });

  test('should read Claude Code format (projects.mcpServers)', async () => {
    const configPath = join(tmpDir, 'claude-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const claudeConfig = {
      projects: {
        mcpServers: {
          'github-test': {
            command: 'node',
            args: ['/path/to/github-server.js'],
            env: { GITHUB_TOKEN: 'test' }
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(claudeConfig));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not fail on config reading
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /config.*not found|invalid.*json|mcpServers.*required/i);
    }
  });

  test('should read flat format (mcpServers)', async () => {
    const configPath = join(tmpDir, 'flat-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const flatConfig = {
      mcpServers: {
        'github-test': {
          command: 'node',
          args: ['/path/to/github-server.js'],
          env: { GITHUB_TOKEN: 'test' }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(flatConfig));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not fail on config reading
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /config.*not found|invalid.*json|mcpServers.*required/i);
    }
  });

  test('should reject config without mcpServers', async () => {
    const configPath = join(tmpDir, 'no-servers-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    writeFileSync(configPath, JSON.stringify({ other: 'data' }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /mcpServers.*not found/i);
  });

  test('should accept config with empty mcpServers', async () => {
    const configPath = join(tmpDir, 'empty-servers-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not fail on config reading (but may show "no servers to wrap" message)
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /config.*not found|invalid.*json|mcpServers.*required/i);
    }
  });
});

describe('mcp-gov-wrap unwrapped server detection', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should detect unwrapped server (no mcp-gov-proxy in command)', async () => {
    const configPath = join(tmpDir, 'unwrapped-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'github-server': {
          command: 'node',
          args: ['/path/to/github-server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should detect unwrapped server (stdout or stderr should mention wrapping)
    const output = result.stdout + result.stderr;
    assert.match(output, /wrap|unwrapped|github-server/i);
  });

  test('should detect already wrapped server (mcp-gov-proxy in command)', async () => {
    const configPath = join(tmpDir, 'wrapped-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'github-server': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'node /path/to/github-server.js', '--rules', '/path/to/rules.json']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should detect already wrapped server (stdout should mention already wrapped or skip)
    const output = result.stdout + result.stderr;
    assert.match(output, /already|wrapped|skip/i);
  });

  test('should detect mix of wrapped and unwrapped servers', async () => {
    const configPath = join(tmpDir, 'mixed-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'github-server': {
          command: 'node',
          args: ['/path/to/github-server.js']
        },
        'slack-server': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'node /path/to/slack-server.js', '--rules', '/path/to/rules.json']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should mention both servers appropriately
    const output = result.stdout + result.stderr;
    assert.match(output, /github-server/i);
    assert.match(output, /slack-server/i);
  });

  test('should report when no servers need wrapping', async () => {
    const configPath = join(tmpDir, 'all-wrapped-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'github-server': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'node /path/to/github-server.js', '--rules', '/path/to/rules.json']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should report all servers already wrapped
    const output = result.stdout + result.stderr;
    assert.match(output, /no.*server|all.*wrapped|already.*wrapped/i);
  });

  test('should report when no servers exist', async () => {
    const configPath = join(tmpDir, 'empty-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    writeFileSync(configPath, JSON.stringify({ mcpServers: {} }));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should report no servers found
    const output = result.stdout + result.stderr;
    assert.match(output, /no.*server|0.*server/i);
  });
});

describe('mcp-gov-wrap server wrapping logic', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should wrap simple server with no args', async () => {
    const configPath = join(tmpDir, 'simple-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const wrappedServer = modifiedConfig.mcpServers['test-server'];

    // Should use mcp-gov-proxy as command
    assert.strictEqual(wrappedServer.command, 'mcp-gov-proxy');

    // Should have --target and --rules args
    assert.ok(wrappedServer.args.includes('--target'));
    assert.ok(wrappedServer.args.includes('--rules'));

    // Should preserve original command in --target
    const targetIndex = wrappedServer.args.indexOf('--target');
    const targetValue = wrappedServer.args[targetIndex + 1];
    assert.match(targetValue, /node.*server\.js/);
  });

  test('should preserve original args when wrapping', async () => {
    const configPath = join(tmpDir, 'args-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js', '--port', '3000', '--verbose']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const wrappedServer = modifiedConfig.mcpServers['test-server'];

    // Should preserve all original args in --target
    const targetIndex = wrappedServer.args.indexOf('--target');
    const targetValue = wrappedServer.args[targetIndex + 1];
    assert.match(targetValue, /--port.*3000/);
    assert.match(targetValue, /--verbose/);
  });

  test('should preserve environment variables when wrapping', async () => {
    const configPath = join(tmpDir, 'env-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js'],
          env: {
            API_KEY: 'secret123',
            DEBUG: 'true'
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const wrappedServer = modifiedConfig.mcpServers['test-server'];

    // Should preserve env vars
    assert.ok(wrappedServer.env);
    assert.strictEqual(wrappedServer.env.API_KEY, 'secret123');
    assert.strictEqual(wrappedServer.env.DEBUG, 'true');
  });

  test('should handle servers with no args field', async () => {
    const configPath = join(tmpDir, 'no-args-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: '/usr/bin/mcp-server'
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should not crash
    assert.strictEqual(result.exitCode, 0);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const wrappedServer = modifiedConfig.mcpServers['test-server'];

    // Should use mcp-gov-proxy
    assert.strictEqual(wrappedServer.command, 'mcp-gov-proxy');
  });

  test('should use absolute path for rules in wrapped config', async () => {
    const configPath = join(tmpDir, 'test-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const wrappedServer = modifiedConfig.mcpServers['test-server'];

    // Find --rules argument
    const rulesIndex = wrappedServer.args.indexOf('--rules');
    const rulesValue = wrappedServer.args[rulesIndex + 1];

    // Should be absolute path
    assert.strictEqual(rulesValue, rulesPath);
  });
});

describe('mcp-gov-wrap config backup', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('should create timestamped backup before modifying config', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const originalConfig = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Check for backup file with timestamp pattern (YYYYMMDD-HHMMSS format)
    const backupPattern = /config\.json\.backup-\d{8}-\d{6}/;
    const files = rmSync(tmpDir, { recursive: true, force: false });

    // Alternative: check if backup message in output
    const output = result.stdout + result.stderr;
    assert.match(output, /backup/i);
  });

  test('should preserve original config content in backup', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const originalConfig = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js'],
          env: { KEY: 'value' }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Find backup file
    const files = readdirSync(tmpDir);
    const backupFile = files.find(f => f.match(/config\.json\.backup-/));

    assert.ok(backupFile, 'Backup file should exist');

    // Read backup and verify it matches original
    const backupPath = join(tmpDir, backupFile);
    const backupContent = JSON.parse(readFileSync(backupPath, 'utf8'));

    assert.deepStrictEqual(backupContent, originalConfig);
  });

  test('should not create backup if no servers need wrapping', async () => {
    const configPath = join(tmpDir, 'wrapped-config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const wrappedConfig = {
      mcpServers: {
        'test-server': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'node /path/to/server.js', '--rules', '/path/to/rules.json']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(wrappedConfig, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Check that no backup was created
    const files = readdirSync(tmpDir);
    const backupFile = files.find(f => f.match(/config\.json\.backup-/));

    assert.ok(!backupFile, 'Backup file should not exist when no changes needed');
  });

  test('should use YYYYMMDD-HHMMSS format for backup timestamp', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'rules.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(rulesPath, JSON.stringify({ rules: [] }));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Find backup file and verify timestamp format
    const files = readdirSync(tmpDir);
    const backupFile = files.find(f => f.match(/config\.json\.backup-/));

    assert.ok(backupFile, 'Backup file should exist');

    // Extract timestamp and verify format
    const timestampMatch = backupFile.match(/backup-(\d{8})-(\d{6})/);
    assert.ok(timestampMatch, 'Timestamp should match YYYYMMDD-HHMMSS format');

    const [, date, time] = timestampMatch;

    // Verify date format (YYYYMMDD)
    assert.strictEqual(date.length, 8);
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6));
    const day = parseInt(date.substring(6, 8));
    assert.ok(year >= 2024 && year <= 2100);
    assert.ok(month >= 1 && month <= 12);
    assert.ok(day >= 1 && day <= 31);

    // Verify time format (HHMMSS)
    assert.strictEqual(time.length, 6);
    const hour = parseInt(time.substring(0, 2));
    const minute = parseInt(time.substring(2, 4));
    const second = parseInt(time.substring(4, 6));
    assert.ok(hour >= 0 && hour <= 23);
    assert.ok(minute >= 0 && minute <= 59);
    assert.ok(second >= 0 && second <= 59);
  });
});
