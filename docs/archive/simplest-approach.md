# Simplest Approach: Auto-Wrap CLI Tool

## The Problem with Two Configs

If mcp-gov has its own config, we have synchronization issues:
```
~/.claude.json          ~/mcp-gov-config.json
    ↓                           ↓
  Claude                    mcp-gov

User adds new MCP → Must update BOTH
```

This is terrible UX.

---

## Simplest Solution: Transform Config In-Place

**One command that wraps everything automatically.**

### Installation
```bash
npm install -g mcp-gov

# One command to enable governance
mcp-gov enable --rules ~/mcp-governance/rules.json
```

### What It Does

**Before:**
```json
{
  "mcpServers": {
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

**After:**
```json
{
  "mcpServers": {
    "github": {
      "command": "mcp-gov-proxy",
      "args": [
        "--target", "npx @anthropic/mcp-server-github",
        "--target-env", "GITHUB_TOKEN=xxx",
        "--rules", "/home/user/mcp-governance/rules.json"
      ]
    },
    "google": {
      "command": "mcp-gov-proxy",
      "args": [
        "--target", "npx @anthropic/mcp-server-google-drive",
        "--target-env", "GOOGLE_TOKEN=xxx",
        "--rules", "/home/user/mcp-governance/rules.json"
      ]
    }
  },
  "_mcpGovBackup": {
    "enabled": true,
    "originalConfig": {...}  // Store original for unwrap
  }
}
```

### Usage

#### Enable Governance
```bash
cd /your/project
mcp-gov enable --rules ~/mcp-governance/rules.json

# Output:
✓ Found 2 MCP servers: github, google
✓ Wrapped github with governance
✓ Wrapped google with governance
✓ Backed up original config
✓ Governance enabled
```

#### Add New MCP Server (Normal Flow)
```bash
# User adds server normally
claude mcp add slack -- npx @anthropic/mcp-server-slack

# Then wrap it
mcp-gov wrap slack

# Or re-enable to wrap everything
mcp-gov enable
```

#### Disable Governance
```bash
mcp-gov disable

# Output:
✓ Restored original config
✓ Governance disabled
```

#### Check Status
```bash
mcp-gov status

# Output:
Governance: ENABLED
Rules file: /home/user/mcp-governance/rules.json
Governed servers: github, google, slack (3 total)
```

---

## Implementation

### CLI Tool (~300 lines)

```javascript
#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_CONFIG = path.join(os.homedir(), '.claude.json');

function enable(rulesPath) {
  // 1. Read current config
  const config = JSON.parse(fs.readFileSync(CLAUDE_CONFIG, 'utf-8'));
  const project = findCurrentProject(config);

  // 2. Backup original
  if (!config._mcpGovBackup) {
    config._mcpGovBackup = {
      enabled: false,
      originalConfig: JSON.parse(JSON.stringify(config.projects[project].mcpServers))
    };
  }

  // 3. Wrap each MCP server
  const servers = config.projects[project].mcpServers;
  const wrapped = {};

  for (const [name, serverConfig] of Object.entries(servers)) {
    // Skip if already wrapped
    if (serverConfig.command === 'mcp-gov-proxy') {
      wrapped[name] = serverConfig;
      continue;
    }

    // Wrap it
    wrapped[name] = {
      type: serverConfig.type || 'stdio',
      command: 'mcp-gov-proxy',
      args: [
        '--target', `${serverConfig.command} ${serverConfig.args.join(' ')}`,
        '--rules', path.resolve(rulesPath)
      ].concat(
        // Pass through environment variables
        Object.entries(serverConfig.env || {}).map(([k, v]) =>
          `--target-env ${k}=${v}`
        )
      )
    };
  }

  // 4. Update config
  config.projects[project].mcpServers = wrapped;
  config._mcpGovBackup.enabled = true;

  // 5. Write back
  fs.writeFileSync(CLAUDE_CONFIG, JSON.stringify(config, null, 2));

  console.log(`✓ Governance enabled for ${Object.keys(wrapped).length} servers`);
}

