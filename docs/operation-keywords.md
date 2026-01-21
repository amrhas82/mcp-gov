# Operation Detection Keywords - Exhaustive List

This is the definitive keyword mapping used by the library to detect operation types from tool names.

## Detection Algorithm

```javascript
// Tool name: "todoist_delete_task"
1. Convert to lowercase: "todoist_delete_task"
2. Split by underscore/hyphen: ["todoist", "delete", "task"]
3. Check each word against keyword lists (in priority order)
4. Return first match, or default to "write"
```

---

## READ Operations (Safe)

**Intent:** View, query, retrieve data without modification

### Primary Keywords
```
read
get
fetch
retrieve
list
show
view
display
query
search
find
lookup
select
```

### Database/Query Terms
```
select
query
scan
index
count
```

### Inspection/Analysis
```
check
validate
verify
inspect
examine
test
peek
preview
```

### Download/Export (read-only variants)
```
download
dump
export
extract
pull
clone
```

### Status/Info
```
status
info
describe
details
summary
stat
```

**Total:** ~35 keywords

---

## WRITE Operations (Create/Update, No Delete)

**Intent:** Create new data or modify existing data

### Creation
```
create
add
new
insert
post
put
make
build
generate
initialize
setup
register
```

### Modification
```
update
modify
edit
change
set
patch
alter
amend
revise
replace
```

### Append/Extend
```
append
push
attach
extend
increment
```

### Configuration
```
configure
adjust
tune
customize
```

**Total:** ~30 keywords

---

## EXECUTE Operations (Run/Trigger Actions)

**Intent:** Perform operations with external effects

### Sending/Communication
```
send
email
mail
notify
message
post
publish
broadcast
transmit
```

### Execution
```
execute
run
invoke
call
trigger
fire
launch
start
begin
```

### Processing
```
process
compile
build
deploy
render
convert
transform
```

### Workflow/Automation
```
schedule
queue
enqueue
dispatch
submit
```

### Testing/Validation (active)
```
test
validate
verify
check
```

**Total:** ~35 keywords

---

## DELETE Operations (Destructive)

**Intent:** Remove, destroy, or permanently modify data

### Deletion
```
delete
remove
destroy
drop
purge
clear
erase
```

### Archival (often irreversible)
```
archive
trash
discard
abandon
```

### Cancellation
```
cancel
abort
terminate
kill
stop
halt
```

### Reset (destructive)
```
reset
wipe
flush
clean
prune
```

**Total:** ~25 keywords

---

## ADMIN Operations (System Management)

**Intent:** Manage system, users, permissions, infrastructure

### Administration
```
admin
administer
administrate
```

### Management
```
manage
grant
revoke
assign
unassign
```

### Configuration (system-level)
```
configure
setup
install
uninstall
migrate
```

### User/Access Management
```
invite
approve
reject
block
unblock
ban
unban
promote
demote
```

### Permission Control
```
permission
authorize
authenticate
allow
deny
enable
disable
```

### System Operations
```
restart
reboot
upgrade
downgrade
scale
provision
```

**Total:** ~35 keywords

---

## Ambiguous Keywords (Context-Dependent)

These require careful handling:

### "publish"
- **execute** if publishing content (e.g., "publish_blog_post")
- **write** if publishing a draft (e.g., "publish_draft")
- **admin** if publishing system config (e.g., "publish_settings")

### "archive"
- **delete** if archival is like deletion (e.g., "archive_old_emails")
- **write** if archival preserves data (e.g., "archive_to_storage")

### "test"
- **read** if testing connectivity (e.g., "test_connection")
- **execute** if running tests (e.g., "test_endpoint")

### "validate"
- **read** if checking format (e.g., "validate_email_format")
- **execute** if triggering validation (e.g., "validate_webhook")

### "reset"
- **delete** if destructive (e.g., "reset_database")
- **write** if restoring defaults (e.g., "reset_settings")

**Resolution:** Use most restrictive interpretation (conservative approach)

---

## Priority Order (First Match Wins)

When a tool name contains multiple keywords:

```javascript
// Example: "admin_create_user"
// Contains: "admin" (admin) + "create" (write)
// Priority order:
1. admin → MATCH ✓ (most restrictive)
2. delete → no match
3. execute → no match
4. write → skipped (admin already matched)
5. read → skipped
```

