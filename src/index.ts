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

const server = new McpServer(
  {
    name: "meo-insights-mcp",
    version: "1.0.0",
  },
  {
    instructions: [
      "MEO ORGANIC social insights for Facebook & Instagram (read-only).",
      "",
      "Use this server whenever someone asks about ORGANIC / ORGANISCHE / ORGANISCH results, reach,",
      "engagement or performance on Meta / Facebook / Instagram — non-paid posts, reels, page or",
      "account statistics for MEO's Facebook Pages and Instagram accounts (e.g. the werkcentra pages).",
      "It returns reach, views, likes/comments/shares/saves, video views & watch time, and follower",
      "growth, per post and per account.",
      "",
      "Do NOT use this for PAID advertising (campaigns, ad sets, ads, spend, ROAS, CPC/CPM) — that is a",
      "separate Meta Ads server. This server is strictly read-only: it cannot post, publish, delete,",
      "boost, or run ads.",
      "",
      "Typical flow: meta_list_pages / meta_list_instagram_accounts to resolve a page or IG-account id,",
      "then meta_get_posts / meta_get_instagram_media for post ids, then meta_get_post_insights /",
      "meta_get_instagram_media_insights per post, and meta_get_page_insights /",
      "meta_get_instagram_account_insights for account totals. Note: Meta retired organic",
      "reach & impressions PER Facebook post in 2025 (Instagram still has full per-post reach); the",
      "tools drop unavailable metrics automatically.",
    ].join("\n"),
  }
);

// Default-deny read-only gate. Must be applied BEFORE any tool is registered:
// only allowlisted, readOnlyHint:true tools survive. See src/readonly.ts.
enforceReadOnly(server);

registerPageTools(server, client);
registerInstagramTools(server, client);
registerUtilityTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
