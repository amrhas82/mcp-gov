# Auto-Wrap: Actual Implementation Flow

## The Key Insight

**Proxy doesn't need to know tools in advance.**

It just:
1. Receives tool call from Claude
2. Reads the tool name
3. Checks governance rules
4. Blocks OR forwards to target MCP server

---

## What Does Proxy Actually Do?

### Proxy is Just a Pass-Through with Rules Check

```
Claude → mcp-gov-proxy → Target MCP Server
          ↓
       Checks tool name against rules
       If blocked: return error
       If allowed: forward request
```

### Proxy Implementation (Simplified)

```javascript
// mcp-gov-proxy.js
import { spawn } from 'child_process';
import { parseToolName } from './operation-detector.js';

// 1. Parse command line args
const targetCommand = process.argv[2];  // "npx @anthropic/mcp-server-github"
const rulesPath = process.argv[4];      // "~/rules.json"

// 2. Load rules
const rules = JSON.parse(fs.readFileSync(rulesPath));

// 3. Spawn target MCP server as subprocess
const targetServer = spawn('sh', ['-c', targetCommand], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// 4. Pipe Claude's stdin to proxy
process.stdin.on('data', async (data) => {
  const message = JSON.parse(data);

  // Is this a tool call?
  if (message.method === 'tools/call') {
    const toolName = message.params.name;
    const { service, operation } = parseToolName(toolName);

    // Check rules
    if (rules[service]?.[operation] === 'deny') {
      // BLOCK
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [{
            type: "text",
            text: `Permission denied: ${toolName} blocked by governance`
          }],
          isError: true
        }
      }));
      return;
    }
  }

  // FORWARD to target server
  targetServer.stdin.write(data);
});

// 5. Pipe target server's stdout back to Claude
targetServer.stdout.on('data', (data) => {
  process.stdout.write(data);
});
```

**Key points:**
- ✅ Proxy doesn't call `tools/list` at startup
- ✅ Proxy doesn't know what tools exist
- ✅ Proxy just intercepts messages in real-time
- ✅ If tool call → check rules → block or forward
- ✅ All other messages (initialize, tools/list, etc.) → forward directly

---

## Auto-Detection & Wrapping Flow

### Option A: Wrapper Script (Simplest)

```bash
#!/usr/bin/env node
// mcp-gov-claude wrapper

// 1. Read config
const config = readFile('~/.claude.json');

// 2. Find unwrapped servers
const unwrapped = findUnwrappedServers(config);

// 3. Wrap them
if (unwrapped.length > 0) {
  console.log(`Wrapping ${unwrapped.length} servers...`);
  wrapServers(unwrapped);
  writeConfig(config);
}

// 4. Run actual Claude
exec('claude', process.argv.slice(2));
```

**User runs:**
```bash
# Instead of:
claude

# User runs:
mcp-gov-claude

# OR alias it:
alias claude='mcp-gov-claude'
```

**Flow:**
```
User types: claude
   ↓
mcp-gov-claude wrapper runs
   ↓
1. Reads ~/.claude.json
2. Finds: github (unwrapped), google (unwrapped)
3. Wraps them in-place:
   github: {command: "npx..."}
   → github: {command: "mcp-gov-proxy", args: ["--target", "npx..."]}
4. Saves config
5. Runs actual claude command
   ↓
Claude starts normally, sees wrapped servers
```

**Pros:**
- ✅ Auto-wraps on every Claude start
- ✅ No manual sync needed
- ✅ Transparent to user

**Cons:**
- ❌ User must use wrapper instead of claude directly
- ❌ Slight delay on startup (config check)

---

### Option B: One-Time Install + Manual Sync

```bash
# 1. Initial install
mcp-gov install --rules ~/rules.json

# Wraps all existing servers once
# Config updated

# 2. User adds new server later
claude mcp add slack -- npx @anthropic/mcp-server-slack

# Config now has unwrapped slack server

# 3. User must sync
mcp-gov sync

# OR provide helper command
mcp-gov add slack -- npx @anthropic/mcp-server-slack
# This adds AND wraps in one step
```

**Pros:**
- ✅ User can still use `claude` directly
- ✅ No startup delay

**Cons:**
- ❌ User must remember to run sync after adding servers
- ❌ Easy to forget

---

### Option C: File Watcher (Background Daemon)

