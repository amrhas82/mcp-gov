```
███╗   ███╗ ██████╗██████╗      ██████╗  ██████╗ ██╗   ██╗
████╗ ████║██╔════╝██╔══██╗    ██╔════╝ ██╔═══██╗██║   ██║
██╔████╔██║██║     ██████╔╝    ██║  ███╗██║   ██║██║   ██║
██║╚██╔╝██║██║     ██╔═══╝     ██║   ██║██║   ██║╚██╗ ██╔╝
██║ ╚═╝ ██║╚██████╗██║         ╚██████╔╝╚██████╔╝ ╚████╔╝
╚═╝     ╚═╝ ╚═════╝╚═╝          ╚═════╝  ╚═════╝   ╚═══╝
```

# MCP Governance System

A permission control and audit logging system for Model Context Protocol (MCP) servers. Provides fine-grained governance over tool operations with **automatic rule generation**, **wrap/unwrap capabilities**, and structured audit logs.

## Quick Start (2 Steps)

```bash
# 1. Install globally
npm install -g mcp-gov

# 2. Wrap your MCP servers (auto-generates rules with safe defaults)
mcp-gov-wrap --config ~/.config/claude/config.json
```

That's it! Rules are automatically generated at `~/.mcp-gov/rules.json` with safe defaults:
- ✅ **Allow**: read, write operations
- ❌ **Deny**: delete, admin, execute operations

**To unwrap (restore original config):**
```bash
mcp-gov-unwrap --config ~/.config/claude/config.json
```

**To customize rules:**
Edit `~/.mcp-gov/rules.json` - changes take effect immediately!

## Features

- **Auto-Discovery**: Automatically discovers MCP server tools and generates governance rules with safe defaults
- **Smart Delta Updates**: Detects new servers and adds rules while preserving your customizations
- **Permission Control**: Fine-grained rules for read, write, delete, execute, and admin operations
- **Operation Detection**: Automatic classification of 160+ keywords across 5 operation types
- **Safe by Default**: Denies destructive operations (delete/admin/execute) unless explicitly allowed
- **Audit Logging**: Structured JSON logs to stderr with timestamps, tool names, and status
- **Zero Configuration**: Works out of the box - no manual rule writing required
- **MCP-Compliant**: Works seamlessly with any MCP client (Claude Code, Droid, etc.)
- **Middleware Pattern**: Wraps existing MCP servers without modifying tool logic

## Installation

```bash
# From npm (recommended)
npm install -g mcp-gov

# Or from source
git clone https://github.com/yourusername/mcp-gov.git
cd mcp-gov
npm install
sudo npm link
```

**Verify installation:**
```bash
mcp-gov-wrap --help
mcp-gov-unwrap --help
mcp-gov-proxy --help
```

## The 3 Commands

### 1. `mcp-gov-wrap` - Wrap MCP Servers

Automatically wraps MCP servers with governance proxy and generates rules.

```bash
# Minimal (uses all defaults)
mcp-gov-wrap --config ~/.config/claude/config.json

# With custom rules file
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/my-rules.json

# Wrap and launch a tool after
mcp-gov-wrap --config ~/.config/claude/config.json --tool "claude chat"
```

**What it does:**
- ✅ Auto-detects unwrapped MCP servers in your config
- ✅ Wraps them with `mcp-gov-proxy`
- ✅ Stores original config in `_original` field (for unwrapping later)
- ✅ Auto-generates rules at `~/.mcp-gov/rules.json` if missing
- ✅ Creates timestamped backup before modifying config
- ✅ Supports both flat and Claude Code config formats

**First run output:**
```
Loaded config in flat format
Found 4 MCP servers

No rules file found - generating with safe defaults...
Discovering tools from 4 server(s)...
  Discovering github...
  ✓ Found 15 tool(s), generated 5 rule(s)

✓ Generated rules file: ~/.mcp-gov/rules.json

Safe defaults applied:
  ✓ Allow: read, write
  ✗ Deny: delete, admin, execute

Server status:
  Total: 4
  Already wrapped: 0
  Need wrapping: 4

Wrapping 4 server(s)...
✓ Created backup: ~/.config/claude/config.json.backup-20260123-123456
✓ Updated config file: ~/.config/claude/config.json

✓ Wrapping complete!

To customize governance rules, edit: ~/.mcp-gov/rules.json
```

