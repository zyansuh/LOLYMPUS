import type { Assignment, Ladder, MatchPlan, RoundResult, TeamId } from '../types.ts'
import { TEAM_IDS } from '../types.ts'
import { rungsAreValid, traceColumn } from './ladder.ts'

export function isCoherentRound(result: RoundResult): boolean {
  const count = result.participants.length
  if (count < 2 || count > 30) return false
  if (result.plan.matchCount < 1 || result.plan.matchCount > 3) return false
  if (result.plan.matchCount !== Math.ceil(count / 10)) return false
  if (result.plan.matches.length !== result.plan.matchCount) return false
  if (result.ladder.participantIds.length !== count) return false
  if (result.ladder.slots.length !== count) return false
  if (result.assignments.length !== count) return false
  if (!Number.isInteger(result.ladder.rowCount) || result.ladder.rowCount < 1) return false
  if (!rungsAreValid(result.ladder.rungs, count, result.ladder.rowCount)) return false

  const participantIds = result.participants.map((participant) => participant.id)
  if (new Set(participantIds).size !== count) return false
  if (!sameMembers(participantIds, result.ladder.participantIds)) return false

  const totals = result.plan.matches.map((match) => match.total)
  if (Math.max(...totals) - Math.min(...totals) > 1) return false
  if (totals.reduce((sum, total) => sum + total, 0) !== count) return false

  const expectedSlots: string[] = []
  for (const match of result.plan.matches) {
    if (match.teams[0].size + match.teams[1].size !== match.total) return false
    if (Math.abs(match.teams[0].size - match.teams[1].size) > 1) return false
    if (match.teams.some((team) => team.size > 5 || team.size < 1)) return false
    for (const team of match.teams) {
      for (let index = 0; index < team.size; index += 1) {
        expectedSlots.push(`${match.matchIndex}:${team.teamId}`)
      }
    }
  }
  const actualSlots = result.ladder.slots.map((slot) => `${slot.matchIndex}:${slot.teamId}`)
  if (expectedSlots.slice().sort().join('|') !== actualSlots.slice().sort().join('|')) return false

  const seenStart = new Set<number>()
  const seenEnd = new Set<number>()
  const seenMembers = new Set<string>()
  for (const assignment of result.assignments) {
    if (seenStart.has(assignment.startColumn) || seenEnd.has(assignment.endColumn)) return false
    if (assignment.startColumn < 0 || assignment.startColumn >= count) return false
    if (assignment.endColumn < 0 || assignment.endColumn >= count) return false
    if (result.ladder.participantIds[assignment.startColumn] !== assignment.memberId) return false
    if (traceColumn(result.ladder, assignment.startColumn) !== assignment.endColumn) return false
    const slot = result.ladder.slots[assignment.endColumn]
    if (!slot || slot.matchIndex !== assignment.matchIndex || slot.teamId !== assignment.teamId) {
      return false
    }
    seenStart.add(assignment.startColumn)
    seenEnd.add(assignment.endColumn)
    seenMembers.add(assignment.memberId)
  }

  return seenMembers.size === count && sameMembers(participantIds, [...seenMembers])
}

export function isTeamId(value: unknown): value is TeamId {
  return typeof value === 'string' && (TEAM_IDS as readonly string[]).includes(value)
}

export function isMatchPlan(value: unknown): value is MatchPlan {
  if (!isRecord(value) || !Array.isArray(value.matches) || typeof value.matchCount !== 'number') {
    return false
  }
  return value.matches.every((match) => {
    if (!isRecord(match) || !Array.isArray(match.teams) || match.teams.length !== 2) return false
    return match.teams.every(
      (team) => isRecord(team) && isTeamId(team.teamId) && typeof team.size === 'number',
    )
  })
}

export function isLadder(value: unknown): value is Ladder {
  if (!isRecord(value) || !Array.isArray(value.participantIds) || !Array.isArray(value.slots)) {
    return false
  }
  if (!Array.isArray(value.rungs) || typeof value.rowCount !== 'number') return false
  return value.participantIds.every((id) => typeof id === 'string')
}

export function isAssignment(value: unknown): value is Assignment {
  return (
    isRecord(value) &&
    typeof value.memberId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.startColumn === 'number' &&
    typeof value.endColumn === 'number' &&
    typeof value.matchIndex === 'number' &&
    isTeamId(value.teamId)
  )
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const values = new Set(left)
  return right.every((id) => values.has(id))
}
