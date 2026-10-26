# 个人知识库与 AnythingLLM、Codex 集成

## 目标

建立一个可以保存多领域知识的个人知识库，内容包括前端开发、Node.js 开发、烹饪技巧和个人实践经验，并让 AI 在遇到问题时基于这些资料回答。

## 推荐的知识库方式

先用 AnythingLLM Desktop 验证流程，后续可以使用 Obsidian 或 Markdown 文件长期积累内容。第一阶段围绕“记录、检索、带来源回答、保存新经验”展开，不急着做复杂知识图谱或模型微调。

建议每篇笔记包含：

- 标题和问题背景
- 适用条件，例如框架版本、运行环境、食材和设备
- 具体步骤、代码或菜谱
- 实际尝试后的结果和调整
- 来源与更新时间

## AnythingLLM 本地运行说明

通过 `brew install --cask anythingllm` 安装的是 AnythingLLM Desktop 本地应用。应用、工作区和本地向量数据可以保存在 Mac 上，但语言模型和 Embedding 模型是否本地运行，取决于配置。使用 OpenAI、Claude 等云端模型时，相关内容会发送到对应服务。

AnythingLLM API 文档地址：

```text
http://localhost:3001/api/docs
```

## Codex 集成方案

AnythingLLM 的 MCP 页面主要用于让 AnythingLLM 调用外部 MCP 工具。为了让 Codex 查询 AnythingLLM，采用一个本地 MCP 桥接层：

```text
Codex → personal-knowledge-mcp → AnythingLLM Developer API → 知识库工作区
```

桥接层使用环境变量连接 AnythingLLM：

```env
ANYTHINGLLM_BASE_URL=http://localhost:3001
ANYTHINGLLM_API_KEY=Developer_API_Key
ANYTHINGLLM_WORKSPACE=工作区slug
```

不要把 API Key 提交到 Git 或公开分享。

## MCP 工具

### ask_personal_knowledge(question)

使用 Query 模式查询个人知识库，返回回答和来源。适合让 Codex 在解决问题前先查询自己的经验。

示例：

```text
请先查询我的个人知识库，再帮我解决这个 Node.js 跨域问题。如果知识库中没有相关经验，请明确说明。
```

### search_personal_knowledge(question)

根据问题或关键词检索知识库，返回匹配的来源和片段。

### save_personal_note(title, content, source?, tags?)

将新的解决方案、踩坑记录或经验整理成 Markdown，上传并嵌入指定 AnythingLLM 工作区。

## 已实现的本地桥接项目

项目目录：

```text
/Users/fanghaoming/Documents/Codex/2026-10-26/s-d-f
```

主要文件：

- `src/index.js`：MCP Server 实现
- `.env.example`：环境变量模板
- `README.md`：安装、配置和 Codex MCP 配置说明

启动方式：

```bash
cd /Users/fanghaoming/Documents/Codex/2026-10-26/s-d-f
npm install
npm start
```

Codex 配置后可以直接调用上述三个工具。MCP 协议启动和工具发现已经验证通过；真实问答需要确保 AnythingLLM 正在运行并且 API Key、工作区 slug 和端口正确。

## 使用原则

- 有依据时引用笔记来源。
- 没有相关笔记时明确说明资料不足。
- 区分个人经验和 AI 的通用补充建议。
- 修改或删除笔记后确认索引已更新。
- 先用 5～10 篇真实笔记验证检索质量，再批量导入资料。
