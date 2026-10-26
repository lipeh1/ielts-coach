import { NextResponse } from "next/server";
import { isCefr, isVocabularyTopic } from "@/lib/vocabulary";
import { findVocabularyWord, listVocabulary, vocabularyMeta } from "@/lib/vocabulary-data";

const cacheHeaders = { "Cache-Control": "public, max-age=3600" };

function readInteger(value: string | null, fallback: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id !== null) {
    const word = findVocabularyWord(id);
    if (!word) return NextResponse.json({ error: "未找到该词条。" }, { status: 404 });
    return NextResponse.json({ word }, { headers: cacheHeaders });
  }

  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length > 64) return NextResponse.json({ error: "搜索词不能超过 64 个字符。" }, { status: 400 });

  const cefr = searchParams.get("cefr") ?? undefined;
  if (cefr && !isCefr(cefr)) return NextResponse.json({ error: "cefr 参数无效。" }, { status: 400 });

  const topic = searchParams.get("topic") ?? undefined;
  if (topic && !isVocabularyTopic(topic)) return NextResponse.json({ error: "topic 参数无效。" }, { status: 400 });

  const page = readInteger(searchParams.get("page"), 1);
  const pageSize = readInteger(searchParams.get("pageSize"), 20);
  if (page === null || page < 1) return NextResponse.json({ error: "page 必须为正整数。" }, { status: 400 });
  if (pageSize === null || pageSize < 1 || pageSize > 100) {
    return NextResponse.json({ error: "pageSize 必须在 1 到 100 之间。" }, { status: 400 });
  }

  return NextResponse.json(
    { meta: vocabularyMeta, ...listVocabulary({ q, cefr, topic, page, pageSize }) },
    { headers: cacheHeaders },
  );
}
