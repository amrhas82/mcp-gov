<p align="center">
<pre>
███╗   ███╗ ██████╗██████╗      ██████╗  ██████╗ ██╗   ██╗
████╗ ████║██╔════╝██╔══██╗    ██╔════╝ ██╔═══██╗██║   ██║
██╔████╔██║██║     ██████╔╝    ██║  ███╗██║   ██║██║   ██║
██║╚██╔╝██║██║     ██╔═══╝     ██║   ██║██║   ██║╚██╗ ██╔╝
██║ ╚═╝ ██║╚██████╗██║         ╚██████╔╝╚██████╔╝ ╚████╔╝
╚═╝     ╚═╝ ╚═════╝╚═╝          ╚═════╝  ╚═════╝   ╚═══╝
</pre>
</p>

# MCP Governance System

Permission control and audit logging for Model Context Protocol (MCP) servers.

## Install

```bash
# Using npm
npm install -g mcp-gov

# Or run directly with npx
npx mcp-gov
```

## Usage

```bash
mcp-gov
```

```
███╗   ███╗ ██████╗██████╗      ██████╗  ██████╗ ██╗   ██╗
████╗ ████║██╔════╝██╔══██╗    ██╔════╝ ██╔═══██╗██║   ██║
██╔████╔██║██║     ██████╔╝    ██║  ███╗██║   ██║██║   ██║
██║╚██╔╝██║██║     ██╔═══╝     ██║   ██║██║   ██║╚██╗ ██╔╝
██║ ╚═╝ ██║╚██████╗██║         ╚██████╔╝╚██████╔╝ ╚████╔╝
╚═╝     ╚═╝ ╚═════╝╚═╝          ╚═════╝  ╚═════╝   ╚═══╝
                                                    v1.2.5

Select action:
  1) Wrap MCP servers
  2) Unwrap MCP servers
  3) View audit logs
  4) Edit rules
  5) Exit

Enter choice [1-5]:
```

## How It Works

**Before wrapping:**
```
Claude → MCP Server
```

**After wrapping:**
```
Claude → mcp-gov-proxy → MCP Server
              ↓
        checks rules
        logs to audit
```

## Default Rules

Rules are auto-generated at `~/.mcp-gov/rules.json`:

| Operation | Default | Examples |
|-----------|---------|----------|
| **read** | ✅ Allow | get, list, search, fetch |
| **write** | ✅ Allow | create, update, add, save |
| **delete** | ❌ Deny | delete, remove, drop, purge |
| **execute** | ❌ Deny | run, exec, invoke, trigger |
| **admin** | ❌ Deny | admin, configure, grant |

## Files

| Path | Description |
|------|-------------|
| `~/.mcp-gov/rules.json` | Governance rules |
| `~/.mcp-gov/logs/*.log` | Audit logs by service |

## Rules Format

```json
{
  "rules": [
    {
      "service": "github",
      "operations": ["delete"],
      "permission": "deny",
      "reason": "Block destructive operations"
    },
    {
      "service": "github",
      "operations": ["read", "write"],
      "permission": "allow"
    }
  ]
}
```

## Audit Log Format

```
[AUDIT] 2026-01-24T10:30:45.123Z | DENIED | tool=delete_repo | service=github | operation=delete | project=/home/user/myproject
```

## CLI Commands

The interactive menu is recommended, but you can also use commands directly:

```bash
# Wrap servers
mcp-gov-wrap --config ~/.claude.json

# Unwrap servers
mcp-gov-unwrap --config ~/.claude.json

# Low-level proxy (used internally)
mcp-gov-proxy --service github --target "npx server" --rules ~/.mcp-gov/rules.json
```

## License

MIT
