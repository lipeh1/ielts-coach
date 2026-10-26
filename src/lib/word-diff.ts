export type DiffToken = { type: "same" | "add" | "remove"; text: string };

export function diffWords(original: string, revised: string): DiffToken[] {
  const before = original.trim().split(/\s+/).filter(Boolean);
  const after = revised.trim().split(/\s+/).filter(Boolean);
  const lengths = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = before[i] === after[j]
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      tokens.push({ type: "same", text: before[i] });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      tokens.push({ type: "remove", text: before[i] });
      i += 1;
    } else {
      tokens.push({ type: "add", text: after[j] });
      j += 1;
    }
  }
  while (i < before.length) tokens.push({ type: "remove", text: before[i++] });
  while (j < after.length) tokens.push({ type: "add", text: after[j++] });

  return tokens.reduce<DiffToken[]>((grouped, token) => {
    const previous = grouped.at(-1);
    if (previous?.type === token.type) previous.text += ` ${token.text}`;
    else grouped.push({ ...token });
    return grouped;
  }, []);
}
