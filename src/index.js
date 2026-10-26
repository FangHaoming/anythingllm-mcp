#!/usr/bin/env node

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const baseUrl = (process.env.ANYTHINGLLM_BASE_URL || "http://localhost:3001").replace(/\/$/, "");
const apiKey = process.env.ANYTHINGLLM_API_KEY;
const workspace = process.env.ANYTHINGLLM_WORKSPACE;
const timeoutMs = Number(process.env.ANYTHINGLLM_TIMEOUT_MS || 30000);

if (!apiKey || !workspace) {
  console.error("Missing ANYTHINGLLM_API_KEY or ANYTHINGLLM_WORKSPACE");
  process.exit(1);
}

const toolError = (message, details) => ({
  isError: true,
  content: [{ type: "text", text: details ? `${message}\n${details}` : message }],
});

async function anythingRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw };
    }
    if (!response.ok) {
      throw new Error(`AnythingLLM API ${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function extractSources(result) {
  return result.sources || result.sourceDocuments || result.documents || result.data?.sources || [];
}

const server = new Server(
  { name: "anythingllm-personal-knowledge", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ask_personal_knowledge",
      description: "Ask the configured AnythingLLM workspace. Answers are grounded in the personal knowledge base.",
      inputSchema: {
        type: "object",
        properties: { question: { type: "string", description: "The question to answer." } },
        required: ["question"],
      },
    },
    {
      name: "search_personal_knowledge",
      description: "Search the configured AnythingLLM workspace and return matching excerpts/sources. Provide a question or keywords.",
      inputSchema: {
        type: "object",
        properties: { question: { type: "string", description: "Question or keywords to search for." } },
        required: ["question"],
      },
    },
    {
      name: "save_personal_note",
      description: "Save a Markdown note into the configured AnythingLLM workspace and embed it for future retrieval.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Note title." },
          content: { type: "string", description: "Markdown note content." },
          source: { type: "string", description: "Optional source or URL." },
          tags: { type: "array", items: { type: "string" }, description: "Optional tags." },
        },
        required: ["title", "content"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    if (name === "ask_personal_knowledge") {
      const { question } = z.object({ question: z.string().min(1) }).parse(args);
      const result = await anythingRequest(`/v1/workspace/${encodeURIComponent(workspace)}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: question, mode: "query", sessionId: `mcp-${randomUUID()}` }),
      });
      return textResult({ answer: result.textResponse || result.answer || result.text || result, sources: extractSources(result) });
    }

    if (name === "search_personal_knowledge") {
      const { question } = z.object({ question: z.string().min(1) }).parse(args);
      const result = await anythingRequest(`/v1/workspace/${encodeURIComponent(workspace)}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: question, mode: "query", sessionId: `mcp-search-${randomUUID()}` }),
      });
      return textResult({ query: question, sources: extractSources(result) });
    }

    if (name === "save_personal_note") {
      const input = z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }).parse(args);
      const markdown = `# ${input.title}\n\n${input.content}\n\n${input.source ? `Source: ${input.source}\n` : ""}${input.tags?.length ? `Tags: ${input.tags.join(", ")}\n` : ""}`;
      const form = new FormData();
      form.append("file", new Blob([markdown], { type: "text/markdown" }), `${input.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-")}.md`);
      form.append("addToWorkspaces", workspace);
      form.append("metadata", JSON.stringify({ title: input.title, docSource: input.source || "Codex MCP" }));
      const uploadResult = await anythingRequest("/v1/document/upload", { method: "POST", body: form });
      const uploadedDocument = uploadResult.documents?.[0];
      const docPath = uploadedDocument?.location;
      if (!docPath) {
        throw new Error(`Note uploaded but AnythingLLM did not return a document location: ${JSON.stringify(uploadResult)}`);
      }

      const pinResult = await anythingRequest(`/v1/workspace/${encodeURIComponent(workspace)}/update-pin`, {
        method: "POST",
        body: JSON.stringify({ docPath, pinStatus: true }),
      });
      return textResult({ saved: true, pinned: true, title: input.title, docPath, upload: uploadResult, pin: pinResult });
    }

    return toolError(`Unknown tool: ${name}`);
  } catch (error) {
    return toolError(`Tool ${name} failed`, error instanceof Error ? error.message : String(error));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
