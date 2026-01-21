## Relevant Files

- `/home/hamr/PycharmProjects/mcp-gov/package.json` - Project metadata, dependencies (@modelcontextprotocol/sdk, axios), ESM module configuration
- `/home/hamr/PycharmProjects/mcp-gov/.gitignore` - Git ignore patterns for node_modules, .env, logs
- `/home/hamr/PycharmProjects/mcp-gov/src/operation-keywords.js` - Exhaustive keyword mapping constants (~160 keywords across 5 operation types)
- `/home/hamr/PycharmProjects/mcp-gov/src/operation-detector.js` - Operation detection logic, service name extraction, tool name parsing (~100 lines)
- `/home/hamr/PycharmProjects/mcp-gov/src/index.js` - Main GovernedMCPServer class, permission enforcement, audit logging (~150 lines)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/server.js` - Working GitHub MCP server implementation with governance (~50 lines)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/rules.json` - Example permission rules (read: allow, write: allow, delete: deny)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/.env.example` - API key template for GitHub
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/README.md` - How to run the GitHub example, Claude Desktop integration instructions
- `/home/hamr/PycharmProjects/mcp-gov/README.md` - Project overview, quick start, installation (update with API documentation)
- `/home/hamr/PycharmProjects/mcp-gov/.npmignore` - NPM publish ignore rules (future)

### Notes

**Testing Framework:** Manual testing via console logs and Claude Desktop integration for POC. No automated test framework initially.

**Module System:** Pure ES Modules (import/export). Use `"type": "module"` in package.json. No build tools or transpilation.

**Architectural Pattern:** Middleware wrapper pattern. GovernedMCPServer wraps the MCP SDK Server, intercepting tool registration to inject permission checks before handler execution.

**Operation Detection Priority:** Check keywords in order: admin → delete → execute → write → read. Default to 'write' if no match (conservative).

**Audit Logging:** Output to console.error (stderr) as JSON for structured parsing. Each log entry includes timestamp, tool name, truncated args (200 chars), status (allowed/denied/success/error), and optional detail message.

**Permission Rules Default:** When no rule exists for a service/operation, default to 'allow' (permissive for POC). Can be made configurable post-POC.

**Error Messages:** Must be MCP-compliant error responses with clear messages including suggestions for fixing rules.

**TDD Approach:** For core library components (operation-detector.js, index.js), write tests first to ensure behavior correctness. For example server, implement directly and verify manually.

---

## Tasks

- [ ] 1.0 Project Setup and Configuration
  - [ ] 1.1 Create package.json with ESM configuration, dependencies (@modelcontextprotocol/sdk, axios), and scripts
    - tdd: no
    - verify: `node --version && cat /home/hamr/PycharmProjects/mcp-gov/package.json`
  - [ ] 1.2 Create .gitignore file with node_modules, .env, logs, .DS_Store patterns
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/.gitignore`
  - [ ] 1.3 Create directory structure (src/, examples/github/)
    - tdd: no
    - verify: `ls -la /home/hamr/PycharmProjects/mcp-gov/src/ && ls -la /home/hamr/PycharmProjects/mcp-gov/examples/github/`
  - [ ] 1.4 Install dependencies via npm
    - tdd: no
    - verify: `npm list --depth=0`
  - [ ] 1.5 Verify: `node --version && npm list --depth=0` - Node 20+ and dependencies installed

- [ ] 2.0 Operation Detection System
  - [ ] 2.1 Create src/operation-keywords.js with exhaustive keyword mappings for all 5 operation types
    - tdd: yes
    - verify: `node -e "import('./src/operation-keywords.js').then(m => console.log(Object.keys(m.OPERATION_KEYWORDS)))"`
  - [ ] 2.2 Implement detectOperation(toolName) function in src/operation-detector.js with priority-based matching
    - tdd: yes
    - verify: `node -e "import('./src/operation-detector.js').then(m => console.log(m.detectOperation('github_list_repos')))"`
  - [ ] 2.3 Implement parseToolName(toolName) function to extract service name and operation verb
    - tdd: yes
    - verify: `node -e "import('./src/operation-detector.js').then(m => console.log(m.parseToolName('github_delete_repo')))"`
  - [ ] 2.4 Write manual test cases for operation detection (20+ tool names covering all operation types)
    - tdd: yes
    - verify: `node /home/hamr/PycharmProjects/mcp-gov/src/operation-detector-test.js`
  - [ ] 2.5 Verify: `node src/operation-detector-test.js` - All test cases pass with correct operation type detection

- [ ] 3.0 GovernedMCPServer Core Implementation
  - [ ] 3.1 Create src/index.js with GovernedMCPServer class constructor accepting config and rules
    - tdd: yes
    - verify: `node -e "import('./src/index.js').then(m => console.log(typeof m.GovernedMCPServer))"`
  - [ ] 3.2 Implement checkPermission(toolName, rules) method for permission rule lookup
    - tdd: yes
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {github:{delete:'deny'}}); console.log(s.checkPermission('github_delete_repo', s.rules)); })"`
  - [ ] 3.3 Implement logAudit(entry) method for structured JSON logging to console.error
    - tdd: yes
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {}); s.logAudit({tool:'test',status:'success'}); })"`
  - [ ] 3.4 Implement registerTool(toolDef, handler) method with permission wrapping logic
    - tdd: yes
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {}); s.registerTool({name:'test_get'}, async()=>({content:[{type:'text',text:'ok'}]})); console.log('registered'); })"`
  - [ ] 3.5 Implement start() method to initialize MCP stdio transport
    - tdd: no
    - verify: Manual verification via example server
  - [ ] 3.6 Add comprehensive error handling for permission denials with helpful messages
    - tdd: yes
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {test:{delete:'deny'}}); s.registerTool({name:'test_delete'}, async()=>({})); })"`
  - [ ] 3.7 Verify: Manual test of GovernedMCPServer with mock tools - permission checks and audit logs work correctly

