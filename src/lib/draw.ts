import type { Assignment, Ladder, Member, RoundResult } from '../types.ts'
import { teamGroups, compositionsEqual, countIntactTeams, isBetterReshuffle } from './composition.ts'
import { generateRungs, defaultRowCount, traceColumn } from './ladder.ts'
import { canAlterComposition, createMatchPlan, slotsFromPlan } from './plan.ts'
import { shuffle, type RandomInt } from './random.ts'

export const MAX_RESHUFFLE_ATTEMPTS = 24

export type DrawResult = {
  plan: RoundResult['plan']
  ladder: Ladder
  assignments: Assignment[]
  sameComposition: boolean
  cannotChangeComposition: boolean
  attempts: number
}

export function createDraw(
  participants: readonly Member[],
  previousTeams: readonly (readonly string[])[] | null,
  randomInt: RandomInt,
): DrawResult {
  if (participants.length < 2 || participants.length > 30) {
    throw new Error('participant count must be between 2 and 30')
  }

  const cannotChangeComposition = previousTeams !== null && !canAlterComposition(participants.length)
  const attemptLimit = !previousTeams || cannotChangeComposition ? 1 : MAX_RESHUFFLE_ATTEMPTS
  let best: (DrawResult & { preservedTeams: number }) | null = null
  let tried = 0

  for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
    tried = attempt
    const built = buildOnce(participants, randomInt)
    const teams = teamGroups(built.assignments)
    const sameComposition = previousTeams ? compositionsEqual(teams, previousTeams) : false
    const preservedTeams = previousTeams ? countIntactTeams(teams, previousTeams) : 0
    const candidate: DrawResult & { preservedTeams: number } = {
      ...built,
      sameComposition,
      cannotChangeComposition,
      attempts: attempt,
      preservedTeams,
    }

    if (
      isBetterReshuffle(
        { sameComposition, preservedTeams },
        best
          ? { sameComposition: best.sameComposition, preservedTeams: best.preservedTeams }
          : null,
      )
    ) {
      best = candidate
    }

    if (!previousTeams || cannotChangeComposition) break
    if (!sameComposition && preservedTeams === 0) break
  }

  if (!best) throw new Error('failed to create a draw')

  return {
    plan: best.plan,
    ladder: best.ladder,
    assignments: best.assignments,
    sameComposition: best.sameComposition,
    cannotChangeComposition: best.cannotChangeComposition,
    attempts: tried,
  }
}

function buildOnce(participants: readonly Member[], randomInt: RandomInt): {
  plan: RoundResult['plan']
  ladder: Ladder
  assignments: Assignment[]
} {
  const plan = createMatchPlan(participants.length, randomInt)
  const slots = shuffle(slotsFromPlan(plan), randomInt)
  const participantIds = shuffle(
    participants.map((participant) => participant.id),
    randomInt,
  )
  const rowCount = defaultRowCount(participantIds.length)
  const ladder: Ladder = {
    participantIds,
    slots,
    rungs: generateRungs(participantIds.length, randomInt, rowCount),
    rowCount,
  }
  const names = new Map(participants.map((participant) => [participant.id, participant.name]))
  const assignments = participantIds.map((memberId, startColumn) => {
    const endColumn = traceColumn(ladder, startColumn)
    const slot = ladder.slots[endColumn]
    if (!slot) throw new Error('destination slot is missing')
    return {
      memberId,
      name: names.get(memberId) ?? '',
      startColumn,
      endColumn,
      matchIndex: slot.matchIndex,
      teamId: slot.teamId,
    }
  })

  return { plan, ladder, assignments }
}
