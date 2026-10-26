export function elapsedMinutes(startedAt: number | null, now = Date.now()): number {
  if (startedAt === null || !Number.isFinite(startedAt)) return 1;
  return Math.max(1, Math.round((now - startedAt) / 60_000));
}
