/**
 * Minimal duration parser: converts strings like "15m", "7d", "30s", "24h" to
 * milliseconds. Avoids pulling in the `ms` package for one job. Plain numbers
 * are treated as milliseconds.
 */
const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export function ms(input: string | number): number {
  if (typeof input === 'number') return input;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}"`);
  const value = parseFloat(match[1]!);
  const unit = match[2] ?? 'ms';
  return Math.round(value * UNIT_MS[unit]!);
}
