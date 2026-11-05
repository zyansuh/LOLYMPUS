const nameCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })

function scriptRank(name: string): number {
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 32) continue
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f)
    ) {
      return 0
    }
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 1
    if (code >= 48 && code <= 57) return 2
    return 3
  }
  return 3
}

export function compareNames(left: string, right: string): number {
  const rank = scriptRank(left) - scriptRank(right)
  if (rank !== 0) return rank
  const compared = nameCollator.compare(left, right)
  if (compared !== 0) return compared
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return items.toSorted((left, right) => compareNames(left.name, right.name))
}
