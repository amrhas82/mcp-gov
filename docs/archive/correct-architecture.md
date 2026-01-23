# The Correct Architecture

## The Problem

If both mcp-gov AND the original servers are in mcpServers, Claude spawns everything directly:

```json
{
  "mcpServers": {
    "mcp-gov": {"command": "mcp-gov-universal"},
    "github": {"command": "npx @anthropic/mcp-server-github"}  // ← Claude spawns this!
  }
}
```

Result: Claude talks directly to GitHub, bypassing governance.

---

## Solution: Different Config Sections

**Single file, different sections:**

```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-universal",
      "args": ["--rules", "/home/user/mcp-governance/rules.json"]
    }
  },

  "mcpGovManaged": {
    "github": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-github"],
      "env": {"GITHUB_TOKEN": "xxx"}
    },
    "google": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-google-drive"],
      "env": {"GOOGLE_TOKEN": "xxx"}
    }
  }
}
```

### What Happens

**Claude reads mcpServers:**
- Finds ONLY "mcp-gov"
- Spawns ONLY mcp-gov-universal

**mcp-gov reads mcpGovManaged:**
- Finds github and google
- Spawns them internally
- Routes their tools through governance

**Result:** All MCP traffic flows through mcp-gov.

---

## User Flow

### 1. User Has Normal MCP Servers
```json
{
  "mcpServers": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]}
  }
}
```

### 2. Install Governance
```bash
mcp-gov install --rules ~/mcp-governance/rules.json
```

### 3. Config Transformed
```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-universal",
      "args": ["--rules", "/home/user/mcp-governance/rules.json"]
    }
  },

  "mcpGovManaged": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]}
  }
}
```

**What happened:**
- Moved github and google from `mcpServers` → `mcpGovManaged`
- Added mcp-gov to `mcpServers`

### 4. Add New Server
```bash
# User wants to add Slack
# They edit config directly OR use helper:

mcp-gov add slack -- npx @anthropic/mcp-server-slack

# This adds to mcpGovManaged (not mcpServers)
```

Or provide a wrapper for `claude mcp add`:
```bash
# Instead of:
claude mcp add slack -- npx @anthropic/mcp-server-slack

# Use:
mcp-gov add slack -- npx @anthropic/mcp-server-slack
```

### 5. Restart Claude
```bash
claude
# mcp-gov reads mcpGovManaged, spawns all servers
# All governed automatically
```

---

## Implementation

### Installation Tool
```javascript
#!/usr/bin/env node
// mcp-gov install

function install(rulesPath) {
  const config = readClaudeConfig();
  const project = getCurrentProject();

  // 1. Move existing MCP servers to mcpGovManaged
  config.mcpGovManaged = config.projects[project].mcpServers;

  // 2. Replace mcpServers with just mcp-gov
  config.projects[project].mcpServers = {
    'mcp-gov': {
      command: 'mcp-gov-universal',
      args: ['--rules', path.resolve(rulesPath)]
    }
  };

  // 3. Backup original
  config._mcpGovBackup = {
    originalMcpServers: {...config.mcpGovManaged}
  };

  writeClaudeConfig(config);
  console.log('✓ Governance installed');
}
```

### Universal Proxy Server
```javascript
#!/usr/bin/env node
// mcp-gov-universal

async function start() {
  const rulesPath = parseArgs().rules;
  const rules = JSON.parse(fs.readFileSync(rulesPath));

  // 1. Read Claude config
  const config = readClaudeConfig();

  // 2. Get managed servers from mcpGovManaged section
  const managedServers = config.mcpGovManaged || {};

  // 3. Spawn all managed servers
  const servers = {};
  for (const [name, serverConfig] of Object.entries(managedServers)) {
    servers[name] = spawn(serverConfig.command, serverConfig.args, {
      env: {...process.env, ...serverConfig.env},
      stdio: ['pipe', 'pipe', 'inherit']
    });
  }

  // 4. Get tools from all servers
  const allTools = await getAllTools(servers);

  // 5. Start MCP server that routes to managed servers
  const mcpServer = new Server({name: 'mcp-gov', version: '1.0.0'});

  // 6. Register all tools with governance
  for (const tool of allTools) {
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const {service, operation} = parseToolName(toolName);

      // Check governance rules
      if (rules[service]?.[operation] === 'deny') {
        return {
          content: [{type: 'text', text: 'Permission denied by governance'}],
          isError: true
        };
      }

      // Forward to appropriate server
      const targetServer = findServerForTool(toolName, servers);
      return await forwardToolCall(targetServer, toolName, request.params.arguments);
    });
  }

  mcpServer.connect(new StdioServerTransport());
}
```

---

## Pros and Cons

### Pros
✅ **Single config file** (~/.claude.json)
✅ **No bypassing** (Claude only knows about mcp-gov)
✅ **Auto-discovery** (mcp-gov reads mcpGovManaged)
✅ **Universal proxy** (all MCP goes through one layer)
✅ **Clean separation** (active vs managed servers)

### Cons
❌ **Custom config section** (mcpGovManaged not standard)
❌ **Can't use `claude mcp add`** (need `mcp-gov add` instead)
❌ **Less familiar** (users must learn new section)

---

## Alternative: Complete Replacement (Auto-Wrap)

**Go back to 1:1 proxies, but make it automatic:**

```bash
# One command wraps everything
mcp-gov install --rules ~/rules.json

# Config transformed from:
{
  "mcpServers": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]}
  }
}

# To:
{
  "mcpServers": {
    "github": {
      "command": "mcp-gov-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", "--rules", "~/rules.json"]
    }
  }
}
```

**Still 1:1, but:**
- ✅ Single config file
- ✅ Auto-wraps everything with one command
- ✅ Works with `claude mcp add` (just need to re-run `mcp-gov wrap` after)
- ❌ Not a universal proxy (separate process per server)

---

## Recommendation

**For simplicity: Auto-wrap approach (1:1 proxies)**
- One command: `mcp-gov install`
- Transforms existing config in-place
- Each server gets wrapped individually
- Still 1:1, but fully automatic

**For elegance: Custom config section (universal proxy)**
- Separate mcpServers from mcpGovManaged
- True universal proxy
- Requires custom add command
- More complex but cleaner architecture

---

## Honest Assessment

**The universal proxy is complex for marginal benefit.**

The 1:1 auto-wrap approach is:
- Simpler to implement
- Easier for users to understand
- Works with existing Claude commands (mostly)
- Good enough for safety guardrails

**Let's build the auto-wrap tool - it's 80% of the value with 20% of the complexity.**
