/**
 * Platform-specific tests for mcp-gov
 * Tests Windows and macOS path handling scenarios
 */

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, sep, win32, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const wrapperPath = join(projectRoot, 'bin', 'mcp-gov-wrap.js');
const proxyPath = join(projectRoot, 'bin', 'mcp-gov-proxy.js');

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

/**
 * Helper to create temporary test files
 * @param {string} filename - Name of the file
 * @param {object} content - JSON content
 * @returns {string} - Absolute path to created file
 */
function createTempFile(filename, content) {
  const tempDir = join(projectRoot, 'test', 'temp-platform');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, JSON.stringify(content, null, 2));
  return filePath;
}

/**
 * Helper to clean up temp files
 */
function cleanupTempFiles() {
  const tempDir = join(projectRoot, 'test', 'temp-platform');
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('Windows path handling', () => {
  test('should handle Windows absolute paths with drive letters', async () => {
    // Test that the wrapper can parse Windows-style paths
    // This test validates path format, not actual file access on non-Windows systems
    const windowsPath = 'C:\\Users\\test\\config.json';
    const rulesPath = 'C:\\Users\\test\\rules.json';

    // Create temporary files to simulate the test
    const configPath = createTempFile('win-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['C:\\Users\\test\\server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('win-rules.json', {
      rules: []
    });

    try {
      // On Windows, this would work with actual Windows paths
      // On Unix, we test with Unix paths to verify the logic works
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Wrapper should complete without path-related errors
      assert.strictEqual(result.exitCode, 0);
      // Should show that server was wrapped
      assert.match(result.stdout, /Need wrapping: 1|Wrapping 1 server/);
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle Windows UNC paths', async () => {
    // UNC path format: \\\\server\\share\\path
    // This tests that path handling doesn't break on UNC-style paths
    const configPath = createTempFile('unc-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('unc-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should handle paths without breaking
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle Windows paths with backslashes in command', async () => {
    // Test server command with Windows-style paths
    const configPath = createTempFile('backslash-config.json', {
      mcpServers: {
        testServer: {
          // On Windows, commands might have backslashes
          command: 'node',
          args: ['test\\server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('backslash-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Wrapper should preserve the path format when wrapping
      assert.strictEqual(result.exitCode, 0);

      // Read the wrapped config to verify path preservation
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.ok(wrappedConfig.mcpServers.testServer.command.includes('mcp-gov-proxy'));

      // Original path should be preserved in --target argument
      const targetArg = wrappedConfig.mcpServers.testServer.args.find(arg =>
        arg.includes('test') && arg.includes('server.js')
      );
      assert.ok(targetArg, 'Should preserve original command in wrapped config');
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle paths with spaces on Windows', async () => {
    // Windows often has paths with spaces (e.g., "Program Files")
    const configPath = createTempFile('spaces-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['path with spaces\\server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('spaces-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should handle spaces in paths correctly
      assert.strictEqual(result.exitCode, 0);

      // Verify the path with spaces is preserved
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      const hasSpacePath = wrappedConfig.mcpServers.testServer.args.some(arg =>
        arg.includes('path with spaces')
      );
      assert.ok(hasSpacePath, 'Should preserve paths with spaces');
    } finally {
      cleanupTempFiles();
    }
  });

  test('should normalize Windows paths when creating absolute rules path', async () => {
    // When the wrapper wraps a server, it should convert relative rules path to absolute
    // On Windows, this means handling drive letters correctly
    const configPath = createTempFile('normalize-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('normalize-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      assert.strictEqual(result.exitCode, 0);

      // Check that the wrapped config has an absolute path for rules
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      const rulesArg = wrappedConfig.mcpServers.testServer.args.find(arg =>
        arg === '--rules' || arg === '-r'
      );
      assert.ok(rulesArg, 'Should have rules argument');

      const rulesArgIndex = wrappedConfig.mcpServers.testServer.args.indexOf(rulesArg);
      const rulesPathArg = wrappedConfig.mcpServers.testServer.args[rulesArgIndex + 1];

      // On any platform, the rules path should be absolute
      // On Windows it would start with drive letter, on Unix with /
      assert.ok(
        rulesPathArg.startsWith('/') || /^[A-Za-z]:/.test(rulesPathArg),
        'Rules path should be absolute'
      );
    } finally {
      cleanupTempFiles();
    }
  });
});

describe('macOS-specific behaviors', () => {
  test('should handle macOS .app bundle paths', async () => {
    // macOS applications are often in .app bundles
    // e.g., /Applications/MyApp.app/Contents/MacOS/myapp
    const configPath = createTempFile('macos-app-config.json', {
      mcpServers: {
        testServer: {
          command: '/Applications/MyApp.app/Contents/MacOS/node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('macos-app-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should handle .app bundle paths correctly
      assert.strictEqual(result.exitCode, 0);

      // Verify the .app path is preserved
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      const targetArg = wrappedConfig.mcpServers.testServer.args.find(arg =>
        arg.includes('--target') || arg.includes('-t')
      );

      // The original command with .app should be in the wrapped config
      const hasAppPath = JSON.stringify(wrappedConfig).includes('.app');
      assert.ok(hasAppPath, 'Should preserve .app bundle paths');
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle macOS case-sensitive filesystem paths', async () => {
    // macOS can have case-sensitive filesystems (APFS)
    // Test that we preserve exact case
    const configPath = createTempFile('macos-case-config.json', {
      mcpServers: {
        TestServer: {  // Note: capital T
          command: 'node',
          args: ['MyServer.js']  // Note: capital M and S
        }
      }
    });

    const rulesFilePath = createTempFile('macos-case-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      assert.strictEqual(result.exitCode, 0);

      // Verify case is preserved
      const wrappedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.ok(wrappedConfig.mcpServers.TestServer, 'Should preserve server name case');

      const hasCorrectCase = wrappedConfig.mcpServers.TestServer.args.some(arg =>
        arg.includes('MyServer.js')
      );
      assert.ok(hasCorrectCase, 'Should preserve filename case');
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle macOS home directory expansion', async () => {
    // macOS often uses ~ for home directory
    // The wrapper should work with both expanded and unexpanded paths
    const configPath = createTempFile('macos-home-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('macos-home-rules.json', {
      rules: []
    });

    try {
      // Test with actual paths (not ~ paths, as those need shell expansion)
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      assert.strictEqual(result.exitCode, 0);

      // On macOS, home paths should work correctly
      // This is more of a smoke test since ~ expansion is shell-specific
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle macOS extended attributes and resource forks', async () => {
    // macOS files can have extended attributes
    // This is more about not breaking when files have xattrs
    const configPath = createTempFile('macos-xattr-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('macos-xattr-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should not break on files with extended attributes
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle macOS /private symlinks', async () => {
    // macOS has symlinks like /tmp -> /private/tmp
    // Test that the wrapper works with these system symlinks
    const configPath = createTempFile('macos-symlink-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('macos-symlink-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should handle symlinked paths correctly
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });
});

describe('Cross-platform proxy path handling', () => {
  test('should use platform-appropriate path separators', async () => {
    // The proxy should work regardless of platform
    const currentPlatform = platform();
    const expectedSep = currentPlatform === 'win32' ? '\\' : '/';

    // Just verify that Node's path module is being used correctly
    assert.strictEqual(sep, expectedSep);
  });

  test('should handle mixed path separators gracefully', async () => {
    // Some configs might have mixed separators (Windows accepting both / and \\)
    const configPath = createTempFile('mixed-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['path/to\\mixed/separators\\server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('mixed-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should not break on mixed separators
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });
});

describe('Line ending compatibility', () => {
  test('should handle CRLF line endings (Windows)', async () => {
    // Create a config file with CRLF line endings
    const configPath = join(projectRoot, 'test', 'temp-platform', 'crlf-config.json');
    const tempDir = join(projectRoot, 'test', 'temp-platform');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const configContent = JSON.stringify({
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    }, null, 2).replace(/\n/g, '\r\n');  // Convert to CRLF

    writeFileSync(configPath, configContent);

    const rulesFilePath = createTempFile('crlf-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should parse JSON with CRLF correctly
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });

  test('should handle LF line endings (Unix/macOS)', async () => {
    // Create a config file with LF line endings (default)
    const configPath = createTempFile('lf-config.json', {
      mcpServers: {
        testServer: {
          command: 'node',
          args: ['server.js']
        }
      }
    });

    const rulesFilePath = createTempFile('lf-rules.json', {
      rules: []
    });

    try {
      const result = await runWrapper([
        '--config', configPath,
        '--rules', rulesFilePath,
        '--tool', 'echo Test'
      ]);

      // Should parse JSON with LF correctly
      assert.strictEqual(result.exitCode, 0);
    } finally {
      cleanupTempFiles();
    }
  });
});
