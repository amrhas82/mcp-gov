# Multi-Instance Governance Guide

## Use Case: Different Rules for Different Environments

You have multiple GitHub accounts or want different safety levels:

- **Production GitHub** → Read-only (can't accidentally break production)
- **Development GitHub** → Full access (need to test everything)
- **Personal GitHub** → Moderate restrictions (protect important repos)

## Configuration

### Step 1: Configure Multiple MCP Servers in Claude

Each server runs the same code but with different rules based on instance name.

```bash
# Add production instance (read-only)
claude mcp add github-prod \
  -e MCP_SERVER_INSTANCE=github-prod \
  -e GITHUB_TOKEN=ghp_prod_token_here \
  -- node /path/to/multi-instance-example.js

# Add development instance (full access)
claude mcp add github-dev \
  -e MCP_SERVER_INSTANCE=github-dev \
  -e GITHUB_TOKEN=ghp_dev_token_here \
  -- node /path/to/multi-instance-example.js

# Add personal instance (moderate restrictions)
claude mcp add github-personal \
  -e MCP_SERVER_INSTANCE=github-personal \
  -e GITHUB_TOKEN=ghp_personal_token_here \
  -- node /path/to/multi-instance-example.js
```

### Step 2: Rules Configuration

The `multi-instance-rules.json` file contains all rules:

```json
{
  "servers": {
    "github-prod": {
      "github": {
        "read": "allow",    ✅ Can list repos, issues, PRs
        "write": "deny",    ❌ Cannot create/update
        "delete": "deny",   ❌ Cannot delete
        "execute": "deny",  ❌ Cannot run workflows
        "admin": "deny"     ❌ Cannot change settings
      }
    },

    "github-dev": {
      "github": {
        "read": "allow",    ✅ Can read
        "write": "allow",   ✅ Can create/update
        "delete": "allow",  ✅ Can delete (it's dev!)
        "execute": "allow", ✅ Can run workflows
        "admin": "deny"     ❌ Still can't change org settings
      }
    },

    "github-personal": {
      "github": {
        "read": "allow",    ✅ Can read
        "write": "allow",   ✅ Can create/update
        "delete": "deny",   ❌ Protect against accidents
        "execute": "allow", ✅ Can run workflows
        "admin": "deny"     ❌ Can't change settings
      }
    }
  }
}
```

### Step 3: Verify Configuration

```bash
# List all MCP servers
claude mcp list

# Expected output:
# github-prod: node /path/to/multi-instance-example.js - ✓ Connected
# github-dev: node /path/to/multi-instance-example.js - ✓ Connected
# github-personal: node /path/to/multi-instance-example.js - ✓ Connected
```

## Usage Examples

### Example 1: Safe Production Operations

```
You: "List repos in production"
Claude: [Uses github-prod server]
✅ Lists repos successfully

You: "Delete test-repo in production"
Claude: [Uses github-prod server]
❌ ERROR: Permission denied - write operations blocked in github-prod
```

### Example 2: Full Dev Environment Access

```
You: "Create test branch in dev environment"
Claude: [Uses github-dev server]
✅ Created branch successfully

You: "Delete old-experiment repo in dev"
Claude: [Uses github-dev server]
✅ Deleted repo successfully (allowed in dev)
```

### Example 3: Personal Projects Safety

```
You: "Create issue in my personal repo"
Claude: [Uses github-personal server]
✅ Created issue successfully

You: "Delete important-project repo"
Claude: [Uses github-personal server]
❌ ERROR: Permission denied - delete blocked for safety
```

## How It Works

### 1. Server Instance Name
Each MCP server gets a unique instance name via environment variable:
```bash
MCP_SERVER_INSTANCE=github-prod
```

### 2. Rule Lookup
When the server starts:
1. Reads `multi-instance-rules.json`
2. Looks for `servers[MCP_SERVER_INSTANCE]`
3. Uses those specific rules
4. Falls back to default `github` rules if not found

### 3. Tool Registration
All servers register the same tools:
- `github_list_repos`
- `github_create_issue`
- `github_delete_repo`
- etc.

But each enforces different rules based on instance name.

## Claude Config Location

The configuration is stored in:
```bash
~/.claude.json
```

Under the `projects` section, you'll see:
```json
{
  "projects": {
    "/your/project/path": {
      "mcpServers": {
        "github-prod": {...},
        "github-dev": {...},
        "github-personal": {...}
      }
    }
  }
}
```

## Benefits for Safety Guardrails

### ✅ Prevent Production Accidents
- Read-only access to production
- Can inspect, can't modify
- Peace of mind when asking Claude about prod

### ✅ Full Dev Freedom
- Test destructive operations safely
- Delete test repos without worry
- Experiment freely in dev environment

### ✅ Moderate Personal Protection
- Can work on personal projects
- Protected against accidental deletions
- Still get useful functionality

### ✅ Clear Mental Model
- "I'm working in prod" → Read-only
- "I'm in dev" → Full access
- "It's my personal repo" → Moderate protection

### ✅ Easy to Adjust
- Edit `multi-instance-rules.json`
- Restart Claude session
- New rules take effect immediately

## Practical Tips

### Tip 1: Use Clear Naming
```bash
# Good names (environment is obvious)
github-prod
github-staging
github-dev
github-personal

# Bad names (confusing)
github1
gh-server
my-github
```

### Tip 2: Start Restrictive, Relax Later
Begin with strict rules:
```json
{
  "read": "allow",
  "write": "deny",
  "delete": "deny"
}
```

If you need more access, gradually enable operations:
```json
{
  "read": "allow",
  "write": "allow",  // Added later
  "delete": "deny"
}
```

### Tip 3: Use Project-Scoped Configs
If working on multiple projects:
```bash
# Project A uses strict rules
cd ~/projects/client-work
claude  # Uses github-prod

# Project B uses permissive rules
cd ~/projects/personal-experiments
claude  # Uses github-dev
```

### Tip 4: Monitor Audit Logs
Watch for blocked operations:
```bash
# See what's being blocked
tail -f ~/.cache/claude/mcp-*.log | grep denied

# Adjust rules if legitimate operations are blocked
```

## Troubleshooting

### "All operations blocked even in dev"
Check environment variable is set:
```bash
echo $MCP_SERVER_INSTANCE
# Should output: github-dev (or whatever you configured)
```

### "Wrong rules being applied"
Verify instance name matches rules file:
```bash
# Check what Claude is running
claude mcp get github-dev

# Check rules file has matching entry
cat multi-instance-rules.json | jq '.servers["github-dev"]'
```

### "Can't tell which server is being used"
Add server name to responses:
```javascript
// In your tool handler:
text: `[${SERVER_INSTANCE}] Listed 10 repositories`
```

## Next Steps

1. **Test the Example**
   ```bash
   node multi-instance-example.js github-prod
   ```

2. **Add More Environments**
   - Staging environment
   - Test environment
   - Customer demo environment

3. **Extend to Other Services**
   - `slack-prod` vs `slack-dev`
   - `database-prod` vs `database-dev`
   - `aws-prod` vs `aws-dev`

4. **Build Admin Dashboard**
   - View all configured servers
   - See which rules apply to each
   - Monitor blocked operations per environment
