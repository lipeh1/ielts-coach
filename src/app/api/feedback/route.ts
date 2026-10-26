import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  calculateOverallBand,
  countWords,
  criterionNames,
  validateFeedback,
  type FeedbackCriterion,
  type FeedbackReport,
} from "@/lib/feedback";

function createSubmissionId(essay: string) {
  const normalized = essay.replace(/\s+/g, " ").trim();
  return `writing-${createHash("sha256").update(normalized).digest("hex").slice(0, 24)}`;
}

function demoReport(essay: string, submissionId: string): FeedbackReport {
  const wordCount = countWords(essay);
  const excerpt = essay.slice(0, 110);
  const criteria = criterionNames.map((name) => ({
    name,
    band: 6,
    observation: "这是演示结构，尚未调用 AI 分析你的作文。配置服务端模型后会生成对应维度的实际反馈。",
    evidence: excerpt,
    evidenceMissing: excerpt.length === 0,
    suggestion: "先明确段落中心句，再用具体理由或例子展开，并检查是否回应题目要求。",
  } satisfies FeedbackCriterion));

  return {
    demo: true,
    submissionId,
    wordCount,
    overallBand: calculateOverallBand(criteria.map((criterion) => criterion.band)),
    criteria,
    nextStep: wordCount < 250
      ? `当前约 ${wordCount} 词。先补全论证并达到题目建议的 250 词，再检查段落结构。`
      : "配置 AI 服务后，可根据你的主要失分点生成针对性的下一次练习。",
  };
}

function parseModelResponse(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as unknown;
}

export async function POST(request: Request) {
  let essay: string;
  let taskPrompt: string;
  try {
    const body = await request.json() as { essay?: unknown; prompt?: unknown };
    essay = typeof body.essay === "string" ? body.essay.trim() : "";
    taskPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return NextResponse.json({ error: "请求内容无效，请重新提交作文。" }, { status: 400 });
  }

  if (essay.length < 40) return NextResponse.json({ error: "作文内容太短，请至少输入 40 个字符。" }, { status: 400 });
  if (essay.length > 14_000) return NextResponse.json({ error: "作文超过可处理长度，请精简后再提交。" }, { status: 413 });
  if (taskPrompt.length > 2_000) return NextResponse.json({ error: "题目内容过长。" }, { status: 400 });

  const submissionId = createSubmissionId(essay);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json(demoReport(essay, submissionId));

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = Math.min(300_000, Math.max(5_000, Number(process.env.OPENAI_TIMEOUT_MS) || 120_000));
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["overallBand", "criteria", "nextStep"],
    properties: {
      overallBand: { type: "number", minimum: 0, maximum: 9 },
      criteria: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "band", "observation", "evidence", "suggestion"],
          properties: {
            name: { type: "string", enum: [...criterionNames] },
            band: { type: "integer", minimum: 0, maximum: 9 },
            observation: { type: "string" },
            evidence: { type: "string" },
            suggestion: { type: "string" },
          },
        },
      },
      nextStep: { type: "string" },
    },
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: { name: "ielts_writing_feedback", strict: true, schema } },
        messages: [
          {
            role: "system",
            content: "你是一位谨慎的雅思 Academic Writing Task 2 练习教练。按 IELTS 四项标准给出非官方练习估分。不得编造原文证据；每项 evidence 必须是作文中连续、可核验的原文片段；若确实没有合适片段，返回空字符串。使用简体中文解释，例句保留英文。反馈具体、可执行，不要整篇代写。四项顺序固定为 TR、CC、LR、GRA，name 必须依次使用“TR · 任务回应”、“CC · 连贯与衔接”、“LR · 词汇资源”、“GRA · 语法多样性与准确性”。每项 band 必须是 0–9 的整数，不要返回小数。overallBand 不会被采用，服务端会根据四项重新计算。评分必须区分“未覆盖题目要求”与“已覆盖但展开较浅”：后者可以降分，但不能描述成缺失。对于 Discuss both views 类题目，必须在 TR 的 observation 中明确说明双方是否都给出了理由；如果任一方完全没有理由，必须指出“另一方理由缺失”，并将 TR 最高压到 5 分。不得虚构具体数据、年份、机构、政策或人物姓名；需要举例时使用通用、可核验的日常情境。作文明显不足 250 词时可以指出篇幅限制了论证展开，但不要仅因字数扣分。",
          },
          { role: "user", content: `题目：${taskPrompt || "未提供题目"}\n\n请批改下面的 IELTS Writing Task 2 作文。只给估算的练习分数，不声称是官方结果。\n\n${essay}` },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Writing feedback provider returned an error", response.status, detail.slice(0, 500));
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "AI 服务认证失败，请检查服务端 API 配置。" : "AI 批改服务暂时不可用，请检查服务配置后重试。" }, { status: 502 });
    }

    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI service returned an empty response");
    const feedback = validateFeedback(parseModelResponse(content), essay);
    return NextResponse.json({
      demo: false,
      submissionId,
      wordCount: countWords(essay),
      ...feedback,
    });
  } catch (error) {
    console.error("Writing feedback failed", error);
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "AI 批改超时，请稍后重试。" : "未能解析 AI 批改结果，请稍后重试。" }, { status: 502 });
  }
}
