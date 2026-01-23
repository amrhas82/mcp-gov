# MCP-Gov Quick Reference

## Installation

```bash
# From npm (when published)
npm install -g mcp-gov

# From source
cd mcp-gov
npm install
sudo npm link
```

## The 3 Commands

### 1. `mcp-gov-wrap` - Wrap Servers

```bash
# Minimal (uses all defaults)
mcp-gov-wrap --config ~/.config/claude/config.json

# With custom rules
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/my-rules.json

# Wrap and run a command after
mcp-gov-wrap --config ~/.config/claude/config.json --tool "claude chat"
```

**What it does:**
- Auto-detects unwrapped MCP servers
- Wraps with `mcp-gov-proxy`
- Auto-generates rules at `~/.mcp-gov/rules.json` (if missing)
- Creates timestamped backup
- Stores original config in `_original` field

### 2. `mcp-gov-unwrap` - Restore Original

```bash
# Minimal
mcp-gov-unwrap --config ~/.config/claude/config.json

# Unwrap and run a command after
mcp-gov-unwrap --config ~/.config/claude/config.json --tool "claude chat"
```

**What it does:**
- Detects wrapped servers (has `_original` field)
- Restores original `command` and `args`
- Removes `_original` field
- Creates timestamped backup

### 3. `mcp-gov-proxy` - Low-Level Proxy

```bash
mcp-gov-proxy \
  --target "npx -y @modelcontextprotocol/server-github" \
  --rules ~/.mcp-gov/rules.json
```

**What it does:**
- Intercepts JSON-RPC `tools/call` messages
- Checks permissions
- Logs to stderr

*Note: Normally invoked by `mcp-gov-wrap`, not called directly.*

## Rules Configuration

### Location

**`~/.mcp-gov/rules.json`** - Auto-generated on first run

### Format

```json
{
  "_comment": "Auto-generated governance rules. Edit as needed.",
  "rules": [
    {
      "service": "github",
      "operations": ["read"],
      "permission": "allow"
    },
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Safety: deny destructive operations"
    }
  ]
}
```

### Operation Types

| Type | Examples | Default |
|------|----------|---------|
| **read** | get, list, search, query | ✅ Allow |
| **write** | create, update, modify | ✅ Allow |
| **delete** | delete, remove, destroy | ❌ Deny |
| **execute** | execute, run, eval | ❌ Deny |
| **admin** | admin, sudo, grant | ❌ Deny |

### Editing Rules

```bash
vim ~/.mcp-gov/rules.json
# Changes take effect immediately - no restart!
```

## Common Workflows

### First Time Setup

```bash
# 1. Install
npm install -g mcp-gov

# 2. Wrap servers (auto-generates rules)
mcp-gov-wrap --config ~/.config/claude/config.json

# 3. Done! Use your client normally
claude chat
```

### Add New Server

```bash
# 1. Add server using your client
claude mcp add slack --command "npx" --args "-y @modelcontextprotocol/server-slack"

# 2. Wrap again (auto-detects new server, preserves existing rules)
mcp-gov-wrap --config ~/.config/claude/config.json
```

### Toggle Governance On/Off

```bash
# Turn governance ON
mcp-gov-wrap --config ~/.config/claude/config.json

# Turn governance OFF
mcp-gov-unwrap --config ~/.config/claude/config.json
```

### Customize Rules

```bash
# Edit rules
vim ~/.mcp-gov/rules.json

# Example: Allow deletes for specific service
{
  "service": "github",
  "operations": ["delete"],
  "permission": "allow",
  "reason": "Trusted - allow deletes"
}
```

## Config File Locations

| Client | Config Path |
|--------|-------------|
| Claude Code | `~/.config/claude/config.json` |
| Claude Desktop | `~/.config/Claude/claude_desktop_config.json` |
| Custom | Specify with `--config` |

## Backup Files

Backups are created automatically with timestamps:

```
config.json.backup-20260123-143022
config.json.backup-20260123-151530
```

To restore from backup:
```bash
# Easiest: use unwrap
mcp-gov-unwrap --config ~/.config/claude/config.json

# Or manually
cp config.json.backup-TIMESTAMP config.json
```

## Troubleshooting

### Check Wrapped Status

```bash
# View current config
cat ~/.config/claude/config.json | jq '.mcpServers'

# Wrapped servers have:
# - "command": "mcp-gov-proxy"
# - "_original": { ... }
```

### View Rules

```bash
cat ~/.mcp-gov/rules.json | jq '.'
```

### View Audit Logs

```bash
# Capture logs to file
mcp-gov-wrap --config ~/.config/claude/config.json --tool "claude chat" 2>> ~/.mcp-gov/audit.log

# Monitor in real-time
tail -f ~/.mcp-gov/audit.log | jq '.'
```

## Help

```bash
mcp-gov-wrap --help
mcp-gov-unwrap --help
mcp-gov-proxy --help
```

## Summary

- **Install:** `npm install -g mcp-gov`
- **Wrap:** `mcp-gov-wrap --config CONFIG_PATH`
- **Unwrap:** `mcp-gov-unwrap --config CONFIG_PATH`
- **Rules:** `~/.mcp-gov/rules.json` (auto-generated)
- **Backups:** Created automatically with timestamps
- **Changes:** Edit rules, no restart needed
