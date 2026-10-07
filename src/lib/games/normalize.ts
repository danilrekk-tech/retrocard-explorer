/**
 * Распознавание названия игры по имени файла и папке.
 * Общий модуль (браузер + сервер), без зависимостей.
 */

const GENERIC_NAME = /^(disc|disk|cd|track|game|rom|image|eboot|boot|main|start|default)[\s_\-.]*\d*$/i;

/** Убирает теги (USA), [!], нумерацию «001 - », версии, подчёркивания. */
export function cleanTitle(raw: string): string {
  let s = raw.replace(/\.[a-z0-9]{1,4}$/i, "");
  s = s.replace(/[_]+/g, " ");
  if (!/\s/.test(s) && /\./.test(s)) s = s.replace(/\./g, " ");
  s = s.replace(/\s*[([{][^)\]}]*[)\]}]/g, " ");
  s = s.replace(/^\s*\d{1,4}\s*[-.)_]\s+/, "");
  s = s.replace(/\b(v\d+(\.\d+)*|rev\s*[a-z0-9]+|beta\s*\d*|proto|hack|disc\s*\d+|cd\s*\d+)\b/gi, " ");
  s = s.replace(/\s+-\s*$/, "");
  s = s.replace(/^(.*), (The|A|An)$/i, "$2 $1");
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Название игры с учётом папки игры (Disc 1.bin, track01.bin, EBOOT.PBP …). */
export function titleFromPath(fileName: string, path?: string | null): string {
  const base = cleanTitle(fileName);
  if (base && !GENERIC_NAME.test(base) && !/^\d+$/.test(base)) return base;
  const parts = (path ?? "").split(/[\\/]/).filter(Boolean);
  parts.pop();
  for (let i = parts.length - 1; i >= 0; i--) {
    const c = cleanTitle(parts[i]!);
    if (c && !GENERIC_NAME.test(c) && c.length > 1) return c;
  }
  return base || fileName;
}

/** Ключ для сравнения: нижний регистр, без артиклей и знаков. */
export function normKey(s: string): string {
  return cleanTitle(s)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/[ё]/g, "е")
    .replace(/[^a-z0-9а-я]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
function tokens(s: string) {
  return normKey(s)
    .split(" ")
    .filter(Boolean)
    .map((t) => ROMAN[t] ?? t);
}

/** Похожесть 0..1 (токены + префикс). */
export function similarity(a: string, b: string): number {
  const ka = tokens(a);
  const kb = tokens(b);
  if (!ka.length || !kb.length) return 0;
  if (ka.join(" ") === kb.join(" ")) return 1;
  const sa = new Set(ka);
  const sb = new Set(kb);
  let inter = 0;
  sa.forEach((t) => sb.has(t) && inter++);
  const jac = inter / (sa.size + sb.size - inter);
  // все слова короткого названия входят в длинное — сильный сигнал
  const [small, big] = sa.size <= sb.size ? [sa, sb] : [sb, sa];
  let covered = 0;
  small.forEach((t) => big.has(t) && covered++);
  const cover = covered / small.size;
  // цифры (номер части) должны совпадать
  const numsA = ka.filter((t) => /^\d+$/.test(t)).join();
  const numsB = kb.filter((t) => /^\d+$/.test(t)).join();
  const numPenalty = numsA !== numsB ? 0.25 : 0;
  return Math.max(0, Math.max(jac, cover * 0.85) - numPenalty);
}