**Detection Priority:**
1. **admin** (most restrictive)
2. **delete** (very restrictive)
3. **execute** (moderately restrictive)
4. **write** (somewhat restrictive)
5. **read** (least restrictive)

**Default:** If no match → **write** (conservative)

---

## Special Cases

### Compound Actions
```
"github_fork_and_clone"
  → Contains: "clone" (read)
  → But creates new resource
  → Override: write
```

### Negative Actions
```
"todoist_uncomplete_task"
  → Contains: "complete" → not in any list
  → Default: write ✓
```

### Prefix/Suffix Matching
```
"get_tasks"       → "get" → read ✓
"tasks_getter"    → "get" substring → read ✓
"forget_password" → "get" substring → WRONG!
```

**Solution:** Match whole words only, with word boundaries

---

## Implementation

This exact list is encoded in the library:

```javascript
// src/index.js
const OPERATION_KEYWORDS = {
  admin: [
    'admin', 'administer', 'administrate',
    'manage', 'grant', 'revoke', 'assign', 'unassign',
    'invite', 'approve', 'reject', 'block', 'unblock',
    'ban', 'unban', 'promote', 'demote',
    'permission', 'authorize', 'authenticate',
    'allow', 'deny', 'enable', 'disable',
    'restart', 'reboot', 'upgrade', 'downgrade',
    'scale', 'provision', 'install', 'uninstall', 'migrate'
  ],
  delete: [
    'delete', 'remove', 'destroy', 'drop', 'purge', 'clear', 'erase',
    'archive', 'trash', 'discard', 'abandon',
    'cancel', 'abort', 'terminate', 'kill', 'stop', 'halt',
    'reset', 'wipe', 'flush', 'clean', 'prune'
  ],
  execute: [
    'send', 'email', 'mail', 'notify', 'message', 'post', 'publish', 'broadcast', 'transmit',
    'execute', 'run', 'invoke', 'call', 'trigger', 'fire', 'launch', 'start', 'begin',
    'process', 'compile', 'build', 'deploy', 'render', 'convert', 'transform',
    'schedule', 'queue', 'enqueue', 'dispatch', 'submit'
  ],
  write: [
    'create', 'add', 'new', 'insert', 'post', 'put', 'make', 'build', 'generate', 'initialize', 'setup', 'register',
    'update', 'modify', 'edit', 'change', 'set', 'patch', 'alter', 'amend', 'revise', 'replace',
    'append', 'push', 'attach', 'extend', 'increment',
    'configure', 'adjust', 'tune', 'customize'
  ],
  read: [
    'read', 'get', 'fetch', 'retrieve', 'list', 'show', 'view', 'display',
    'query', 'search', 'find', 'lookup', 'select',
    'scan', 'index', 'count',
    'check', 'validate', 'verify', 'inspect', 'examine', 'test', 'peek', 'preview',
    'download', 'dump', 'export', 'extract', 'pull', 'clone',
    'status', 'info', 'describe', 'details', 'summary', 'stat'
  ]
};
```

---

## Testing the Detection

```javascript
// Test cases
'todoist_list_tasks'        → read
'github_create_issue'       → write
'gmail_send_email'          → execute
'notion_delete_page'        → delete
'salesforce_manage_users'   → admin
'stripe_process_payment'    → execute
'slack_post_message'        → execute (not write!)
'db_drop_table'             → delete
'aws_provision_server'      → admin
'api_get_user'              → read
```

---

## Extensibility

Developers can override detection:

```javascript
// Future feature
server.registerTool(
  {
    name: 'custom_weird_operation',
    operation: 'delete'  // ← Manual override
  },
  handler
);
```

Or add custom keywords:

```javascript
// Future feature
server.addOperationKeywords('execute', ['fire', 'blast', 'yeet']);
```

---

## Summary

**Total Keywords:** ~160 across 5 operation types

**Coverage:**
- ✓ Standard CRUD operations
- ✓ RESTful API conventions
- ✓ Database operations (SQL-like)
- ✓ Cloud infrastructure operations
- ✓ Communication/messaging operations
- ✓ System administration

**Missing:** Highly domain-specific terms (add via manual override)

**Accuracy:** Estimated 90-95% for well-named tools
