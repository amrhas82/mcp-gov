# Multi-Service Governance Setup

## Scenario: Protect Against Destructive Operations Across All Services

You have multiple MCP servers installed:
- **GitHub** - Code repositories
- **Google Drive** - Documents
- **Context7** - Memory/embeddings
- **Slack** - Team communication
- **Filesystem** - Local files

You want **safety guardrails** for all of them with one governance layer.

---

## Configuration

### Step 1: Single Rules File for All Services

Create `~/mcp-governance/rules.json`:

```json
{
  "github": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "allow",
    "admin": "deny"
  },

  "google": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "deny",
    "admin": "deny"
  },

  "context7": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "deny",
    "admin": "deny"
  },

  "slack": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "deny",
    "admin": "deny"
  },

  "filesystem": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "deny",
    "admin": "deny"
  }
}
```

### Step 2: Current State (What You Have Now)

Check your existing MCP servers:

```bash
claude mcp list
```

You might see:
```
context7: npx -y @upstash/context7-mcp --api-key YOUR_API_KEY - ✓ Connected
```

---

## Problem: How to Add Governance to Existing Servers?

You have two options:

### Option A: Build Custom Governed Servers (What We Did with GitHub)

**Pros:**
- Full control over implementation
- Custom tools tailored to your needs

**Cons:**
- Need to rebuild tools for each service
- More maintenance

**Example:** The GitHub server we just built and tested

---

### Option B: Build Governance Proxy (Wraps Existing Servers)

**Pros:**
- Works with ANY existing MCP server
- No need to rebuild tools
- Install once, govern everything

**Cons:**
- Need to build the proxy (200 lines of code)
- Adds one extra process in the chain

**This is what we should build next!**

---

## Option B Architecture (Recommended)

```
Claude
  ↓
Governance Proxy (reads rules.json)
  ↓
Existing MCP Servers:
  - @anthropic/mcp-server-github
  - @anthropic/mcp-server-google-drive
  - @upstash/context7-mcp
  - @anthropic/mcp-server-slack
  - @anthropic/mcp-server-filesystem
```

### How It Would Work

**1. Install governance proxy:**
```bash
npm install -g mcp-governance-proxy
```

**2. Configure wrapped servers:**

