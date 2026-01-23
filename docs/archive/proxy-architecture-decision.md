# Proxy Architecture Decision: One Proxy Per MCP Server

## Architecture: One Proxy Instance Per MCP Server

Each MCP server gets wrapped by its own proxy instance. All proxies share the same rules.json file.

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Desktop / Claude Code CLI                             │
└─────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Proxy Instance  │ │ Proxy Instance  │ │ Proxy Instance  │
│ (github)        │ │ (google)        │ │ (context7)      │
│                 │ │                 │ │                 │
│ Reads:          │ │ Reads:          │ │ Reads:          │
│ rules.json      │ │ rules.json      │ │ rules.json      │
│ → github {...}  │ │ → google {...}  │ │ → context7 {...}│
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ GitHub          │ │ Google Drive    │ │ Context7        │
│ MCP Server      │ │ MCP Server      │ │ MCP Server      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Configuration Files

### Shared Rules File
**Location:** `~/mcp-governance/rules.json`

```json
{
  "github": {
    "read": "allow",
    "write": "allow",
    "delete": "deny"
  },
  "google": {
    "read": "allow",
    "write": "allow",
    "delete": "deny"
  },
  "context7": {
    "read": "allow",
    "write": "allow",
    "delete": "allow"
  }
}
```

### Claude Configuration
**Location:** `~/.claude.json`

```json
{
  "projects": {
    "/your/project": {
      "mcpServers": {
        "github-governed": {
          "type": "stdio",
          "command": "mcp-governance-proxy",
          "args": [
            "--target", "npx @anthropic/mcp-server-github",
            "--rules", "/home/user/mcp-governance/rules.json",
            "--env", "GITHUB_TOKEN=xxx"
          ]
        },
        "google-governed": {
          "type": "stdio",
          "command": "mcp-governance-proxy",
          "args": [
            "--target", "npx @anthropic/mcp-server-google-drive",
            "--rules", "/home/user/mcp-governance/rules.json",
            "--env", "GOOGLE_TOKEN=xxx"
          ]
        },
        "context7-governed": {
          "type": "stdio",
          "command": "mcp-governance-proxy",
          "args": [
            "--target", "npx @upstash/context7-mcp --api-key xxx",
            "--rules", "/home/user/mcp-governance/rules.json"
          ]
        }
      }
    }
  }
}
```

## How It Works

### Step 1: Claude Starts Session

When you run `claude`, it reads `~/.claude.json` and spawns three separate processes:

```bash
# Process tree
claude (PID 1000)
  ├── mcp-governance-proxy (PID 2000) [github-governed]
  │     └── npx @anthropic/mcp-server-github (PID 2001)
  │
  ├── mcp-governance-proxy (PID 3000) [google-governed]
  │     └── npx @anthropic/mcp-server-google-drive (PID 3001)
  │
  └── mcp-governance-proxy (PID 4000) [context7-governed]
        └── npx @upstash/context7-mcp (PID 4001)
```

### Step 2: Each Proxy Reads Rules

Each proxy instance:
1. Reads `rules.json` on startup
2. Extracts service name from tool names
3. Looks up rules for that service
4. Caches rules in memory

```javascript
// Proxy #1 (github-governed)
const rules = readRulesFile(); // reads full file
const githubRules = rules.github; // extracts github section
// Applies: {read: allow, write: allow, delete: deny}

// Proxy #2 (google-governed)
const rules = readRulesFile(); // reads same file
const googleRules = rules.google; // extracts google section
// Applies: {read: allow, write: allow, delete: deny}
```

### Step 3: Tool Calls Are Routed

When Claude needs to call a tool:

```
User: "List my GitHub repos and Google Drive files"

Claude analyzes available tools:
  - github_list_repos (from github-governed server)
  - google_drive_list_files (from google-governed server)

Claude sends two separate requests:
  1. To github-governed proxy (PID 2000)
  2. To google-governed proxy (PID 3000)
```

**Request 1 to github-governed:**
```
Claude (stdin) → Proxy #1 → Checks rules.github.read (allow)
                           → Forwards to GitHub Server
                           → Returns results to Claude
```

