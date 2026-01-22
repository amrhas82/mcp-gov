# Single Universal Proxy vs Multiple Proxies

## Current: Multiple Proxies (1:1)

### Process Tree
```
claude (PID 1000)
  ├── mcp-gov-proxy (PID 2000) → GitHub server
  ├── mcp-gov-proxy (PID 3000) → Google server
  └── mcp-gov-proxy (PID 4000) → Context7 server
```

### Config
```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-gov-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", "--rules", "~/rules.json"]
    },
    "google-governed": {
      "command": "mcp-gov-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-google-drive", "--rules", "~/rules.json"]
    }
  }
}
```

### Pros
- ✅ Standard MCP architecture (each server is independent)
- ✅ Isolated failures
- ✅ Easy to debug

### Cons
- ❌ Must configure each MCP server individually
- ❌ Multiple processes

---

## Proposed: Single Universal Proxy

### Process Tree
```
claude (PID 1000)
  └── mcp-gov-universal (PID 2000)
        ├── GitHub server (PID 2001)
        ├── Google server (PID 2002)
        └── Context7 server (PID 2003)
```

### Config
```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-universal",
      "args": ["--config", "~/mcp-gov-config.json"]
    }
  }
}
```

### The mcp-gov-config.json
```json
{
  "rules": {
    "github": {"delete": "deny"},
    "google": {"delete": "deny"}
  },
  "servers": {
    "github": {"command": "npx @anthropic/mcp-server-github", "env": {...}},
    "google": {"command": "npx @anthropic/mcp-server-google-drive", "env": {...}}
  }
}
```

### How It Works

#### 1. Initialization
```javascript
// mcp-gov-universal starts
const config = readConfig('~/mcp-gov-config.json');

// Spawn all target MCP servers
const githubServer = spawn(config.servers.github.command);
const googleServer = spawn(config.servers.google.command);

// Map tool names to servers
const toolToServer = {};
// Get tools from GitHub: github_list_repos, github_delete_repo
// Get tools from Google: google_drive_list_files, google_drive_delete_file
```

#### 2. Tool Call Routing
```javascript
// Claude calls: github_list_repos
onToolCall('github_list_repos', args) {
  // 1. Extract service name
  const service = 'github'; // from tool name prefix

  // 2. Check rules
  const operation = detectOperation('github_list_repos'); // → 'read'
  if (rules[service][operation] === 'deny') {
    return {error: 'Permission denied'};
  }

  // 3. Route to correct server
  const targetServer = toolToServer['github_list_repos']; // → githubServer

  // 4. Forward request
  targetServer.stdin.write(JSON.stringify({
    method: 'tools/call',
    params: {name: 'github_list_repos', arguments: args}
  }));

  // 5. Return response
  return await readResponse(targetServer.stdout);
}
```

### Pros
- ✅ **Single config entry in Claude**
- ✅ **All servers governed in one place**
- ✅ **Easier for end users** (looks like one MCP server)
- ✅ **Centralized rules management**

### Cons
- ❌ More complex to build (~500 lines vs ~200 lines)
- ❌ Single point of failure
- ❌ Tool name routing logic required
- ❌ Non-standard MCP architecture

---

## Comparison Table

| Feature | Multiple Proxies (1:1) | Single Universal Proxy |
|---------|------------------------|------------------------|
| **Claude Config** | One entry per MCP server | One entry total |
| **User Setup** | Configure each server | Configure once |
| **Architecture** | Standard MCP model | Custom multiplexer |
| **Failure Isolation** | Yes (one fails, others work) | No (one fails, all fail) |
| **Debugging** | Easy (separate logs) | Harder (mixed logs) |
| **Build Complexity** | Simple (~200 lines) | Complex (~500 lines) |
| **Rules Management** | Shared rules.json | Shared rules.json |

---

## What Does "Easier" Actually Mean?

### For Multiple Proxies
**Setup per server:**
```bash
claude mcp add github-gov -- mcp-gov-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/rules.json

claude mcp add google-gov -- mcp-gov-proxy \
  --target "npx @anthropic/mcp-server-google-drive" \
  --rules ~/rules.json
```

**Total effort:** 2 commands per server = 6 commands for 3 servers

### For Single Universal Proxy
**Setup once:**
```bash
# 1. Create config
cat > ~/mcp-gov-config.json << EOF
{
  "rules": {...},
  "servers": {
    "github": {...},
    "google": {...},
    "context7": {...}
  }
}
EOF

# 2. Add to Claude
claude mcp add mcp-gov -- mcp-gov-universal \
  --config ~/mcp-gov-config.json
```

**Total effort:** 1 config file + 1 command

**Winner:** Single universal proxy (for user setup)

---

## Which Should We Build?

### Build Multiple Proxies If:
- You want standard MCP architecture
- You value isolation and debugging ease
- You want to ship something quickly (~2 days)

### Build Single Universal Proxy If:
- You want better user experience
- You're okay with more complex implementation
- You want a "one governance layer" mental model
- You have time to build it properly (~1 week)

---

## My Recommendation

**Build the Single Universal Proxy.**

Why?
1. **Better UX** - Users configure governance once, not per server
2. **Matches user's mental model** - "All MCP goes through governance"
3. **Differentiation** - This is actually unique, nobody else has this
4. **Scalability** - Add 10 MCP servers? Still one config entry

The complexity is worth it for a better product.
