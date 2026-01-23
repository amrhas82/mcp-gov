#!/usr/bin/env node
import { createInterface } from 'node:readline';

const rl = createInterface({
  input: process.stdin,
  terminal: false
});

rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line);
    // Echo back success response
    const response = {
      jsonrpc: '2.0',
      id: msg.id,
      result: { success: true, tool: msg.params?.name }
    };
    console.log(JSON.stringify(response));
  } catch (e) {
    // Ignore parse errors
  }
});

console.error('Mock server ready');
