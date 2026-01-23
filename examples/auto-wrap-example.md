# Auto-Wrap Governance Example

This guide walks you through setting up the MCP Governance auto-wrap system step by step.

## Overview

The auto-wrap system provides two CLI tools:

- **mcp-gov-proxy**: A transparent proxy that intercepts MCP tool calls and checks permissions
- **mcp-gov-wrap**: A wrapper that auto-discovers and wraps MCP servers in your config

Together, these tools let you add governance to ANY MCP server without modifying the server code.

## Prerequisites

- Node.js 18 or later
- npm
- An MCP client tool (Claude Code, Droid, etc.)

## Step 1: Install mcp-gov

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-gov.git
cd mcp-gov

# Install dependencies
npm install

# Install globally to make CLI tools available
npm install -g .
```

Verify installation:

```bash
# Check that binaries are installed
which mcp-gov-proxy
which mcp-gov-wrap

# Test the help output
mcp-gov-proxy --help
mcp-gov-wrap --help
```

## Step 2: Create Your Rules File

Create a rules file that defines which operations are allowed or denied. This is typically stored in `~/.mcp-gov/rules.json`.

```bash
# Create directory
mkdir -p ~/.mcp-gov

# Create rules file
cat > ~/.mcp-gov/rules.json << 'EOF'
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Destructive operations require manual approval"
    },
    {
      "service": "github",
      "operations": ["read", "write"],
      "permission": "allow"
    },
    {
      "service": "slack",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Cannot delete messages once sent"
    },
    {
      "service": "slack",
      "operations": ["read", "write"],
      "permission": "allow"
    }
  ]
}
EOF
```

## Step 3: Add an MCP Server (Using Your Client Tool)

Use your MCP client's native command to add a server. For example, with Claude Code:

```bash
# Add a GitHub MCP server
claude mcp add github --command "npx" --args "-y @modelcontextprotocol/server-github"

# Or add a local server
claude mcp add my-server --command "node" --args "/path/to/server.js"
```

This adds the server to your config file (e.g., `~/.config/claude/config.json`) **without** governance.

## Step 4: Wrap Your MCP Servers

Now use `mcp-gov-wrap` to automatically wrap all unwrapped servers with governance:

```bash
# Wrap servers and launch your client tool
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --rules ~/.mcp-gov/rules.json \
  --tool "claude chat"
```

What happens:
1. The wrapper reads your config file
2. Detects servers that aren't wrapped yet
3. Creates a timestamped backup of your config
4. Wraps each server by replacing its command with `mcp-gov-proxy`
5. Launches your client tool (e.g., `claude chat`)

Example output:

```
Loaded config in flat format
Found 2 MCP servers
Loaded 2 rules from /home/user/.mcp-gov/rules.json

Server status:
  Total: 2
  Already wrapped: 0
  Need wrapping: 2

Servers to wrap:
  - github
  - my-server

Wrapping 2 server(s)...
✓ Created backup: /home/user/.config/claude/config.json.backup.20260123-143022
✓ Updated config file: /home/user/.config/claude/config.json

Executing tool command: claude chat
```

## Step 5: Use Your Client Tool with Governance

Now when you use your client tool, all MCP servers are automatically governed:

**Example conversation:**

```
You: List my GitHub repositories
AI: [Uses github_list_repos - ALLOWED]
Here are your repositories...

You: Delete my test repository

AI: [Attempts github_delete_repo - DENIED]
I cannot delete repositories as destructive operations are blocked by governance rules.
```

Behind the scenes, audit logs are written to stderr:

```json
{"timestamp":"2026-01-23T14:30:45.123Z","tool":"github_list_repos","service":"github","operation":"read","status":"allowed"}
{"timestamp":"2026-01-23T14:31:12.456Z","tool":"github_delete_repo","service":"github","operation":"delete","status":"denied","reason":"Destructive operations require manual approval"}
```

## Step 6: View Audit Logs

Audit logs are written to stderr by the proxy. You can capture and monitor them:

```bash
# Run with stderr redirected to a log file
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --rules ~/.mcp-gov/rules.json \
  --tool "claude chat" \
  2>> ~/.mcp-gov/audit.log