- [ ] 4.0 GitHub Example Implementation
  - [ ] 4.1 Create examples/github/.env.example with GITHUB_TOKEN placeholder
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/.env.example`
  - [ ] 4.2 Create examples/github/rules.json with read: allow, write: allow, delete: deny
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/rules.json | jq .`
  - [ ] 4.3 Implement github_list_repos tool in examples/github/server.js using GitHub API
    - tdd: no
    - verify: Manual test with valid API key
  - [ ] 4.4 Implement github_delete_repo tool in examples/github/server.js using GitHub API
    - tdd: no
    - verify: Manual test with valid API key (should be blocked by rules)
  - [ ] 4.5 Wire up GovernedMCPServer with tools and rules in examples/github/server.js
    - tdd: no
    - verify: `node /home/hamr/PycharmProjects/mcp-gov/examples/github/server.js --version`
  - [ ] 4.6 Add environment variable loading with dotenv in examples/github/server.js
    - tdd: no
    - verify: `node -e "import('dotenv').then(d => console.log('dotenv loaded'))"`
  - [ ] 4.7 Verify: `node examples/github/server.js` - Server starts without errors and listens for MCP requests

- [ ] 5.0 End-to-End Testing with Claude Desktop
  - [ ] 5.1 Create Claude Desktop MCP configuration file pointing to GitHub example server
    - tdd: no
    - verify: Manual check of Claude Desktop config
  - [ ] 5.2 Test github_list_repos via Claude Desktop - verify successful execution and audit logs
    - tdd: no
    - verify: Manual test in Claude Desktop
  - [ ] 5.3 Test github_delete_repo via Claude Desktop - verify permission denial error and audit logs
    - tdd: no
    - verify: Manual test in Claude Desktop
  - [ ] 5.4 Review audit logs for completeness (timestamp, tool, args, status, detail)
    - tdd: no
    - verify: `tail -f stderr.log` during tests
  - [ ] 5.5 Verify: End-to-end flow works - read operations succeed, delete operations blocked, all logged

- [ ] 6.0 Documentation Enhancement
  - [ ] 6.1 Update README.md with complete installation instructions (npm install, API key setup)
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.2 Add API reference section to README.md (GovernedMCPServer constructor, methods, parameters)
    - tdd: no
    - verify: `grep -A 20 "## API Reference" /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.3 Add architecture diagram (ASCII art) to README.md showing library wrapping MCP SDK
    - tdd: no
    - verify: `grep -A 10 "Architecture" /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.4 Create examples/github/README.md with step-by-step setup instructions
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/README.md`
  - [ ] 6.5 Add Claude Desktop configuration instructions to examples/github/README.md
    - tdd: no
    - verify: `grep "Claude Desktop" /home/hamr/PycharmProjects/mcp-gov/examples/github/README.md`
  - [ ] 6.6 Add troubleshooting section to README.md (common errors, solutions)
    - tdd: no
    - verify: `grep -A 5 "## Troubleshooting" /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.7 Update README.md with code examples showing complete usage workflow
    - tdd: no
    - verify: `grep -A 20 "## Quick Start" /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.8 Verify: README.md is comprehensive - new user can get started without external help

- [ ] 7.0 Final Polish and Validation
  - [ ] 7.1 Add JSDoc comments to all exported functions in src/index.js
    - tdd: no
    - verify: `grep -c "@param" /home/hamr/PycharmProjects/mcp-gov/src/index.js`
  - [ ] 7.2 Add JSDoc comments to operation-detector.js functions
    - tdd: no
    - verify: `grep -c "@param" /home/hamr/PycharmProjects/mcp-gov/src/operation-detector.js`
  - [ ] 7.3 Review all error messages for clarity and helpfulness
    - tdd: no
    - verify: `grep -r "Error\|denied" /home/hamr/PycharmProjects/mcp-gov/src/`
  - [ ] 7.4 Test with invalid rules.json (missing service, invalid values) - verify helpful error messages
    - tdd: no
    - verify: Manual test with malformed rules
  - [ ] 7.5 Test with missing .env file - verify helpful error message about API key
    - tdd: no
    - verify: Manual test without .env
  - [ ] 7.6 Run complete end-to-end test suite manually (read operations, write operations, delete operations, audit logs)
    - tdd: no
    - verify: Manual checklist completion
  - [ ] 7.7 Create CONTRIBUTING.md with guidelines for contributions
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/CONTRIBUTING.md`
  - [ ] 7.8 Verify: All components working together - library is production-ready for POC
