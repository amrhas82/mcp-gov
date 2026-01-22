# MCP Proxy Architecture Explained

## How Traffic is "Forced" Through Proxy

Unlike nginx (network proxy), MCP proxy works through **configuration replacement**.

## Current Setup (No Proxy)

### Configuration
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-github"],
      "env": {"GITHUB_TOKEN": "xxx"}
    }
  }
}
```

### What Happens at Runtime
```
1. User starts Claude Desktop/Code
2. Claude reads config
3. Claude spawns: npx @anthropic/mcp-server-github
4. Claude gets process handle with stdin/stdout pipes
5. Claude sends JSON-RPC messages via stdin
6. Server responds via stdout
```

### Process Tree
```
claude (PID 1000)
  └── npx @anthropic/mcp-server-github (PID 2000)
```

### Communication Flow
```
Claude Process (PID 1000)
  │
  │ stdin ──▶ {"jsonrpc":"2.0","method":"tools/call",...}
  │
  │ stdout ◀── {"result":{"content":[...]}}
  │
  └──────────▶ MCP Server (PID 2000)
```

**Problem:** Claude talks directly to the server. No governance.

---

## With Proxy Setup

### Configuration Change
```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": [
        "--target", "npx @anthropic/mcp-server-github",
        "--rules", "/path/to/rules.json"
      ],
      "env": {"GITHUB_TOKEN": "xxx"}
    }
  }
}
```

### What Happens at Runtime
```
1. User starts Claude Desktop/Code
2. Claude reads config
3. Claude spawns: mcp-governance-proxy (NOT the original server!)
4. Proxy reads --target argument
5. Proxy spawns: npx @anthropic/mcp-server-github (as its child)
6. Claude talks to proxy, proxy talks to server
```

### Process Tree
```
claude (PID 1000)
  └── mcp-governance-proxy (PID 2000)
        └── npx @anthropic/mcp-server-github (PID 3000)
```

### Communication Flow
```
Claude Process (PID 1000)
  │
  │ stdin ──▶ {"method":"tools/call","params":{"name":"github_delete_repo"}}
  │
  ▼
Proxy (PID 2000) ◀── Receives request
  │
  ├──▶ Checks rules.json: "github" + "delete" → DENY
  │
  └─ stdout ──▶ {"error":{"code":-32000,"message":"Permission denied"}}
  │
  ▲
  │
Claude receives error (delete blocked!)
```

**For allowed operations:**
```
Claude Process (PID 1000)
  │
  │ stdin ──▶ {"method":"tools/call","params":{"name":"github_list_repos"}}
  │
  ▼
Proxy (PID 2000)
  │
  ├──▶ Checks rules.json: "github" + "list" → READ → ALLOW
  │
  ├─ stdin ──▶ Forward to actual server
  │
  ▼
Actual MCP Server (PID 3000)
  │
  ├──▶ Calls GitHub API
  │
  └─ stdout ──▶ {"result":{"content":[list of repos]}}
  │
  ▲
  │
Proxy (PID 2000) ◀── Receives response
  │
  ├──▶ Logs: {"tool":"github_list_repos","status":"success"}
  │
  └─ stdout ──▶ Forward to Claude
  │
  ▲
  │
Claude receives result
```

---

## Why Traffic is "Forced" Through Proxy

**It's not "forced" - it's by configuration:**

1. **Claude only spawns what the config says**
   - Config says: "run mcp-governance-proxy"
   - Claude doesn't know the actual server exists
   - Claude thinks proxy IS the server

2. **The actual server is hidden from Claude**
   - Proxy spawns it as a subprocess
   - Claude never gets its process handle
   - Only the proxy can talk to it

3. **User controls this via config file**
   - Change config → change what runs
   - No "interception" needed
   - Simple process substitution

---

## Key Differences from Nginx

| Feature | Nginx | MCP Proxy |
|---------|-------|-----------|
| **Transport** | Network (TCP/HTTP) | stdio (pipes) |
| **Discovery** | DNS/IP address | Process spawn |
| **Interception** | Network routing | Config replacement |
| **Enforcement** | Firewall rules | Claude only knows proxy |
| **Bypass?** | Connect to backend IP directly | Not possible - user controls config |

---

## How to Install and Use

### Step 1: Install Proxy
```bash
npm install -g mcp-governance-proxy
```

This adds a global command: `mcp-governance-proxy`

### Step 2: Create Rules File
```json
// ~/mcp-rules/github.json
{
  "github": {
    "read": "allow",
    "write": "allow",
    "delete": "deny"
  }
}
```

### Step 3: Change Claude Config

**Before:**
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-github"],
      "env": {"GITHUB_TOKEN": "xxx"}
    }
  }
}
```

**After:**
```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": [
        "--target", "npx @anthropic/mcp-server-github",
        "--rules", "~/mcp-rules/github.json",
        "--env", "GITHUB_TOKEN=xxx"
      ]
    }
  }
}
```

Or using Claude CLI:
```bash
claude mcp add github-governed -- mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/mcp-rules/github.json \
  --env GITHUB_TOKEN=xxx
```

### Step 4: Restart Claude
```bash
# Claude Desktop: Just restart the app
# Claude Code: Start new session
claude
```

### Step 5: Test
```
You: "Delete my test-repo on GitHub"
Claude: ❌ Permission denied by governance policy
```

---

## How Proxy Prevents Bypass

**Question:** Can users bypass the proxy by changing config back?

**Answer:** Yes, but that's intentional!

- User controls their own config file
- If they want to bypass governance, they can
- This is for **self-governance** (preventing accidents)
- For **enterprise governance** (preventing intentional bypass), you'd:
  1. Lock the config file (filesystem permissions)
  2. Use Claude Desktop managed mode (IT controls config)
  3. Run Claude in restricted environment

---

## Implementation Details

### Proxy Server Code (Simplified)

```javascript
import { spawn } from 'child_process';
import { GovernedMCPServer } from 'mcp-gov';

// Parse args
const targetCommand = args['--target']; // "npx @anthropic/mcp-server-github"
const rules = JSON.parse(fs.readFileSync(args['--rules']));

// Create governance layer (talks to Claude)
const proxy = new GovernedMCPServer({name: 'proxy', version: '1.0'}, rules);

// Spawn actual MCP server as subprocess
const targetServer = spawn(targetCommand, {stdio: ['pipe', 'pipe', 'inherit']});

// Forward tools/list request to target
proxy.onToolsList = () => {
  // Send to target server via stdin
  targetServer.stdin.write(JSON.stringify({method: 'tools/list'}));
  // Wait for response on stdout
  const tools = await readFromTarget(targetServer.stdout);
  return tools;
};

// Register all tools from target with governance wrapper
const tools = await getToolsFromTarget();
tools.forEach(tool => {
  proxy.registerTool(tool, async (args) => {
    // This goes through governance checks!
    // If allowed, forward to target:
    targetServer.stdin.write(JSON.stringify({
      method: 'tools/call',
      params: {name: tool.name, arguments: args}
    }));
    return await readFromTarget(targetServer.stdout);
  });
});

proxy.start();
```

---

## Summary

**MCP Proxy is NOT network interception - it's process substitution:**

1. User changes Claude config to run proxy instead of server
2. Claude spawns proxy
3. Proxy spawns actual server
4. All messages flow through proxy
5. Proxy applies governance rules
6. No "forcing" - it's just what Claude is configured to run

**The proxy works because:**
- MCP uses stdio (not network)
- Claude spawns what config tells it to
- Proxy becomes the "man in the middle" by being the process Claude talks to
- Actual server is hidden behind proxy
