import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { join } from "path";

function sendMcpRequest(request: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [join(process.cwd(), "dist/index.js")], {
      env: { ...process.env, META_ACCESS_TOKEN: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let resolved = false;
    let stdout = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === (request as any).id) {
            resolved = true;
            proc.kill();
            resolve(parsed);
            return;
          }
        } catch {
          /* not yet complete */
        }
      }
    });

    proc.stderr.on("data", () => {
      /* MCP SDK + read-only gate log here; ignore */
    });

    proc.on("error", (err) => {
      if (!resolved) reject(err);
    });

    const init = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });

    proc.stdin.write(init + "\n");

    setTimeout(() => {
      if (resolved || proc.killed) return;
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      proc.stdin.write(JSON.stringify(request) + "\n");
    }, 200);

    setTimeout(() => {
      if (resolved) return;
      proc.kill();
      reject(new Error(`Timeout waiting for response. Got: ${stdout}`));
    }, 10000);
  });
}

// Tools the MEO read-only build must expose.
const EXPECTED_READ_TOOLS = [
  "meta_list_pages",
  "meta_get_page_insights",
  "meta_get_post_insights",
  "meta_list_instagram_accounts",
  "meta_get_instagram_media",
  "meta_get_instagram_media_insights",
  "meta_get_instagram_account_insights",
  "meta_debug_token",
];

// Tools that MUST NOT exist — the whole point of the hardened fork.
// If any of these ever appears, the read-only guarantee is broken.
const FORBIDDEN_WRITE_TOOLS = [
  "meta_create_post",
  "meta_delete_post",
  "meta_update_page",
  "meta_send_page_message",
  "meta_publish_instagram_photo",
  "meta_publish_instagram_reel",
  "meta_delete_instagram_media",
  "meta_reply_instagram_comment",
  "meta_send_instagram_message",
  "meta_create_campaign", // whole ads module removed
  "meta_generate_chart", // charts module removed (external egress)
  "meta_get_instagram_conversations", // DM read intentionally excluded (privacy)
  "meta_get_page_conversations",
];

describe("MEO read-only MCP server", () => {
  it("identifies as meo-insights-mcp", async () => {
    const response = await sendMcpRequest({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });

    expect((response as any).result).toBeDefined();
    expect((response as any).result.serverInfo.name).toBe("meo-insights-mcp");
    expect((response as any).result.capabilities.tools).toBeDefined();
  });

  it("exposes the expected read-only tools and every tool is annotated readOnly", async () => {
    const response = await sendMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });

    const tools = (response as any).result?.tools;
    expect(Array.isArray(tools)).toBe(true);

    const names: string[] = tools.map((t: any) => t.name);
    for (const t of EXPECTED_READ_TOOLS) {
      expect(names).toContain(t);
    }

    // Every exposed tool must carry readOnlyHint:true.
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} must be read-only`).toBe(true);
    }
  });

  it("does NOT expose any write / mutating / removed tool", async () => {
    const response = await sendMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const names: string[] = (response as any).result.tools.map((t: any) => t.name);
    for (const t of FORBIDDEN_WRITE_TOOLS) {
      expect(names, `forbidden tool leaked: ${t}`).not.toContain(t);
    }
  });

  it("returns a helpful error when calling a tool without a token", async () => {
    const response = await sendMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "meta_list_pages", arguments: {} },
    });

    const result = (response as any).result;
    expect(result).toBeDefined();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("META_ACCESS_TOKEN");
  });
});