### 2. `mcp-gov-unwrap` - Restore Original Config

Unwraps MCP servers by restoring the original configuration from `_original` field.

```bash
# Minimal (just unwrap)
mcp-gov-unwrap --config ~/.config/claude/config.json

# Unwrap and launch a tool after
mcp-gov-unwrap --config ~/.config/claude/config.json --tool "claude chat"
```

**What it does:**
- ✅ Auto-detects wrapped MCP servers (servers with `_original` field)
- ✅ Restores original `command` and `args` from `_original`
- ✅ Removes `_original` field and proxy wrapper
- ✅ Preserves `env` variables unchanged
- ✅ Creates timestamped backup before modifying config
- ✅ Idempotent (safe to run multiple times)

**Output:**
```
Loaded config in flat format
Found 4 MCP servers

Server status:
  Total: 4
  Wrapped (can unwrap): 4
  Already unwrapped: 0

Servers to unwrap:
  - github
  - filesystem
  - memory

Unwrapping 4 server(s)...
✓ Created backup: ~/.config/claude/config.json.backup-20260123-213121
✓ Updated config file: ~/.config/claude/config.json

✓ Unwrapping complete!
```

**Use cases:**
- Test governance on/off quickly
- Temporarily disable governance for debugging
- Restore original config if something goes wrong

### 3. `mcp-gov-proxy` - Low-Level Proxy (Advanced)

The underlying proxy used by `mcp-gov-wrap`. Normally you don't call this directly.

```bash
mcp-gov-proxy \
  --service filesystem \
  --target "npx -y @modelcontextprotocol/server-filesystem" \
  --rules ~/.mcp-gov/rules.json
```

**What it does:**
- Intercepts JSON-RPC `tools/call` messages
- Checks permissions against rules
- Allows or denies operations
- Logs all operations to stderr (structured JSON)

**Parameters:**
- `--service` (recommended): Service name for rule matching (e.g., "filesystem", "github")
- `--target` (required): Command to spawn the target MCP server
- `--rules` (required): Path to rules.json file

**Important:** When wrapping with `mcp-gov-wrap`, the `--service` parameter is automatically added using the server name from your config (e.g., `mcpServers.filesystem` → `--service filesystem`). This ensures governance rules match correctly.

This command is automatically invoked by `mcp-gov-wrap` - you typically don't need to use it directly.

## Rules Configuration

### Location

Rules are stored at: **`~/.mcp-gov/rules.json`**

This file is **auto-generated** on first run with safe defaults. You can edit it to customize permissions.

### Format

```json
{
  "_comment": "Auto-generated governance rules. Edit as needed.",
  "_location": "/home/user/.mcp-gov/rules.json",
  "rules": [
    {
      "service": "github",
      "operations": ["read"],
      "permission": "allow",
      "reason": "Allow read operations (optional)"
    },
    {
      "service": "github",
      "operations": ["write"],
      "permission": "allow"
    },
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Delete operations denied by default for safety"
    }
  ]
}
```

### Fields

- **`service`** - MCP server name (matches config key)
- **`operations`** - Array of operation types: `read`, `write`, `delete`, `execute`, `admin`
- **`permission`** - `allow` or `deny`
- **`reason`** (optional) - Human-readable explanation

### Operation Types

The system automatically classifies 160+ keywords into 5 operation types:

| Type | Examples | Default |
|------|----------|---------|
| **read** | get, list, search, query, fetch | ✅ Allow |
| **write** | create, update, modify, save, add | ✅ Allow |
| **delete** | delete, remove, drop, purge, destroy | ❌ Deny |
| **execute** | execute, run, eval, invoke, trigger | ❌ Deny |
| **admin** | admin, sudo, grant, revoke, configure | ❌ Deny |

### Editing Rules

```bash
# Edit rules file
vim ~/.mcp-gov/rules.json

# Changes take effect immediately - no restart needed!
```

### Example: Allow Deletes for Specific Service

```json
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "allow",
      "reason": "Trusted service - allow deletes"
    }
  ]
}
```

### Example: Deny All Writes

