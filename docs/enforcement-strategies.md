# MCP Governance Enforcement Strategies

## The Enforcement Problem

**Question:** How do you prevent users from bypassing governance by changing their Claude config?

**Answer:** It depends on your threat model and trust level.

---

## Enforcement Levels (By Trust Model)

### Level 0: No Enforcement (Trust-Based)

**Scenario:** Personal use, self-governance

**Mechanism:** None - user voluntarily uses proxy

**Bypass difficulty:** Trivial (edit config file)

**Use case:**
- "I want to prevent myself from making mistakes"
- Developer safety rails
- Habit formation

**Example:**
```json
// User willingly configures:
{
  "mcpServers": {
    "github-governed": {
      "command": "mcp-governance-proxy",
      "args": ["--target", "npx @anthropic/mcp-server-github", "--rules", "rules.json"]
    }
  }
}
```

**Security rating:** 🔓 None (voluntary participation)

---

### Level 1: Config File Permissions (Soft Enforcement)

**Scenario:** Managed workstations, casual enforcement

**Mechanism:** Lock config file with filesystem permissions

**Implementation:**
```bash
# IT sets up config
sudo cp /etc/mcp-governance/claude.json ~/.claude.json
sudo chown root:root ~/.claude.json
sudo chmod 444 ~/.claude.json  # Read-only

# User cannot edit:
nano ~/.claude.json  # Permission denied
```

**Bypass difficulty:** Easy (use --mcp-config flag or run as different user)

**Bypass methods:**
```bash
# Method 1: Override with CLI flag
claude --mcp-config '{"github":{"command":"npx","args":["@anthropic/mcp-server-github"]}}'

# Method 2: Use different config directory
HOME=/tmp/fake-home claude

# Method 3: Run MCP server manually, extract tool definitions, call APIs directly
```

**Security rating:** 🔒 Low (minor obstacle)

---

### Level 2: Restricted User Environment (Medium Enforcement)

**Scenario:** Corporate managed devices, moderate trust

**Mechanism:** Run Claude in restricted environment

**Implementation Options:**

#### Option 2A: Container/Sandbox
```dockerfile
# Dockerfile for governed Claude environment
FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nodejs npm
RUN npm install -g @anthropic/claude-cli mcp-governance-proxy

# Copy locked config
COPY claude.json /home/claude/.claude.json
RUN chown root:root /home/claude/.claude.json
RUN chmod 444 /home/claude/.claude.json

# User cannot install packages or modify config
USER claude
WORKDIR /workspace

# Network access controlled at container level
CMD ["/usr/local/bin/claude"]
```

Run with:
```bash
docker run -it --rm \
  --network restricted \
  -v $(pwd):/workspace \
  governed-claude:latest
```

**Bypass difficulty:** Medium (requires breaking out of container)

**Bypass methods:**
- Container escape vulnerabilities
- Mount host filesystem with different permissions

#### Option 2B: VM/Thin Client
```
[User's Machine (locked down)]
    ↓ SSH only
[Corporate VM with Claude installed]
    ↓ API calls go through proxy
[Corporate API Gateway with policies]
    ↓
[External APIs: GitHub, Slack, etc.]
```

**Security rating:** 🔒🔒 Medium (requires technical skill to bypass)

---

### Level 3: Proxy at Network Layer (High Enforcement)

**Scenario:** High-security environments, zero trust

**Mechanism:** MCP servers use HTTP transport + network proxy

**Key change:** Use HTTP-based MCP servers instead of stdio

**Architecture:**
```
Claude Desktop
  ↓ HTTP request
  ↓ (blocked at network level - must go through proxy)
  ↓
Corporate Network Proxy (with governance rules)
  ↓ Allowed requests only
  ↓
External MCP Servers (HTTP endpoints)
```

**Implementation:**

1. **Use HTTP MCP transport** (not stdio):
   ```json
   {
     "mcpServers": {
       "github": {
         "transport": "http",
         "url": "https://internal-mcp-proxy.company.com/github"
       }
     }
   }
   ```

2. **Internal proxy enforces governance:**
   ```
   internal-mcp-proxy.company.com
     ↓ Checks: user, operation, resource
     ↓ Applies governance rules
     ↓ Logs audit trail
     ↓ Forwards allowed requests
     ↓
   api.github.com (or other MCP server)
   ```

3. **Network enforcement:**
   ```bash
   # Firewall rules block direct access
   iptables -A OUTPUT -d api.github.com -j DROP  # Block direct access
   iptables -A OUTPUT -d internal-mcp-proxy.company.com -j ACCEPT  # Allow proxy
   ```

**Bypass difficulty:** Hard (requires network access bypass + DNS spoofing)

**Bypass methods:**
- VPN to external network
- Cellular hotspot
- Compromise DNS/network routing
- Use different tools (curl, python) instead of Claude

**Security rating:** 🔒🔒🔒 High (requires network-level attack)

---

### Level 4: Modified Claude Binary (Maximum Enforcement)

**Scenario:** Extremely high-security environments

**Mechanism:** Modify Claude itself to enforce governance

**Implementation:**

1. **Fork Claude Code CLI** (if open source):
   ```javascript
   // In Claude's MCP client code:
   async function callMCPTool(tool, args) {
     // HARDCODED: Always check governance first
     const allowed = await governanceProxy.checkPermission(tool, args);
     if (!allowed) {
       throw new Error("Governance policy denies this operation");
     }

     // Normal MCP call
     return await mcpServer.call(tool, args);
   }
   ```

