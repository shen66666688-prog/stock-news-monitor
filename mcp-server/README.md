# Stock News Monitor MCP Server

## 本地使用

```bash
# stdio 模式（Claude Code / Cursor 可用）
npm run mcp

# HTTP 模式（调试用）
npm run mcp-http
```

## 在 Coze 扣子中配置

1. 把 MCP Server 部署到公网（Vercel / Railway / 你自己的服务器）
2. 打开扣子 → Bot 编辑器 → 插件 → 添加 MCP Server
3. 填写 URL：`https://你的域名/sse`
4. 工具自动加载，Bot 即可调用

## 提供的 5 个工具

| 工具 | 功能 |
|------|------|
| `get_stock_quote` | 获取美股实时行情 |
| `verify_fact` | 检验事实来源合规（禁止 AI 来源） |
| `validate_ai_text` | 扫描 AI 文本是否捏造数字 |
| `build_fact_sheet` | 构建可溯源的 FactSheet |
| `scan_for_fake_numbers` | 批量标记无来源的数字 |
