# steady · IELTS study

适合在职备考的雅思全流程学习工作台。当前包括目标设置、每日计划、听说读写练习、错题复练、AI 写作批改和学习记录。

## 本地启动

```bash
pnpm install
pnpm dev
```

开发和生产服务默认都运行在 `http://localhost:7500`。Node.js 20.9 或更新版本。

## AI 写作批改

复制 `.env.example` 为 `.env.local`，在服务端配置 OpenAI 兼容接口：

```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=120000
```

`OPENAI_TIMEOUT_MS` 单位为毫秒，默认 120000；推理型模型响应较慢时可适当调大。

重启开发服务后，作文会经由 `/api/feedback` 服务端路由发送给所配置的模型。总分由服务端按四项平均并四舍五入到 0.5；无法在原文中核验的证据会被标记为缺失。报告同时包含逐段润色稿（新增/改写标红、删除线保留原文）和四项历史趋势；历史只记录真实 AI 批改。没有配置 API key 时，接口会返回明确标记的演示反馈，不会伪装成真实 AI 分析。练习分数均为备考参考，不代表官方考试成绩。

## 学习记录

目标、打卡、练习记录和错题只通过 `/api/study` 读写，由 Next.js 服务端保存在 `data/study-state.json`；浏览器不保存学习数据副本。此文件存储适用于单用户本地使用；部署到无持久磁盘或多实例环境前，需要换成共享数据库。AI API key 只应放在 `.env.local`，不要放入浏览器代码或提交到版本控制。

只有成功读取合法学习记录（或确认尚无记录）后才能开始修改和保存。读取失败时页面暂停写入，可点击“重新读取”；初始载入不会自动写回。保存提示以服务端响应为准。`data/` 不纳入 Git，请单独备份学习记录。

## 词汇数据

`src/data/vocabulary.json` 是 Word Atlas 的 B2/C1 子集，共 3,735 个词条，许可为 CC BY 4.0，署名为 “Word Atlas contributors”。重新生成：

```bash
node scripts/fetch-word-atlas.mjs
node scripts/build-vocabulary.mjs
```

`GET /api/vocabulary` 支持 `q`、`cefr`、`topic`、`page`、`pageSize`，传 `id` 返回单个词条：

```bash
curl "http://localhost:7500/api/vocabulary?cefr=B2&topic=education&pageSize=5"
curl "http://localhost:7500/api/vocabulary?id=motivate"
```

## 题库

Task 2 题目保存在 `src/data/questions/task2.json`，每道题带 `type` 标签（观点 / 讨论 / 利弊 / 问题解决 / 双问题）。反馈页按日期轮换当天题目；新增题目只需修改 JSON，不需要改组件。

阅读题库保存在 `src/data/reading/passage-01.json`，当前包含 4 段文章和 13 道题（判断、匹配标题、填空）。

听力题库保存在 `src/data/listening/section-01.json`，包含完整脚本、播放时长与 10 道题。

## 检查

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

端到端测试使用独立端口与模拟学习接口，覆盖读取失败保护、重试恢复、保存和听力判分，不修改本地学习记录。

已安装 Chrome 时，也可跳过浏览器下载，在 PowerShell 中运行：

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
pnpm test:e2e
```

## 实现范围

- 每日计划会根据当前未掌握错题最多的科目优先安排复练。
- 阅读使用一篇完整 Passage + 13 题（T/F/NG、匹配标题、填空），提供逐题解析与错题记录；听力使用完整 Section 2（约 4 分钟脚本 + 10 题），支持练习模式重复收听与考试模式只播一遍，音频由浏览器英文语音合成生成。
- 口语提供 Part 2 题卡、浏览器本地录音与回放；录音只保存在当前页面，不会上传。
- 写作反馈按 TR、CC、LR、GRA 四项输出估分、原文证据和下一步建议。
- 完整计时模考和真实录音转写尚未接入。

视觉规范见 [DESIGN.md](./DESIGN.md)。
