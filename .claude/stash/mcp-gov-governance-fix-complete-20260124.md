# MCP-Gov Governance Fix - Complete Session Stash
**Date:** 2026-01-24
**Session:** Critical bug fixes for governance enforcement

## Summary

Successfully fixed 3 critical bugs that were causing governance rules to be completely bypassed. MCP-Gov now properly enforces permission rules.

## Bugs Fixed

### Bug #1: Missing `--service` Parameter
**Commit:** `cba36d7`
- **Problem:** Proxy extracted service name from tool name prefix (`list_directory` → `"list"`) instead of using the actual MCP server name (`"filesystem"`)
- **Fix:** Added `--service` parameter to proxy, wrap tool now passes server name automatically
- **Files:** `bin/mcp-gov-proxy.js`, `bin/mcp-gov-wrap.js`

### Bug #2: Rules Format Mismatch
**Commit:** `2185516`
- **Problem:** Proxy expected `{services: {name: {operations: {op: "deny"}}}}` format but wrap generates `{rules: [{service, operations[], permission}]}`
- **Fix:** Proxy now supports BOTH formats
- **File:** `bin/mcp-gov-proxy.js` - `isOperationAllowed()` function

### Bug #3: Stale MCP Processes
- **Problem:** Old MCP server processes from previous sessions were still running without the fix
- **Fix:** User needed to kill old processes and restart Claude
- **Command:** `pkill -f "mcp-server-filesystem"` then restart Claude

## Features Added

### `[MCP-GOV]` Prefix in Denial Messages
**Commit:** `f07eaf1`
- Error messages now clearly show governance is blocking: `[MCP-GOV] Permission denied: filesystem.read operation on tool list_directory`

### Automatic Audit Logging by Service
**Commits:** `da68020`, `36125d8`
- Logs automatically written to `~/.mcp-gov/logs/<service>.log`
- Example: `~/.mcp-gov/logs/filesystem.log`
- Appends to existing files (never overwrites)
- Can override with `--log` parameter

## Current State

### Working ✅
- Governance rules enforced correctly
- `--service` parameter passed automatically by wrap tool
- Both rules formats supported (array and object)
- Audit logging to files by service
- `[MCP-GOV]` prefix in denial messages

### Config Structure (Wrapped)
```json
{
  "filesystem": {
    "command": "mcp-gov-proxy",
    "args": [
      "--service", "filesystem",
      "--target", "npx -y @modelcontextprotocol/server-filesystem /path",
      "--rules", "/home/user/.mcp-gov/rules.json"
    ],
    "_original": { ... }
  }
}
```

### Rules Structure
```json
{
  "rules": [
    {
      "service": "filesystem",
      "operations": ["read"],
      "permission": "deny"
    }
  ]
}
```

### Log Structure
```
~/.mcp-gov/
├── rules.json              # Governance rules
└── logs/
    ├── filesystem.log      # Filesystem MCP audit log
    └── github.log          # GitHub MCP audit log
```

### Log Format
```
[AUDIT] 2026-01-24T00:05:23.456Z | DENIED | tool=list_directory | service=filesystem | operation=read
```

## Git Commits (This Session)
```
36125d8 feat: Organize audit logs by service
da68020 feat: Add automatic audit logging to ~/.mcp-gov/audit.log
f07eaf1 fix: Add [MCP-GOV] prefix to denial messages for clarity
2185516 fix: Support array-based rules format from mcp-gov-wrap
cba36d7 fix: Add --service parameter to ensure correct rule matching
```

## Test Verification

Governance working - user tested:
```
❯ use filesystem to list top 3 dir
Error: MCP error -32000: [MCP-GOV] Permission denied: filesystem.read operation on tool list_directory
```

## Commands Reference

```bash
# Wrap MCP servers with governance
mcp-gov-wrap --config ~/.claude.json

# Unwrap (restore original)
mcp-gov-unwrap --config ~/.claude.json

# Check wrapped config
cat ~/.claude.json | jq '.projects["/path"].mcpServers'

# Check rules
cat ~/.mcp-gov/rules.json

# View audit logs
cat ~/.mcp-gov/logs/filesystem.log
tail -f ~/.mcp-gov/logs/*.log

# Kill stale MCP processes (if needed)
pkill -f "mcp-server-filesystem"

# Reinstall after code changes
sudo npm link
```

## Files Modified

- `bin/mcp-gov-proxy.js` - Added --service, --log, rules format support, audit logging
- `bin/mcp-gov-wrap.js` - Pass service name when wrapping
- `test/service-param.test.js` - New test for service parameter
- `package.json` - Added test:service-param script
- `README.md` - Updated documentation

## Key Learnings

1. MCP servers persist across Claude sessions - need to kill old processes after updates
2. Tool name prefixes don't reliably map to service names - explicit --service required
3. Rules format consistency between wrap tool and proxy is critical
4. Audit logs should be organized by service for easier debugging
