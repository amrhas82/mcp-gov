# Testing Guide

## Overview

mcp-gov includes comprehensive automated tests that run on all platforms. The test suite covers proxy functionality, wrapper logic, platform-specific scenarios, and end-to-end integration.

## Running Tests

### All Tests

```bash
npm test
```

This runs all test suites in sequence:
- Proxy tests (14 tests)
- Wrapper tests (49 tests)
- Platform tests (14 tests)
- Integration tests (6 tests)

Total: 83 tests

### Individual Test Suites

```bash
# Proxy functionality tests
npm run test:proxy

# Wrapper functionality tests
npm run test:wrapper

# Platform-specific tests (Windows, macOS, Linux)
npm run test:platform

# End-to-end integration tests
npm run test:integration
```

## Test Coverage

### Proxy Tests (test/proxy.test.js)

- CLI argument parsing
- Subprocess spawning and management
- JSON-RPC message interception
- Operation detection integration
- Permission checking logic
- Audit logging format
- Error handling (crashes, invalid commands)

### Wrapper Tests (test/wrapper.test.js)

- CLI argument validation
- Rules file validation
- Config file reading (Claude Code and flat formats)
- Server detection (wrapped vs unwrapped)
- Server wrapping logic
- Config backup creation
- Idempotency (re-wrapping detection)
- Tool command execution
- Error handling for malformed configs

### Platform Tests (test/platform.test.js)

**Windows Scenarios:**
- Absolute paths with drive letters (`C:\Users\...`)
- UNC network paths (`\\server\share\path`)
- Backslashes in commands
- Paths with spaces (`Program Files`)
- Path normalization for absolute rules paths

**macOS Scenarios:**
- Application bundle paths (`.app` directories)
- Case-sensitive filesystem handling
- Home directory paths
- Extended attributes compatibility
- System symlinks (`/tmp` → `/private/tmp`)

**Cross-Platform:**
- Platform-appropriate path separators
- Mixed path separator handling
- CRLF line endings (Windows)
- LF line endings (Unix/macOS)

### Integration Tests (test/integration.test.js)

- Proxy blocking denied operations (GitHub delete)
- Proxy allowing permitted operations (GitHub list)
- Wrapper detecting and wrapping servers
- Audit log format and content verification
- End-to-end workflow (add server → wrap → enforce rules)
- Wrapper idempotency (no double-wrapping)

## Manual Testing Requirements

### Linux (Current Platform)

✅ All automated tests pass on Linux
✅ Platform-specific tests validate Linux behavior

```bash
# Verify on Linux
uname -a
npm test
```

### macOS Testing

To manually test on macOS:

1. **Setup:**
   ```bash
   git clone <repo>
   cd mcp-gov
   npm install
   npm install -g .
   ```

2. **Run automated tests:**
   ```bash
   npm test
   ```
   All 83 tests should pass.

3. **Manual verification:**
   ```bash
   # Test with .app bundle path
   mcp-gov-wrap --config ~/.config/claude/config.json \
                --rules ~/.mcp-gov/rules.json \
                --tool "echo Test"

   # Verify symlink handling
   ls -la /tmp  # Should show -> /private/tmp
   # Config paths with /tmp should work correctly
   ```

4. **Expected results:**
   - All automated tests pass
   - Commands accept macOS-style paths
   - `.app` bundle paths are preserved in wrapped configs
   - System symlinks work transparently

### Windows Testing

To manually test on Windows:

1. **Setup:**
   ```powershell
   git clone <repo>
   cd mcp-gov
   npm install
   npm install -g .
   ```

2. **Run automated tests:**
   ```powershell
   npm test
   ```
   All 83 tests should pass.

3. **Manual verification:**
   ```powershell
   # Test with Windows paths
   mcp-gov-wrap --config %USERPROFILE%\.config\claude\config.json `
                --rules %USERPROFILE%\.mcp-gov\rules.json `
                --tool "echo Test"

   # Test with UNC path
   mcp-gov-proxy --target "node server.js" --rules \\server\share\rules.json

   # Test with path containing spaces
   mcp-gov-wrap --config "C:\Program Files\Claude\config.json" `
                --rules "C:\Program Files\mcp-gov\rules.json" `
                --tool "echo Test"
   ```

4. **Expected results:**
   - All automated tests pass
   - Commands accept Windows-style paths with drive letters
   - UNC paths work correctly
   - Paths with spaces are handled properly
   - Both forward slashes and backslashes work

## Continuous Integration

### Recommended CI Configuration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      - run: npm install
      - run: npm test
      - run: npm install -g .
      - run: which mcp-gov-proxy && which mcp-gov-wrap
```

## Testing Checklist

Before releasing a new version, verify:

- [ ] All automated tests pass on Linux
- [ ] All automated tests pass on macOS (if available)
- [ ] All automated tests pass on Windows (if available)
- [ ] Global installation works (`npm install -g .`)
- [ ] Binary linking is correct (`which mcp-gov-proxy && which mcp-gov-wrap`)
- [ ] Uninstall/reinstall works cleanly
- [ ] README examples work on all platforms
- [ ] Platform-specific paths are handled correctly

## Troubleshooting

### Tests Failing on Specific Platform

1. Check Node.js version (requires 18+)
2. Verify all dependencies are installed (`npm install`)
3. Check for platform-specific path issues in error messages
4. Review test output for specific failure details

### Binary Not Found After Installation

**Linux/macOS:**
```bash
# Check npm global bin path
npm prefix -g
# Add to PATH if needed
export PATH="$(npm prefix -g)/bin:$PATH"
```

**Windows:**
```powershell
# Check npm global bin path
npm prefix -g
# Add to PATH in System Environment Variables
```

### Permission Errors

**Linux/macOS:**
```bash
# Make binaries executable
chmod +x bin/mcp-gov-proxy.js
chmod +x bin/mcp-gov-wrap.js
```

**Windows:**
PowerShell execution policy might need adjustment:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Test Development

When adding new tests:

1. **Follow existing patterns**: Use `node:test` framework
2. **Clean up resources**: Use try/finally to clean temp files
3. **Test both success and failure**: Cover error cases
4. **Use descriptive names**: Test names should explain what they verify
5. **Verify cross-platform**: Consider how tests work on all platforms

Example test structure:

```javascript
test('should handle <specific scenario>', async () => {
  // Setup
  const tempFile = createTempFile('test.json', { ... });

  try {
    // Execute
    const result = await runCommand([...args]);

    // Verify
    assert.strictEqual(result.exitCode, 0);
    assert.match(result.stdout, /expected output/);
  } finally {
    // Cleanup
    cleanupTempFiles();
  }
});
```

## Performance Testing

While not part of the automated test suite, consider performance testing:

```bash
# Time wrapper execution
time mcp-gov-wrap --config test.json --rules rules.json --tool "echo Done"

# Measure proxy overhead
time mcp-gov-proxy --target "node server.js" --rules rules.json
```

Target: Wrapper should complete in <500ms, proxy overhead <50ms per call.
