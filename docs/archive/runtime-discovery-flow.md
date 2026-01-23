# Runtime Discovery & Routing Architecture

## The Flow

### Startup Sequence

```
1. Claude starts
   ↓
2. Claude reads ~/.claude.json
   ↓
3. Claude finds mcpServers section:
   {
     "mcp-gov": {...},
     "github": {...},    ← Problem: Claude spawns this directly!
     "google": {...}     ← Problem: Claude spawns this directly!
   }
   ↓
4. Claude spawns ALL THREE processes
   ↓
5. Governance is BYPASSED (Claude talks directly to github/google)
```

**This doesn't work.**

---

## Proposed Architecture: Separate Section

### Config Structure
```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-universal",
      "args": ["--rules", "~/rules.json"]
    }
  },
  "mcpGovManaged": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]}
  }
}
```

### Runtime Flow

```
1. Claude starts
   ↓
2. Claude reads mcpServers section ONLY
   ↓
3. Claude finds ONLY "mcp-gov"
   ↓
4. Claude spawns: mcp-gov-universal
   ↓
5. mcp-gov-universal reads SAME config file
   ↓
6. mcp-gov reads mcpGovManaged section
   ↓
7. mcp-gov spawns:
      - github MCP server (as subprocess)
      - google MCP server (as subprocess)
   ↓
8. mcp-gov queries each subprocess for their tools:
      - github: github_list_repos, github_delete_repo, etc.
      - google: google_drive_list_files, google_drive_delete_file, etc.
   ↓
9. mcp-gov registers ALL tools as its own tools
   ↓
10. Claude sees tools as coming from "mcp-gov" server
```

### Tool Call Flow

```
User: "Delete my GitHub repo"
   ↓
Claude: Wants to call github_delete_repo
   ↓
Claude sends to: mcp-gov (thinks it owns this tool)
   ↓
mcp-gov receives: {method: "tools/call", params: {name: "github_delete_repo", arguments: {repo_name: "test"}}}
   ↓
mcp-gov:
   1. Parses tool name: service="github", operation="delete"
   2. Checks rules: rules.github.delete = "deny"
   3. BLOCKS: Returns error to Claude
   ↓
Claude: Shows user "Permission denied by governance"
```

**For allowed operations:**
```
User: "List my GitHub repos"
   ↓
Claude → mcp-gov: Call github_list_repos
   ↓
mcp-gov:
   1. Parses: service="github", operation="read"
   2. Checks: rules.github.read = "allow"
   3. Routes to github subprocess:
      - Writes to github server's stdin: {method: "tools/call", ...}
      - Reads from github server's stdout: {result: {content: [...]}}
   4. Forwards response back to Claude
   ↓
Claude: Shows user the repo list
```

---

## Does mcp-gov Store Tool Definitions?

**Yes, at startup:**

```javascript
// mcp-gov-universal startup
async function discoverTools() {
  const allTools = [];

  // For each managed server
  for (const [name, server] of Object.entries(managedServers)) {
    // Send tools/list request
    server.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list"
    }));

    // Read response
    const response = await readLine(server.stdout);
    const tools = JSON.parse(response).result.tools;

    // Store with server mapping
    tools.forEach(tool => {
      allTools.push(tool);
      toolToServer[tool.name] = server; // Map tool → server
    });
  }

  return allTools;
}

// At startup
const tools = await discoverTools();

// Register all tools with MCP SDK
tools.forEach(tool => {
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === tool.name) {
      return await routeToServer(tool.name, request.params.arguments);
    }
  });
});
```

**Key Points:**
1. ✅ mcp-gov discovers tools at startup by querying each server
2. ✅ mcp-gov stores mapping: tool name → which server owns it
3. ✅ mcp-gov registers all tools as its own (to Claude)
4. ✅ When tool is called, mcp-gov routes to correct server

---

## What About New MCP Servers Added Later?

### Option A: Restart Required (Simple)
```bash
# User adds new server
echo '{"slack": {...}}' >> mcpGovManaged section

# Restart Claude
claude
# mcp-gov discovers slack tools on startup
```

**Pros:** Simple, reliable
**Cons:** Must restart

### Option B: Hot Reload (Complex)
```javascript
// mcp-gov watches config file
fs.watch('~/.claude.json', async (event) => {
  const newConfig = readConfig();
  const newServers = findNewServers(newConfig);

  for (const server of newServers) {
    // Spawn new server
    const proc = spawn(server.command, server.args);

    // Discover its tools
    const tools = await getTools(proc);

    // Register tools dynamically
    tools.forEach(tool => registerTool(tool));
  }
});
```

**Pros:** No restart needed
**Cons:** Complex, potential race conditions

**Recommendation:** Require restart (simpler, more reliable)

---

## Summary

**Runtime Discovery:**
1. mcp-gov reads mcpGovManaged section
2. Spawns all listed servers
3. Queries each for tools (tools/list)
4. Stores tool → server mapping
5. Registers all tools as its own

**Routing:**
1. Claude calls tool (thinks it's calling mcp-gov)
2. mcp-gov checks governance rules
3. If allowed, routes to actual server via stdin/stdout
4. Returns response to Claude

**New Servers:**
- Requires restart to discover
- OR complex hot-reload mechanism
