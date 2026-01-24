# Changelog

All notable changes to mcp-gov will be documented in this file.

## [1.3.0] - 2026-01-24

### Changed
- Cleaned up README - reduced from 1200+ lines to ~130 lines
- Focus on interactive CLI usage
- Added npm and npx install options

### Added
- CHANGELOG.md to track version history

## [1.2.5] - 2026-01-24

### Changed
- Removed default config path - users must enter path explicitly
- Added example hint in prompt: `Enter config path (e.g. ~/.claude.json):`
- Re-prompt on invalid path instead of exiting

## [1.2.4] - 2026-01-24

### Changed
- Default config path changed to `~/.claude.json`
- Added retry loop when file not found

## [1.2.3] - 2026-01-24

### Added
- Exit option (5) to interactive menu

## [1.2.2] - 2026-01-24

### Added
- ASCII logo banner for `mcp-gov` command
- Version display below logo
- ASCII logo in README

## [1.2.1] - 2026-01-24

### Fixed
- Config path display now shows `~` instead of full home directory path

## [1.2.0] - 2026-01-24

### Changed
- Switched from `inquirer` to built-in `readline` for zero dependencies
- Simple numbered menu (1-5) instead of arrow-key selection

## [1.1.0] - 2026-01-24

### Added
- Interactive `mcp-gov` CLI command with menu:
  - Wrap MCP servers
  - Unwrap MCP servers
  - View audit logs
  - Edit rules
- `postinstall.js` welcome message after npm install
- `scripts/publish.sh` for npm publishing with pre/post checks

## [1.0.0] - 2026-01-24

### Added
- Initial release
- `mcp-gov-proxy` - JSON-RPC proxy with permission checking
- `mcp-gov-wrap` - Wrap MCP servers with governance
- `mcp-gov-unwrap` - Restore original server config
- Auto-generated rules with safe defaults
- Audit logging to `~/.mcp-gov/logs/`
- Project path in audit logs
- Support for flat and multi-project config formats
