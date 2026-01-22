# Typical MCP Config Structure

## Claude Code CLI Config (~/.claude.json)

```json
{
  "projects": {
    "/home/user/my-project": {
      "mcpServers": {
        "github": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@anthropic/mcp-server-github"],
          "env": {
            "GITHUB_TOKEN": "ghp_xxxxx"
          }
        },
        "google-drive": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-gdrive"],
          "env": {
            "GOOGLE_OAUTH_TOKEN": "ya29.xxxxx"
          }
        },
        "context7": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@upstash/context7-mcp", "--api-key", "xxxxx"]
        },
        "filesystem": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
        }
      },
      "allowedTools": [],
      "disallowedTools": []
    }
  }
}
```

## Claude Desktop Config (~/.config/Claude/claude_desktop_config.json)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxxx"
      }
    },
    "google-drive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": {
        "GOOGLE_OAUTH_TOKEN": "ya29.xxxxx"
      }
    }
  }
}
```

**Key Difference:**
- Claude Code: Per-project config in `projects` section
- Claude Desktop: Global config, flat structure

## Other Tools (Droid, Opencode, etc.)

They likely use **similar but slightly different** formats:

```json
// Hypothetical Droid config
{
  "mcp": {
    "servers": [
      {
        "name": "github",
        "command": "npx @anthropic/mcp-server-github",
        "env": {"GITHUB_TOKEN": "xxx"}
      }
    ]
  }
}
```

**Problem:** Each tool has its own config format!
