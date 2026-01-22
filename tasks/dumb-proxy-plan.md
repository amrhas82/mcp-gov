# Implementation Plan: Auto-Wrap MCP Governance with "Dumb" Proxies

## Overview
Build an auto-wrap system where each MCP server gets wrapped by a lightweight "dumb" proxy that:
- Intercepts tool calls at runtime
- Checks governance rules (using existing operation-detector.js)
- Blocks or forwards to target MCP server
- No tool discovery needed (reads tool names from calls)

## Architecture Decision: 1:1 Proxies (Not Universal Proxy)

**Rationale:**
- ✅ Simpler implementation (~50 lines per proxy vs ~400 for universal)
- ✅ No startup tool discovery overhead
- ✅ No routing tables to maintain
- ✅ Proxy is "dumb" - just reads tool names at runtime
- ✅ Standard MCP architecture
- ✅ Independent failures
- ✅ Works with single config file (~/.claude.json)

## Existing Code to Reuse

**Already Built:**
- `src/operation-detector.js` - Parses tool names, detects operations (read/write/delete/execute/admin)
- `src/operation-keywords.js` - 160+ keywords for operation detection
- `src/index.js` - GovernedMCPServer class (used for custom servers)
- `examples/github/` - Working example with governance

**What's Validated:**
- Operation detection works correctly
- GitHub example blocks delete operations successfully
- Audit logging to stderr works

## Components to Build

### 1. mcp-gov-proxy (New File)
**Location:** `bin/mcp-gov-proxy.js`

**Purpose:** Lightweight proxy that wraps a single MCP server

**Implementation:**
```javascript
#!/usr/bin/env node
// Parse args: --target <command> --rules <path>
// Load rules from JSON file
// Spawn target MCP server as subprocess
// Pipe stdin → check if tool call → check rules → forward or block → stdout
```

**Key Logic:**
```javascript
// On incoming message from stdin
if (message.method === 'tools/call') {
  const { service, operation } = parseToolName(message.params.name);
  if (rules[service]?.[operation] === 'deny') {
    return errorResponse('Permission denied');
  }
}
// Forward all messages (including tools/list) to target server
targetServer.stdin.write(message);
```

**Size:** ~80-100 lines

---

### 2. mcp-gov-wrap (New File)
**Location:** `bin/mcp-gov-wrap.js`

**Purpose:** Generic wrapper that auto-wraps servers before running ANY MCP client tool

**Implementation:**
```javascript
#!/usr/bin/env node
// Usage: mcp-gov-wrap --config <path> --rules <path> --tool <command>
// Example: mcp-gov-wrap --config ~/.claude.json --rules ~/rules.json --tool claude

// 1. Read config file (passed as argument)
// 2. Auto-discover unwrapped servers
// 3. Wrap each server in-place
// 4. Save config
// 5. exec(tool, args) - run the actual tool
```

**Key Features:**
- ✅ Generic (works with claude, droid, opencode, etc.)
- ✅ Config path explicit (no guessing)
- ✅ Auto-discovers servers from config
- ✅ Wraps in-place

**Size:** ~120 lines

---

### 3. Convenience Aliases (Optional)

Users can create tool-specific aliases:
```bash
# For Claude Code
alias claude='mcp-gov-wrap --config ~/.claude.json --rules ~/mcp-gov-rules.json --tool claude'

# For Droid
alias droid='mcp-gov-wrap --config ~/.droid/config.json --rules ~/mcp-gov-rules.json --tool droid'

# Generic
alias mcp-tool='mcp-gov-wrap --config $MCP_CONFIG --rules $MCP_RULES --tool'
```

---

### 4. Package Configuration Updates

**package.json:**
```json
{
  "bin": {
    "mcp-gov-proxy": "./bin/mcp-gov-proxy.js",
    "mcp-gov-wrap": "./bin/mcp-gov-wrap.js"
  }
}
```

**That's it! Just 2 CLI tools:**
1. `mcp-gov-proxy` - The "dumb" proxy
2. `mcp-gov-wrap` - Generic wrapper for any tool

---

## Implementation Steps

### Phase 1: Build mcp-gov-proxy (Core Proxy)
**Files:**
- Create `bin/mcp-gov-proxy.js`
- Reuse `src/operation-detector.js`

**Logic:**
1. Parse command line args (--target, --rules)
2. Load rules.json
3. Spawn target MCP server as subprocess
4. Set up stdin/stdout piping with line buffering
5. Intercept tool calls (method === 'tools/call')
6. Check governance rules using operation-detector
7. Block (return error) or forward to target

**Testing:**
```bash
# Test wrapping github server manually
mcp-gov-proxy \
  --target "node examples/github/server.js" \
  --rules examples/github/rules.json

# Should work like the original server but with governance
# Test by sending MCP JSON-RPC messages
```

**Size:** ~100 lines

---

### Phase 2: Build mcp-gov-wrap (Generic Wrapper)
**Files:**
- Create `bin/mcp-gov-wrap.js`

**Logic:**
1. Parse args: --config <path>, --rules <path>, --tool <command>
2. Read config file at specified path
3. Detect config format (Claude Code vs Claude Desktop vs others)
4. Find unwrapped servers (command !== 'mcp-gov-proxy')
5. Wrap each server in-place
6. Save config with backup
7. exec() the actual tool command

**Config Format Detection:**
```javascript
// Claude Code: projects[currentProject].mcpServers
// Claude Desktop: mcpServers (flat)
// Other tools: vary - handle gracefully
```

