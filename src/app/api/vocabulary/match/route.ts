import { NextResponse } from "next/server";
import { vocabularyWordList } from "@/lib/vocabulary-data";
import { matchVocabularyInText } from "@/lib/vocabulary-match";

export async function POST(request: Request) {
  let body: { text?: unknown; limit?: unknown };
  try {
    body = await request.json() as { text?: unknown; limit?: unknown };
  } catch {
    return NextResponse.json({ error: "请求内容无效。" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ words: [] });
  if (text.length > 6_000) return NextResponse.json({ error: "文本过长。" }, { status: 400 });

  const requestedLimit = typeof body.limit === "number" ? body.limit : 5;
  const limit = Math.min(10, Math.max(1, Math.trunc(requestedLimit)));
  return NextResponse.json({ words: matchVocabularyInText(text, vocabularyWordList(), limit) });
}
