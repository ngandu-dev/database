import type { CallToolResult } from "@modelcontextprotocol/server";

import { safeErrorMessage } from "../redact";

export async function callTool(
  operation: () => Promise<Record<string, unknown>>,
  secrets: string[],
): Promise<CallToolResult> {
  try {
    const output = await operation();
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
      structuredContent: output,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: safeErrorMessage(error, secrets) }],
      isError: true,
    };
  }
}
