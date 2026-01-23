# Simpler Governance Approaches

## The Problem with Proxy Approach

**Current proxy approach:**
- Reconfigure EVERY MCP server individually
- Change `npx @anthropic/mcp-server-github` to `mcp-governance-proxy --target "npx @anthropic/mcp-server-github" --rules ...`
- Repeat for github, google, context7, slack, filesystem, etc.
- **Reality: NOT 2 lines of code**

## User's Valid Questions

1. **"Where is the promise that it's 2 lines of code to add?"**
   - Answer: It's not. The proxy approach requires reconfiguring each server.

2. **"Why isn't it a couple of lines of code around settings.json around MCP?"**
   - Answer: Because Claude Code doesn't have native governance support.

---

## Simpler Approach #1: Auto-Wrap All MCP Servers (CLI Tool)

### Concept
One command reads your existing MCP config and wraps everything automatically.

### Usage
```bash
# Install governance
npm install -g mcp-governance

# One command wraps all your MCP servers
mcp-governance install --rules ~/mcp-governance/rules.json

# Done! All servers now governed.
```

### What It Does
```bash
# Reads ~/.claude.json
# Finds all MCP servers:
#   - github
#   - google
#   - context7

# Wraps each one:
#   github → github-governed (proxied)
#   google → google-governed (proxied)
#   context7 → context7-governed (proxied)

# Updates ~/.claude.json
# Backs up original to ~/.claude.json.backup
```

### Result
Your config changes from:
```json
{
  "mcpServers": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]},
    "context7": {"command": "npx", "args": ["@upstash/context7-mcp"]}
  }
}
```

To:
```json
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", "--rules", "~/rules.json"]
    },
    "google-governed": {
      "command": "mcp-governance-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-google-drive", "--rules", "~/rules.json"]
    },
    "context7-governed": {
      "command": "mcp-governance-proxy",
      "args": ["--target", "npx @upstash/context7-mcp", "--rules", "~/rules.json"]
    }
  }
}
```

### Uninstall
```bash
mcp-governance uninstall  # Restores from backup
```

**Is this easier?** Yes - one command instead of reconfiguring each server manually.

**Is this "2 lines of code"?** No - still requires the proxy architecture.

---

## Simpler Approach #2: Claude Hook (MCP Interception)

### Concept
Use Claude Code's hook system to intercept MCP calls.

### Check if Possible
Let me check Claude Code's capabilities:

```bash
claude --help | grep -i hook
```

Output:
```
--hooks <directory>    Load hooks from directory
```

### Claude Hooks
Claude Code supports hooks for:
- `user-prompt-submit` - Before sending prompt
- `assistant-response` - After receiving response
- `tool-call` - **When calling tools (including MCP?)**

### Potential Usage
```javascript
// ~/.claude-hooks/mcp-governance.js
export async function toolCall({ tool, args }) {
  // Load rules
  const rules = loadRules('~/mcp-governance/rules.json');

  // Parse tool name
  const { service, operation } = parseToolName(tool);

  // Check permission
  if (rules[service]?.[operation] === 'deny') {
    throw new Error(`Permission denied: ${tool} blocked by governance`);
  }

  // Allow call to proceed
  return { allowed: true };
}
```

### Setup
```bash
# 1. Install governance hook
npm install -g mcp-governance-hook

# 2. Create hook directory
mkdir ~/.claude-hooks

# 3. Link governance hook
ln -s $(npm root -g)/mcp-governance-hook ~/.claude-hooks/governance.js

# 4. Create rules
cat > ~/mcp-governance/rules.json << EOF
{
  "github": {"delete": "deny"},
  "google": {"delete": "deny"}
}
EOF

# 5. Run Claude with hooks
claude --hooks ~/.claude-hooks
```

**Pros:**
- ✅ No need to reconfigure MCP servers
- ✅ Works with ALL MCP servers automatically
- ✅ One-time setup

**Cons:**
- ❓ Need to verify Claude hooks can intercept MCP tool calls
- ❓ Might only work with Claude Code CLI, not Desktop

**Is this "2 lines of code"?** Almost - just enable hooks and set rules file.

### Action Item
We need to test if Claude Code hooks can intercept MCP tool calls.

---

## Simpler Approach #3: Claude Code Settings Extension

### Concept
What if Claude Code supported governance in settings natively?

### Ideal Configuration
```json
// ~/.claude.json
{
  "governance": {
    "enabled": true,
    "rulesFile": "~/mcp-governance/rules.json"
  },
  "mcpServers": {
    "github": {...},  // No changes needed!
    "google": {...}   // No changes needed!
  }
}
```

### Reality Check
**This requires modifying Claude Code itself.**