**Testing:**
```bash
# Test with Claude Code
mcp-gov-wrap \
  --config ~/.claude.json \
  --rules ~/mcp-gov-rules.json \
  --tool claude

# Test with explicit config path
mcp-gov-wrap \
  --config /path/to/config.json \
  --rules ~/rules.json \
  --tool some-mcp-tool
```

**Size:** ~150 lines

---

### Phase 3: Update Package & Documentation

**Files to update:**
- `package.json` - Add bin entries (just 2!)
- `README.md` - Installation and usage instructions
- `examples/auto-wrap-example.md` - Show usage

**Documentation:**
- Quick start guide
- Installation: `npm install -g mcp-gov`
- Usage: Set up alias
- Troubleshooting

---

## Critical Files

**To Create:**
- `bin/mcp-gov-proxy.js` - Core "dumb" proxy (~100 lines)
- `bin/mcp-gov-wrap.js` - Generic wrapper for any tool (~150 lines)

**To Modify:**
- `package.json` - Add 2 bin entries
- `README.md` - Update with simplified instructions

**To Reuse (No Changes):**
- `src/operation-detector.js` - Parses tool names, detects operations
- `src/operation-keywords.js` - 160+ keywords
- `examples/github/rules.json` - Example rules

**Total New Code:** ~250 lines (very minimal!)

---

## Testing Plan

### Unit Tests
1. **Proxy piping:** Verify messages flow correctly
2. **Rule checking:** Verify correct block/allow decisions
3. **Config parsing:** Verify wrapper detects unwrapped servers

### Integration Tests
1. **GitHub example:** Use existing github example
2. **Add new server:** Test auto-wrap with fresh server
3. **Multiple servers:** Test with github + google + context7

### End-to-End Test
```bash
# 1. Fresh install
npm install -g .

# 2. Create rules
cat > ~/mcp-gov-rules.json << 'EOF'
{
  "github": {"read": "allow", "write": "allow", "delete": "deny"},
  "google": {"delete": "deny"},
  "slack": {"delete": "deny"}
}
EOF

# 3. Set up alias (one-time)
alias claude='mcp-gov-wrap --config ~/.claude.json --rules ~/mcp-gov-rules.json --tool claude'

# 4. Run Claude (auto-wraps on first run)
claude
# Wrapper detects unwrapped servers and wraps them automatically

# 5. Test governance
# Ask: "List my GitHub repos" - should work ✅
# Ask: "Delete test-repo" - should be blocked ❌

# 6. Add new server normally
/usr/local/bin/claude mcp add slack -- npx @anthropic/mcp-server-slack

# 7. Run again
claude
# Auto-detects new unwrapped slack server and wraps it

# 8. Verify logs
# Check stderr for audit logs showing blocked operations
```

---

## Success Criteria

1. ✅ mcp-gov-proxy blocks delete operations
2. ✅ mcp-gov-wrap auto-detects and wraps new servers
3. ✅ Works with existing `claude mcp add` workflow (just run wrapper again)
4. ✅ Single config file (no separate server config)
5. ✅ Audit logs captured to stderr
6. ✅ Generic (works with Claude, Droid, or any MCP tool)
7. ✅ Explicit config path (no guessing)
8. ✅ Minimal CLI (just 2 commands)
9. ✅ Clean, simple user experience

---

## Verification Commands

```bash
# After implementation, verify:

# 1. Proxy works standalone
mcp-gov-proxy \
  --target "node examples/github/server.js" \
  --rules examples/github/rules.json
# Send test messages via stdin, verify blocking works

# 2. Wrapper detects servers
mcp-gov-wrap \
  --config ~/.claude.json \
  --rules ~/mcp-gov-rules.json \
  --tool echo
# Should wrap servers and run echo (no-op test)

# 3. End-to-end with Claude
alias claude='mcp-gov-wrap --config ~/.claude.json --rules ~/mcp-gov-rules.json --tool claude'
claude
# Ask to delete repo, verify blocked

# 4. Check config was wrapped
cat ~/.claude.json | jq '.projects[].mcpServers'
# Should see mcp-gov-proxy commands

# 5. Verify audit logs
# Check stderr output shows governance decisions
```

---

## Implementation Order

1. **mcp-gov-proxy** (dumb proxy, ~100 lines) - 2-3 hours
2. **mcp-gov-wrap** (generic wrapper, ~150 lines) - 2-3 hours
3. **Package updates** (bin entries, README) - 30 minutes
4. **Testing** (unit, integration, E2E) - 1-2 hours

**Total Estimated Time:** 6-9 hours (1 day max!)

---

## Design Principles

1. **Keep proxy "dumb"** - No tool discovery, just runtime interception
2. **Single source of truth** - Only one config file (explicit path)
3. **Transparent** - Auto-wrap happens on each run
4. **Generic** - Works with any MCP tool (Claude, Droid, etc.)
5. **Explicit** - Config path always specified (no guessing)
6. **Minimal** - Just 2 CLI commands (~250 lines total)

---

## Key Simplifications from User Feedback

1. ❌ **No separate CLI for adding servers** - Users use native tool commands
2. ❌ **No tool-specific wrappers** - One generic wrapper for all tools
3. ❌ **No config path guessing** - Always explicit via --config flag
4. ✅ **Auto-discovery** - Wrapper finds servers automatically
5. ✅ **Minimal CLI** - Just proxy + wrapper

---

## Open Questions

None - architecture is well-defined from conversation.

User requirements:
- Generic wrapper (not claude-specific)
- Explicit config path (no guessing)
- Auto-discovery of servers
- Minimal CLI (just proxy + wrapper)
- Works with any MCP tool
