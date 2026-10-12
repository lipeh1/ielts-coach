import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const storageDir = path.join(process.cwd(), "data");
const storageFile = path.join(storageDir, "study-state.json");
const maxBytes = 2 * 1024 * 1024;
const skills = new Set(["listening", "reading", "writing", "speaking"]);
const bands = new Set(["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"]);
let writes = Promise.resolve();

async function readState() {
  try {
    return JSON.parse(await readFile(storageFile, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidState(value: unknown): value is {
  profile: { targetBand: string; examDate: string; dailyTarget: number };
  logs: { id: string; date: string; minutes: number; skill: string; correct: number; total: number }[];
  mistakes: { id: string; skill: string; question: string; reason: string; date: string; mastered: boolean }[];
  checkIns: string[];
} {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  const profile = state.profile as Record<string, unknown> | undefined;
  if (!profile || !bands.has(String(profile.targetBand)) || ![15, 30, 45, 60, 90].includes(Number(profile.dailyTarget))) return false;
  if (typeof profile.examDate !== "string" || (profile.examDate !== "" && !isDateKey(profile.examDate))) return false;
  if (!Array.isArray(state.logs) || !Array.isArray(state.mistakes) || !Array.isArray(state.checkIns)) return false;
  if (state.logs.some((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const log = entry as Record<string, unknown>;
    return typeof log.id !== "string" || !skills.has(String(log.skill)) || !isDateKey(log.date)
      || !Number.isFinite(log.minutes) || !Number.isFinite(log.correct) || !Number.isFinite(log.total);
  })) return false;
  if (state.mistakes.some((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const mistake = entry as Record<string, unknown>;
    return typeof mistake.id !== "string" || !skills.has(String(mistake.skill)) || !isDateKey(mistake.date)
      || typeof mistake.question !== "string" || typeof mistake.reason !== "string" || typeof mistake.mastered !== "boolean";
  })) return false;
  return state.checkIns.every(isDateKey);
}

export async function GET() {
  try {
    return NextResponse.json({ state: await readState() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Study data could not be read", error);
    return NextResponse.json({ error: "学习数据无法读取，请检查本地 data 目录权限。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return NextResponse.json({ error: "学习数据超过存储限制。" }, { status: 413 });

  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "学习数据格式无效。" }, { status: 400 });
  }
  if (!isValidState(state)) return NextResponse.json({ error: "学习数据字段无效，请刷新页面后重试。" }, { status: 400 });

  const nextWrite = writes.then(async () => {
    await mkdir(storageDir, { recursive: true });
    const temporaryFile = path.join(storageDir, `study-state-${randomUUID()}.tmp`);
    await writeFile(temporaryFile, JSON.stringify(state), "utf8");
    await rename(temporaryFile, storageFile);
  });
  writes = nextWrite.catch(() => undefined);

  try {
    await nextWrite;
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Study data could not be saved", error);
    return NextResponse.json({ error: "学习数据保存失败，请检查本地 data 目录权限。" }, { status: 500 });
  }
}
