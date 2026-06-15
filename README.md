# Stock News Monitor — AI 投研内容工厂

从 Yahoo Finance 拉数据 → DeepSeek AI 多 Agent 分析 → 自动生成投研海报 → 多平台分发。

**不只跑通了，已经在生产环境中验证了 CTR 30%+ 的内容模板。**

## 一句话

每天自动分析 7 只美股，生成 4 页投研海报 + 发帖文案，发布到小红书和抖音。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Next.js 16 + React 19 + TypeScript 5 + Tailwind 4 |
| 数据 | Yahoo Finance API (yahoo-finance2) |
| AI 分析 | DeepSeek API (via OpenAI SDK) |
| 海报渲染 | Puppeteer + Canvas |
| OCR 质检 | Tesseract.js |
| 流水线编排 | 自研 core/ 多 Agent 系统 |

## 核心架构：多 Agent 协作流水线

```
多源数据采集 → 标准化 → 评分排序 → 事实层校验 → 多空分析 → 内容生成 → 视觉渲染
     │              │          │           │            │           │           │
dataCollector  normalizer  scoringEngine  factLayer  analysisLayer  promptEngine  posterTemplate
                                             │            │                │
                                         validator  retryPipeline    strongSignalExtractor
```

### 每个 Agent 的职责

| Agent | 职责 | 核心规则 |
|-------|------|---------|
| **dataCollector** | 多源采集（新闻/视频/社交） | 统一为 Signal 类型 |
| **normalizer** | 去重、提取 ticker、跨源匹配 | 拒绝无源数据 |
| **scoringEngine** | 4 维评分（情绪冲突 30% + 传播性 5% + 资金影响 25% + 多源共振 20%） | 强信号加权 |
| **ranker** | ticker 聚合 → Top 1-3 选题 | 每日输出最佳标的 |
| **factLayer** | 数据事实层 | **硬规则：禁止 AI 来源，所有数据必须带 source** |
| **analysisLayer** | 多空分析 | 仅基于 facts，不做推测 |
| **promptEngine** | 统一 Prompt 管理 | 注入反幻觉规则 |
| **validator** | 数字溯源 + 财报声明校验 | 三段输出：valid / warning / reject |
| **retryPipeline** | reject 自动重跑 | 最多 3 次 |
| **posterTemplate** | 高 CTR P1 模板 | 已验证 30%+ 点击率 |
| **strongSignalExtractor** | 日报 JSON → 高质量 Signal | 过滤弱信号 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动前端 (localhost:3000)
npm run dev

# 一键生成今日投研帖子 + 海报（7 只股票 × 4 页 = 28 张）
npm run generate-posts

# 生成每日结构化日报（DeepSeek 分析）
npm run daily-report

# 日报 → 发帖全流程
npm run daily-pipeline
```

## 内容生产流水线

```
Yahoo Finance 新闻 (30条/7只股)
  → dailyReportGenerator.js
    → [宏观] DeepSeek 1次 → marketRiskEvents + marketSummary
    → [个股] DeepSeek 7次 → sentiment + keyPoints + risks
    → 输出: dailyReport.json
  → generate-posts.js (日报增强模式)
    → 检测 enrichedStockData → 跳过 API 重复调用
    → buildSlideSet() → 4 页海报
      → P1: 诊断面板（价格 + PE + 市值 + 冲突 VS 卡）
      → P2: 空头逻辑（市场在担心什么）
      → P3: 多头逻辑（为什么还有人坚定看多）
      → P4: 操作指南（信号跟踪 + 投票互动）
  → 渲染 PNG → 发布到小红书/抖音