```json
{
  "rules": [
    {
      "service": "github",
      "operations": ["write"],
      "permission": "deny",
      "reason": "Read-only mode"
    }
  ]
}
```

## Complete Workflow

```bash
# 1. Install
npm install -g mcp-gov

# 2. Wrap servers (auto-generates rules)
mcp-gov-wrap --config ~/.config/claude/config.json

# 3. (Optional) Customize rules
vim ~/.mcp-gov/rules.json

# 4. Use your MCP client normally
claude chat

# 5. (Optional) Unwrap to restore original config
mcp-gov-unwrap --config ~/.config/claude/config.json
```

## Adding New Servers (Delta Approach)

When you add a new MCP server, just run `mcp-gov-wrap` again - it **automatically detects** new servers and adds rules:

```bash
# 1. Add a new server (using your client's native command)
claude mcp add slack --command "npx" --args "-y @modelcontextprotocol/server-slack"

# 2. Run wrap again - detects the new server
mcp-gov-wrap --config ~/.config/claude/config.json
```

**What happens:**
```
Discovered 1 new server(s) not in rules:
  - slack

Generating safe defaults for new servers...
  ✓ Added 3 rule(s) for slack

✓ Updated rules file: ~/.mcp-gov/rules.json

Your existing github rules are preserved!
```

**Smart delta approach:**
- ✅ Detects servers not in `rules.json`
- ✅ Adds rules **only for new servers**
- ✅ **Preserves your customizations** to existing rules
- ✅ Never overwrites manual edits

## Usage Examples

### Viewing Audit Logs

Audit logs are written to stderr in JSON format. Capture them for monitoring:

```bash
# Redirect stderr to a log file
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --tool "claude chat" \
  2>> ~/.mcp-gov/audit.log

# In another terminal, monitor logs in real-time
tail -f ~/.mcp-gov/audit.log | jq '.'
```

Example audit log entries:

```json
{"timestamp":"2026-01-23T14:30:45.123Z","tool":"github_list_repos","service":"github","operation":"read","status":"allowed"}
{"timestamp":"2026-01-23T14:31:12.456Z","tool":"github_delete_repo","service":"github","operation":"delete","status":"denied","reason":"Destructive operations require manual approval"}
```

### Updating Rules

To change governance rules:

1. Edit `~/.mcp-gov/rules.json`
2. No need to restart or re-wrap - changes take effect immediately
3. Next tool call will use the updated rules

```bash
# Edit rules
vim ~/.mcp-gov/rules.json

# No restart needed - just continue using your client
```

### Checking Server Status

View which servers are wrapped:

```bash
# Show wrapped config
cat ~/.config/claude/config.json | jq '.mcpServers'

# Or for Claude Code format
cat ~/.config/claude/config.json | jq '.projects.default.mcpServers'
```

Wrapped servers will have `"command": "mcp-gov-proxy"` instead of their original command.

### Restoring Original Config

**Easiest way - use unwrap:**

```bash
mcp-gov-unwrap --config ~/.config/claude/config.json
```

**Or restore from backup manually:**

```bash
# List available backups
ls -lt ~/.config/claude/*.backup-* | head -5

# Restore from a backup
cp ~/.config/claude/config.json.backup-20260123-143022 ~/.config/claude/config.json
```

### Direct Proxy Usage (Advanced)

For testing or custom integrations, use the proxy directly:

```bash
# Run a single server through the proxy
mcp-gov-proxy \
  --target "npx -y @modelcontextprotocol/server-github" \
  --rules ~/.mcp-gov/rules.json

# Pipe input/output for testing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  mcp-gov-proxy \
    --target "npx -y @modelcontextprotocol/server-github" \
    --rules ~/.mcp-gov/rules.json
```

## Quick Start

### 1. Create a governed server

```javascript
import { GovernedMCPServer } from './src/index.js';

// Define permission rules
const rules = {
  github: {
    read: 'allow',
    write: 'allow',
    delete: 'deny',   // Block destructive operations
    admin: 'deny'
  }
};

// Create server
const server = new GovernedMCPServer(
  { name: 'my-server', version: '1.0.0' },
  rules
);

// Register tools
server.registerTool(
  {
    name: 'github_list_repos',
    description: 'List repositories',
    inputSchema: { type: 'object', properties: {} }
  },
  async (args) => {
    // Your tool logic here
    return {
      content: [{ type: 'text', text: 'Repositories listed' }]
    };
  }
);

// Start server
await server.start();
```

