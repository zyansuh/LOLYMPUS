import type { Assignment } from '../types.ts'

export function teamSignature(memberIds: readonly string[]): string {
  return [...memberIds].sort().join('\u0001')
}

export function compositionKey(teams: readonly (readonly string[])[]): string {
  return teams.map((team) => teamSignature(team)).sort().join('\u0002')
}

export function compositionsEqual(
  left: readonly (readonly string[])[],
  right: readonly (readonly string[])[],
): boolean {
  return compositionKey(left) === compositionKey(right)
}

export function countIntactTeams(
  current: readonly (readonly string[])[],
  previous: readonly (readonly string[])[],
): number {
  const previousSignatures = new Set(previous.map((team) => teamSignature(team)))
  return current.filter((team) => previousSignatures.has(teamSignature(team))).length
}

export function teamGroups(assignments: readonly Assignment[]): string[][] {
  const groups = new Map<string, string[]>()
  for (const assignment of assignments) {
    const key = `${assignment.matchIndex}:${assignment.teamId}`
    const members = groups.get(key) ?? []
    members.push(assignment.memberId)
    groups.set(key, members)
  }
  return [...groups.values()]
}

export function isBetterReshuffle(
  candidate: { sameComposition: boolean; preservedTeams: number },
  current: { sameComposition: boolean; preservedTeams: number } | null,
): boolean {
  if (!current) return true
  if (current.sameComposition !== candidate.sameComposition) return !candidate.sameComposition
  if (!candidate.sameComposition && candidate.preservedTeams < current.preservedTeams) return true
  return false
}
