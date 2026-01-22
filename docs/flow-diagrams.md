# Visual Flow Diagrams

## Auto-Wrap Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User runs: claude                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ mcp-gov-claude wrapper starts                                │
│ (if aliased: alias claude='mcp-gov-claude')                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Read ~/.claude.json                                          │
│                                                               │
│ Current config:                                               │
│ {                                                             │
│   "mcpServers": {                                             │
│     "github": {"command": "npx", "args": ["..."]},           │
│     "slack": {"command": "npx", "args": ["..."]}             │
│   }                                                           │
│ }                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Check each server:                                            │
│ - Is command === "mcp-gov-proxy"? NO → needs wrapping        │
│ - github: UNWRAPPED                                           │
│ - slack: UNWRAPPED                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Wrap servers in-place:                                        │
│                                                               │
│ {                                                             │
│   "mcpServers": {                                             │
│     "github": {                                               │
│       "command": "mcp-gov-proxy",                             │
│       "args": [                                               │
│         "--target", "npx @anthropic/mcp-server-github",       │
│         "--rules", "/home/user/rules.json"                    │
│       ]                                                       │
│     },                                                        │
│     "slack": {                                                │
│       "command": "mcp-gov-proxy",                             │
│       "args": [                                               │
│         "--target", "npx @anthropic/mcp-server-slack",        │
│         "--rules", "/home/user/rules.json"                    │
│       ]                                                       │
│     }                                                         │
│   }                                                           │
│ }                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Write updated config back to ~/.claude.json                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Execute actual claude CLI                                    │
│ exec('claude', process.argv)                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Claude starts normally                                        │
│ Reads ~/.claude.json (now with wrapped servers)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Runtime Proxy Flow - Allowed Operation

```
┌─────────────┐
│   Claude    │
└──────┬──────┘
       │ tools/call: github_list_repos
       ↓
┌─────────────────────────────────────────┐
│      mcp-gov-proxy (github)             │
│                                          │
│  1. Receive message from Claude (stdin) │
│  2. Parse JSON                           │
│  3. Extract tool name: "github_list_repos"│
│  4. Parse: service="github"              │
│            operation="read" (has "list") │
│  5. Check rules.json:                    │
│     rules.github.read = "allow"          │
│  6. Decision: FORWARD                    │
│                                          │
└──────┬──────────────────────────────────┘
       │ Forward same message
       ↓
┌─────────────────────────┐
│  GitHub MCP Server      │
│  (subprocess)           │
│                         │
│  - Receives tool call   │
│  - Calls GitHub API     │
│  - Returns repo list    │
└──────┬──────────────────┘
       │ Result
       ↓
┌─────────────────────────────────────────┐
│      mcp-gov-proxy (github)             │
│                                          │
│  7. Receive response from GitHub server │
│  8. Forward to Claude (stdout)          │
│                                          │
└──────┬──────────────────────────────────┘
       │ Result
       ↓
┌─────────────┐
│   Claude    │
│ Shows repos │
└─────────────┘
```

---

## Runtime Proxy Flow - Blocked Operation

```
┌─────────────┐
│   Claude    │
└──────┬──────┘
       │ tools/call: github_delete_repo
       ↓
┌─────────────────────────────────────────┐
│      mcp-gov-proxy (github)             │
│                                          │
│  1. Receive message from Claude (stdin) │
│  2. Parse JSON                           │
│  3. Extract tool name: "github_delete_repo"│
│  4. Parse: service="github"              │
│            operation="delete"            │
│  5. Check rules.json:                    │
│     rules.github.delete = "deny"         │
│  6. Decision: BLOCK                      │
│  7. Create error response                │
│  8. Send to Claude (stdout)              │
│                                          │
└──────┬──────────────────────────────────┘
       │ Error
       ↓
┌─────────────┐
│   Claude    │
│ Shows error │
└─────────────┘

      ↓ (GitHub server never sees the request)

┌─────────────────────────┐
│  GitHub MCP Server      │
│  (subprocess)           │
│                         │
│  IDLE - no message      │
│  received               │
└─────────────────────────┘
```

---

## Process Tree

```
User's Terminal
  │
  └─ mcp-gov-claude (wrapper)
       │
       ├─ Reads config
       ├─ Wraps servers
       ├─ Writes config
       │
       └─ Spawns: claude (actual CLI)
            │
            ├─ mcp-gov-proxy (github) ───┐
            │    └─ npx @anthropic/mcp-server-github
            │
            ├─ mcp-gov-proxy (slack) ────┐
            │    └─ npx @anthropic/mcp-server-slack
            │
            └─ mcp-gov-proxy (google) ───┐
                 └─ npx @anthropic/mcp-server-google-drive
```

**Each proxy:**
- Reads tool calls from Claude
- Checks governance rules
- Blocks or forwards to its target server
- Returns responses to Claude

---

## Comparison: Before vs After

### BEFORE (No Governance)

```
Claude
  ├─ npx @anthropic/mcp-server-github
  ├─ npx @anthropic/mcp-server-slack
  └─ npx @anthropic/mcp-server-google-drive

Tool Call: github_delete_repo
  → Goes directly to GitHub server
  → Executes immediately
  → Repo deleted! ☠️
```

### AFTER (With Governance)

```
Claude
  ├─ mcp-gov-proxy → npx @anthropic/mcp-server-github
  ├─ mcp-gov-proxy → npx @anthropic/mcp-server-slack
  └─ mcp-gov-proxy → npx @anthropic/mcp-server-google-drive

Tool Call: github_delete_repo
  → Intercepted by proxy
  → Checked against rules
  → BLOCKED ✅
  → Error returned to Claude
  → Repo safe!
```

---

## Key Points

1. **Proxy is dumb** - doesn't know tools in advance
2. **Proxy is reactive** - only acts when tool is called
3. **Proxy is transparent** - for allowed operations, it's invisible
4. **Auto-wrap is automatic** - wrapper detects and wraps on Claude start
5. **No manual sync needed** - wrapper handles everything
