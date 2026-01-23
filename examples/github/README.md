# GitHub Governed MCP Server Example

This example demonstrates how to use MCP Governance to control GitHub operations with permission rules.

## Features

- **github_list_repos**: Lists all repositories for the authenticated user (READ - allowed)
- **github_delete_repo**: Deletes a repository (DELETE - blocked by governance)

## Setup Steps

### 1. Get a GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "MCP Governance Test")
4. Select scopes:
   - `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token (starts with `ghp_`)

### 2. Configure Environment

```bash
# Copy the example .env file
cp .env.example .env

# Edit .env and paste your token
# GITHUB_TOKEN=ghp_YourActualTokenHere
```

### 3. Run the Server

```bash
# From the examples/github directory
node server.js

# You should see: MCP Server started: github-governed v1.0.0
```

## Integration with Claude Desktop

### Configure Claude Desktop

1. Find your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the server configuration:

```json
{
  "mcpServers": {
    "github-governed": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-gov/examples/github/server.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_YourActualTokenHere"
      }
    }
  }
}
```

3. Restart Claude Desktop

### Test the Integration

Open Claude Desktop and try these commands:

**Test 1: List repositories (should work)**
```
List my GitHub repositories
```

Expected: Claude will list your repositories successfully.

**Test 2: Delete a repository (should be blocked)**
```
Delete the test-repo repository
```

Expected: Claude will receive a "Permission denied" error.

## Permission Rules

The server is configured with these rules (see `rules.json`):

```json
{
  "github": {
    "read": "allow",      // ✅ Can list repos
    "write": "allow",     // ✅ Can create/update (not implemented in example)
    "delete": "deny",     // ❌ Cannot delete repos
    "execute": "allow",   // ✅ Can run actions (not implemented in example)
    "admin": "deny"       // ❌ Cannot change settings
  }
}
```

## Audit Logs

All operations are logged to stderr as JSON. To view logs:

```bash
# Run the server and capture stderr
node server.js 2> audit.log

# In another terminal, watch the logs
tail -f audit.log | jq .
```

Example log entry:
```json
{
  "timestamp": "2026-01-21T10:00:00.000Z",
  "tool": "github_delete_repo",
  "args": "{\"repo_name\":\"test-repo\"}",
  "status": "denied",
  "detail": "Permission denied by governance rules"
}
```

## Troubleshooting

### Server won't start
- Check that GITHUB_TOKEN is set in .env
- Verify token is valid (not expired or revoked)
- Ensure Node.js 20+ is installed: `node --version`

### Claude Desktop doesn't see the server
- Verify the config file path is correct for your OS
- Use absolute paths (not relative) in config
- Restart Claude Desktop after config changes
- Check Claude Desktop logs for connection errors

### Operations are unexpectedly blocked
- Check `rules.json` for your permission settings
- Review audit logs to see what operation was detected
- Tool names determine operation type (e.g., "delete" keyword → DELETE operation)

## Next Steps

- Modify `rules.json` to test different permission configurations
- Add more GitHub tools (create issue, list PRs, etc.)
- Customize operation detection keywords in `../../src/operation-keywords.js`
- Build your own MCP server with governance