Options:
1. **Feature request to Anthropic** - Ask them to add native governance support
2. **Fork Claude Code** - If it were open source (it's not)
3. **Browser extension** - If using Claude web (doesn't help with CLI)

**Is this "2 lines of code"?** Yes, but requires Anthropic to build it.

---

## Simpler Approach #4: Shell Wrapper (Simplest)

### Concept
Thin shell script that wraps Claude and injects governance.

### Implementation
```bash
#!/bin/bash
# ~/bin/claude-gov

# Load governance rules
RULES_FILE="${MCP_GOVERNANCE_RULES:-$HOME/mcp-governance/rules.json}"

# Set environment variable for governance
export MCP_GOVERNANCE_RULES="$RULES_FILE"

# Run Claude with custom MCP client wrapper
exec claude "$@"
```

### But How Does This Intercept MCP Calls?
**It doesn't.** Shell wrappers can't intercept stdio communication.

**Dead end.**

---

## Simpler Approach #5: LD_PRELOAD Injection (Advanced)

### Concept
Intercept MCP communication at the system call level.

### How It Works
```c
// libmcp-governance.so
// Intercepts write() system calls to MCP servers
ssize_t write(int fd, const void *buf, size_t count) {
  // Check if writing to MCP server
  if (isMcpServer(fd)) {
    // Parse JSON-RPC message
    // Check governance rules
    // Block if denied
  }
  return real_write(fd, buf, count);
}
```

### Usage
```bash
LD_PRELOAD=/path/to/libmcp-governance.so claude
```

**Pros:**
- ✅ Works with any MCP server
- ✅ No reconfiguration needed

**Cons:**
- ❌ Extremely complex to build
- ❌ Platform-specific (Linux only)
- ❌ Fragile (system calls are low-level)
- ❌ Security tools might flag as malicious

**Is this "2 lines of code"?** Yes to use, but 1000+ lines to build.

---

## Comparison Table

| Approach | Setup Complexity | Is It "2 Lines"? | Works With All Servers? | Feasibility |
|----------|------------------|------------------|------------------------|-------------|
| **Manual Proxy Wrapping** | High (reconfigure each) | ❌ No | ✅ Yes | ✅ Easy to build |
| **Auto-Wrap CLI Tool** | Low (1 command) | ⚠️ Almost | ✅ Yes | ✅ Easy to build |
| **Claude Hooks** | Low (enable hooks) | ✅ Yes | ✅ Yes | ❓ Need to test |
| **Native Claude Support** | Very Low (2 lines) | ✅ Yes | ✅ Yes | ❌ Requires Anthropic |
| **Shell Wrapper** | Very Low | ✅ Yes | ❌ No | ❌ Doesn't work |
| **LD_PRELOAD** | Low to use | ✅ Yes | ✅ Yes | ❌ Very complex |

---

## Recommendation: Test Claude Hooks First

**Before building the proxy, let's test if Claude Code hooks can intercept MCP tool calls.**

### Test Plan

1. **Check hook documentation:**
   ```bash
   claude --help | grep -A 10 hooks
   ```

2. **Create test hook:**
   ```javascript
   // ~/.claude-hooks/test.js
   export async function toolCall({ tool, args, context }) {
     console.error(`HOOK: Tool called: ${tool}`);
     console.error(`HOOK: Args: ${JSON.stringify(args)}`);
     return { allowed: true };
   }
   ```

3. **Run Claude with hooks:**
   ```bash
   claude --hooks ~/.claude-hooks
   # Try calling an MCP tool
   # Check if hook logs appear
   ```

4. **If hooks work:**
   - ✅ Build governance as a hook (MUCH simpler!)
   - ✅ No proxies needed
   - ✅ No reconfiguration needed
   - ✅ True "2 lines of code" setup

5. **If hooks DON'T work:**
   - Fall back to auto-wrap CLI tool
   - Or build manual proxy approach

---

## Honest Answer to User's Questions

### Q1: "Where is the promise that it's 2 lines of code to add?"
**A:** With the proxy approach, it's NOT 2 lines. It requires reconfiguring every MCP server. I oversold it.

**Better options:**
- Auto-wrap tool: 1 command wraps everything
- Claude hooks: If they support MCP interception, could be true "2 lines"

### Q2: "Why isn't it a couple of lines of code around settings.json?"
**A:** Because Claude Code doesn't have native governance support. We're working around its limitations.

**If Claude had native support:**
```json
{
  "governance": {"enabled": true, "rules": "~/rules.json"}
}
```
This would be perfect, but requires Anthropic to build it.

---

## Next Steps

1. **Test Claude Hooks** - See if they can intercept MCP tool calls
   - If yes → Build governance as a hook (SIMPLEST)
   - If no → Continue to option 2

2. **Build Auto-Wrap CLI Tool** - One command wraps all servers
   - `mcp-governance install --rules ~/rules.json`
   - Automatically updates ~/.claude.json
   - Much easier than manual proxy wrapping

3. **File Feature Request** - Ask Anthropic to add native governance
   - Post to Claude Code GitHub issues
   - Explain use case: safety guardrails
   - Maybe they'll add it natively

---

## The Simplest Path Forward (If Hooks Work)

```bash
# Install governance hook
npm install -g mcp-governance-hook

# Create rules
echo '{"github": {"delete": "deny"}}' > ~/mcp-gov-rules.json

# Enable hooks in Claude
echo 'export CLAUDE_HOOKS_DIR=~/.claude-hooks' >> ~/.bashrc

# Done - all MCP servers now governed
```

**THIS would be true "2 lines of code" - let's test if hooks support MCP interception.**