```bash
# 1. Start watcher
mcp-gov watch &

# Daemon watches ~/.claude.json for changes

# 2. User adds server normally
claude mcp add slack -- npx @anthropic/mcp-server-slack

# 3. Watcher detects change
# Automatically wraps slack server
# Updates config in background

# 4. Next Claude restart picks up wrapped version
```

**Implementation:**
```javascript
// mcp-gov watch
import { watch } from 'fs';

let lastConfig = readConfig();

watch('~/.claude.json', (eventType) => {
  if (eventType === 'change') {
    const newConfig = readConfig();
    const newServers = findNewServers(newConfig, lastConfig);

    if (newServers.length > 0) {
      console.log(`Auto-wrapping: ${newServers.join(', ')}`);
      wrapServers(newConfig, newServers);
      writeConfig(newConfig);
      lastConfig = newConfig;
    }
  }
});
```

**Pros:**
- ✅ Fully automatic
- ✅ User uses claude normally
- ✅ No manual sync needed

**Cons:**
- ❌ Background daemon (must start on boot)
- ❌ Race conditions (if Claude writes config while daemon wraps)
- ❌ More complex

---

## Detailed Message Flow at Runtime

### Startup (tools/list)

```
1. Claude sends to mcp-gov-proxy:
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "tools/list"
   }

2. Proxy forwards to target GitHub server:
   targetServer.stdin.write(message)

3. GitHub server responds:
   {
     "result": {
       "tools": [
         {"name": "github_list_repos", ...},
         {"name": "github_delete_repo", ...}
       ]
     }
   }

4. Proxy forwards response back to Claude:
   process.stdout.write(response)

5. Claude now knows available tools
```

**Proxy does nothing here - just forwards.**

---

### Tool Call - Allowed (github_list_repos)

```
1. Claude sends to mcp-gov-proxy:
   {
     "method": "tools/call",
     "params": {
       "name": "github_list_repos",
       "arguments": {}
     }
   }

2. Proxy intercepts:
   - Extracts: toolName = "github_list_repos"
   - Parses: service = "github", operation = "read"
   - Checks rules: rules.github.read = "allow"
   - Decision: FORWARD

3. Proxy forwards to GitHub server:
   targetServer.stdin.write(message)

4. GitHub server executes:
   - Calls GitHub API
   - Returns repo list

5. GitHub server responds:
   {
     "result": {
       "content": [{
         "type": "text",
         "text": "Found 19 repositories..."
       }]
     }
   }

6. Proxy forwards response to Claude:
   process.stdout.write(response)

7. Claude shows user the repos
```

---

### Tool Call - Blocked (github_delete_repo)

```
1. Claude sends to mcp-gov-proxy:
   {
     "method": "tools/call",
     "params": {
       "name": "github_delete_repo",
       "arguments": {"repo_name": "test-repo"}
     }
   }

2. Proxy intercepts:
   - Extracts: toolName = "github_delete_repo"
   - Parses: service = "github", operation = "delete"
   - Checks rules: rules.github.delete = "deny"
   - Decision: BLOCK

3. Proxy does NOT forward to GitHub server

4. Proxy returns error to Claude:
   {
     "result": {
       "content": [{
         "type": "text",
         "text": "Permission denied: github_delete_repo blocked by governance"
       }],
       "isError": true
     }
   }

5. Claude shows user the error
```

**GitHub server never sees the request!**

---

## Summary: What Proxy Knows

**Proxy does NOT need to know:**
- ❌ What tools exist
- ❌ Tool schemas
- ❌ Tool descriptions

**Proxy only needs to know:**
- ✅ How to parse tool names (service + operation)
- ✅ Governance rules (rules.json)
- ✅ How to forward messages (stdin/stdout piping)

**This makes the proxy incredibly simple!**

---

## Recommended Approach

**Use wrapper script (Option A) for best UX:**

```bash
# 1. Install
npm install -g mcp-gov

# 2. Create alias
echo 'alias claude="mcp-gov-claude"' >> ~/.bashrc

# 3. User runs claude normally
claude

# Behind the scenes:
# - Wrapper checks config
# - Auto-wraps any unwrapped servers
# - Runs actual claude
# - Completely transparent
```

**Benefits:**
- ✅ Automatic wrapping on every start
- ✅ Works with new servers automatically
- ✅ No manual sync needed
- ✅ User doesn't need to think about it

**Trade-off:**
- Adds ~100ms startup delay (reading/checking config)
- Worth it for automatic behavior
