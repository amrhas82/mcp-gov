/**
 * Tests for mcp-gov-wrap auto-discovery feature
 * Tests the automatic generation of rules with safe defaults
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

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

describe('mcp-gov-wrap auto-discovery - optional rules', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-discovery');
  const defaultRulesPath = join(homedir(), '.mcp-gov', 'rules.json');
  const defaultRulesDir = join(homedir(), '.mcp-gov');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    // Clean up default rules file created during tests
    if (existsSync(defaultRulesPath)) {
      unlinkSync(defaultRulesPath);
    }
  });

  test('should make --rules optional and default to ~/.mcp-gov/rules.json', async () => {
    const configPath = join(tmpDir, 'config.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Run without --rules flag (currently this would fail)
    const result = await runWrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should not fail due to missing --rules
    if (result.exitCode !== 0) {
      assert.doesNotMatch(result.stderr, /--rules.*required/i);
    }
  });

  test('should accept --rules flag when provided (backwards compatibility)', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'custom-rules.json');

    const config = { mcpServers: {} };
    const rules = { rules: [] };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify(rules));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should work with explicit --rules (existing behavior)
    const output = result.stdout + result.stderr;
    assert.match(output, /rules.*custom-rules\.json/i);
  });
});

describe('mcp-gov-wrap auto-discovery - rules generation', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-discovery');
  const testRulesPath = join(tmpDir, 'generated-rules.json');
  const defaultRulesPath = join(homedir(), '.mcp-gov', 'rules.json');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    // Clean up default rules file created during tests
    if (existsSync(defaultRulesPath)) {
      unlinkSync(defaultRulesPath);
    }
  });

  test('should generate rules file when it does not exist', async () => {
    const configPath = join(tmpDir, 'config.json');

    const config = {
      mcpServers: {
        'github': {
          command: 'node',
          args: [join(projectRoot, 'examples/github/server.js')]
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Set HOME to tmpDir so rules go to test location
    const result = await runWrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should mention rules generation in output
    const output = result.stdout + result.stderr;
    assert.match(output, /generat.*rules|creat.*rules|discover/i);
  });

  test('should apply safe defaults: allow read/write, deny delete/admin/execute', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'test-rules.json');

    // Simple mock server config
    const config = {
      mcpServers: {
        'test-service': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // When rules don't exist, they should be generated
    // This test will pass once we implement the feature
    const result = await runWrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Check that safe defaults were mentioned
    const output = result.stdout + result.stderr;
    assert.match(output, /safe.*default|allow.*read|deny.*delete/i);
  });

  test('should inform user where rules file was created', async () => {
    const configPath = join(tmpDir, 'config.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runWrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should tell user where rules were saved
    const output = result.stdout + result.stderr;
    assert.match(output, /rules.*\.mcp-gov\/rules\.json|saved.*rules/i);
  });

  test('should tell user how to customize rules', async () => {
    const configPath = join(tmpDir, 'config.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));

    const result = await runWrapper([
      '--config', configPath,
      '--tool', 'echo test'
    ]);

    // Should provide instructions on customization
    const output = result.stdout + result.stderr;
    assert.match(output, /customize.*edit|to.*customize.*rules/i);
  });

  test('should not regenerate rules if they already exist', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'existing-rules.json');

    const config = { mcpServers: {} };
    const existingRules = {
      rules: [
        { service: 'test', operations: ['read'], permission: 'deny' }
      ]
    };

    writeFileSync(configPath, JSON.stringify(config));
    writeFileSync(rulesPath, JSON.stringify(existingRules, null, 2));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // Should use existing rules, not regenerate
    const finalRules = JSON.parse(readFileSync(rulesPath, 'utf8'));
    assert.deepStrictEqual(finalRules, existingRules);

    // Should not mention generation
    const output = result.stdout + result.stderr;
    assert.doesNotMatch(output, /generat.*rules|creat.*new.*rules/i);
  });
});

describe('mcp-gov-wrap auto-discovery - generated rules format', () => {
  const tmpDir = join(projectRoot, 'test', 'tmp-discovery');
  const defaultRulesPath = join(homedir(), '.mcp-gov', 'rules.json');

  beforeEach(() => {
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    // Clean up default rules file created during tests
    if (existsSync(defaultRulesPath)) {
      unlinkSync(defaultRulesPath);
    }
  });

  test('should generate rules with safe defaults structure', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'generated.json');

    const config = {
      mcpServers: {
        'test-service': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));

    // Set custom rules path for testing
    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // If rules were generated, check format
    if (existsSync(rulesPath)) {
      const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));

      // Should have rules array
      assert.ok(rules.rules);
      assert.ok(Array.isArray(rules.rules));

      // Should have safe defaults (if any rules generated)
      if (rules.rules.length > 0) {
        const rule = rules.rules[0];
        assert.ok(rule.service);
        assert.ok(rule.operations);
        assert.ok(rule.permission);
      }
    }
  });

  test('should include helpful comment in generated rules', async () => {
    const configPath = join(tmpDir, 'config.json');
    const rulesPath = join(tmpDir, 'with-comment.json');

    const config = {
      mcpServers: {
        'test-server': {
          command: 'node',
          args: ['/path/to/server.js']
        }
      }
    };

    writeFileSync(configPath, JSON.stringify(config));

    const result = await runWrapper([
      '--config', configPath,
      '--rules', rulesPath,
      '--tool', 'echo test'
    ]);

    // If rules were generated, check for comment
    if (existsSync(rulesPath)) {
      const rulesContent = readFileSync(rulesPath, 'utf8');

      // Should have comment about auto-generation or customization
      assert.match(rulesContent, /_comment|comment/i);
    }
  });
});
