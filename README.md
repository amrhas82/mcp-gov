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

## Platform Compatibility

mcp-gov is designed to work seamlessly across Linux, macOS, and Windows. The system handles platform-specific path conventions and behaviors automatically.

### Supported Platforms

- **Linux**: Full support with Unix path separators (`/`) and LF line endings
- **macOS**: Full support including .app bundles, case-sensitive filesystems, and system symlinks
- **Windows**: Full support with drive letters (`C:\`), UNC paths (`\\server\share`), backslashes, and CRLF line endings

### Path Handling

The proxy and wrapper tools automatically handle platform-specific path formats:

**Linux/macOS:**
```bash
# Unix-style paths with forward slashes
mcp-gov-proxy --target "node server.js" --rules /home/user/rules.json
mcp-gov-wrap --config ~/.config/claude/config.json --rules ~/.mcp-gov/rules.json --tool "claude chat"
```

**Windows:**
```powershell
# Windows-style paths with backslashes or forward slashes
mcp-gov-proxy --target "node server.js" --rules C:\Users\user\rules.json
mcp-gov-wrap --config %USERPROFILE%\.config\claude\config.json --rules %USERPROFILE%\.mcp-gov\rules.json --tool "claude chat"
```

### Special Considerations

**macOS:**
- Application bundles (`.app` directories) are handled correctly
- System symlinks like `/tmp` → `/private/tmp` work transparently
- Both case-sensitive and case-insensitive APFS filesystems are supported

**Windows:**
- UNC network paths (`\\server\share\path`) are fully supported
- Paths with spaces are handled correctly (e.g., `C:\Program Files`)
- Both forward slashes and backslashes work in paths
- Drive letters in absolute paths (e.g., `C:\`, `D:\`) are preserved

**Line Endings:**
- Config files can use either LF (Unix/macOS) or CRLF (Windows) line endings
- JSON parsing handles both formats automatically
- Backup files preserve the original line ending format

### Testing

The test suite includes platform-specific test cases for Windows and macOS scenarios, even when run on Linux. To run platform tests:

```bash
npm run test:platform
```

These tests verify path handling, line ending compatibility, and platform-specific behaviors without requiring multiple operating systems for development.

## Development

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:proxy
npm run test:wrapper
npm run test:platform
npm run test:integration

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
