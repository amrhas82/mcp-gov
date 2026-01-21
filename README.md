# mcp-governance

Add permission controls and audit logging to your MCP servers.

## Overview

A lightweight JavaScript library that wraps MCP (Model Context Protocol) servers to add governance features:

- **Permission Controls** - Block specific operations (read/write/delete)
- **Audit Logging** - Track what AI agents actually do
- **Clean API** - Add governance in ~5 lines of code

## Status

🚧 **In Development** - POC Phase

See [PRD](./tasks/0001-prd-mcp-governance.md) for detailed requirements.

## Quick Example

```javascript
import { GovernedMCPServer } from 'mcp-governance';

const server = new GovernedMCPServer(
  { name: 'my-server', version: '1.0.0' },
  {
    todoist: {
      read: 'allow',
      write: 'allow',
      delete: 'deny'  // Prevent AI from deleting tasks
    }
  }
);

// Register your tools as normal
server.registerTool(toolDef, handler);
await server.start();
```

## Why?

MCP servers give AI agents powerful access to your tools. This library lets you:
- Make services read-only
- Block dangerous operations
- Log everything for audit trails
- Enforce policies before allowing operations

## Stack

- Pure JavaScript (ESM)
- Node.js 20+
- Minimal dependencies (@modelcontextprotocol/sdk, axios)
- No build steps

## Contributing

This is an open-source project. PRs welcome!

## License

MIT