### 2. Run the GitHub example

```bash
# Set up environment
cd examples/github
cp .env.example .env
# Edit .env and add your GitHub token

# Run the server
node server.js
```

### 3. Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-governed": {
      "command": "node",
      "args": ["/path/to/mcp-gov/examples/github/server.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Troubleshooting

### Rules Auto-Generation

**Behavior:** When `--rules` is not provided or the file doesn't exist, rules are **automatically generated**.

The wrapper will:
1. Discover tools from each MCP server
2. Classify operations (read/write/delete/admin/execute)
3. Generate rules with safe defaults
4. Save to `~/.mcp-gov/rules.json` (or specified path)

**To disable auto-generation:** Always provide a rules file explicitly with `--rules`.

**To regenerate rules:** Delete `~/.mcp-gov/rules.json` and run the wrapper again.

### Config file errors

**Error:** `Error: Config file not found` or `Error: Invalid config format`

**Solution:** Check your config file path and format:

```bash
# Verify file exists
ls -la ~/.config/claude/config.json

# Check JSON is valid
jq '.' ~/.config/claude/config.json

# Check for mcpServers key
jq 'keys' ~/.config/claude/config.json
```

For Claude Code, the config uses `projects.default.mcpServers` or `projects.<project-name>.mcpServers`.
For other clients, look for top-level `mcpServers`.

### Wrapper says "No servers found"

**Error:** `Found 0 MCP servers`

**Solution:** Check your config format:

```bash
# Claude Code format
cat ~/.config/claude/config.json | jq '.projects'

# Flat format
cat ~/.config/claude/config.json | jq '.mcpServers'
```

Make sure you've added at least one server using your client's native command first.

### Proxy not blocking operations

**Problem:** Operations that should be denied are being allowed.

**Solutions:**

1. **Verify rules file syntax:**
   ```bash
   jq '.' ~/.mcp-gov/rules.json
   ```

2. **Check service name matches:**
   Tool names like `github_delete_repo` are parsed as service `github`, operation `delete`.
   Your rules should use `"service": "github"`.

3. **Check operation detection:**
   ```bash
   node -e "import('./src/operation-detector.js').then(m => console.log(m.detectOperation('github_delete_repo')))"
   ```

4. **Review audit logs:**
   Check stderr output to see what's being detected:
   ```bash
   # Logs show what service/operation was detected
   tail ~/.mcp-gov/audit.log | jq '.'
   ```

### Path issues (Windows)

**Problem:** Paths with backslashes or spaces cause errors.

**Solution:** Use forward slashes (works on Windows too) or quote paths:

```powershell
# Forward slashes work on Windows
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"

# Or use quotes for paths with spaces
mcp-gov-wrap --config "C:\Program Files\Claude\config.json" --rules "C:\mcp-gov\rules.json" --tool "claude chat"
```

### Commands fail after wrapping

**Problem:** MCP client fails to start or servers don't respond after wrapping.

**Solutions:**

1. **Test original command:**
   ```bash
   # Test the server command directly
   npx -y @modelcontextprotocol/server-github
   ```

2. **Test proxy directly:**
   ```bash
   # If original works, test through proxy
   mcp-gov-proxy --target "npx -y @modelcontextprotocol/server-github" --rules ~/.mcp-gov/rules.json
   ```

3. **Restore from backup:**
   ```bash
   # If wrapping broke config, restore backup
   ls -lt ~/.config/claude/*.backup.* | head -1
   cp <backup-file> ~/.config/claude/config.json
   ```

4. **Check for double-wrapping:**
   ```bash
   # Verify servers aren't double-wrapped
   cat ~/.config/claude/config.json | jq '.mcpServers'

   # Should see "mcp-gov-proxy" as command, NOT nested proxies
   ```

### Binary not found after installation

**Error:** `command not found: mcp-gov-proxy`

**Solution:** Add npm global bin to PATH:

**Linux/macOS:**
```bash
# Find global bin directory
npm prefix -g

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$(npm prefix -g)/bin:$PATH"
```

**Windows:**
```powershell
# Find global bin directory
npm prefix -g

# Add to PATH in System Environment Variables
# Or use full path:
$env:PATH += ";$(npm prefix -g)\bin"
```

### Permission denied on Linux/macOS

**Error:** `Permission denied` when running binaries.

**Solution:** Make binaries executable:

```bash
chmod +x $(npm prefix -g)/lib/node_modules/mcp-gov/bin/mcp-gov-proxy.js
chmod +x $(npm prefix -g)/lib/node_modules/mcp-gov/bin/mcp-gov-wrap.js
```

### Audit logs not appearing

**Problem:** No logs in stderr or log file.

**Solutions:**

1. **Ensure stderr is redirected:**
   ```bash
   mcp-gov-wrap ... 2>> ~/.mcp-gov/audit.log
   ```

2. **Check tools are being called:**
   Use your MCP client to call a tool and verify it triggers the proxy.

3. **Test proxy directly:**
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
     mcp-gov-proxy --target "npx -y @modelcontextprotocol/server-github" --rules ~/.mcp-gov/rules.json \
     2>&1 | tee test.log
   ```

### Performance issues

**Problem:** Tool calls seem slow after adding governance.

**Expected:** Proxy overhead should be < 50ms per call.

**Solutions:**

1. **Check rules file size:**
   Very large rules files (1000+ rules) may slow parsing.

2. **Test without proxy:**
   Compare performance with and without governance to isolate the issue.

3. **Check network latency:**
   If calling external APIs, most delay is network, not governance.

For more help, see [TESTING.md](TESTING.md) or open an issue on GitHub.

## Operation Detection

The system automatically classifies tools based on keywords in their names:

| Operation | Keywords | Default Policy |
|-----------|----------|----------------|
| **admin** | admin, superuser, configure, migrate, deploy | Conservative |
| **delete** | delete, remove, destroy, purge, erase | Conservative |
| **execute** | execute, run, invoke, trigger, send | Conservative |
| **write** | create, add, update, modify, edit, write | Moderate |
| **read** | get, list, fetch, query, search, view | Permissive |

Priority order: admin → delete → execute → write → read

## Permission Rules

### Rules File Format (CLI Tools)

For the auto-wrap CLI tools, rules are defined in `rules.json`:

```json
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete", "admin"],
      "permission": "deny",
      "reason": "Destructive operations require manual approval"
    },
    {
      "service": "github",
      "operations": ["read", "write"],
      "permission": "allow"
    }
  ]
}
```

**Fields:**
- `service`: Service name (extracted from tool name prefix, e.g., `github_list_repos` → `github`)
- `operations`: Array of operation types: `["read", "write", "delete", "execute", "admin"]`
- `permission`: Either `"allow"` or `"deny"`
- `reason` (optional): Human-readable explanation for deny rules

### Multiple Service Examples

```json
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete", "admin"],
      "permission": "deny",
      "reason": "Destructive operations require manual approval"
    },
    {
      "service": "google",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Prevent accidental deletion of Google Drive files"
    },
    {
      "service": "aws",
      "operations": ["admin", "execute"],
      "permission": "deny",
      "reason": "AWS administrative actions require explicit approval"
    },
    {
      "service": "database",
      "operations": ["delete", "admin"],
      "permission": "deny",
      "reason": "Database modifications must be reviewed"
    },
    {
      "service": "slack",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Cannot delete messages once sent"
    }
  ]
}
```

### Default Behavior

- **Default policy:** `allow` (if no rule matches, operation is allowed)
- Operations not listed in rules default to allowed
- Service names are automatically extracted from tool names
- Rules are evaluated at runtime (no restart needed after changes)

### Programmatic API Format

For the `GovernedMCPServer` class, rules use a different format:

```javascript
const rules = {
  serviceName: {
    read: 'allow',
    write: 'allow',
    delete: 'deny',
    execute: 'allow',
    admin: 'deny'
  }
};
```

## Audit Logs

### Log Format

All tool operations are logged to stderr in JSON format by the proxy:

```json
{
  "timestamp": "2026-01-23T14:30:45.123Z",
  "tool": "github_delete_repo",
  "service": "github",
  "operation": "delete",
  "status": "denied",
  "reason": "Destructive operations require manual approval"
}
```

**Fields:**
- `timestamp`: ISO 8601 timestamp (UTC)
- `tool`: Full tool name as called by the MCP client
- `service`: Extracted service name (e.g., `github` from `github_delete_repo`)
- `operation`: Operation type (`read`, `write`, `delete`, `execute`, `admin`)
- `status`: Either `allowed` or `denied`
- `reason`: Optional explanation (only for denied operations)

### Capturing Logs

Redirect stderr to capture audit logs:

```bash
# Append to log file
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --tool "claude chat" \
  2>> ~/.mcp-gov/audit.log
