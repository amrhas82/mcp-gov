# Multi-Client Governance Example

This guide shows how to use mcp-gov with multiple MCP client tools, each with their own config files.

## Overview

Different MCP clients store their configurations in different locations:

- **Claude Code**: `~/.config/claude/config.json`
- **Droid**: `~/.config/droid/config.json` (example)
- **Custom Client**: Your custom config location

You can use mcp-gov with all of them, sharing the same rules file.

## Shared Rules File

Create a single rules file used by all clients:

```bash
mkdir -p ~/.mcp-gov

cat > ~/.mcp-gov/rules.json << 'EOF'
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
      "reason": "Prevent accidental deletion"
    },
    {
      "service": "aws",
      "operations": ["admin", "execute"],
      "permission": "deny",
      "reason": "AWS actions require approval"
    }
  ]
}
EOF
```

## Claude Code Setup

### 1. Add Servers

```bash
# Add MCP servers using Claude Code CLI
claude mcp add github --command "npx" --args "-y @modelcontextprotocol/server-github"
claude mcp add google --command "npx" --args "-y @modelcontextprotocol/server-google"
```

### 2. Create Alias

```bash
# Add to ~/.bashrc or ~/.zshrc
alias claude-gov='mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"'
```

### 3. Launch

```bash
# Launch Claude Code with governance
claude-gov
```

## Droid Setup

### 1. Add Servers

```bash
# Add MCP servers using Droid CLI (example syntax)
droid mcp add github --command "npx" --args "-y @modelcontextprotocol/server-github"
droid mcp add google --command "npx" --args "-y @modelcontextprotocol/server-google"
```

### 2. Create Alias

```bash
# Add to ~/.bashrc or ~/.zshrc
alias droid-gov='mcp-gov-wrap --config ~/.config/droid/config.json --rules ~/.mcp-gov/rules.json --tool "droid start"'
```

### 3. Launch

```bash
# Launch Droid with governance
droid-gov
```

## Custom Client Setup

### 1. Determine Config Location

Find where your client stores MCP server configuration:

```bash
# Common locations
~/.config/<client-name>/config.json
~/.config/<client-name>/mcp.json
~/<client-dir>/config/mcp-servers.json
```

### 2. Check Config Format

Your config should have one of these formats:

**Flat format:**
```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

**Claude Code format:**
```json
{
  "projects": {
    "default": {
      "mcpServers": {
        "server-name": {
          "command": "node",
          "args": ["server.js"]
        }
      }
    }
  }
}
```

### 3. Add Servers to Config

Either use your client's native command or manually edit the config:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}
```

### 4. Wrap and Launch

```bash
mcp-gov-wrap \
  --config /path/to/your/config.json \
  --rules ~/.mcp-gov/rules.json \
  --tool "your-client-command"
```

## Multi-Client Workflow

### Scenario: Developer uses both Claude Code and Droid

Create separate aliases for each client, sharing the same rules:

```bash
# ~/.bashrc or ~/.zshrc

# Claude Code with governance
alias claude-gov='mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"'

# Droid with governance
alias droid-gov='mcp-gov-wrap --config ~/.config/droid/config.json --rules ~/.mcp-gov/rules.json --tool "droid start"'

# View audit logs from both clients
alias mcp-logs='tail -f ~/.mcp-gov/audit.log | jq .'
```

### Daily Usage

```bash
# Use Claude Code
claude-gov 2>> ~/.mcp-gov/audit.log

# Or use Droid (in a different terminal/session)
droid-gov 2>> ~/.mcp-gov/audit.log

# Monitor all audit logs
mcp-logs
```

### Benefits

- **Single rules file**: Define governance once, apply to all clients
- **Consistent security**: Same policies across all tools
- **Centralized logging**: All audit logs in one place
- **Easy updates**: Change rules once, affects all clients immediately

## Different Rules Per Client

If you need different rules for different clients:

### 1. Create separate rules files

```bash
# Strict rules for production client
cat > ~/.mcp-gov/rules-strict.json << 'EOF'
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete", "write", "admin"],
      "permission": "deny"
    }
  ]
}
EOF

# Relaxed rules for development client
cat > ~/.mcp-gov/rules-dev.json << 'EOF'
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete", "admin"],
      "permission": "deny"
    }
  ]
}
EOF
```

### 2. Create separate aliases

```bash
# Production environment (strict)
alias claude-prod='mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules-strict.json --tool "claude chat"'

# Development environment (relaxed)
alias claude-dev='mcp-gov-wrap --config ~/.config/claude-dev/config.json --rules ~/.mcp-gov/rules-dev.json --tool "claude chat"'
```

