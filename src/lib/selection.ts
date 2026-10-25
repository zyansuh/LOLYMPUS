export const MAX_PARTICIPANTS = 30
export const MIN_PARTICIPANTS = 2

export function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const values = new Set(left)
  if (values.size !== left.length) return false
  return right.every((id) => values.has(id))
}

export function toggleSelected(
  selectedIds: readonly string[],
  id: string,
): { selectedIds: string[]; limited: boolean } {
  if (selectedIds.includes(id)) {
    return { selectedIds: selectedIds.filter((selectedId) => selectedId !== id), limited: false }
  }
  if (selectedIds.length >= MAX_PARTICIPANTS) {
    return { selectedIds: [...selectedIds], limited: true }
  }
  return { selectedIds: [...selectedIds, id], limited: false }
}

export function selectAllIds(memberIds: readonly string[]): string[] | null {
  if (memberIds.length > MAX_PARTICIPANTS) return null
  return [...memberIds]
}
