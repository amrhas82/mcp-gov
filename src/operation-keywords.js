/**
 * Exhaustive keyword mappings for operation detection.
 * Priority order: admin → delete → execute → write → read
 */

export const OPERATION_KEYWORDS = {
  // ADMIN operations - highest priority (system control)
  admin: [
    'admin', 'superuser', 'root', 'sudo', 'elevate', 'privilege',
    'grant', 'revoke', 'permission', 'role', 'access', 'policy',
    'configure', 'config', 'setting', 'preference', 'setup',
    'initialize', 'init', 'bootstrap', 'install', 'uninstall',
    'enable', 'disable', 'activate', 'deactivate', 'toggle',
    'migrate', 'migration', 'backup', 'restore', 'export', 'import',
    'deploy', 'deployment', 'provision', 'manage', 'management'
  ],

  // DELETE operations - second priority (destructive)
  delete: [
    'delete', 'remove', 'destroy', 'erase', 'clear', 'purge',
    'drop', 'truncate', 'unlink', 'discard', 'revoke', 'cancel',
    'terminate', 'kill', 'stop', 'abort', 'close', 'shutdown',
    'deactivate', 'disable', 'detach', 'disconnect', 'unpublish',
    'archive', 'trash', 'clean', 'wipe', 'reset', 'revert'
  ],

  // EXECUTE operations - third priority (action/mutation)
  execute: [
    'execute', 'run', 'invoke', 'call', 'trigger', 'fire',
    'launch', 'start', 'begin', 'process', 'perform', 'apply',
    'send', 'submit', 'post', 'publish', 'deploy', 'release',
    'build', 'compile', 'generate', 'compute', 'calculate',
    'merge', 'rebase', 'commit', 'push', 'pull', 'sync',
    'approve', 'reject', 'accept', 'decline', 'confirm',
    'schedule', 'queue', 'enqueue', 'dispatch', 'broadcast',
    'notify', 'alert', 'trigger', 'activate', 'deactivate',
    'lock', 'unlock', 'freeze', 'unfreeze', 'suspend', 'resume'
  ],

  // WRITE operations - fourth priority (creation/modification)
  write: [
    'create', 'add', 'insert', 'new', 'make', 'build',
    'write', 'save', 'store', 'persist', 'record',
    'update', 'modify', 'edit', 'change', 'alter', 'set',
    'put', 'patch', 'replace', 'overwrite', 'append',
    'upload', 'push', 'commit', 'submit', 'publish',
    'move', 'rename', 'copy', 'duplicate', 'clone',
    'attach', 'link', 'associate', 'bind', 'connect',
    'assign', 'allocate', 'register', 'enroll', 'subscribe',
    'comment', 'reply', 'respond', 'post', 'share',
    'transfer', 'migrate', 'convert', 'transform',
    'fork', 'branch', 'tag', 'label', 'mark',
    'star', 'favorite', 'like', 'follow', 'watch',
    'open', 'reopen', 'draft', 'issue', 'pr', 'pull_request'
  ],

  // READ operations - lowest priority (safe/non-mutating)
  read: [
    'get', 'list', 'fetch', 'retrieve', 'query', 'find',
    'search', 'lookup', 'check', 'verify', 'validate',
    'read', 'view', 'show', 'display', 'print', 'render',
    'describe', 'info', 'detail', 'summary', 'status',
    'count', 'total', 'aggregate', 'stats', 'statistics',
    'download', 'export', 'extract', 'parse', 'decode',
    'inspect', 'audit', 'log', 'trace', 'monitor',
    'compare', 'diff', 'match', 'filter', 'sort',
    'scan', 'analyze', 'review', 'preview', 'browse',
    'watch', 'observe', 'listen', 'subscribe', 'poll',
    'test', 'ping', 'health', 'heartbeat', 'check'
  ]
};

// Total keyword count for reference
export const TOTAL_KEYWORDS = Object.values(OPERATION_KEYWORDS)
  .reduce((sum, keywords) => sum + keywords.length, 0);