```

Or with your alias (recommended):

```bash
# Capture stderr to log
claude-gov 2>> ~/.mcp-gov/audit.log
```

### Real-Time Monitoring

Monitor logs in real-time using `tail` and `jq`:

```bash
# Watch logs with pretty formatting
tail -f ~/.mcp-gov/audit.log | jq '.'

# Watch only denied operations
tail -f ~/.mcp-gov/audit.log | jq -r 'select(.status=="denied")'

# Count operations by service
tail -f ~/.mcp-gov/audit.log | jq -r '.service' | sort | uniq -c

# Show timestamp and tool name
tail -f ~/.mcp-gov/audit.log | jq -r '"\(.timestamp) \(.tool) \(.status)"'
```

### Log Analysis

Analyze historical audit logs:

```bash
# Count total operations
wc -l ~/.mcp-gov/audit.log

# Count denied operations
grep '"status":"denied"' ~/.mcp-gov/audit.log | wc -l

# List unique tools called
jq -r '.tool' ~/.mcp-gov/audit.log | sort | uniq

# Operations by service
jq -r '.service' ~/.mcp-gov/audit.log | sort | uniq -c | sort -rn

# Denied operations with reasons
jq -r 'select(.status=="denied") | "\(.tool): \(.reason)"' ~/.mcp-gov/audit.log