**Request 2 to google-governed:**
```
Claude (stdin) → Proxy #2 → Checks rules.google.read (allow)
                           → Forwards to Google Server
                           → Returns results to Claude
```

### Step 4: Blocked Operations

```
User: "Delete my old GitHub repo and old Google docs"

Claude analyzes:
  - github_delete_repo (DELETE operation)
  - google_drive_delete_file (DELETE operation)
```

**Request 1 to github-governed:**
```
Claude → Proxy #1 → Checks rules.github.delete (deny)
                  → BLOCKS request
                  → Returns error: "Permission denied"
```

**Request 2 to google-governed:**
```
Claude → Proxy #2 → Checks rules.google.delete (deny)
                  → BLOCKS request
                  → Returns error: "Permission denied"
```

## Selective Governance

You can choose which servers to govern:

```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", ...]
    },
    "context7-direct": {
      "command": "npx",
      "args": ["@upstash/context7-mcp", "--api-key", "xxx"]
    }
  }
}
```

**Result:**
- GitHub operations → Governed (delete blocked)
- Context7 operations → Direct (no governance, full access)

## Benefits of This Architecture

### 1. Isolation
If one proxy crashes, others continue working:
```
Proxy #1 (github) → CRASHED
Proxy #2 (google) → Still working ✓
Proxy #3 (context7) → Still working ✓
```

### 2. Standard MCP Model
Follows the established pattern:
- One MCP server = one stdio process
- Claude spawns multiple servers
- Each server is independent

### 3. Easy Debugging
Each proxy logs separately:
```bash
# View GitHub proxy logs
tail -f ~/.cache/claude/github-governed-*.log

# View Google proxy logs
tail -f ~/.cache/claude/google-governed-*.log
```

### 4. Flexible Rules
Can use different rules files per server if needed:
```bash
claude mcp add github-prod -- mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/rules-prod.json

claude mcp add github-dev -- mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/rules-dev.json
```

### 5. Gradual Adoption
Add governance server-by-server:
```
Week 1: Add governance to GitHub (most critical)
Week 2: Add governance to filesystem (also critical)
Week 3: Add governance to other services
```

### 6. Performance
Lightweight proxies:
- ~10MB memory per proxy
- Negligible CPU overhead
- Rules cached in memory

## Shared Rules Management

All proxies read the same file, so one change updates all:

```bash
# Edit rules
nano ~/mcp-governance/rules.json

# Change: github.delete from "deny" to "allow"

# Restart Claude session
# All proxies reload with new rules
```

## CLI Usage

### Add Governed Server
```bash
mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/mcp-governance/rules.json \
  --env GITHUB_TOKEN=xxx
```

### Add Multiple Servers
```bash
# GitHub
claude mcp add github-gov -- mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-github" \
  --rules ~/rules.json \
  --env GITHUB_TOKEN=xxx

# Google
claude mcp add google-gov -- mcp-governance-proxy \
  --target "npx @anthropic/mcp-server-google-drive" \
  --rules ~/rules.json \
  --env GOOGLE_TOKEN=xxx

# Context7
claude mcp add context7-gov -- mcp-governance-proxy \
  --target "npx @upstash/context7-mcp --api-key xxx" \
  --rules ~/rules.json
```

## Why Not a Single Universal Proxy?

A single proxy managing all servers would require:

1. **Custom Protocol:** Proxy needs to route tools to correct backend
   - "github_list_repos" → route to GitHub server
   - "google_drive_list" → route to Google server
   - Complex multiplexing logic

2. **Single Point of Failure:** One crash kills all servers

3. **Harder Debugging:** Mixed logs from all services

4. **Non-Standard:** Doesn't follow MCP architecture patterns

5. **All-or-Nothing:** Can't selectively govern some servers

## Implementation Complexity

**One Proxy Per Server:**
- ~200 lines of code
- Simple subprocess management
- Standard stdio piping
- Easy to test

**Single Universal Proxy:**
- ~800 lines of code
- Complex routing logic
- Multiple subprocess management
- Tool name → server mapping
- Much harder to test

## Decision: One Proxy Per Server

✅ **Recommended Architecture**

Each MCP server gets its own proxy instance. All share the same rules file. Simple, standard, and easy to maintain.
