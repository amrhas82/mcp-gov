# Governance Proxy Architecture

## Problem Statement

Users have existing MCP servers installed:
- `@anthropic/mcp-server-github`
- `@anthropic/mcp-server-slack`
- `@anthropic/mcp-server-filesystem`
- etc.

They want to add governance policies WITHOUT modifying these servers.

## Solution: Governance Proxy

### Architecture

```
┌─────────┐      ┌──────────────────┐      ┌─────────────────┐
│ Claude  │─────▶│ Governance Proxy │─────▶│ Actual MCP      │
│ Desktop │      │ (Policy Layer)   │      │ Server (GitHub) │
└─────────┘      └──────────────────┘      └─────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ rules.json  │
                  │ audit.log   │
                  └─────────────┘
```

### How It Works

1. **User installs proxy:**
   ```bash
   npm install -g mcp-governance-proxy
   ```

2. **User configures proxy in Claude:**
   ```json
   {
     "mcpServers": {
       "github-governed": {
         "command": "mcp-governance-proxy",
         "args": [
           "--target", "npx @anthropic/mcp-server-github",
           "--rules", "/path/to/github-rules.json",
           "--env", "GITHUB_TOKEN=xxx"
         ]
       }
     }
   }
   ```

3. **Proxy intercepts all calls:**
   - Claude calls `github_create_issue` → Proxy receives it
   - Proxy checks: "Is 'create' allowed for github?" → rules.json says "write: deny"
   - Proxy blocks: Returns error to Claude
   - Proxy logs: Writes audit entry

4. **For allowed operations:**
   - Proxy spawns actual MCP server as subprocess
   - Forwards the call
   - Returns response to Claude
   - Logs success

### Configuration Example

**rules.json:**
```json
{
  "github": {
    "read": "allow",
    "write": "deny",
    "delete": "deny"
  },
  "slack": {
    "read": "allow",
    "write": "allow",
    "delete": "deny"
  }
}
```

**User's Claude config:**
```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": [
        "--target", "@anthropic/mcp-server-github",
        "--target-args", "GITHUB_TOKEN=xxx",
        "--rules", "./github-rules.json"
      ]
    },
    "slack-governed": {
      "command": "mcp-governance-proxy",
      "args": [
        "--target", "@anthropic/mcp-server-slack",
        "--target-args", "SLACK_TOKEN=xxx",
        "--rules", "./slack-rules.json"
      ]
    }
  }
}
```

## Implementation Plan

### Step 1: Build Governance Proxy Server

Create `src/proxy.js`:
- Spawns target MCP server as subprocess
- Intercepts all `tools/call` requests
- Applies governance rules
- Forwards allowed calls to target
- Returns responses

### Step 2: CLI Tool

Create `bin/mcp-governance-proxy`:
```bash
#!/usr/bin/env node
mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ./rules.json
```

### Step 3: Package for Distribution

```json
{
  "name": "mcp-governance-proxy",
  "bin": {
    "mcp-governance-proxy": "./bin/proxy.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

## User Experience

### Before (No Governance):
```bash
claude mcp add github -- npx @anthropic/mcp-server-github
```

User can accidentally delete repos, create issues, etc.

### After (With Governance):
```bash
# Install governance proxy
npm install -g mcp-governance-proxy

# Add governed server
claude mcp add github-governed -- mcp-governance-proxy \
  --target "@anthropic/mcp-server-github" \
  --rules ./github-rules.json \
  --env GITHUB_TOKEN=xxx

# Now delete operations are blocked!
```

## Benefits

1. **No Code Changes** - Works with any existing MCP server
2. **Centralized Policy** - One rules.json per service
3. **Audit Trail** - All operations logged
4. **Zero Trust** - Even with valid tokens, rules enforced
5. **Easy Adoption** - Just add proxy in config

## Next Steps

To make this work for existing MCP servers:

1. Build the proxy server (`src/proxy.js`)
2. Add subprocess management for target servers
3. Implement request forwarding
4. Package as npm module
5. Publish to npm as `mcp-governance-proxy`
