# AnythingLLM Personal Knowledge MCP

本地 MCP 桥接服务：让 Codex 通过 MCP 查询和写入 AnythingLLM 工作区。

## 安装

```bash
npm install
cp .env.example .env
```

编辑 `.env`：

```bash
ANYTHINGLLM_BASE_URL=http://localhost:3001
ANYTHINGLLM_API_KEY=你的-Developer-API-Key
ANYTHINGLLM_WORKSPACE=你的工作区-slug
```

## 运行

```bash
ANYTHINGLLM_API_KEY=... ANYTHINGLLM_WORKSPACE=... npm start
```

服务通过 stdio 提供三个 MCP 工具：

- `ask_personal_knowledge(question)`：以 Query 模式回答，并返回来源。
- `search_personal_knowledge(question)`：查询并返回匹配来源/片段。
- `save_personal_note(title, content, source?, tags?)`：上传 Markdown，加入工作区进行嵌入，并自动调用 `update-pin` 固定该文档。

## 在 MCP 客户端中配置

把下面的 server 配置加入 Codex 的 MCP 配置。请使用绝对路径，并通过环境变量传入密钥：

```json
{
  "mcpServers": {
    "anythingllm-personal-knowledge": {
      "command": "node",
      "args": ["/绝对路径/anythingllm-mcp/src/index.js"],
      "env": {
        "ANYTHINGLLM_BASE_URL": "http://localhost:3001",
        "ANYTHINGLLM_API_KEY": "你的-Developer-API-Key",
        "ANYTHINGLLM_WORKSPACE": "你的工作区-slug"
      }
    }
  }
}
```

AnythingLLM 的 API 文档可在本地实例的 `/api/docs` 查看。API key 不要提交到 Git 或分享给其他人。
