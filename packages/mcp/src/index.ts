/**
 * @lo-fi-rocket/mcp: the local MCP server through which Claude builds and simulates designs on the
 * user's own Claude plan (plan 0061 route A, plan 0062).
 */
export {
  createServer,
  INSTRUCTIONS,
  MAX_CONTENT_CHARACTERS,
  SERVER_NAME,
  SERVER_VERSION,
} from './server.js';
export { Session } from './session.js';
