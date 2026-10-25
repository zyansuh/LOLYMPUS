import type { MatchPlan, MatchPlanItem, TeamId, TeamSlot } from '../types.ts'
import { TEAM_IDS } from '../types.ts'
import { shuffle, type RandomInt } from './random.ts'

export type PlanPreview = {
  matchCount: number
  teamCount: number
  summary: string
  lines: string[]
}

export function matchCountFor(participantCount: number): number {
  return Math.ceil(participantCount / 10)
}

export function matchSizes(participantCount: number): number[] {
  if (participantCount < 2) return []
  const matchCount = matchCountFor(participantCount)
  const base = Math.floor(participantCount / matchCount)
  const extra = participantCount - base * matchCount
  return Array.from({ length: matchCount }, (_, index) => base + (index < extra ? 1 : 0))
}

export function teamSizes(participantCount: number): number[] {
  return matchSizes(participantCount).flatMap((size) => [
    Math.floor(size / 2),
    Math.ceil(size / 2),
  ])
}

export function canAlterComposition(participantCount: number): boolean {
  if (participantCount < 3) return false
  return partitionCountGreaterThanOne(teamSizes(participantCount))
}

export function describePlan(participantCount: number): PlanPreview | null {
  if (participantCount < 2 || participantCount > 30) return null
  const sizes = matchSizes(participantCount)
  const grouped = new Map<number, number>()
  for (const size of sizes) grouped.set(size, (grouped.get(size) ?? 0) + 1)

  const lines = [...grouped.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([size, count]) => {
      const low = Math.floor(size / 2)
      const high = Math.ceil(size / 2)
      const label = count > 1 ? `${size}명 경기 ${count}개` : `${size}명 경기`
      return `${label}: ${low}명 vs ${high}명`
    })

  const matchCount = sizes.length
  return {
    matchCount,
    teamCount: matchCount * 2,
    summary: `${matchCount}경기 · 총 ${matchCount * 2}팀 · 전원 배정`,
    lines,
  }
}

export function createMatchPlan(participantCount: number, randomInt: RandomInt): MatchPlan {
  if (participantCount < 2 || participantCount > 30) {
    throw new Error('participant count must be between 2 and 30')
  }

  const matchCount = matchCountFor(participantCount)
  if (matchCount > 3) throw new Error('match count exceeds 3')

  const base = Math.floor(participantCount / matchCount)
  const extra = participantCount - base * matchCount
  const sizes = Array.from({ length: matchCount }, () => base)
  const recipientOrder = shuffle(
    sizes.map((_, index) => index),
    randomInt,
  )
  for (let index = 0; index < extra; index += 1) {
    const recipient = recipientOrder[index]
    if (recipient === undefined) continue
    sizes[recipient] = (sizes[recipient] ?? base) + 1
  }

  const matches: MatchPlanItem[] = sizes.map((total, matchIndex) => {
    const low = Math.floor(total / 2)
    const high = Math.ceil(total / 2)
    const left = total % 2 === 0 ? low : randomInt(2) === 0 ? high : low
    const right = total - left
    const leftId = TEAM_IDS[matchIndex * 2]
    const rightId = TEAM_IDS[matchIndex * 2 + 1]
    if (!leftId || !rightId) throw new Error('team id is missing')
    return {
      matchIndex,
      total,
      teams: [
        { teamId: leftId, size: left },
        { teamId: rightId, size: right },
      ],
    }
  })

  return { matchCount, matches }
}

export function slotsFromPlan(plan: MatchPlan): TeamSlot[] {
  const slots: TeamSlot[] = []
  for (const match of plan.matches) {
    for (const team of match.teams) {
      for (let index = 0; index < team.size; index += 1) {
        slots.push({ matchIndex: match.matchIndex, teamId: team.teamId })
      }
    }
  }
  return slots
}

export function teamIdForMatch(matchIndex: number, side: 0 | 1): TeamId {
  const teamId = TEAM_IDS[matchIndex * 2 + side]
  if (!teamId) throw new Error('team id is missing')
  return teamId
}

function partitionCountGreaterThanOne(sizes: readonly number[]): boolean {
  const participantCount = sizes.reduce((sum, size) => sum + size, 0)
  const divisors: number[] = []
  const multiplicity = new Map<number, number>()
  for (const size of sizes) {
    multiplicity.set(size, (multiplicity.get(size) ?? 0) + 1)
    for (let value = 2; value <= size; value += 1) divisors.push(value)
  }
  for (const count of multiplicity.values()) {
    for (let value = 2; value <= count; value += 1) divisors.push(value)
  }

  let logValue = 0
  for (let value = 2; value <= participantCount; value += 1) logValue += Math.log(value)
  for (const divisor of divisors) logValue -= Math.log(divisor)
  return logValue > 1e-9
}
