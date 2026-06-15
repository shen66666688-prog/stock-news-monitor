# 项目速览

**stock-news-monitor** — 面向小红书/抖音的中文美股 AI 投研内容工厂。

> ⚠️ 如果你是另一个 AI：读完本文后，请立即读 `INTEGRATION_REPORT.md` 和 `memory/` 下的最新交接文档。本项目完整路径：`C:\Users\Shenbo\stock-news-monitor`。

## 一句话
Yahoo Finance 数据 → DeepSeek AI 分析 → 自动生成投研帖子+海报 → 中文社交平台发布。

## 架构
```
多源采集 → 标准化 → 评分排序 → 事实表 → Prompt引擎 → AI生成 → 校验 → 输出(小红书/抖音/海报)
```

## 目录速查

| 目录 | 说明 |
|------|------|
| `core/` | AI 内容工厂核心流水线（入口：`core/index.ts`） |
| `scripts/` | 发帖、日报生成、CTR优化、截图、视觉检测 |
| `src/app/` | Next.js 16 前端 + API 路由 |
| `src/lib/` | stocks(行情)、news(新闻)、summary(AI总结) |
| `src/components/` | Navbar、SearchBar、StockCard |
| `covers/` | 已生成的7只股票海报数据（AAPL/NVDA/META/TSLA/GOOGL/AMZN/MSFT） |
| `memory/` | 历史会话交接文档（新 AI 必读） |
| `output/` | 运行产出（metrics、小红书/知乎文案） |
| `market-validation/` | 市场分析、案例研究 |

## 技术栈
Next.js 16 / React 19 / TypeScript 5 / Tailwind 4 / Yahoo Finance API / DeepSeek API / Puppeteer / Canvas / Tesseract.js

## 常用命令
- `npm run dev` — 启动前端 (localhost:3000)
- `npm run daily-pipeline` — 日报→发帖→海报 全流程
- `npm run generate-posts` — 一键生成投研帖子
- `npm run daily-report` — 仅生成日报 JSON+TXT
- `node scripts/eyeScanner.js --full` — 扫描桌面投喂文件夹
- `node scripts/visualInspector.js TICKER` — 检查某只股票海报
- `node scripts/quickRank.js` — 跑选题排名

## 关键文件
- 核心流水线入口: `core/index.ts`
- 数据流整合: `INTEGRATION_REPORT.md`
- 前端首页: `src/app/page.tsx`
- 股票详情页: `src/app/stock/[symbol]/page.tsx`
- 发帖脚本: `scripts/generate-posts.js`
- 环境变量: `.env.local`（含 API Key，勿提交）

## 核心设计
- **防幻觉**: promptEngine 内置规则 + validator 三段校验 + retryPipeline 重试
- **数据复用**: 日报 JSON 直接注入 P1-P4 幻灯片，避免重复调 AI
- **CTR 驱动**: 基于真实发布数据（GOOGL 15k播放/30%+ CTR）校准评分
- **7只美股**: AAPL/NVDA/TSLA/GOOGL/META/AMZN/MSFT

## 新 AI 快速上手
1. 先读本文 → 再读 `INTEGRATION_REPORT.md` → 再读 `memory/` 下最新交接文档
2. 理解 `core/pipeline.ts` 的 `runPipeline()` 主入口
3. 跑 `npm run daily-pipeline` 看完整流程