Instead of:
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "xxx"]
    }
  }
}
```

You do:
```json
{
  "mcpServers": {
    "context7-governed": {
      "command": "mcp-governance-proxy",
      "args": [
        "--target", "npx -y @upstash/context7-mcp --api-key xxx",
        "--rules", "~/mcp-governance/rules.json"
      ]
    }
  }
}
```

**3. All Context7 operations now governed:**

```
You: "Delete my old memories from Context7"
Claude: ❌ ERROR: Permission denied - delete operations blocked
```

---

## Practical Rules Examples

### Conservative (Maximum Safety)
```json
{
  "github": {"read": "allow", "write": "deny", "delete": "deny"},
  "google": {"read": "allow", "write": "deny", "delete": "deny"},
  "context7": {"read": "allow", "write": "deny", "delete": "deny"},
  "slack": {"read": "allow", "write": "deny", "delete": "deny"},
  "filesystem": {"read": "allow", "write": "deny", "delete": "deny"}
}
```
**Use case:** First time using AI assistants, want maximum protection

### Balanced (Recommended for Safety Guardrails)
```json
{
  "github": {"read": "allow", "write": "allow", "delete": "deny"},
  "google": {"read": "allow", "write": "allow", "delete": "deny"},
  "context7": {"read": "allow", "write": "allow", "delete": "deny"},
  "slack": {"read": "allow", "write": "allow", "delete": "deny"},
  "filesystem": {"read": "allow", "write": "allow", "delete": "deny"}
}
```
**Use case:** Prevent accidental deletions, allow normal operations

### Permissive (Development)
```json
{
  "github": {"read": "allow", "write": "allow", "delete": "allow"},
  "google": {"read": "allow", "write": "allow", "delete": "allow"},
  "context7": {"read": "allow", "write": "allow", "delete": "allow"},
  "slack": {"read": "allow", "write": "allow", "delete": "deny"},
  "filesystem": {"read": "allow", "write": "allow", "delete": "deny"}
}
```
**Use case:** Testing environments, keep Slack/filesystem protected

### Service-Specific Mix (Smart Safety)
```json
{
  "github": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",      // Never delete repos
    "execute": "allow",
    "admin": "deny"
  },

  "google": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",      // Never delete docs
    "execute": "deny",
    "admin": "deny"
  },

  "context7": {
    "read": "allow",
    "write": "allow",
    "delete": "allow",     // OK to delete embeddings
    "execute": "deny",
    "admin": "deny"
  },

  "slack": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",      // Never delete messages
    "execute": "deny",
    "admin": "deny"
  },

  "filesystem": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",      // Never delete files
    "execute": "deny",
    "admin": "deny"
  }
}
```
**Use case:** Realistic safety - protect critical services, allow cleanup of temp data

---

## What Operations Map to What?

### READ (Safe, Always Allow)
- `github_list_repos` - List repositories
- `google_drive_list_files` - List files
- `context7_search` - Search memories
- `slack_list_channels` - List channels
- `filesystem_read` - Read files

### WRITE (Usually Safe)
- `github_create_issue` - Create issue
- `google_drive_create_doc` - Create document
- `context7_store` - Store embedding
- `slack_send_message` - Send message
- `filesystem_write` - Write file

### DELETE (Destructive, Consider Blocking)
- `github_delete_repo` - ⚠️ Deletes repository forever
- `google_drive_delete_file` - ⚠️ Deletes document
- `context7_delete` - Delete embeddings (usually OK)
- `slack_delete_message` - ⚠️ Removes message
- `filesystem_delete` - ⚠️ Deletes file

### EXECUTE (Varies)
- `github_trigger_workflow` - Run CI/CD (can be dangerous)
- `slack_run_command` - Run slash commands
- `filesystem_execute` - Run scripts (very dangerous!)

### ADMIN (Very Dangerous)
- `github_change_settings` - Modify repo settings
- `slack_change_permissions` - Change workspace permissions
- Any operation with "admin", "config", "settings" in name

---

## Real-World Safety Examples

### Example 1: Prevent GitHub Accidents
```
You: "I made a mistake, delete that test repository"
Claude: Uses github_delete_repo
Governance: ❌ BLOCKED - delete operations denied for github
Result: Repository stays safe
```

### Example 2: Allow Google Doc Creation
```
You: "Create a new document with my meeting notes"
Claude: Uses google_drive_create_doc
Governance: ✅ ALLOWED - write operations permitted for google
Result: Document created successfully
```

### Example 3: Protect Slack History
```
You: "Delete that embarrassing message I just sent"
Claude: Uses slack_delete_message
Governance: ❌ BLOCKED - delete operations denied for slack
Result: Message preserved (might save you later!)
```

---

## Current Status

### ✅ What Works Today
- GitHub MCP server with governance (fully tested)
- Multi-service rules configuration (rules.json supports multiple services)
- Operation detection for any service (github, google, context7, slack, etc.)

### 🚧 What's Needed
- **Governance proxy** to wrap existing MCP servers
  - 200 lines of code
  - Spawns target server as subprocess
  - Intercepts tool calls
  - Applies rules from rules.json
  - Forwards allowed operations

---

## Next Steps

### For You
1. **Define your rules** - What services do you want protected?
2. **Prioritize services** - Start with most dangerous (filesystem, github)
3. **Test with custom server** - Use GitHub example as template

### For Development
1. **Build governance proxy** - Universal wrapper for any MCP server
2. **Test with Context7** - You already have this installed
3. **Test with multiple services** - GitHub + Google + Context7
4. **Package for easy install** - `npm install -g mcp-governance`

---

## Questions to Consider

1. **Which services do you currently use?**
   - GitHub? ✓ (Already tested)
   - Context7? ✓ (You have it configured)
   - Google Drive?
   - Slack?
   - Filesystem?

2. **What's your risk tolerance?**
   - Conservative: Block all deletes everywhere
   - Balanced: Allow cleanup in dev services
   - Permissive: Only block critical services

3. **What would you never want AI to do?**
   - Delete production repositories?
   - Remove important files?
   - Change workspace settings?
   - Send messages to customers?

---

## Ready to Build the Proxy?

The governance proxy would let you add safety guardrails to **all your existing MCP servers** without rebuilding each one.

**Should we build it now?** It would work like this:

```bash
# Before (no governance)
claude mcp add context7 -- npx @upstash/context7-mcp --api-key xxx

# After (with governance)
claude mcp add context7-governed -- mcp-governance-proxy \
  --target "npx @upstash/context7-mcp --api-key xxx" \
  --rules ~/mcp-governance/rules.json

# All context7 operations now protected by rules!
```