## CI/CD Integration

### Example: Testing with Multiple Clients

```bash
#!/bin/bash
# test-governance.sh

RULES_FILE=~/.mcp-gov/rules-ci.json

# Test with Claude Code
echo "Testing Claude Code..."
mcp-gov-wrap \
  --config ~/.config/claude/config.json \
  --rules $RULES_FILE \
  --tool "echo 'Claude Code config wrapped'" || exit 1

# Test with Droid
echo "Testing Droid..."
mcp-gov-wrap \
  --config ~/.config/droid/config.json \
  --rules $RULES_FILE \
  --tool "echo 'Droid config wrapped'" || exit 1

echo "All clients configured successfully!"
```

## Shared Server Definitions

If multiple clients need the same servers, you can:

### Option 1: Copy Config Sections

```bash
# Extract server config from Claude Code
jq '.mcpServers.github' ~/.config/claude/config.json > /tmp/github-server.json

# Add to Droid config
jq --argjson server "$(cat /tmp/github-server.json)" \
   '.mcpServers.github = $server' \
   ~/.config/droid/config.json > /tmp/droid-new.json

mv /tmp/droid-new.json ~/.config/droid/config.json
```

### Option 2: Use Wrapper for Each Client

Let the wrapper manage each config independently:

```bash
# Wrap Claude Code config
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "echo Done"

# Wrap Droid config
mcp-gov-wrap --config ~/.config/droid/config.json --rules ~/.mcp-gov/rules.json --tool "echo Done"
```

## Monitoring Multiple Clients

### Unified Audit Log

Direct all clients' stderr to the same log file:

```bash
# Launch each client with same log file
claude-gov 2>> ~/.mcp-gov/unified-audit.log
droid-gov 2>> ~/.mcp-gov/unified-audit.log
```

### Separate Audit Logs

Or keep separate logs per client:

```bash
# Separate logs
claude-gov 2>> ~/.mcp-gov/claude-audit.log
droid-gov 2>> ~/.mcp-gov/droid-audit.log

# Monitor both
tail -f ~/.mcp-gov/*-audit.log | jq '.'
```

### Log Analysis

Query audit logs across clients:

```bash
# Count denied operations across all clients
cat ~/.mcp-gov/*-audit.log | jq -r 'select(.status=="denied") | .tool' | sort | uniq -c

# Find all GitHub operations
cat ~/.mcp-gov/*-audit.log | jq -r 'select(.service=="github")'

# Operations by hour
cat ~/.mcp-gov/*-audit.log | jq -r '.timestamp[0:13]' | uniq -c
```

## Environment-Specific Configurations

### Development vs Production

```bash
# Development environment
export MCP_ENV=dev
alias mcp-dev='mcp-gov-wrap \
  --config ~/.config/claude/config.dev.json \
  --rules ~/.mcp-gov/rules-dev.json \
  --tool "claude chat"'

# Production environment
export MCP_ENV=prod
alias mcp-prod='mcp-gov-wrap \
  --config ~/.config/claude/config.prod.json \
  --rules ~/.mcp-gov/rules-strict.json \
  --tool "claude chat"'
```

## Best Practices

1. **Use a single rules file** when possible for consistency
2. **Create client-specific aliases** for convenience
3. **Centralize audit logs** for easier monitoring
4. **Test wrapper with each client** before daily use
5. **Keep backups** of config files (wrapper does this automatically)
6. **Document your setup** in a team wiki or README
7. **Version control your rules** files (not config files with tokens)

## Troubleshooting Multi-Client Setup

### Config paths differ

Different clients use different config locations. Find yours:

```bash
# Search for MCP configs
find ~/ -name "*config*.json" -type f 2>/dev/null | xargs grep -l "mcpServers" 2>/dev/null
```

### Wrapper can't find mcpServers

Check the config format:

```bash
# Check top-level keys
jq 'keys' ~/.config/<client>/config.json

# Check for projects structure
jq '.projects | keys' ~/.config/<client>/config.json
```

### Different clients, same servers

If two clients use the same server definitions, consider:
- Symlinking config files (not recommended)
- Using the wrapper for each config independently (recommended)
- Scripting config generation to keep them in sync

## Summary

With mcp-gov, you can:
- Apply governance to multiple MCP clients
- Share rules across all clients
- Or use client-specific rules
- Monitor all clients from a unified audit log
- Maintain separate configs while sharing governance logic

The wrapper-based approach works with ANY MCP client that uses JSON config files.
