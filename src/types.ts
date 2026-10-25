export const STORAGE_VERSION = 1

export const TEAM_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export type TeamId = (typeof TEAM_IDS)[number]

export type Member = {
  id: string
  name: string
}

export type ParticipantSnapshot = {
  id: string
  name: string
}

export type MatchTeamPlan = {
  teamId: TeamId
  size: number
}

export type MatchPlanItem = {
  matchIndex: number
  total: number
  teams: [MatchTeamPlan, MatchTeamPlan]
}

export type MatchPlan = {
  matchCount: number
  matches: MatchPlanItem[]
}

export type TeamSlot = {
  matchIndex: number
  teamId: TeamId
}

export type Rung = {
  row: number
  left: number
}

export type Ladder = {
  participantIds: string[]
  slots: TeamSlot[]
  rungs: Rung[]
  rowCount: number
}

export type Assignment = {
  memberId: string
  name: string
  startColumn: number
  endColumn: number
  matchIndex: number
  teamId: TeamId
}

export type RoundResult = {
  id: string
  round: number
  createdAt: string
  participants: ParticipantSnapshot[]
  plan: MatchPlan
  ladder: Ladder
  assignments: Assignment[]
  sameComposition: boolean
  cannotChangeComposition: boolean
}

export type AppState = {
  version: typeof STORAGE_VERSION
  members: Member[]
  selectedIds: string[]
  revealed: boolean
  currentResult: RoundResult | null
  history: RoundResult[]
}
