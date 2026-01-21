# API Permission Levels

## Overview

The mcp-governance library supports 5 permission levels to control what AI agents can do with your services.

## The 5 Permission Levels (POC)

### 1. read (Safest)
**Purpose:** View-only access to data

**Examples:**
- List tasks, view emails, search documents
- Get user profile, fetch repository info
- Query database, retrieve files

**Keywords detected:** list, get, fetch, retrieve, search, query, find, show, view

**Risk level:** 🟢 Low - Cannot modify data

---

### 2. write
**Purpose:** Create and update data (but not delete)

**Examples:**
- Create new tasks, update issue descriptions
- Add comments, edit documents
- Insert database records, modify settings

**Keywords detected:** create, add, update, modify, edit, set, post, put, patch

**Risk level:** 🟡 Medium - Can change data but not destroy it

---

### 3. execute
**Purpose:** Run operations and trigger actions

**Examples:**
- Send emails, publish posts, deploy code
- Run CI/CD pipelines, trigger webhooks
- Start jobs, invoke functions

**Keywords detected:** send, run, trigger, start, invoke, publish, deploy, execute

**Risk level:** 🟠 Medium-High - Can cause external effects

**Why separate from write?** Sending an email is different from drafting one. Execute operations have immediate external impact.

---

### 4. delete (Dangerous)
**Purpose:** Remove and destroy data

**Examples:**
- Delete tasks, remove files, drop database tables
- Archive projects, destroy resources
- Clear caches, purge data

**Keywords detected:** delete, remove, destroy, archive, drop

**Risk level:** 🔴 High - Data loss is permanent

---

### 5. admin (Most Dangerous)
**Purpose:** Full control over service configuration

**Examples:**
- Manage users and permissions
- Configure service settings
- Grant/revoke access, change security settings
- Modify infrastructure, manage API keys

**Keywords detected:** admin, configure, manage, settings, permission, grant

**Risk level:** 🔴🔴 Critical - Can change access control itself

---

## Usage Examples

### Read-Only Mode (Safest)
```json
{
  "todoist": {
    "read": "allow",
    "write": "deny",
    "execute": "deny",
    "delete": "deny",
    "admin": "deny"
  }
}
```
AI can only view data, cannot make any changes.

### Normal Operations (Moderate)
```json
{
  "github": {
    "read": "allow",
    "write": "allow",
    "execute": "allow",
    "delete": "deny",
    "admin": "deny"
  }
}
```
AI can view, create, update, and trigger builds - but cannot delete repos or change settings.

### Full Access (Use with Caution)
```json
{
  "test-service": {
    "read": "allow",
    "write": "allow",
    "execute": "allow",
    "delete": "allow",
    "admin": "allow"
  }
}
```
AI has unrestricted access. Only use for testing or trusted scenarios.

---

## Real-World Scenarios

### Gmail Integration
```json
{
  "gmail": {
    "read": "allow",     // Can read emails
    "write": "allow",    // Can compose drafts
    "execute": "deny",   // CANNOT send emails
    "delete": "deny",    // CANNOT delete emails
    "admin": "deny"      // CANNOT change settings
  }
}
```

### Database Access
```json
{
  "postgres": {
    "read": "allow",     // SELECT queries
    "write": "allow",    // INSERT, UPDATE
    "execute": "allow",  // Stored procedures
    "delete": "deny",    // NO DELETE statements
    "admin": "deny"      // NO ALTER, CREATE, DROP
  }
}
```

### CI/CD Pipeline
```json
{
  "jenkins": {
    "read": "allow",     // View job status
    "write": "deny",     // Cannot modify job configs
    "execute": "allow",  // Can trigger builds
    "delete": "deny",    // Cannot delete jobs
    "admin": "deny"      // Cannot change Jenkins settings
  }
}
```

---

## Future Permission Levels (Post-POC)

These may be added based on community feedback:

- **share** - Control sharing and collaboration
- **billing** - Manage payments and subscriptions
- **webhook** - Manage integrations and webhooks
- **export** - Export and download data
- **moderate** - Content moderation and review
- **comment** - Add comments (lighter than write)

---

## Detection Algorithm

The library automatically detects operation type from tool names:

```
todoist_list_tasks        → read
github_create_issue       → write
gmail_send_email          → execute
notion_delete_page        → delete
salesforce_manage_users   → admin
```

If no verb matches, defaults to **write** (conservative approach).

---

## Default Policy

When no rule exists for a service/operation: **ALLOW** (permissive default)

To change default behavior, set explicit rules for all operations.

---

## Best Practices

1. **Start restrictive** - Begin with read-only, add permissions as needed
2. **Separate execute from write** - Sending email is different from drafting
3. **Always block admin** - Unless explicitly required
4. **Test with safe operations first** - Try read operations before write
5. **Monitor audit logs** - Review what AI agents are actually doing
6. **Use different rules per environment** - Production more restrictive than dev

---

## Questions?

See the main [PRD](../tasks/0001-prd-mcp-governance.md) for technical details.
