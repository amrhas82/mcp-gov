# The Compatibility Problem

## The Issue

If we use a custom config section:
```json
{
  "mcpServers": {...},
  "mcpGovManaged": {...}  // ← Custom section!
}
```

**Who understands this custom section?**
- ❌ Claude Code CLI - No (doesn't read mcpGovManaged)
- ❌ Claude Desktop - No (doesn't read mcpGovManaged)
- ❌ Droid - No (doesn't exist in their schema)
- ❌ Opencode - No (doesn't exist)
- ❌ Ampcode - No (doesn't exist)

**Only mcp-gov reads it.**

But Claude itself doesn't read mcpGovManaged, so it doesn't know those servers exist!

---

## The Contradiction

### What We Need
```
Claude reads ONLY mcpServers (mcp-gov entry)
mcp-gov reads mcpGovManaged (actual MCP servers)
```

### The Problem
**Claude Code is closed source. We can't modify it to read custom sections.**

---

## Only Real Solutions

### Solution 1: In-Place Transformation (Auto-Wrap)

**Transform the mcpServers section directly:**

```bash
# Before
{
  "mcpServers": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]}
  }
}

# After running: mcp-gov install
{
  "mcpServers": {
    "github": {
      "command": "mcp-gov-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", "--rules", "~/rules.json"]
    }
  }
}
```

**Works with ALL tools:**
- ✅ Claude Code
- ✅ Claude Desktop
- ✅ Droid
- ✅ Opencode
- ✅ Any tool that reads mcpServers

**Why it works:** We're not adding custom sections, just changing the command.

**Downside:** Still 1:1 proxies (not universal)

---

### Solution 2: Add Configurator to ALL Tools

**Modify each tool to understand mcpGovManaged:**

```javascript
// In Claude Code source (if we had access)
const mcpServers = config.mcpServers || {};
const govManaged = config.mcpGovManaged || {};

// If mcp-gov exists, don't spawn govManaged servers directly
if (mcpServers['mcp-gov']) {
  // Only spawn mcp-gov
  spawn(mcpServers['mcp-gov']);
} else {
  // Spawn all servers normally
  Object.values({...mcpServers, ...govManaged}).forEach(spawn);
}
```

**Required:**
- Fork Claude Code CLI (closed source - can't do this)
- Fork Claude Desktop (closed source - can't do this)
- PR to Droid (if open source)
- PR to Opencode (if open source)
- PR to every MCP client

**Reality:** This is impossible for closed-source tools.

---

### Solution 3: MCP Standard Extension (Long-term)

**Propose to Anthropic/MCP maintainers:**

Add governance to MCP spec:
```json
{
  "mcpServers": {...},
  "mcpGovernance": {
    "enabled": true,
    "provider": "mcp-gov-universal",
    "rules": "~/rules.json"
  }
}
```

When Claude sees mcpGovernance.enabled = true:
- Spawns the provider (mcp-gov-universal)
- Provider manages all servers
- All calls go through provider

**Timeline:** 6-12 months if accepted

**Probability:** Low (Anthropic might not prioritize)

---

## Comparison

| Solution | Works Today? | Tool Support | Complexity | Universal Proxy? |
|----------|--------------|--------------|------------|------------------|
| **Auto-Wrap** | ✅ Yes | All tools | Low | ❌ No (1:1) |
| **Modify Tools** | ❌ No | Need forks | High | ✅ Yes |
| **MCP Standard** | ❌ No | Future | Medium | ✅ Yes |

---

## Hard Truth

**You can't have:**
- Universal proxy (single governance layer)
- Works with existing tools unchanged
- Custom config section

**Pick two.**

---

## Realistic Path Forward

### Short-term (Now): Auto-Wrap
```bash
mcp-gov install --rules ~/rules.json
```

Transforms config in-place. Each server gets wrapped with mcp-gov-proxy.

**Works with:**
- ✅ Claude Code
- ✅ Claude Desktop
- ✅ Droid
- ✅ All MCP clients

**Architecture:** 1:1 proxies (not universal)

### Long-term (Future): MCP Standard

1. Build proof-of-concept with auto-wrap
2. Get users (prove value)
3. Propose to Anthropic: "Add governance to MCP spec"
4. If accepted, migrate to universal proxy

---

## Your Question #3 Answer

> "doesn't that mean we need to add auto-configurator to all tools like claude, droid, etc?"

**YES, if you want universal proxy with custom config sections.**

**But we can't because:**
- Claude Code is closed source
- Claude Desktop is closed source
- We don't control other tools

**Therefore:**

We MUST use auto-wrap (in-place transformation) to work with existing tools.

The universal proxy dream requires either:
1. Convincing Anthropic to add it to MCP standard
2. Only supporting open-source tools we can fork

**For a shippable product: auto-wrap is the only option.**
