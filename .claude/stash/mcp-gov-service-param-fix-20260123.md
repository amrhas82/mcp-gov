# MCP-Gov Session Stash
**Date:** 2026-01-23
**Session:** Service Parameter Fix Investigation

## Current Status

### What We Built Today
1. ✅ **mcp-gov-unwrap** command - restores original config from `_original` field
2. ✅ **Multi-project config support** - auto-detects all `mcpServers` sections across flat/nested configs
3. ✅ **Simplified CLI** - made `--tool` optional for both wrap/unwrap
4. ✅ **Store `_original` field** - enables lossless unwrap
5. ✅ **Comprehensive tests** - 14 unwrap tests, updated wrap tests
6. ✅ **Documentation** - updated README.md, added QUICK_REFERENCE.md

### Critical Bug Discovered 🐛

**Problem:** Governance rules are NOT being enforced!

**Root Cause:** The proxy doesn't know which MCP server it's wrapping, so it can't match service names in rules.

**Example:**
- User has `filesystem` MCP server
- Rules say: `service: "filesystem", operations: ["read"], permission: "deny"`
- Tool called: `list_directory`
- Proxy extracts service from tool name: `extractService("list_directory")` → `"list"`
- Proxy looks for rules with `service: "list"` → NOT FOUND
- **Defaults to ALLOW** (bypasses governance!)

**Expected:**
- Proxy should know it's wrapping the "filesystem" service
- Check rules for `service: "filesystem"`
- DENY the operation

### The Fix (Not Yet Implemented)

Add `--service` parameter to `mcp-gov-proxy`:

```bash
mcp-gov-proxy \
  --service filesystem \
  --target "npx -y @modelcontextprotocol/server-filesystem" \
  --rules /path/to/rules.json
```

**Implementation Steps:**
1. Update `bin/mcp-gov-proxy.js`:
   - Add `--service` parameter to CLI args
   - Use provided service name instead of extracting from tool name
   - Keep tool name extraction as fallback for backward compatibility

2. Update `bin/mcp-gov-wrap.js`:
   - When wrapping, add `--service <serverName>` to proxy args
   - Server name = key in mcpServers config (e.g., "filesystem", "github")

3. Update tests:
   - Add tests for `--service` parameter
   - Test that rules are enforced correctly with service param
   - Test fallback to tool name extraction

4. Update documentation:
   - Document `--service` parameter in README
   - Update examples to show service parameter

## Test Case That Fails

```bash
# Setup
1. Unwrap all: mcp-gov-unwrap --config ~/.claude.json
2. Remove all MCPs except filesystem
3. Edit ~/.mcp-gov/rules.json:
   {
     "service": "filesystem",
     "operations": ["read"],
     "permission": "deny"
   }
4. Wrap: mcp-gov-wrap --config ~/.claude.json
5. Test: Ask Claude to "list files in current directory"

# Current Result: ❌ PASSES (governance bypassed)
# Expected Result: ✅ DENIED by governance

# Why it fails:
- Tool: list_directory
- Proxy extracts service: "list" (wrong!)
- No rules for service "list"
- Defaults to ALLOW
```

## File Locations

- **Proxy:** `~/PycharmProjects/mcp-gov/bin/mcp-gov-proxy.js`
- **Wrap tool:** `~/PycharmProjects/mcp-gov/bin/mcp-gov-wrap.js`
- **Unwrap tool:** `~/PycharmProjects/mcp-gov/bin/mcp-gov-unwrap.js`
- **Service extractor:** `~/PycharmProjects/mcp-gov/src/operation-detector.js`
- **Rules file:** `~/.mcp-gov/rules.json`
- **User config:** `~/.claude.json` (multi-project format)

## Key Code Sections

### Current Service Extraction (Broken)
`src/operation-detector.js`:
```javascript
export function extractService(toolName) {
  // Split by underscore and take first segment
  const parts = toolName.split('_');
  return parts.length > 1 ? parts[0] : 'unknown';
}
// list_directory → "list" (WRONG!)
// github_delete_repo → "github" (works by accident!)
```

### Proxy Permission Check
`bin/mcp-gov-proxy.js`:
```javascript
const service = extractService(toolName);  // BUG: Uses tool name
const operation = detectOperation(toolName);

// Check permissions against rules
const isAllowed = checkPermission(rules, service, operation);
```

## Config Structure

**Wrapped config (current):**
```json
{
  "filesystem": {
    "command": "mcp-gov-proxy",
    "args": [
      "--target", "npx -y @modelcontextprotocol/server-filesystem /path",
      "--rules", "/home/user/.mcp-gov/rules.json"
    ],
    "_original": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    }
  }
}
```

**After fix (should be):**
```json
{
  "filesystem": {
    "command": "mcp-gov-proxy",
    "args": [
      "--service", "filesystem",  // ← ADD THIS
      "--target", "npx -y @modelcontextprotocol/server-filesystem /path",
      "--rules", "/home/user/.mcp-gov/rules.json"
    ],
    "_original": { ... }
  }
}
```

## Recent Commits

- `b9d5d76` - feat: Add mcp-gov-unwrap and multi-project config support
- `0cf940d` - feat: Auto-Wrap MCP Governance System

## Next Steps

1. Implement `--service` parameter in proxy
2. Update wrap tool to pass service name
3. Add tests for service parameter
4. Update documentation
5. Test with real config (filesystem deny read)
6. Commit and push fix

## Environment

- **Project:** ~/PycharmProjects/mcp-gov
- **Branch:** main
- **Node:** v20+ (using ES modules)
- **Tests:** Pass (50/50 wrap, 14/14 unwrap) - but don't test actual enforcement
- **Install:** `sudo npm link` (globally installed)

## Commands

```bash
# Current working commands
mcp-gov-wrap --config ~/.claude.json
mcp-gov-unwrap --config ~/.claude.json

# Test governance (currently broken)
# 1. Set filesystem read to deny
# 2. Ask Claude to list files
# 3. Should be blocked but isn't

# Check rules
cat ~/.mcp-gov/rules.json | jq '.rules[] | select(.service == "filesystem")'

# Check if wrapped
cat ~/.claude.json | jq '.projects[].mcpServers.filesystem'
```

## Notes

- Multi-project config support works perfectly (6 projects detected)
- Unwrap/wrap cycle works correctly (restores identical config)
- `_original` field storage works
- Main issue: service name extraction from tool name is fundamentally flawed
- Some MCP servers follow `service_operation` naming (github_delete_repo) but not all (list_directory vs filesystem_list_directory)
- Need explicit service parameter, can't rely on tool name patterns
