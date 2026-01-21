/**
 * Operation detection logic for MCP tool names.
 * Analyzes tool names to determine operation type (admin/delete/execute/write/read).
 */

import { OPERATION_KEYWORDS } from './operation-keywords.js';

/**
 * Extract service name from tool name prefix (e.g., "github_list_repos" → "github")
 * @param {string} toolName - Full tool name
 * @returns {string} Service name or "unknown"
 */
export function extractService(toolName) {
  if (!toolName || typeof toolName !== 'string') {
    return 'unknown';
  }

  // Split by underscore and take first segment as service name
  const parts = toolName.split('_');
  return parts.length > 1 ? parts[0] : 'unknown';
}

/**
 * Detect operation type from tool name using priority-based keyword matching.
 * Priority order: admin → delete → execute → write → read
 * @param {string} toolName - Tool name to analyze
 * @returns {string} Operation type: 'admin', 'delete', 'execute', 'write', 'read', or 'write' (default)
 */
export function detectOperation(toolName) {
  if (!toolName || typeof toolName !== 'string') {
    return 'write'; // Conservative default
  }

  const lowerName = toolName.toLowerCase();

  // Check keywords in priority order
  const operationTypes = ['admin', 'delete', 'execute', 'write', 'read'];

  for (const opType of operationTypes) {
    const keywords = OPERATION_KEYWORDS[opType];
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return opType;
      }
    }
  }

  // Default to 'write' if no match (conservative)
  return 'write';
}

/**
 * Parse tool name into service and operation components.
 * @param {string} toolName - Full tool name
 * @returns {{service: string, operation: string}} Parsed components
 */
export function parseToolName(toolName) {
  return {
    service: extractService(toolName),
    operation: detectOperation(toolName)
  };
}
