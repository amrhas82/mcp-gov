# Manual Testing Guide for MCP Governance

## Quick Start Test (5 minutes)

### 1. Install the tools globally

```bash
cd /home/hamr/PycharmProjects/mcp-gov
npm install -g .
```

Verify installation:
```bash
which mcp-gov-proxy
which mcp-gov-wrap
```

### 2. Test the Proxy Directly

Create a rules file for the proxy:
```bash
cat > /tmp/proxy-rules.json << 'EOF'
{
  "services": {
    "github": {
      "operations": {
        "delete": "deny",
        "list": "allow"
      }
    }
  }
}
EOF
```

Start the GitHub server with governance:
```bash
cd /home/hamr/PycharmProjects/mcp-gov
mcp-gov-proxy --target "node examples/github/server.js" --rules /tmp/proxy-rules.json
```

This will:
- ✅ Allow `github_list_repos` operations
- ❌ Block `github_delete_repo` operations
- 📝 Log all operations to stderr

### 3. Test the Wrapper

Create a test MCP config:
```bash
cat > /tmp/test-config.json << 'EOF'
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["examples/github/server.js"],
      "env": {
        "GITHUB_TOKEN": "test-token"
      }
    }
  }
}
EOF
```

Create wrapper rules:
```bash
cat > /tmp/wrapper-rules.json << 'EOF'
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "deny"
    }
  ]
}
EOF
```

Run the wrapper:
```bash
cd /home/hamr/PycharmProjects/mcp-gov
mcp-gov-wrap --config /tmp/test-config.json --rules /tmp/wrapper-rules.json --tool "cat /tmp/test-config.json"
```

This will:
1. Read your MCP config
2. Detect unwrapped servers
3. Wrap them with governance
4. Create a backup
5. Execute the tool command

### 4. Verify Wrapping

Check the wrapped config:
```bash
cat /tmp/test-config.json
```

You should see:
```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-gov-proxy",
      "args": [
        "--target",
        "node examples/github/server.js",
        "--rules",
        "/tmp/wrapper-rules.json"
      ],
      "env": {
        "GITHUB_TOKEN": "test-token"
      }
    }
  }
}
```

Check the backup was created:
```bash
ls -la /tmp/test-config.json.backup-*
```

### 5. Test Idempotency

Run the wrapper again:
```bash
mcp-gov-wrap --config /tmp/test-config.json --rules /tmp/wrapper-rules.json --tool "echo 'Done'"
```

Output should show:
```
Already wrapped: 1
Need wrapping: 0
```

## Run the Automated Tests

```bash
cd /home/hamr/PycharmProjects/mcp-gov

# Run all tests
npm test

# Or run specific test suites
npm run test:proxy        # Proxy tests
npm run test:wrapper      # Wrapper tests
npm run test:integration  # End-to-end tests
npm run test:platform     # Cross-platform tests
```

## Real-World Test with Claude Code

If you have Claude Code installed:

1. **Create your rules:**
   ```bash
   mkdir -p ~/.mcp-gov
   cat > ~/.mcp-gov/rules.json << 'EOF'
   {
     "rules": [
       {
         "service": "github",
         "operations": ["delete"],
         "permission": "deny"
       }
     ]
   }
   EOF
   ```

2. **Wrap your Claude Code servers:**
   ```bash
   mcp-gov-wrap \
     --config ~/.config/claude/config.json \
     --rules ~/.mcp-gov/rules.json \
     --tool "claude chat"
   ```

3. **Use Claude Code normally:**
   All MCP tool calls are now governed automatically!

## What to Look For

### ✅ Success Indicators:
- Wrapper creates backups before modifying config
- Proxy intercepts tool calls (check stderr logs)
- Denied operations return "Permission denied" errors
- Allowed operations work normally
- No double-wrapping on repeated runs

### 📊 Performance:
- Per-call overhead: should be < 50ms
- Check logs for timing information

### 🐛 Troubleshooting:
- If tests fail intermittently: subprocess timing issues (normal)
- If wrapper fails: check rules format (needs "rules" array)
- If proxy fails: check rules format (needs "services" object)
- Check TESTING.md for more troubleshooting tips

## Documentation

- **Setup Guide**: README.md (Auto-Wrap Setup section)
- **Examples**: examples/auto-wrap-example.md
- **Multi-Client**: examples/multi-client-example.md
- **Testing**: TESTING.md
