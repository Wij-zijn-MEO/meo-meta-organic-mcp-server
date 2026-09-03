#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MetaApiClient } from "./services/api.js";
import { registerPageTools } from "./tools/pages.js";
import { registerInstagramTools } from "./tools/instagram.js";
import { registerUtilityTools } from "./tools/utility.js";
import { resolveApiKey } from "./op-fallback.js";
import { enforceReadOnly } from "./readonly.js";

// Optional 1Password fallback (no-op if the `op` CLI is not installed).
resolveApiKey("META_ACCESS_TOKEN", "op://Development/Meta Access Token/credential");

const token = process.env.META_ACCESS_TOKEN ?? "";
const client = new MetaApiClient(token);

const server = new McpServer({
  name: "meo-insights-mcp",
  version: "1.0.0",
});

// Default-deny read-only gate. Must be applied BEFORE any tool is registered:
// only allowlisted, readOnlyHint:true tools survive. See src/readonly.ts.
enforceReadOnly(server);

registerPageTools(server, client);
registerInstagramTools(server, client);
registerUtilityTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
