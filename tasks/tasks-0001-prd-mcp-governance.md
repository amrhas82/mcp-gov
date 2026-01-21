## Relevant Files

- `/home/hamr/PycharmProjects/mcp-gov/package.json` - Project metadata, dependencies (@modelcontextprotocol/sdk, axios, dotenv), ESM module configuration
- `/home/hamr/PycharmProjects/mcp-gov/.gitignore` - Git ignore patterns for node_modules, .env, logs
- `/home/hamr/PycharmProjects/mcp-gov/src/operation-keywords.js` - Exhaustive keyword mapping constants (~160 keywords across 5 operation types)
- `/home/hamr/PycharmProjects/mcp-gov/src/operation-detector.js` - Operation detection logic, service name extraction, tool name parsing (~100 lines)
- `/home/hamr/PycharmProjects/mcp-gov/src/index.js` - Main GovernedMCPServer class, permission enforcement, audit logging (~150 lines)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/server.js` - Working GitHub MCP server implementation with governance (~50 lines)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/rules.json` - Example permission rules (read: allow, write: allow, delete: deny)
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/.env.example` - Token template for GitHub
- `/home/hamr/PycharmProjects/mcp-gov/examples/github/README.md` - How to run the GitHub example, Claude Desktop integration instructions
- `/home/hamr/PycharmProjects/mcp-gov/README.md` - Project overview, quick start, installation

### Notes

**Testing Framework:** Manual testing via console logs and Claude Desktop integration for POC. No automated test framework.

**Module System:** Pure ES Modules (import/export). Use `"type": "module"` in package.json. No build tools or transpilation.

**Architectural Pattern:** Middleware wrapper pattern. GovernedMCPServer wraps the MCP SDK Server, intercepting tool registration to inject permission checks before handler execution.

**Operation Detection Priority:** Check keywords in order: admin → delete → execute → write → read. Default to 'write' if no match (conservative).

**Audit Logging:** Output to console.error (stderr) as JSON for structured parsing. Each log entry includes timestamp, tool name, truncated args (200 chars), status (allowed/denied/success/error), and optional detail message.

**Permission Rules Default:** When no rule exists for a service/operation, default to 'allow' (permissive for POC).

**GitHub API Details:**
- List repos: `GET https://api.github.com/user/repos` with header `Authorization: Bearer {token}`
- Delete repo: `DELETE https://api.github.com/repos/{owner}/{repo}`
- Get authenticated user: `GET https://api.github.com/user` (for owner name)

---

## Tasks

- [ ] 1.0 Project Setup and Configuration
  - [ ] 1.1 Create package.json with ESM configuration, dependencies (@modelcontextprotocol/sdk@^0.5.0, axios@^1.6.0, dotenv@^16.0.0)
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/package.json | grep -E "modelcontextprotocol|axios|dotenv"`
  - [ ] 1.2 Create .gitignore file with node_modules, .env, logs, .DS_Store patterns
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/.gitignore`
  - [ ] 1.3 Create directory structure (src/, examples/github/)
    - tdd: no
    - verify: `ls -la /home/hamr/PycharmProjects/mcp-gov/src/ && ls -la /home/hamr/PycharmProjects/mcp-gov/examples/github/`
  - [ ] 1.4 Install dependencies via npm
    - tdd: no
    - verify: `npm list --depth=0 | grep -E "modelcontextprotocol|axios|dotenv"`
  - [ ] 1.5 Verify: `node --version && npm list --depth=0` - Node 20+ and dependencies installed

- [ ] 2.0 Operation Detection System
  - [ ] 2.1 Create src/operation-keywords.js with exhaustive keyword mappings for all 5 operation types (~160 keywords)
    - tdd: no
    - verify: `node -e "import('./src/operation-keywords.js').then(m => console.log(Object.keys(m.OPERATION_KEYWORDS)))"`
  - [ ] 2.2 Create src/operation-detector.js with detectOperation(toolName) function using priority-based matching
    - tdd: no
    - verify: `node -e "import('./src/operation-detector.js').then(m => console.log(m.detectOperation('github_list_repos')))"`
  - [ ] 2.3 Add extractService(toolName) function to operation-detector.js (extracts service name from tool name prefix)
    - tdd: no
    - verify: `node -e "import('./src/operation-detector.js').then(m => console.log(m.extractService('github_delete_repo')))"`
  - [ ] 2.4 Add parseToolName(toolName) function that returns {service, operation}
    - tdd: no
    - verify: `node -e "import('./src/operation-detector.js').then(m => console.log(m.parseToolName('github_delete_repo')))"`
  - [ ] 2.5 Verify: Test operation detection with sample tool names - github_list_repos→read, github_delete_repo→delete, github_create_issue→write

