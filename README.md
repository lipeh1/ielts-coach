# steady · IELTS study

[![CI](https://github.com/lipeh1/ielts-coach/actions/workflows/ci.yml/badge.svg)](https://github.com/lipeh1/ielts-coach/actions/workflows/ci.yml)

适合在职备考的雅思全流程学习工作台。当前包括目标设置、每日计划、听说读写练习、错题复练、AI 写作批改和学习记录。

## 本地启动

```bash
pnpm install
pnpm dev
```

开发和生产服务默认都运行在 `http://localhost:7500`。需要 Node.js 22.13 或更新版本（pnpm 11 的要求）。

## AI 写作批改

复制 `.env.example` 为 `.env.local`，在服务端配置 OpenAI 兼容接口：

```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=180000
```

`OPENAI_TIMEOUT_MS` 单位为毫秒，默认 180000；推理型模型响应较慢时可适当调大。

重启开发服务后，作文会经由 `/api/feedback` 服务端路由发送给所配置的模型。总分由服务端按四项平均并四舍五入到 0.5；无法在原文中核验的证据会被标记为缺失。报告同时包含逐段润色稿（新增/改写标红、删除线保留原文）和四项历史趋势；历史只记录真实 AI 批改。没有配置 API key 时，接口会返回明确标记的演示反馈，不会伪装成真实 AI 分析。练习分数均为备考参考，不代表官方考试成绩。

## 学习记录

目标、打卡、练习记录和错题只通过 `/api/study` 读写，由 Next.js 服务端保存在 `data/study-state.json`；浏览器不保存学习数据副本。此文件存储适用于单用户本地使用；部署到无持久磁盘或多实例环境前，需要换成共享数据库。AI API key 只应放在 `.env.local`，不要放入浏览器代码或提交到版本控制。

只有成功读取合法学习记录（或确认尚无记录）后才能开始修改和保存。读取失败时页面暂停写入，可点击“重新读取”；初始载入不会自动写回。保存提示以服务端响应为准。`data/` 不纳入 Git，请单独备份学习记录。

## 听力真人录音

默认使用浏览器英文语音合成。换成真人录音：

1. 把录制好的 MP3 放到 `public/audio/listening/section-01.mp3`
2. 把 `src/data/listening/section-01.json` 的 `audioFile` 改成 `/audio/listening/section-01.mp3`
3. 重启服务

录音文本在 `section-01.json` 的 `script` 字段；考试模式的「只播一遍」对真人录音同样生效。请使用自己录制或获得授权的音频。

## 手机访问与录音

电脑和手机在同一局域网时，用本地 CA 启动 HTTPS：

```bash
pnpm dev:https
```

首次运行会在 `.cert/` 生成本地 CA 和服务器证书，并打印手机访问地址。把 `.cert/rootCA.pem` 安装为手机信任的 CA：

- iOS：通过 AirDrop/邮件安装证书 → 设置 → 通用 → 关于本机 → 证书信任设置 → 开启完全信任
- Android：设置 → 安全 → 加密与凭据 → 安装证书 → CA 证书

然后手机打开 `https://<电脑局域网 IP>:7500`。如果电脑局域网 IP 变化，运行 `node scripts/generate-dev-cert.mjs --force` 重新生成证书，并在手机上重新信任新的 CA。确保 Windows 防火墙允许 7500 端口。

麦克风录音只在 HTTPS 或 localhost 下可用，`http://192.168.x.x:7500` 不会允许录音。`.cert/` 包含私钥，已加入 `.gitignore`，不要提交。`dev:https` 仅用于个人开发和使用；正式部署请使用受信任证书的反向代理。

## 数据备份

设置 → 目标与设置 → 导出备份，会下载当前学习记录的 JSON 快照。恢复时停止服务，用备份文件替换 `data/study-state.json` 后重启。备份包含目标、练习记录、错题、批改历史和词汇复习，不包含录音或 API key。

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
- 阅读使用一篇完整 Passage + 13 题（T/F/NG、匹配标题、填空），提供逐题解析与错题记录；听力使用完整 Section 2（约 4 分钟脚本 + 10 题），支持练习模式重复收听与考试模式只播一遍；音频默认由浏览器英文语音合成生成，也可替换为 `public/audio` 下的真人录音。
- 口语提供 Part 2 题卡、浏览器本地录音与回放，并支持浏览器实时转写；录音保存在当前页面，转写是否上传由浏览器语音服务决定，不保存到学习数据。
- 写作反馈按 TR、CC、LR、GRA 四项输出估分、原文证据和下一步建议。
- 词汇：B2/C1 词库搜索与浏览，简化 SM-2 间隔重复复习，复习记录写入学习数据。写作反馈、阅读和听力错题中匹配到的词库单词会自动加入复习，按词形做简单还原；写作中疑似拼错的词会累计出现次数，连续两次后自动加入复习。
- 练习记录使用实际用时；完整计时模考尚未接入。口语转写使用浏览器语音服务，不保存到学习数据。

视觉规范见 [DESIGN.md](./DESIGN.md)。
