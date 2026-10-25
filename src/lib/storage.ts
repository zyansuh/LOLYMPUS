import type {
  AppState,
  Assignment,
  Ladder,
  MatchPlan,
  MatchPlanItem,
  Member,
  ParticipantSnapshot,
  RoundResult,
  Rung,
  TeamSlot,
} from '../types.ts'
import { STORAGE_VERSION } from '../types.ts'
import { isAssignment, isCoherentRound, isRecord, isTeamId } from './validate.ts'

export const STORAGE_KEY = 'lolympus.state.v1'
export const MAX_HISTORY = 9

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>

export function initialState(): AppState {
  return {
    version: STORAGE_VERSION,
    members: [],
    selectedIds: [],
    revealed: false,
    currentResult: null,
    history: [],
  }
}

export function loadState(storage: KeyValueStorage = localStorage): AppState {
  try {
    return parseState(storage.getItem(STORAGE_KEY))
  } catch {
    return initialState()
  }
}

export function saveState(state: AppState, storage: KeyValueStorage = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota and privacy-mode write failures.
  }
}

export function parseState(raw: string | null): AppState {
  if (!raw) return initialState()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) return initialState()

    const members = parseMembers(parsed.members)
    const memberIds = new Set(members.map((member) => member.id))
    const selectedIds = uniqueIds(parsed.selectedIds, memberIds).slice(0, 30)
    const history = parseHistory(parsed.history)
    const currentResult = parseRound(parsed.currentResult)
    const revealed = parsed.revealed === true && currentResult !== null

    return {
      version: STORAGE_VERSION,
      members,
      selectedIds,
      revealed,
      currentResult,
      history,
    }
  } catch {
    return initialState()
  }
}

function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) return []
  const members: Member[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') continue
    const name = item.name.trim()
    if (!item.id || !name || ids.has(item.id) || names.has(name)) continue
    ids.add(item.id)
    names.add(name)
    members.push({ id: item.id, name })
  }
  return members
}

function uniqueIds(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item) || seen.has(item)) continue
    seen.add(item)
    ids.push(item)
  }
  return ids
}

function parseHistory(value: unknown): RoundResult[] {
  if (!Array.isArray(value)) return []
  const history: RoundResult[] = []
  for (const item of value) {
    const round = parseRound(item)
    if (!round) continue
    history.push(round)
    if (history.length >= MAX_HISTORY) break
  }
  return history
}

function parseRound(value: unknown): RoundResult | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || !value.id) return null
  if (typeof value.round !== 'number' || !Number.isInteger(value.round) || value.round < 1) return null
  if (typeof value.createdAt !== 'string') return null
  if (typeof value.sameComposition !== 'boolean') return null
  if (typeof value.cannotChangeComposition !== 'boolean') return null

  const participants = parseParticipants(value.participants)
  const plan = parsePlan(value.plan)
  const ladder = parseLadder(value.ladder)
  const assignments = parseAssignments(value.assignments)
  if (!participants || !plan || !ladder || !assignments) return null

  const result: RoundResult = {
    id: value.id,
    round: value.round,
    createdAt: value.createdAt,
    participants,
    plan,
    ladder,
    assignments,
    sameComposition: value.sameComposition,
    cannotChangeComposition: value.cannotChangeComposition,
  }
  return isCoherentRound(result) ? result : null
}

function parseParticipants(value: unknown): RoundResult['participants'] | null {
  if (!Array.isArray(value)) return null
  const participants: ParticipantSnapshot[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return null
    if (!item.id) return null
    participants.push({ id: item.id, name: item.name })
  }
  return participants
}

function parsePlan(value: unknown): MatchPlan | null {
  if (!isRecord(value) || typeof value.matchCount !== 'number' || !Array.isArray(value.matches)) {
    return null
  }
  const matches: MatchPlanItem[] = []
  for (const item of value.matches) {
    if (!isRecord(item) || typeof item.matchIndex !== 'number' || typeof item.total !== 'number') {
      return null
    }
    if (!Array.isArray(item.teams) || item.teams.length !== 2) return null
    const teams = []
    for (const team of item.teams) {
      if (!isRecord(team) || !isTeamId(team.teamId) || typeof team.size !== 'number') return null
      teams.push({ teamId: team.teamId, size: team.size })
    }
    const left = teams[0]
    const right = teams[1]
    if (!left || !right) return null
    matches.push({ matchIndex: item.matchIndex, total: item.total, teams: [left, right] })
  }
  return { matchCount: value.matchCount, matches }
}

function parseLadder(value: unknown): Ladder | null {
  if (!isRecord(value) || typeof value.rowCount !== 'number') return null
  if (!Array.isArray(value.participantIds) || !value.participantIds.every((id) => typeof id === 'string')) {
    return null
  }
  if (!Array.isArray(value.slots)) return null
  const slots: TeamSlot[] = []
  for (const slot of value.slots) {
    if (!isRecord(slot) || typeof slot.matchIndex !== 'number' || !isTeamId(slot.teamId)) return null
    slots.push({ matchIndex: slot.matchIndex, teamId: slot.teamId })
  }
  if (!Array.isArray(value.rungs)) return null
  const rungs: Rung[] = []
  for (const rung of value.rungs) {
    if (!isRecord(rung) || typeof rung.row !== 'number' || typeof rung.left !== 'number') return null
    rungs.push({ row: rung.row, left: rung.left })
  }
  return { participantIds: value.participantIds, slots, rungs, rowCount: value.rowCount }
}

function parseAssignments(value: unknown): Assignment[] | null {
  if (!Array.isArray(value) || !value.every((item) => isAssignment(item))) return null
  return value.map((item) => ({
    memberId: item.memberId,
    name: item.name,
    startColumn: item.startColumn,
    endColumn: item.endColumn,
    matchIndex: item.matchIndex,
    teamId: item.teamId,
  }))
}
