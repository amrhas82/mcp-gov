# MCP Governance System

A permission control and audit logging system for Model Context Protocol (MCP) servers. Provides fine-grained governance over tool operations with automatic detection and structured audit logs.

## Features

- **Permission Control**: Fine-grained rules for read, write, delete, execute, and admin operations
- **Operation Detection**: Automatic classification of 160+ keywords across 5 operation types
- **Audit Logging**: Structured JSON logs to stderr with timestamps, tool names, and status
- **MCP-Compliant**: Works seamlessly with any MCP client (Claude Desktop, etc.)
- **Middleware Pattern**: Wraps existing MCP servers without modifying tool logic

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-gov.git
cd mcp-gov

# Install dependencies
npm install
```

## Quick Start

### 1. Create a governed server

```javascript
import { GovernedMCPServer } from './src/index.js';

// Define permission rules
const rules = {
  github: {
    read: 'allow',
    write: 'allow',
    delete: 'deny',   // Block destructive operations
    admin: 'deny'
  }
};

// Create server
const server = new GovernedMCPServer(
  { name: 'my-server', version: '1.0.0' },
  rules
);

// Register tools
server.registerTool(
  {
    name: 'github_list_repos',
    description: 'List repositories',
    inputSchema: { type: 'object', properties: {} }
  },
  async (args) => {
    // Your tool logic here
    return {
      content: [{ type: 'text', text: 'Repositories listed' }]
    };
  }
);

// Start server
await server.start();
```

### 2. Run the GitHub example

```bash
# Set up environment
cd examples/github
cp .env.example .env
# Edit .env and add your GitHub token

# Run the server
node server.js
```

### 3. Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github-governed": {
      "command": "node",
      "args": ["/path/to/mcp-gov/examples/github/server.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Operation Detection

The system automatically classifies tools based on keywords in their names:

| Operation | Keywords | Default Policy |
|-----------|----------|----------------|
| **admin** | admin, superuser, configure, migrate, deploy | Conservative |
| **delete** | delete, remove, destroy, purge, erase | Conservative |
| **execute** | execute, run, invoke, trigger, send | Conservative |
| **write** | create, add, update, modify, edit, write | Moderate |
| **read** | get, list, fetch, query, search, view | Permissive |

Priority order: admin → delete → execute → write → read

## Permission Rules

Rules are defined per service and operation:

```json
{
  "serviceName": {
    "read": "allow",
    "write": "allow",
    "delete": "deny",
    "execute": "allow",
    "admin": "deny"
  }
}
```

- Default policy: `allow` (if no rule exists)
- Missing operations inherit default
- Service name extracted from tool name prefix (e.g., `github_list` → `github`)

## Audit Logs

All operations are logged to stderr as JSON:

```json
{
  "timestamp": "2026-01-21T10:00:00.000Z",
  "tool": "github_delete_repo",
  "args": "{\"repo_name\":\"test-repo\"}",
  "status": "denied",
  "detail": "Permission denied by governance rules"
}
```

Status values: `allowed`, `denied`, `success`, `error`

## Architecture

```
┌─────────────────┐
│  MCP Client     │ (Claude Desktop)
└────────┬────────┘
         │ MCP Protocol (stdio)
         ▼
┌─────────────────┐
│ GovernedMCP     │ 1. Check permission
│ Server          │ 2. Log operation
│                 │ 3. Execute handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool Handlers   │ (GitHub API, etc.)
└─────────────────┘
```

## Examples

See `examples/github/` for a complete working example with:

- GitHub API integration (list repos, delete repo)
- Permission rules configuration
- Environment variable management
- Claude Desktop integration

## Development

```bash
# Test operation detection
node -e "import('./src/operation-detector.js').then(m => console.log(m.detectOperation('github_list_repos')))"

# Test permission checking
node -e "import('./src/index.js').then(m => {
  const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {github:{delete:'deny'}});
  console.log(s.checkPermission('github_delete_repo'));
})"
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
