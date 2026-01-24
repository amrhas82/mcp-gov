#!/usr/bin/env node

const colors = {
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

console.log('');
console.log(`${colors.green}==========================================`);
console.log(`  mcp-gov installed successfully`);
console.log(`==========================================${colors.reset}`);
console.log('');
console.log(`${colors.bright}${colors.yellow}Quick Start:${colors.reset}`);
console.log('');
console.log(`  ${colors.cyan}mcp-gov-wrap${colors.reset}    Add governance to claude_desktop_config.json`);
console.log(`  ${colors.cyan}mcp-gov-unwrap${colors.reset}  Remove governance`);
console.log('');
console.log(`${colors.bright}Docs:${colors.reset} https://github.com/amrhas82/mcp-gov`);
console.log('');
console.log(`${colors.green}==========================================${colors.reset}`);
console.log('');