# In another terminal, monitor logs in real-time
tail -f ~/.mcp-gov/audit.log | jq '.'
```

## Step 7: Daily Workflow

Once set up, your daily workflow is simple:

### Adding New Servers

```bash
# Add server using your client's native command
claude mcp add new-server --command "node" --args "server.js"

# Wrap the new server and launch
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --rules ~/.mcp-gov/rules.json \
  --tool "claude chat"
```

The wrapper automatically detects the new server and wraps it.

### Creating an Alias (Recommended)

Create an alias to simplify the wrapper command:

```bash
# Add to your ~/.bashrc or ~/.zshrc
alias claude-gov='mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"'

# Then simply run:
claude-gov
```

## Step 8: Advanced Configuration

### Multiple Service Rules

Edit `~/.mcp-gov/rules.json` to add rules for multiple services:

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
    }
  ]
}
```

### Direct Proxy Usage

You can also use the proxy directly without the wrapper:

```bash
# Run a specific server through the proxy
mcp-gov-proxy \
  --target "npx -y @modelcontextprotocol/server-github" \
  --rules ~/.mcp-gov/rules.json
```

This is useful for:
- Testing individual servers
- CI/CD environments
- Custom MCP client integrations

## Inspecting Your Config

To see how servers are wrapped, check your config file:

```bash
# View config (Claude Code format)
cat ~/.config/claude/config.json | jq '.projects.default.mcpServers'

# Or flat format
cat ~/.config/claude/config.json | jq '.mcpServers'
```

Before wrapping:
```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"]
  }
}
```

After wrapping:
```json
{
  "github": {
    "command": "mcp-gov-proxy",
    "args": [
      "--target",
      "npx -y @modelcontextprotocol/server-github",
      "--rules",
      "/home/user/.mcp-gov/rules.json"
    ]
  }
}
```

## Restoring From Backup

If something goes wrong, restore from the automatic backup:

```bash
# List backups
ls -la ~/.config/claude/*.backup.*

# Restore from a backup
cp ~/.config/claude/config.json.backup.20260123-143022 ~/.config/claude/config.json
```

## Updating Rules

To update your governance rules:

1. Edit `~/.mcp-gov/rules.json`
2. No need to re-wrap servers - the proxy reads rules.json at runtime
3. Changes take effect immediately on next tool call

## Troubleshooting

### Wrapper says "No servers found"

Check your config file format:

```bash
# For Claude Code, check for projects.default.mcpServers or projects.*.mcpServers
cat ~/.config/claude/config.json | jq 'keys'

# For other clients, check for top-level mcpServers
cat ~/.config/mcp/config.json | jq '.mcpServers'
```

### Proxy not blocking operations

1. Check rules file is valid JSON: `jq '.' ~/.mcp-gov/rules.json`
2. Verify service name matches tool name pattern (e.g., `github_delete_repo` → service: `github`)
3. Check audit logs to see what's being detected

### Commands fail to execute

Ensure the original server command is correct:

```bash
# Test the original command directly
npx -y @modelcontextprotocol/server-github

# If that works, the proxy should work too
mcp-gov-proxy --target "npx -y @modelcontextprotocol/server-github" --rules ~/.mcp-gov/rules.json
```

## Next Steps

- Check [TESTING.md](../TESTING.md) for comprehensive testing guide
- See [README.md](../README.md) for architecture details
- Review [examples/github/](github/) for a complete working example
- Add more services to your rules.json as you install more MCP servers

## Summary

The auto-wrap system provides:
- **Zero-code governance**: No server modifications needed
- **Automatic discovery**: Finds and wraps all servers in your config
- **Transparent operation**: Works with any MCP client
- **Audit logging**: Complete visibility into all tool calls
- **Easy maintenance**: Add servers with native commands, wrapper handles governance
