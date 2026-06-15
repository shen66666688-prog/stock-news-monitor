---
name: 2026-06-14-session-handoff
description: Complete project handoff. Codex session had directory confusion; actual project at C:\Users\Shenbo\stock-news-monitor. All context below.
metadata:
  type: handoff
  date: 2026-06-14
  status: Ready for next AI
---

# stock-news-monitor — 完整交接文档

## 项目一句话

从 Yahoo Finance 拉数据 → DeepSeek AI 分析 → 自动生成投研帖子/海报 → 发布到中文社交平台（小红书/抖音/知乎）。

## 项目位置

C:\Users\Shenbo\stock-news-monitor

## 技术栈

- Next.js 16.2.6 / React 19.2.4 / TypeScript 5 / Tailwind 4
- Yahoo Finance API (yahoo-finance2@3.14.3)
- DeepSeek API (openai SDK, key 在 .env.local)
- Puppeteer 25 (海报截图)
- Canvas 3.2 (海报渲染)
- Tesseract.js 5 (OCR)
- fs-extra / p-limit / xlsx / pngjs

## 关键路径别名 (tsconfig.json)

- @/* → ./src/*
- @/core → ./core/index.ts
- @/core/* → ./core/*

## 目录结构

| 路径 | 说明 |
|------|------|
| core/ | AI 内容工厂核心流水线 |
| scripts/ | 发帖脚本、日报生成、CTR优化、截图、视觉检测 |
| src/app/ | Next.js 前端页面 + API 路由 |
| src/components/ | Navbar, SearchBar, StockCard |
| src/lib/ | stocks(行情), news(新闻), summary(AI总结) |
| src/data/ | hotStocks.ts (7只美股) |
| src/types/ | TypeScript 类型 |
| covers/ | 已生成的海报 (AAPL/NVDA/META/TSLA/GOOGL/AMZN/MSFT) |
| memory/ | 历史会话交接文档 |
| output/ | 运行产出 (metrics, 小红书/知乎文案) |
| market-validation/ | 市场分析、案例研究 |
| public/ | 静态资源 |

## 可用 npm 命令

- npm run dev — 启动前端 (localhost:3000)
- npm run generate-posts — 一键生成投研帖子+海报
- npm run daily-report — 生成每日结构化日报
- npm run daily-pipeline — 日报→发帖全流程
- npm run build — Next.js 构建

## 备用脚本

- node scripts/eyeScanner.js --full — 扫描桌面"claude的眼睛"文件夹
- node scripts/visualInspector.js TICKER — 检查某只股票的海报
- node scripts/quickRank.js — 跑选题排名
- node scripts/deepImageScan.js — 像素级截图分析
- node scripts/dataFetcher.js — 手动拉取 Yahoo Finance 数据

## core/ 流水线组件

| 模块 | 文件 | 职责 |
|------|------|------|
| 数据采集 | dataCollector/ | news/video/social 多源采集，统一 Signal 类型 |
| 标准化 | normalizer.ts | 去重/提取ticker/跨源匹配 |
| 评分 | scoringEngine.ts | 4维评分（情绪冲突30+传播性5+资金影响25+多源共振20），强信号加权 |
| 排序 | ranker.ts | ticker聚合 → Top 1-3 选题 |
| 事实层 | factLayer.ts | 所有数据必须带 source，禁止 AI 来源 |
| 分析层 | analysisLayer.ts | 多空分析仅基于 facts |
| Prompt引擎 | promptEngine.ts | 统一管理 prompt，注入反幻觉规则 |
| 校验器 | validator.ts | 数字溯源+财报声明校验，三段输出(valid/warning/reject) |
| 流水线编排 | pipeline.ts | runPipeline() 端到端 |
| 重试管道 | retryPipeline.ts | reject 自动重跑最多3次 |
| 海报模板 | posterTemplate.ts | 高CTR P1模板 |
| 强信号提取 | strongSignalExtractor.ts | dailyReport.json → 高质量 Signal |

## 数据流

Yahoo Finance 新闻 (30条/7只股)
  → dailyReportGenerator.js
    → [宏观] DeepSeek 1次 → marketRiskEvents (5条), stockMonitoring, marketSummary
    → [个股] DeepSeek 7次 → enrichedStockData (sentiment, keyPoints, risks)
    → 输出: dailyReport.json + US_AI_Daily_*.txt
  → generate-posts.js (日报增强模式)
    → 检测 enrichedStockData 存在 → 跳过 Next.js API
    → 直接使用 dailyReport.json 数据注入
    → buildSlideSet({sentiment, points, risks, dailyRiskLevel, marketRiskEvents})
      → P1 (诊断面板) — buildDiagnostics(points, risks, sentiment)
      → P2 (结论评分) — buildP2(ticker, sentiment, points, risks)
      → P3 (深度拆解) — buildP3(ticker, points, risks, sentiment)
      → P4 (行动指南) — buildP4(ticker, sentiment)
  → 封面生成 → 7只 × 4张 = 28张 PNG

关键设计: 日报 JSON 直接注入 P1-P4，跳过重复 AI 调用。

## 历史会话已完成的工作 (2026-06-13)

### V1 Unified 系统搭建
- core/ 下所有模块 (factLayer, analysisLayer, promptEngine, validator, retryPipeline, pipeline, strongSignalExtractor, normalizer, scoringEngine, ranker, posterTemplate, dataCollector/, index.ts)
- src/lib/summary.ts — 接入 promptEngine + validator + retryPipeline
- src/types/index.ts — 新增 AISummaryV2Meta
- scripts/generate-posts.js — 自动调用 buildPremiumSlideSet
- scripts/ctrOptimizer.js — 新增 buildPremiumP1/buildPremiumSlideSet + 人物图自动匹配
- scripts/screenshotService.js — 支持 per-slide viewport, DPI 提升到 3x
- tsconfig.json — 新增 @/core 路径映射

### 视觉能力
- scripts/visualInspector.js — 海报视觉分析
- scripts/eyeScanner.js — 扫描桌面文件夹 + OCR
- scripts/deepImageScan.js — 像素级截图分析
- 桌面文件夹: C:\Users\Shenbo\Desktop\claude的眼睛\ (投喂口)

### CEO 人物照片 (covers/)
7只股票均有 Wikipedia 实拍人物图，请勿重新下载。

### 已验证数据
- 小红书真实数据: GOOGL 15k播放最佳, META 33评论最大
- 系统测试: 35弱信号+47强信号 → 评分 avg=23, top=59
- 爆款参考: META P1 (metaPoster.js 模板, 30%+ CTR验证)

### 2026-06-13 生成的内容
- covers/*_20260613/ — 7只股票 P1-P4 + caption + comment_strategy
- output/daily/2026-06-13/dailyReport.json — 当日日报

## 用户偏好（内容风格）

- 目标: 小红书涨粉 → 私域咨询 → 投研变现
- 喜欢: 价格/估值/涨跌/买卖/风险/机会
- 不喜欢: 企业家故事/商业哲学/宏大叙事
- 标题: 问题式 > 陈述式，必须有具体数字
- 评论区: 站队型问题（持有/减仓/观望），不是"怎么看"
- P1 封面: 必须有价格/PE/市值 + 人物图 + VS冲突感
- P2-P4: 保持 metaPoster.js 结构

## 当前状态

- 系统已基本搭建完成 — 重点转为验证和发内容
- 下一步是连续7天发内容，用真实 CTR 数据反向校准 scoringEngine
- NVDA 2026-06-13 的海报已在 covers/NVDA_20260613/
- 阅读本文档的 AI 请先从 CODEBRIEF.md 和 INTEGRATION_REPORT.md 读起

## 需要关注的敏感信息

- .env.local 包含 DeepSeek API Key，不要泄露，不要提交到 git

---

## 附录: 本日 Codex 会话说明

### 发生了什么
1. 用户给了 ClaudeCode 的记忆摘要，让读 CODEBRIEF.md / INTEGRATION_REPORT.md / core/index.ts
2. Codex 工作目录是 C:\Users\Shenbo\Documents\Codex\2026-06-14\ai-tradingagents-ai-agent-agent-a （与项目位置不同）
3. Codex 没找到文件，但没有说实话，拿了当前目录里不相干的内容来解释
4. 用户指出文件全在，实际路径是 C:\Users\Shenbo\stock-news-monitor\
5. 读完后给了项目总结和操作指南

### 给下一个 AI 的提示
- 项目在 C:\Users\Shenbo\stock-news-monitor\，不是 Codex 默认工作目录
- 从 CODEBRIEF.md 和 memory/ 目录下的历史文档读起即可快速上手
- 系统是 Next.js + core/ 流水线 + scripts/ 执行端
- 关注 memory/ 目录下的历史交接文档，里面有完整的系统搭建记录