# Operations in the last hour
jq -r --arg hour "$(date -u +%Y-%m-%dT%H)" 'select(.timestamp | startswith($hour))' ~/.mcp-gov/audit.log

# Group by hour
jq -r '.timestamp[0:13]' ~/.mcp-gov/audit.log | uniq -c
```

### Monitoring Best Practices

1. **Rotate logs** to prevent unlimited growth:
   ```bash
   # Add to cron (daily rotation)
   0 0 * * * mv ~/.mcp-gov/audit.log ~/.mcp-gov/audit.$(date +\%Y\%m\%d).log && touch ~/.mcp-gov/audit.log
   ```

2. **Alert on anomalies** using a simple script:
   ```bash
   #!/bin/bash
   # alert-on-denied.sh
   tail -f ~/.mcp-gov/audit.log | while read line; do
     status=$(echo $line | jq -r '.status')
     if [ "$status" = "denied" ]; then
       tool=$(echo $line | jq -r '.tool')
       reason=$(echo $line | jq -r '.reason')
       echo "ALERT: Denied operation: $tool ($reason)"
       # Send notification, email, etc.
     fi
   done
   ```

3. **Export to external systems**:
   ```bash
   # Forward to syslog
   tail -f ~/.mcp-gov/audit.log | logger -t mcp-gov

   # Forward to monitoring service
   tail -f ~/.mcp-gov/audit.log | curl -X POST -H "Content-Type: application/json" \
     -d @- https://your-monitoring-service.com/logs
   ```

4. **Backup audit logs** regularly:
   ```bash
   # Daily backup
   tar -czf ~/backups/mcp-audit-$(date +%Y%m%d).tar.gz ~/.mcp-gov/*.log
   ```

### Log Retention

Consider your retention requirements:

- **Development**: 7-30 days
- **Production**: 90-365 days (or per compliance requirements)
- **Compliance**: May require indefinite retention and immutability

### Privacy Considerations

Audit logs may contain sensitive information:

- Tool names might reveal user intent
- Service names show what systems are being accessed
- Timestamps reveal usage patterns

Ensure logs are:
- Stored securely (appropriate file permissions)
- Encrypted at rest if required
- Access-controlled
- Included in backup strategies

### Example: Continuous Monitoring Dashboard

```bash
#!/bin/bash
# mcp-dashboard.sh - Simple audit log dashboard

watch -n 5 '
echo "=== MCP Governance Dashboard ==="
echo ""
echo "Total Operations: $(wc -l < ~/.mcp-gov/audit.log)"
echo "Allowed: $(grep -c "\"status\":\"allowed\"" ~/.mcp-gov/audit.log || echo 0)"
echo "Denied: $(grep -c "\"status\":\"denied\"" ~/.mcp-gov/audit.log || echo 0)"
echo ""
echo "=== Top Services ==="
jq -r ".service" ~/.mcp-gov/audit.log | sort | uniq -c | sort -rn | head -5
echo ""
echo "=== Recent Denied Operations ==="
jq -r "select(.status==\"denied\") | \"\(.timestamp) \(.tool)\"" ~/.mcp-gov/audit.log | tail -5
'
```

## Architecture

### Auto-Wrap System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        User Workflow                          │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 1. Add servers with native command
                             │    (claude mcp add server ...)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    ~/.config/claude/config.json               │
│  {                                                            │
│    "mcpServers": {                                            │
│      "github": {                                              │
│        "command": "npx",                                      │
│        "args": ["-y", "@modelcontextprotocol/server-github"] │
│      }                                                        │
│    }                                                          │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 2. Run wrapper
                             │    (mcp-gov-wrap --config ... --rules ... --tool ...)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      mcp-gov-wrap                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. Read config file (detect format)                    │  │
│  │ 2. Load rules from ~/.mcp-gov/rules.json              │  │
│  │ 3. Detect unwrapped servers                           │  │
│  │ 4. Create timestamped backup                          │  │
│  │ 5. Wrap servers: replace command with mcp-gov-proxy   │  │
│  │ 6. Execute tool command (e.g., "claude chat")         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 3. Config now wrapped
                             ▼
┌──────────────────────────────────────────────────────────────┐
│               ~/.config/claude/config.json (wrapped)          │
│  {                                                            │
│    "mcpServers": {                                            │
│      "github": {                                              │
│        "command": "mcp-gov-proxy",                            │
│        "args": [                                              │
│          "--service", "github",                               │
│          "--target", "npx -y @modelcontextprotocol/...",     │
│          "--rules", "/home/user/.mcp-gov/rules.json"         │
│        ]                                                      │
│      }                                                        │
│    }                                                          │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 4. Client launches with governed servers
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      MCP Client                               │
│                   (Claude Code, Droid, etc.)                  │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 5. Client makes tool call
                             │    (tools/call: github_delete_repo)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      mcp-gov-proxy                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ JSON-RPC Message Interception                          │  │
│  │  ↓                                                      │  │
│  │ Operation Detection                                     │  │
│  │  - Parse tool name: github_delete_repo                 │  │
│  │  - Extract service: github                             │  │
│  │  - Extract operation: delete                           │  │
│  │  ↓                                                      │  │
│  │ Permission Check                                        │  │
│  │  - Load rules.json                                      │  │
│  │  - Check service="github", operation="delete"          │  │
│  │  - Decision: DENY                                       │  │
│  │  ↓                                                      │  │
│  │ Audit Logging (stderr)                                  │  │
│  │  {"timestamp":"...","tool":"github_delete_repo",       │  │
│  │   "service":"github","operation":"delete",             │  │
│  │   "status":"denied","reason":"..."}                    │  │
│  │  ↓                                                      │  │
│  │ Response                                                │  │
│  │  - If ALLOW: Forward to target server                  │  │
│  │  - If DENY: Return error to client                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 6a. If ALLOWED: Forward to target
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                   Target MCP Server                           │
│            (npx -y @modelcontextprotocol/server-github)       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Execute tool logic                                      │  │
│  │  - Call GitHub API                                      │  │
│  │  - Return result                                        │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ 7. Result flows back to client
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                      MCP Client                               │
│                 Receives result or error                      │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

**mcp-gov-wrap (Wrapper)**
- Config file discovery and parsing
- Server detection (wrapped vs unwrapped)
- Automatic wrapping with mcp-gov-proxy
- Config backup management
- Tool command execution

**mcp-gov-proxy (Proxy)**
- JSON-RPC message interception
- Operation detection and classification
- Permission checking against rules
- Audit logging to stderr
- Message forwarding to target servers

**rules.json**
- Centralized governance policies
- Service-specific operation rules
- Allow/deny decisions with reasons
- Hot-reloadable (no restart needed)

**Target MCP Servers**
- Unchanged original servers
- No code modifications needed
- Work through proxy transparently

### Data Flow

1. **Setup**: User adds servers with native commands → mcp-gov-wrap wraps them
2. **Runtime**: Client calls tool → Proxy intercepts → Checks permission → Forwards or denies
3. **Audit**: Every operation logged to stderr with timestamp, service, operation, status
4. **Updates**: Change rules.json → Takes effect immediately on next call

### Programmatic API Architecture (Alternative)

For building custom governed servers:

```
┌─────────────────┐
│  MCP Client     │ (Claude Desktop)
└────────┬────────┘
         │ MCP Protocol (stdio)
         ▼
┌─────────────────┐
│ GovernedMCP     │ 1. Check permission
│ Server          │ 2. Log operation
│ (SDK)           │ 3. Execute handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool Handlers   │ (GitHub API, etc.)
└─────────────────┘
```

## Examples

### Auto-Wrap System

- **[Auto-Wrap Example](examples/auto-wrap-example.md)**: Complete step-by-step walkthrough
  - Installation and setup
  - Creating rules files
  - Adding and wrapping servers
  - Daily workflow and monitoring

- **[Multi-Client Example](examples/multi-client-example.md)**: Using governance with multiple MCP clients
  - Claude Code, Droid, and custom clients
  - Shared rules across clients
  - Centralized audit logging
  - Environment-specific configurations

### Programmatic API

- **[GitHub Example](examples/github/)**: Complete working example with:
  - GitHub API integration (list repos, delete repo)
  - Permission rules configuration
  - Environment variable management
  - Claude Desktop integration

## Platform Compatibility

mcp-gov is designed to work seamlessly across Linux, macOS, and Windows. The system handles platform-specific path conventions and behaviors automatically.

### Supported Platforms

- **Linux**: Full support with Unix path separators (`/`) and LF line endings
- **macOS**: Full support including .app bundles, case-sensitive filesystems, and system symlinks
- **Windows**: Full support with drive letters (`C:\`), UNC paths (`\\server\share`), backslashes, and CRLF line endings

### Path Handling

The proxy and wrapper tools automatically handle platform-specific path formats:

**Linux/macOS:**
```bash
# Unix-style paths with forward slashes
mcp-gov-proxy --target "node server.js" --rules /home/user/rules.json
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"
```

**Windows:**
```powershell
# Windows-style paths with backslashes or forward slashes
mcp-gov-proxy --target "node server.js" --rules C:\Users\user\rules.json
mcp-gov-wrap --config %USERPROFILE%\.config\claude\config.json --rules %USERPROFILE%\.mcp-gov\rules.json --tool "claude chat"
```

### Special Considerations

**macOS:**
- Application bundles (`.app` directories) are handled correctly
- System symlinks like `/tmp` → `/private/tmp` work transparently
- Both case-sensitive and case-insensitive APFS filesystems are supported

**Windows:**
- UNC network paths (`\\server\share\path`) are fully supported
- Paths with spaces are handled correctly (e.g., `C:\Program Files`)
- Both forward slashes and backslashes work in paths
- Drive letters in absolute paths (e.g., `C:\`, `D:\`) are preserved

**Line Endings:**
- Config files can use either LF (Unix/macOS) or CRLF (Windows) line endings
- JSON parsing handles both formats automatically
- Backup files preserve the original line ending format

### Testing

The test suite includes platform-specific test cases for Windows and macOS scenarios, even when run on Linux. To run platform tests:

```bash
npm run test:platform
```

These tests verify path handling, line ending compatibility, and platform-specific behaviors without requiring multiple operating systems for development.

## Development

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:proxy
npm run test:wrapper
npm run test:platform
npm run test:integration

# Test operation detection
node -e "import('./src/operation-detector.js').then(m => console.log(m.detectOperation('github_list_repos')))"

# Test permission checking
node -e "import('./src/index.js').then(m => {
  const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {github:{delete:'deny'}});
  console.log(s.checkPermission('github_delete_repo'));
})"
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
