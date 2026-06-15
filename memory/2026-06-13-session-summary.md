---
name: 2026-06-13-session-summary
description: Today's complete work log — V1-V3 system built, content generated, eyes installed. Handoff for next AI.
metadata:
  type: project
  date: 2026-06-13
  status: NVDA content ready to publish
---

# 2026-06-13 会话总结

## 今日完成

### 1. 核心系统搭建 (V2 → V3 → V1 Unified)

| 文件 | 作用 |
|------|------|
| `core/factLayer.ts` | 事实层 — 所有数据必须带 source，禁止 AI 来源 |
| `core/analysisLayer.ts` | 分析层 — 多空分析仅基于 facts |
| `core/promptEngine.ts` | Prompt 引擎 — 统一管理，注入反幻觉规则 |
| `core/validator.ts` | 校验器 — 数字溯源 + 财务声明校验，三段输出(valid/warning/reject) |
| `core/retryPipeline.ts` | V3 重试管道 — reject 自动重跑最多3次 |
| `core/pipeline.ts` | 主编排器 — runPipeline() 端到端 |
| `core/strongSignalExtractor.ts` | 强信号提取 — dailyReport.json → 高质量 Signal |
| `core/normalizer.ts` | 多源信号归一化 — 去重/提取ticker/跨源匹配 |
| `core/scoringEngine.ts` | 爆点评分 — 4维评分(情绪冲突30+传播性25+资金影响25+多源共振20)，强信号加权 |
| `core/ranker.ts` | 选题排名 — ticker聚合 → Top 1-3 |
| `core/posterTemplate.ts` | 高CTR P1模板 — metaPoster.js 验证的 Bloomberg×小红书 黑金封面 |
| `core/dataCollector/` | 多源采集 — news/video/social, 统一 Signal 类型 |
| `core/index.ts` | 统一 barrel export |

### 2. 流水线改造

- `src/lib/summary.ts` — 接入 promptEngine + validator + retryPipeline
- `src/types/index.ts` — 新增 AISummaryV2Meta
- `scripts/generate-posts.js` — 自动调用 buildPremiumSlideSet (有 metrics 时)
- `scripts/ctrOptimizer.js` — 新增 buildPremiumP1/buildPremiumSlideSet + 人物图自动匹配
- `scripts/screenshotService.js` — 支持 per-slide viewport，DPI 提升到 3x
- `tsconfig.json` — 新增 @/core 路径映射

### 3. 视觉能力

- `scripts/visualInspector.js` — 读取海报 HTML，分析字号/间距/对比度/留白
- `scripts/eyeScanner.js` — 扫描桌面 "claude的眼睛" 文件夹，支持 xlsx/csv/txt/json + OCR (tesseract.js)
- `scripts/deepImageScan.js` — 像素级截图分析 (色彩分布/文字密度/人物区域检测)
- 桌面文件夹 `C:\Users\Shenbo\Desktop\claude的眼睛\` — 投喂口

### 4. CEO 人物照片 (covers/)

所有 7 只股票的人物照片已就绪 (Wikipedia 实拍):
- `aapl.jpg` Tim Cook 363KB
- `nvda.jpg` Jensen Huang 447KB
- `tsla.jpg` Elon Musk 6.3MB
- `msft.jpg` Satya Nadella 3.5MB
- `amzn.jpg` Jeff Bezos 492KB
- `googl.jpg` Sundar Pichai 4.3MB
- `meta.jpg` / `zuck.jpg` Mark Zuckerberg 304KB

### 5. 今天生成的内容

- `covers/NVDA_20260613/` — NVDA P1-P4 + caption + comment_strategy
- `covers/*_20260613/` — 其余 6 只自动生成 (premium P1 模板)
- `output/daily/2026-06-13/dailyReport.json` — 今日日报

### 6. 已验证的数据

- 小红书真实数据: `claude的眼睛/作品列表.xlsx` (5条帖子，GOOGL 15k播放最好，META 33评论最多)
- 系统测试: 35弱信号 + 47强信号 → 评分 avg=23, top=59
- 爆款参考: META P1 (metaPoster.js 模板, 30%+ CTR验证)

## 当前系统架构

```
多源采集 (news/video/social) + 强信号 (dailyReport)
  → normalizer (去重/提取/跨源匹配)
    → scoringEngine (4维评分 + 强信号加权)
      → ranker (Top 1-3 选题)
        → factLayer → promptEngine → DeepSeek
          → validator → retryPipeline
            → 输出 (小红书文案 + 黑金海报 P1-P4)
```

## 关键设计原则

1. 事实与AI生成严格分离 (factLayer)
2. 所有 prompt 注入反幻觉规则 (ANTI_HALLUCINATION_RULES)
3. AI 输出必经校验 (validator → retryPipeline)
4. 海报模板已验证 (metaPoster.js / 30%+ CTR)
5. 评分公式基于历史爆款数据 (TSLA CTR 25.7%, MSFT CTR 28.5%)

## 用户偏好

- 内容目标: 小红书涨粉 → 私域咨询 → 投研变现
- 用户喜欢: 价格/估值/涨跌/买卖/风险/机会
- 用户不喜欢: 企业家故事/商业哲学/宏大叙事
- 标题: 问题式 > 陈述式，必须有具体数字
- 评论区: 站队型问题 (持有/减仓/观望)，不是"怎么看"
- P1 封面: 必须有价格/PE/市值 + 人物图 + VS冲突卡
- P2-P4 保持 metaPoster.js 结构

## 下一个 AI 应该知道的

1. **系统已冻结** — 不需要再加模块，重点是验证和发内容
2. **下一步是连续7天发内容**，用真实 CTR 数据反向校准 scoringEngine
3. **NVDA 今天的海报已就绪**，在 `covers/NVDA_20260613/`
4. **自动流水线命令**: `node scripts/dailyPipeline.js` (先生成日报，再生成海报)
5. **眼睛命令**: `node scripts/eyeScanner.js --full` (扫描 claude的眼睛 文件夹)
6. **海报检查**: `node scripts/visualInspector.js TICKER`
7. **系统检测**: `node scripts/quickRank.js` (跑选题排名)
