# Testing Claude Code's Built-in Tool Filtering

## Discovery
Claude Code has `allowedTools` and `disallowedTools` config options!

## Configuration Location
```
~/.claude.json → projects → [project_path] → disallowedTools
```

## Test: Can We Block MCP Tools?

### Current MCP Tools
```bash
claude mcp list
# Output: github-governed with tools:
# - github_list_repos
# - github_delete_repo
```

### Method 1: Command Line Flag
```bash
claude --disallowedTools "github_delete_repo"
```

### Method 2: Config File
```json
{
  "projects": {
    "/home/hamr/PycharmProjects/mcp-gov": {
      "disallowedTools": ["github_delete_repo", "github_create_issue"],
      "mcpServers": {
        "github-governed": {...}
      }
    }
  }
}
```

## If This Works...

**This would be the "2 lines of code" solution!**

Just add to ~/.claude.json:
```json
{
  "disallowedTools": [
    "github_delete_repo",
    "google_drive_delete_file",
    "context7_delete",
    "slack_delete_message"
  ]
}
```

No proxy needed!
No reconfiguration!
Just block the dangerous tools!