2. **Distribute modified binary:**
   ```bash
   # Employees must use company-provided Claude binary
   sudo dpkg -i claude-enterprise_2.1.14_amd64.deb

   # Lock package manager to prevent updates
   sudo apt-mark hold claude-enterprise
   ```

3. **Binary verification:**
   ```bash
   # Check binary hasn't been replaced
   sha256sum /usr/bin/claude | grep expected-hash
   ```

**Bypass difficulty:** Very Hard (requires replacing binary + evading integrity checks)

**Bypass methods:**
- Compile Claude from source
- Use alternative AI tools
- Run tools outside Claude

**Security rating:** 🔒🔒🔒🔒 Very High (requires significant effort)

**Problem:** Claude CLI is not open source (as of 2026), so this may not be feasible

---

### Level 5: Zero Trust Architecture (Enterprise Grade)

**Scenario:** Financial, healthcare, government sectors

**Mechanism:** Multiple enforcement layers

**Architecture:**
```
[User Device - Locked Down]
  ↓ Certificate-based auth
[Corporate Network - Monitored]
  ↓ All traffic logged
[Governance Proxy - Enforces Rules]
  ↓ Dual authorization for dangerous ops
[Admin Dashboard - Real-time Monitoring]
  ↓ Alerts on policy violations
[External APIs - Rate Limited]
```

**Implementation:**

1. **Device Management:**
   - MDM software (Intune, JAMF) enforces policies
   - Cannot install unauthorized software
   - All processes monitored

2. **Network Enforcement:**
   - All external API access goes through proxy
   - DNS resolution controlled
   - Firewall rules block direct access

3. **Application Control:**
   - Only approved binaries can run
   - Digital signatures verified
   - Runtime monitoring (EDR tools)

4. **Audit & Monitoring:**
   - All MCP calls logged centrally
   - Real-time alerts for violations
   - Dashboards for compliance team

5. **Human Process:**
   - Dangerous operations require manager approval
   - Proxy sends Slack message: "Approve user X deleting repo Y?"
   - Two-person rule for critical changes

**Bypass difficulty:** Extreme (requires compromising multiple security layers)

**Bypass methods:**
- Use personal device (blocked by network)
- Exfiltrate credentials (DLP tools detect)
- Social engineering (human approval required)

**Security rating:** 🔒🔒🔒🔒🔒 Maximum (enterprise-grade)

---

## Comparison Table

| Level | Enforcement | Bypass Difficulty | Cost | Best For |
|-------|-------------|-------------------|------|----------|
| 0. Trust | None | Trivial | Free | Personal use |
| 1. File Permissions | Config lock | Easy | Low | Small teams |
| 2. Restricted Env | Container/VM | Medium | Medium | Mid-size companies |
| 3. Network Proxy | Firewall rules | Hard | Medium-High | Corporate environments |
| 4. Modified Binary | Code changes | Very Hard | High | Regulated industries |
| 5. Zero Trust | Multi-layer | Extreme | Very High | Financial/Gov/Healthcare |

---

## Practical Recommendation by Organization Size

### Personal / Indie Developers (1-5 people)
**Use:** Level 0 (Trust-based)
- Config-based governance is enough
- You trust yourself / small team
- Focus: Prevent accidents, not malice

### Startups / Small Companies (5-50 people)
**Use:** Level 1 (File Permissions) + Culture
- Lock config files
- Use `--strict-mcp-config` flag
- Team agreements + peer review
- Focus: Consistency, not security

### Mid-Size Companies (50-500 people)
**Use:** Level 2-3 (Restricted Env + Network Proxy)
- Run Claude in managed VMs or containers
- Network-level enforcement for HTTP MCP
- Centralized config management
- Focus: Compliance + audit trails

### Enterprises (500+ people) / Regulated Industries
**Use:** Level 4-5 (Modified Binary + Zero Trust)
- Multi-layer enforcement
- Real-time monitoring
- Human approval workflows
- Focus: Security + compliance + audit

---

## When Config-Based Governance is Sufficient

**It's sufficient when:**
1. ✅ Users want the protection (self-governance)
2. ✅ Consequences of bypass are low (dev environments)
3. ✅ Trust level is high (personal use, small teams)
4. ✅ Primary goal is accident prevention, not security
5. ✅ Audit trail is for learning, not compliance

**It's NOT sufficient when:**
1. ❌ Users might intentionally bypass
2. ❌ Consequences are severe (production access, data loss)
3. ❌ Regulatory compliance required
4. ❌ Zero trust security model
5. ❌ Malicious actors are a concern

---

## Honest Assessment for Your POC

**Your current implementation:**
- Config-based governance (Level 0-1)
- Easy to bypass if user wants to
- **Perfect for:** Personal use, small teams, accident prevention
- **Not suitable for:** Enterprise security, compliance, untrusted users

**To move to enterprise-grade:**
1. Add HTTP transport support (network enforcement)
2. Build centralized governance proxy server
3. Add authentication/authorization
4. Add admin dashboard for policy management
5. Integrate with existing IAM systems

**Question for you:** What's your target use case?
- Personal safety rails? → Current POC is great
- Enterprise compliance? → Need network-based enforcement