```

### 各股票专属海报脚本

| 脚本 | 股票 | CTR 验证 |
|------|------|:--:|
| `googlFullPoster.js` | Google | ✅ |
| `metaPoster.js` | Meta | ✅ 30%+ |
| `nvdaFullPoster.js` | NVIDIA | ✅ 27.9% |
| `msftFullPoster.js` | Microsoft | 🆕 |
| `aaplFullPoster.js` | Apple | ✅ |
| `tslaPoster.js` | Tesla | ✅ |
| `amznFullPoster.js`* | Amazon | — |

## 已验证的效果

| 指标 | 数据 |
|------|------|
| 小红书封面 CTR | **27.9%**（NVDA 篇） |
| 抖音单篇最高播放 | **56,495**（NVDA 篇） |
| 抖音 5s 完播率最高 | **19.15%** |
| 验证过的标题公式 | "XX 从 $XX 跌到 $XX，是机会还是陷阱？" |
| META 模板 CTR | **30%+** |

## 反幻觉机制 (Anti-Hallucination)

这套系统最大的工程挑战不是 AI 调用，而是**保证 AI 不编数据**：

1. **factLayer**：所有数据强制带 traceable source，拒绝 AI 来源
2. **validator**：数字反向溯源到财报原文，三段校验（valid/warning/reject）
3. **retryPipeline**：reject 自动重跑，最多 3 次
4. **promptEngine**：注入结构化约束，禁止 AI 自行填充数字

### 真实案例：NVDA 估值数据校验

用户质疑 NVDA 文章的 Forward PE 数据（称应该是 20x 而非 16x）。系统通过 Yahoo Finance API 原始 analyst estimates 反向验证，发现：
- Forward PE 16x = 基于 **FY2028** 一致性 EPS ($12.73) ✅ 数据正确
- 用户看到的 ~20x = 基于 **FY2027** 一致性 EPS ($8.96)
- **结论：数据没错，但不同平台的 Forward PE 用不同财年基准，差异高达 7x**

此案例已被纳入 factLayer + validator 的改进规则。

## 项目结构

```
├── core/                    # AI 内容工厂核心流水线
│   ├── dataCollector/       # 多源数据采集
│   ├── normalizer.ts        # 标准化/去重
│   ├── scoringEngine.ts     # 4 维评分引擎
│   ├── ranker.ts            # 选题排名
│   ├── factLayer.ts         # 事实层校验
│   ├── analysisLayer.ts     # 多空分析
│   ├── promptEngine.ts      # Prompt 统一管理
│   ├── validator.ts         # 数字溯源校验
│   ├── retryPipeline.ts     # 重试管道
│   ├── posterTemplate.ts    # 海报模板
│   ├── strongSignalExtractor.ts  # 强信号提取
│   └── pipeline.ts          # 端到端编排
├── scripts/                 # 执行端脚本
│   ├── generate-posts.js    # 一键发帖
│   ├── dailyPipeline.js     # 日报全流程
│   ├── dailyReportGenerator.js  # 日报生成
│   ├── dataFetcher.js       # Yahoo Finance 数据
│   ├── screenshotService.js # 海报截图
│   ├── ctrOptimizer.js      # CTR 优化
│   ├── *Poster.js           # 各股票海报脚本
│   └── ...
├── src/                     # Next.js 前端
│   ├── app/
│   │   ├── page.tsx         # 首页
│   │   ├── dashboard/       # 数据仪表盘
│   │   └── api/             # API 路由
│   ├── components/          # UI 组件
│   ├── lib/                 # stocks / news / summary
│   └── types/               # TypeScript 类型
├── memory/                  # 项目文档与历史交接
├── covers/                  # 生成的海报 (gitignored)
└── output/                  # 运行产出 (gitignored)
```

## 平台数据

| 指标 | 小红书 | 抖音 |
|------|--------|------|
| 近 30 日曝光 | 86,142 | — |
| 近 30 日观看 | 22,456 | 126,568 |
| 封面 CTR | 26.1% | — |
| 互动率 | 高评论导向 | 高播放导向 |
| 长尾效应 | 强（旧笔记持续涨曝光） | 弱（48h 后断流） |

## 关于我

留学生，AI-native 开发者。这套系统从架构设计、多 Agent 编排、Prompt 工程到前后端实现，均为独立开发。

**Contact:** GitHub Issues

---

**Built with ⚡ by an AI-native developer.** 不只是一个项目，是一套完整的内容生产系统。
