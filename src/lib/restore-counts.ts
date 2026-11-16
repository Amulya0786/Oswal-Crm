export type CountMismatch = { table: string; actual: number; expected: number };

export function compareCounts(actual: Record<string, number>, expected: Record<string, number>): CountMismatch[] {
  const mismatches: CountMismatch[] = [];
  for (const [table, expectedCount] of Object.entries(expected)) {
    const got = actual[table];
    if (got !== expectedCount) mismatches.push({ table, actual: got ?? -1, expected: expectedCount });
  }
  return mismatches;
}