function disable() {
  const config = JSON.parse(fs.readFileSync(CLAUDE_CONFIG, 'utf-8'));

  if (!config._mcpGovBackup) {
    console.log('Governance not enabled');
    return;
  }

  // Restore original
  const project = findCurrentProject(config);
  config.projects[project].mcpServers = config._mcpGovBackup.originalConfig;
  config._mcpGovBackup.enabled = false;

  fs.writeFileSync(CLAUDE_CONFIG, JSON.stringify(config, null, 2));
  console.log('✓ Governance disabled');
}

// CLI
const command = process.argv[2];
const rulesPath = process.argv[4]; // --rules ~/rules.json

if (command === 'enable') {
  enable(rulesPath);
} else if (command === 'disable') {
  disable();
}
```

---

## Handling Config Changes

### User Adds New Server
```bash
# User adds normally
claude mcp add context7 -- npx @upstash/context7-mcp

# Governance needs to wrap it
mcp-gov wrap context7
# OR
mcp-gov enable  # Re-wraps everything
```

### Auto-Detect New Servers (Advanced)
```bash
# Watch mode - automatically wraps new servers
mcp-gov watch &

# Now when user runs:
claude mcp add newserver -- ...

# watcher detects change and auto-wraps
```

Implementation:
```javascript
// Watch ~/.claude.json for changes
fs.watch(CLAUDE_CONFIG, (eventType) => {
  if (eventType === 'change') {
    const config = readConfig();
    const currentServers = Object.keys(config.projects[project].mcpServers);
    const knownServers = getKnownServers();

    const newServers = currentServers.filter(s => !knownServers.includes(s));

    if (newServers.length > 0) {
      console.log(`New servers detected: ${newServers.join(', ')}`);
      enable(); // Re-wrap everything
    }
  }
});
```

---

## Pros and Cons

### Pros
- ✅ **Single source of truth** (~/.claude.json only)
- ✅ **Simple mental model** (enable/disable governance)
- ✅ **No sync issues** (transforms existing config)
- ✅ **Easy to undo** (backup stored in config)
- ✅ **Works with existing workflow** (claude mcp add still works)

### Cons
- ❌ Still uses 1:1 proxy approach (not universal proxy)
- ❌ User must remember to wrap new servers
- ❌ Config file gets modified (some users might not like this)

---

## Comparison with Universal Proxy

| Feature | Auto-Wrap (In-Place) | Universal Proxy |
|---------|---------------------|-----------------|
| **Config files** | 1 (~/.claude.json) | 2 (claude + mcp-gov) |
| **Sync issues** | None | Must sync both configs |
| **User command** | `mcp-gov enable` | `mcp-gov install` |
| **Add new server** | `mcp-gov wrap name` | Update mcp-gov config |
| **Complexity** | Simple (~300 lines) | Complex (~500 lines) |
| **Architecture** | Standard (1:1 proxy) | Custom (multiplexer) |

---

## Hybrid Approach: Universal Proxy + Read Claude Config

**Best of both worlds:**

```javascript
// mcp-gov-universal at startup:
const claudeConfig = readFile('~/.claude.json');
const myProject = getCurrentProject();
const mcpServers = claudeConfig.projects[myProject].mcpServers;

// Spawn all servers EXCEPT myself
for (const [name, config] of Object.entries(mcpServers)) {
  if (name === 'mcp-gov') continue; // Skip self

  spawnServer(name, config.command, config.args, config.env);
}
```

**User config:**
```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-universal",
      "args": ["--rules", "~/rules.json"]
    },
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]}
  }
}
```

**When mcp-gov starts:**
1. Reads `~/.claude.json`
2. Finds github and google servers
3. Spawns them
4. Routes their tools through governance

**User adds new server:**
```bash
claude mcp add slack -- npx @anthropic/mcp-server-slack
# Restart Claude session
# mcp-gov auto-detects slack and spawns it
```

**Benefits:**
- ✅ Universal proxy (all MCP goes through one layer)
- ✅ Single source of truth (~/.claude.json)
- ✅ Auto-detects new servers (reads config at startup)
- ✅ No manual wrapping needed

---

## Recommendation: Hybrid Approach

**Implementation:**
1. Build universal proxy that reads ~/.claude.json
2. One-time setup: `mcp-gov install --rules ~/rules.json`
3. Adds one entry to Claude config: mcp-gov
4. When Claude spawns mcp-gov, it reads the SAME config file
5. Finds all other MCP servers and spawns them
6. User adds new servers normally - auto-detected on next Claude restart

**This is the simplest AND most powerful.**
