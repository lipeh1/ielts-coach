import { NextResponse } from "next/server";

type Criterion = { name: string; band: number; observation: string; evidence: string; suggestion: string };

const criteriaNames = ["TR · 任务回应", "CC · 连贯与衔接", "LR · 词汇资源", "GRA · 语法多样性与准确性"];

function demoReport(essay: string) {
  const wordCount = essay.trim().split(/\s+/).filter(Boolean).length;
  return {
    demo: true,
    overallBand: 6,
    criteria: criteriaNames.map((name) => ({
      name,
      band: 6,
      observation: "这是演示结构，尚未调用 AI 分析你的作文。配置服务端模型后会生成对应维度的实际反馈。",
      evidence: essay.trim().slice(0, 110) || "提交作文后，这里会引用你的原文。",
      suggestion: "先明确段落中心句，再用具体理由或例子展开，并检查是否回应题目要求。",
    } satisfies Criterion)),
    nextStep: wordCount < 250 ? `当前约 ${wordCount} 词。先补全论证并达到题目建议的 250 词，再检查段落结构。` : "配置 AI 服务后，可根据你的主要失分点生成针对性的下一次练习。",
  };
}

function parseModelResponse(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as { overallBand?: unknown; criteria?: unknown; nextStep?: unknown };
}

export async function POST(request: Request) {
  let essay: string;
  try {
    const body = await request.json() as { essay?: unknown };
    essay = typeof body.essay === "string" ? body.essay.trim() : "";
  } catch {
    return NextResponse.json({ error: "请求内容无效，请重新提交作文。" }, { status: 400 });
  }

  if (essay.length < 40) return NextResponse.json({ error: "作文内容太短，请至少输入 40 个字符。" }, { status: 400 });
  if (essay.length > 14_000) return NextResponse.json({ error: "作文超过可处理长度，请精简后再提交。" }, { status: 413 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json(demoReport(essay));

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
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
            name: { type: "string" },
            band: { type: "number", minimum: 0, maximum: 9 },
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
            content: "你是一位谨慎的雅思 Academic Writing Task 2 练习教练。按 IELTS 四项标准给出非官方练习估分。不得编造原文证据；每项 evidence 必须是作文中连续、可核验的原文片段；若确实没有合适片段，指出缺失而不伪造。使用简体中文解释，例句保留英文。反馈具体、可执行，不要整篇代写。四项分别为 TR、CC、LR、GRA。JSON 字段 name 应使用“TR · 任务回应”、“CC · 连贯与衔接”、“LR · 词汇资源”、“GRA · 语法多样性与准确性”。",
          },
          { role: "user", content: `请批改下面的 IELTS Writing Task 2 作文。只给估算的练习分数，不声称是官方结果。\n\n${essay}` },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("Writing feedback provider returned an error", response.status, detail.slice(0, 500));
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "AI 服务认证失败，请检查服务端 API 配置。" : "AI 批改服务暂时不可用，请检查服务配置后重试。" }, { status: 502 });
    }

    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI service returned an empty response");
    const parsed = parseModelResponse(content);
    const overallBand = Number(parsed.overallBand);
    const criteria = parsed.criteria;
    if (!Number.isFinite(overallBand) || !Array.isArray(criteria) || criteria.length !== 4 || typeof parsed.nextStep !== "string") {
      throw new Error("AI service returned an invalid feedback structure");
    }
    return NextResponse.json({ demo: false, overallBand, criteria, nextStep: parsed.nextStep });
  } catch (error) {
    console.error("Writing feedback failed", error);
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "AI 批改超时，请稍后重试。" : "未能解析 AI 批改结果，请稍后重试。" }, { status: 502 });
  }
}
