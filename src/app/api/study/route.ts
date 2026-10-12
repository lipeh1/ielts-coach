import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isValidState } from "@/lib/study-data";

const storageDir = path.join(process.cwd(), "data");
const storageFile = path.join(storageDir, "study-state.json");
const maxBytes = 2 * 1024 * 1024;
let writes = Promise.resolve();

async function readState() {
  try {
    const state = JSON.parse(await readFile(storageFile, "utf8")) as unknown;
    if (!isValidState(state)) throw new Error("Stored study data has invalid fields");
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json({ state }, { headers: { "Cache-Control": "no-store" } });
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
