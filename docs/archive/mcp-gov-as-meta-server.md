# mcp-gov as Meta-MCP Server

## The Concept

**mcp-gov is the ONLY MCP server in config, but wraps multiple servers passed as arguments.**

## Config

```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-server",
      "args": [
        "--rules", "/home/user/mcp-governance/rules.json",
        "--wrap", "github:npx @anthropic/mcp-server-github",
        "--wrap", "google:npx @anthropic/mcp-server-google-drive",
        "--wrap", "context7:npx @upstash/context7-mcp --api-key xxx"
      ]
    }
  }
}
```

## Startup Flow

```
1. Claude spawns: mcp-gov-server

2. mcp-gov parses args:
   --wrap github:npx @anthropic/mcp-server-github
   --wrap google:npx @anthropic/mcp-server-google-drive
   --wrap context7:npx @upstash/context7-mcp

3. mcp-gov spawns each as subprocess:
   githubServer = spawn('npx', ['@anthropic/mcp-server-github'])
   googleServer = spawn('npx', ['@anthropic/mcp-server-google-drive'])
   context7Server = spawn('npx', ['@upstash/context7-mcp'])

4. mcp-gov discovers tools from each:
   - Send tools/list to githubServer
   - Receive: [github_list_repos, github_delete_repo, ...]

   - Send tools/list to googleServer
   - Receive: [google_drive_list_files, google_drive_delete_file, ...]

   - Send tools/list to context7Server
   - Receive: [context7_search, context7_store, ...]

5. mcp-gov registers ALL tools as its own:
   - github_list_repos (mapped to githubServer)
   - github_delete_repo (mapped to githubServer)
   - google_drive_list_files (mapped to googleServer)
   - google_drive_delete_file (mapped to googleServer)
   - context7_search (mapped to context7Server)
   - context7_store (mapped to context7Server)

6. Claude queries mcp-gov for tools:
   Claude → tools/list → mcp-gov
   mcp-gov responds with ALL discovered tools

7. Claude sees tools namespaced as:
   - mcp__mcp-gov__github_list_repos
   - mcp__mcp-gov__github_delete_repo
   - mcp__mcp-gov__google_drive_list_files
   - etc.
```

## Runtime Flow

```
User: "Delete my GitHub repo"

1. Claude calls: mcp__mcp-gov__github_delete_repo

2. mcp-gov receives tool call:
   {
     "method": "tools/call",
     "params": {
       "name": "github_delete_repo",
       "arguments": {"repo_name": "test-repo"}
     }
   }

3. mcp-gov governance check:
   - Parse: service="github", operation="delete"
   - Check rules: rules.github.delete = "deny"
   - Decision: BLOCK

4. mcp-gov returns error:
   {
     "result": {
       "content": [{"type": "text", "text": "Permission denied"}],
       "isError": true
     }
   }

5. Claude shows error to user
```

## Pros

✅ **Single MCP server** (mcp-gov is the only entry)
✅ **Single source of truth** (servers defined in command args)
✅ **Universal proxy** (all tools go through governance)
✅ **No separate config section** (no mcpGovManaged needed)
✅ **Works with any MCP client** (Claude Code, Desktop, etc.)
✅ **Auto-discovery** (mcp-gov discovers tools at startup)

## Cons

❌ **Long command line** (all servers in args)
❌ **Hard to add new servers** (must edit the long args array)
❌ **Environment variables tricky** (how to pass GITHUB_TOKEN?)
❌ **No native `claude mcp add`** (would add to mcpServers, not mcp-gov's args)

## Environment Variables Problem

```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-server",
      "args": [
        "--wrap", "github:npx @anthropic/mcp-server-github"
      ],
      "env": {
        "GITHUB_TOKEN": "xxx"  // ← This goes to mcp-gov, not github server!
      }
    }
  }
}
```

**Solution:** Pass env vars in the wrap argument:

```json
{
  "args": [
    "--wrap", "github:npx @anthropic/mcp-server-github",
    "--env", "github:GITHUB_TOKEN=xxx",
    "--wrap", "google:npx @anthropic/mcp-server-google-drive",
    "--env", "google:GOOGLE_TOKEN=xxx"
  ]
}
```

**Gets even longer!**

## Alternative: Config File Reference

```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-server",
      "args": ["--config", "/home/user/mcp-gov-servers.json"]
    }
  }
}
```

**mcp-gov-servers.json:**
```json
{
  "rules": "/home/user/rules.json",
  "servers": {
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

**But now we have two config files again!**

## Hybrid: Minimal Args + Discover from Claude Config

```json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-server",
      "args": [
        "--rules", "~/rules.json",
        "--discover-from-claude-config"
      ]
    }
  }
}
```

**On startup, mcp-gov:**
1. Reads `~/.claude.json`
2. Looks for commented-out or disabled servers
3. Spawns them internally

**But how do we mark servers as "managed by mcp-gov"?**

Maybe:
```json
{
  "mcpServers": {
    "mcp-gov": {"command": "mcp-gov-server", "args": ["--rules", "~/rules.json"]}
  },
  "_mcpGovWrapped": {
    "github": {"command": "npx", "args": ["@anthropic/mcp-server-github"]},
    "google": {"command": "npx", "args": ["@anthropic/mcp-server-google-drive"]}
  }
}
```

**Back to custom config section!**

## Comparison

| Approach | Config Complexity | Adding Servers | Env Vars |
|----------|-------------------|----------------|----------|
| **Inline Args** | Simple (1 entry) | Hard (edit long args) | Hard |
| **Separate Config** | Complex (2 files) | Easy (edit one file) | Easy |
| **Custom Section** | Medium (1 file, 2 sections) | Easy | Easy |
| **Auto-wrap 1:1** | Medium (multiple entries) | Easy (`claude mcp add`) | Easy |

## Recommendation

**Use separate config file approach:**

```json
// ~/.claude.json
{
  "mcpServers": {
    "mcp-gov": {
      "command": "mcp-gov-server",
      "args": ["--config", "~/.mcp-gov.json"]
    }
  }
}
```

```json
// ~/.mcp-gov.json
{
  "rules": {
    "github": {"delete": "deny"},
    "google": {"delete": "deny"}
  },
  "servers": {
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

**Why:**
- ✅ Easy to add new servers (edit ~/.mcp-gov.json)
- ✅ Clean env var handling
- ✅ Single MCP entry in Claude config
- ✅ Universal proxy architecture
- ❌ Two config files to maintain

**This is the cleanest universal proxy approach.**
