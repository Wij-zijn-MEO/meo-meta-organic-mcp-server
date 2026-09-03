import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MEO read-only build — allowlist gate.
 *
 * Safety of this fork rests on three independent layers:
 *   1. The Meta System User token is granted READ-ONLY scopes only
 *      (ads_read, read_insights, pages_read_engagement, instagram_basic,
 *      instagram_manage_insights). Even a bug cannot mutate anything.
 *   2. The heavy write/ads/commerce/threads modules are deleted from source.
 *   3. This gate: every tool registration is checked against an explicit
 *      allowlist AND must carry annotations.readOnlyHint === true. Anything
 *      else is refused registration (default-deny) and logged to stderr.
 *
 * Adding a tool here is a deliberate act: it must be a pure GET/read tool.
 * DM/inbox/conversation read tools are intentionally NOT included — the
 * monthly organic review never needs the content of citizens' messages.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set<string>([
  // --- Facebook Pages (organic) ---
  "meta_list_pages",            // discover pages + cache page tokens (run first)
  "meta_get_page",              // page profile / follower counts
  "meta_get_posts",             // list posts on a page
  "meta_get_published_posts",   // published feed
  "meta_get_post",              // single post detail
  "meta_get_page_insights",     // page-level organic insights
  "meta_get_post_insights",     // per-post organic insights (reach/impressions/engagement)
  "meta_get_post_comments",     // public comments on a post
  "meta_get_post_reactions",    // reactions on a post
  "meta_get_page_fan_demographics",
  "meta_get_page_videos",

  // --- Instagram (organic) ---
  "meta_list_instagram_accounts",       // resolve IG business account from a Page
  "meta_get_instagram_media",           // list media/posts/reels
  "meta_get_instagram_single_media",    // single media detail
  "meta_get_instagram_media_children",  // carousel children
  "meta_get_instagram_media_insights",  // per-post reach/likes/comments/shares/saves
  "meta_get_instagram_account_insights",// account-level insights
  "meta_get_instagram_comments",        // public comments
  "meta_get_instagram_comment_replies",
  "meta_get_instagram_stories",         // active stories (read)
  "meta_get_instagram_user",            // public business discovery (profile)
  "meta_get_competitor_instagram",      // peer benchmark via business discovery (public engagement)

  // --- Diagnostics ---
  "meta_debug_token",   // inspect token scopes/expiry — confirm it is read-only
  "meta_health_check",  // connectivity + cached page tokens
]);

/**
 * Wraps registerTool/tool on an McpServer so only allowlisted, read-only-
 * annotated tools are ever registered. Call once, before registering modules.
 */
export function enforceReadOnly(server: McpServer): McpServer {
  const wrap = (methodName: "registerTool" | "tool") => {
    const original = (server as unknown as Record<string, unknown>)[methodName];
    if (typeof original !== "function") return;
    const bound = (original as (...a: unknown[]) => unknown).bind(server);
    (server as unknown as Record<string, unknown>)[methodName] = (
      name: string,
      config: unknown,
      ...rest: unknown[]
    ): unknown => {
      const annotations = (config as { annotations?: { readOnlyHint?: boolean } } | undefined)
        ?.annotations;
      const readOnlyHint = annotations?.readOnlyHint === true;

      if (!READ_ONLY_TOOLS.has(name)) {
        console.error(`[meo read-only] skip (not allowlisted): ${name}`);
        return undefined;
      }
      if (!readOnlyHint) {
        console.error(
          `[meo read-only] BLOCKED: '${name}' is allowlisted but not annotated readOnlyHint:true — refusing to register.`
        );
        return undefined;
      }
      return bound(name, config, ...rest);
    };
  };

  wrap("registerTool");
  wrap("tool");
  return server;
}