- [ ] 3.0 GovernedMCPServer Core Implementation
  - [ ] 3.1 Create src/index.js with GovernedMCPServer class constructor accepting config and rules
    - tdd: no
    - verify: `node -e "import('./src/index.js').then(m => console.log(typeof m.GovernedMCPServer))"`
  - [ ] 3.2 Implement checkPermission(toolName) method that uses operation-detector to determine if operation is allowed
    - tdd: no
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {github:{delete:'deny'}}); console.log(s.checkPermission('github_delete_repo')); })"`
  - [ ] 3.3 Implement logOperation(tool, args, status, detail) method for structured JSON logging to console.error
    - tdd: no
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {}); s.logOperation('test','{}','success'); })"`
  - [ ] 3.4 Implement registerTool(toolDef, handler) that wraps handler with permission check before execution
    - tdd: no
    - verify: `node -e "import('./src/index.js').then(m => { const s = new m.GovernedMCPServer({name:'test',version:'1.0'}, {}); s.registerTool({name:'test_get',description:'test',inputSchema:{}}, async()=>({content:[{type:'text',text:'ok'}]})); console.log('registered'); })"`
  - [ ] 3.5 Implement start() method to initialize MCP stdio transport and connect server
    - tdd: no
    - verify: Manual verification via example server
  - [ ] 3.6 Add error handling for permission denials - return MCP-compliant error with helpful message
    - tdd: no
    - verify: Check error response format matches MCP spec
  - [ ] 3.7 Verify: Create simple test in node REPL - GovernedMCPServer blocks denied operations and logs all attempts

- [ ] 4.0 GitHub Example Implementation
  - [ ] 4.1 Create examples/github/.env.example with GITHUB_TOKEN placeholder and instructions
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/.env.example`
  - [ ] 4.2 Create examples/github/rules.json with github: {read: "allow", write: "allow", delete: "deny", admin: "deny"}
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/rules.json | jq .`
  - [ ] 4.3 Implement github_list_repos tool - GET /user/repos, returns list of user's repositories
    - tdd: no
    - verify: Manual test with valid GitHub token
  - [ ] 4.4 Implement github_delete_repo tool - DELETE /repos/{owner}/{repo}, requires repo_name parameter
    - tdd: no
    - verify: Manual test (should be blocked by rules)
  - [ ] 4.5 Wire up GovernedMCPServer with both tools and rules in examples/github/server.js
    - tdd: no
    - verify: `node /home/hamr/PycharmProjects/mcp-gov/examples/github/server.js` (check it starts)
  - [ ] 4.6 Add dotenv config loading and error handling for missing GITHUB_TOKEN
    - tdd: no
    - verify: `node examples/github/server.js` without .env shows helpful error
  - [ ] 4.7 Verify: Server starts without errors, shows "MCP Server started" message, ready for stdio connections

- [ ] 5.0 End-to-End Testing with Claude Desktop
  - [ ] 5.1 Create Claude Desktop MCP configuration file entry for github-governed server
    - tdd: no
    - verify: Check config file at ~/.config/Claude/claude_desktop_config.json (or platform equivalent)
  - [ ] 5.2 Test github_list_repos via Claude Desktop - verify it lists repositories successfully
    - tdd: no
    - verify: Claude Desktop chat - "List my GitHub repositories"
  - [ ] 5.3 Test github_delete_repo via Claude Desktop - verify it's blocked with permission denied error
    - tdd: no
    - verify: Claude Desktop chat - "Delete the test-repo repository" → blocked
  - [ ] 5.4 Review audit logs in stderr - verify all operations logged with timestamp, tool, status
    - tdd: no
    - verify: `node examples/github/server.js 2>&1 | grep -E "github_list_repos|github_delete_repo"`
  - [ ] 5.5 Verify: End-to-end flow complete - read works, delete blocked, all logged

- [ ] 6.0 Documentation
  - [ ] 6.1 Update README.md with installation instructions and quick start example
    - tdd: no
    - verify: `grep -A 10 "## Installation" /home/hamr/PycharmProjects/mcp-gov/README.md`
  - [ ] 6.2 Create examples/github/README.md with setup steps (get token, configure .env, run server)
    - tdd: no
    - verify: `cat /home/hamr/PycharmProjects/mcp-gov/examples/github/README.md`
  - [ ] 6.3 Add Claude Desktop configuration instructions to examples/github/README.md
    - tdd: no
    - verify: `grep "claude_desktop_config.json" /home/hamr/PycharmProjects/mcp-gov/examples/github/README.md`
  - [ ] 6.4 Verify: A new developer can clone repo, follow README, and get it working in 15 minutes

- [ ] 7.0 Final Validation and Commit
  - [ ] 7.1 Add brief code comments to exported functions (one-line description of what each does)
    - tdd: no
    - verify: `grep -E "^export|^\/\/" /home/hamr/PycharmProjects/mcp-gov/src/index.js | head -20`
  - [ ] 7.2 Run complete end-to-end test: list repos (works), delete repo (blocked), check audit logs (complete)
    - tdd: no
    - verify: Manual checklist - all 3 scenarios tested and working
  - [ ] 7.3 Git commit all changes with descriptive message
    - tdd: no
    - verify: `git log -1 --oneline`
  - [ ] 7.4 Verify: POC is complete - library works, example works, documented, committed to git
