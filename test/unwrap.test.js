/**
 * Tests for mcp-gov-unwrap - MCP Server Unwrapper
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const unwrapperPath = join(projectRoot, 'bin', 'mcp-gov-unwrap.js');

/**
 * Helper to run unwrapper with arguments
 * @param {string[]} args - Command line arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
async function runUnwrapper(args) {
  return new Promise((resolve) => {
    const child = spawn('node', [unwrapperPath, ...args]);
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

describe('mcp-gov-unwrap CLI argument parsing', () => {
  test('should show usage with --help flag', async () => {
    const result = await runUnwrapper(['--help']);

    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--config/);
  });

  test('should require --config argument', async () => {
    const result = await runUnwrapper(['--tool', 'echo test']);

    assert.notStrictEqual(result.exitCode, 0);
    assert.match(result.stderr, /--config.*required/i);
  });

  test('should allow optional --tool argument', async () => {
    const result = await runUnwrapper(['--config', 'config.json']);

    // Should not fail due to missing --tool (it's optional)
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /--tool.*required/i);
    }
  });
});

describe('mcp-gov-unwrap wrapped server detection', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-unwrap');

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

  test('should detect wrapped servers (has _original field)', async () => {
    const configPath = join(tmpDir, 'wrapped-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/path/to/rules.json'],
          env: { GITHUB_TOKEN: 'xxx' },
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should detect wrapped server
    const output = result.stdout + result.stderr;
    assert.match(output, /unwrap|github|wrapped/i);
  });

  test('should skip already unwrapped servers (no _original field)', async () => {
    const configPath = join(tmpDir, 'unwrapped-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'xxx' }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should report no servers need unwrapping
    const output = result.stdout + result.stderr;
    assert.match(output, /no.*server|already.*unwrapped|all.*unwrapped/i);
  });

  test('should detect mix of wrapped and unwrapped servers', async () => {
    const configPath = join(tmpDir, 'mixed-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        },
        'slack': {
          command: 'node',
          args: ['/path/to/slack-server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should mention github needs unwrapping, slack already unwrapped
    const output = result.stdout + result.stderr;
    assert.match(output, /github/i);
    assert.match(output, /1.*server|Need unwrapping: 1/i);
  });
});

describe('mcp-gov-unwrap server unwrapping logic', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-unwrap');

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

  test('should restore command and args from _original', async () => {
    const configPath = join(tmpDir, 'restore-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
          env: { GITHUB_TOKEN: 'xxx' },
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const unwrappedServer = modifiedConfig.mcpServers['github'];

    // Should restore original command and args
    assert.strictEqual(unwrappedServer.command, 'npx');
    assert.deepStrictEqual(unwrappedServer.args, ['-y', '@modelcontextprotocol/server-github']);

    // Should preserve env
    assert.ok(unwrappedServer.env);
    assert.strictEqual(unwrappedServer.env.GITHUB_TOKEN, 'xxx');
  });

  test('should delete _original field after unwrapping', async () => {
    const configPath = join(tmpDir, 'delete-original-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const unwrappedServer = modifiedConfig.mcpServers['github'];

    // Should NOT have _original field
    assert.strictEqual(unwrappedServer._original, undefined);
  });

  test('should preserve env unchanged', async () => {
    const configPath = join(tmpDir, 'env-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
          env: {
            GITHUB_TOKEN: 'secret123',
            DEBUG: 'true'
          },
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const unwrappedServer = modifiedConfig.mcpServers['github'];

    // Should preserve all env vars
    assert.ok(unwrappedServer.env);
    assert.strictEqual(unwrappedServer.env.GITHUB_TOKEN, 'secret123');
    assert.strictEqual(unwrappedServer.env.DEBUG, 'true');
  });

  test('should handle servers with no env field', async () => {
    const configPath = join(tmpDir, 'no-env-config.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'mcp-gov-proxy',
          args: ['--target', '/usr/bin/mcp-server', '--rules', '/rules.json'],
          _original: {
            command: '/usr/bin/mcp-server',
            args: []
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should not crash
    assert.strictEqual(result.exitCode, 0);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const unwrappedServer = modifiedConfig.mcpServers['test-server'];

    // Should restore command
    assert.strictEqual(unwrappedServer.command, '/usr/bin/mcp-server');
    assert.deepStrictEqual(unwrappedServer.args, []);
  });

  test('should handle wrapped server missing _original field gracefully', async () => {
    const configPath = join(tmpDir, 'missing-original-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json']
          // Missing _original field
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should handle gracefully - either warn or skip
    const output = result.stdout + result.stderr;
    assert.match(output, /warn|skip|no.*original|cannot.*unwrap/i);
  });
});

describe('mcp-gov-unwrap config backup', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-unwrap');

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

  test('should create timestamped backup before unwrapping', async () => {
    const configPath = join(tmpDir, 'config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'mcp-gov-proxy',
          args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
          _original: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github']
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Check for backup message in output
    const output = result.stdout + result.stderr;
    assert.match(output, /backup/i);
  });

  test('should be idempotent (no-op if already unwrapped)', async () => {
    const configPath = join(tmpDir, 'idempotent-config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: 'xxx' }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Run unwrapper twice
    const result1 = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    const result2 = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Both runs should report no servers need unwrapping
    const output1 = result1.stdout + result1.stderr;
    const output2 = result2.stdout + result2.stderr;

    assert.match(output1, /no.*server|already|unwrapped/i);
    assert.match(output2, /no.*server|already|unwrapped/i);

    // Config should remain unchanged
    const finalConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.strictEqual(finalConfig.mcpServers.github.command, 'npx');
    assert.deepStrictEqual(finalConfig.mcpServers.github.args, ['-y', '@modelcontextprotocol/server-github']);
  });
});

describe('mcp-gov-unwrap multi-project format support', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-unwrap');

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

  test('should support multi-project format (projects[path].mcpServers)', async () => {
    const configPath = join(tmpDir, 'multi-project-config.json');

    const config = {
      projects: {
        '/home/user/myproject': {
          mcpServers: {
            'github': {
              command: 'mcp-gov-proxy',
              args: ['--target', 'npx -y @modelcontextprotocol/server-github', '--rules', '/rules.json'],
              _original: {
                command: 'npx',
                args: ['-y', '@modelcontextprotocol/server-github']
              }
            }
          }
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runUnwrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should detect multi-project format
    const output = result.stdout + result.stderr;
    assert.match(output, /multi-project|project/i);

    // Read modified config
    const modifiedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    const unwrappedServer = modifiedConfig.projects['/home/user/myproject'].mcpServers['github'];

    // Should unwrap correctly
    assert.strictEqual(unwrappedServer.command, 'npx');
    assert.deepStrictEqual(unwrappedServer.args, ['-y', '@modelcontextprotocol/server-github']);
    assert.strictEqual(unwrappedServer._original, undefined);
  });
});
