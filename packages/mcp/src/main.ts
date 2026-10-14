/**
 * Entry point: the server on standard input and output, as Claude Code and Claude Desktop run a
 * local MCP server (plan 0062). Nothing is ever written to standard output but protocol messages;
 * a failure to start is reported on standard error.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { Session } from './session.js';
import { thrustCurveTransport } from './transport.js';

/** Largest single message read from the client: twice the largest content a tool accepts. */
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

createServer(new Session(thrustCurveTransport(fetch)))
  .connect(
    new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: MAX_MESSAGE_BYTES }),
  )
  .catch((error: unknown) => {
    process.stderr.write(
      `lo-fi-rocket MCP server could not start: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
