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
```

重启开发服务后，作文会经由 `/api/feedback` 服务端路由发送给所配置的模型。没有配置 API key 时，接口会返回明确标记的演示反馈，不会伪装成真实 AI 分析。练习分数均为备考参考，不代表官方考试成绩。

## 学习记录

目标、打卡、练习记录和错题只通过 `/api/study` 读写，由 Next.js 服务端保存在 `data/study-state.json`；浏览器不保存学习数据副本。此文件存储适用于单用户本地使用；部署到无持久磁盘或多实例环境前，需要换成共享数据库。AI API key 只应放在 `.env.local`，不要放入浏览器代码或提交到版本控制。

## 实现范围

- 每日计划会根据当前未掌握错题最多的科目优先安排复练。
- 阅读与听力练习包含答案反馈；听力材料使用浏览器英文语音合成，作为交互示例。
- 口语提供 Part 2 题卡与练习记录入口。
- 写作反馈按 TR、CC、LR、GRA 四项输出估分、原文证据和下一步建议。
- 完整计时模考和真实录音转写尚未接入。

视觉规范见 [DESIGN.md](./DESIGN.md)。
