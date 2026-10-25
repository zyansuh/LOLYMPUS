import { describe, expect, it } from 'vitest'
import { compositionsEqual, isBetterReshuffle, teamGroups } from './composition.ts'
import { createDraw, MAX_RESHUFFLE_ATTEMPTS, type DrawResult } from './draw.ts'
import { formatResultText } from './format.ts'
import { buildPathPoints, ladderMetrics, rungsAreValid, traceColumn } from './ladder.ts'
import { addMemberNames, removeMemberFromState, renameMember, splitNameInput } from './members.ts'
import { describePlan, matchSizes } from './plan.ts'
import { mulberry32 } from './random.ts'
import { selectAllIds, toggleSelected } from './selection.ts'
import { isCoherentRound } from './validate.ts'
import type { Member, RoundResult } from '../types.ts'

function people(count: number): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${index + 1}`,
    name: `멤버${index + 1}`,
  }))
}

function toRound(draw: DrawResult, participants: Member[], round = 1): RoundResult {
  return {
    id: `round-${round}`,
    round,
    createdAt: '2026-10-25T00:00:00.000Z',
    participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
    plan: draw.plan,
    ladder: draw.ladder,
    assignments: draw.assignments,
    sameComposition: draw.sameComposition,
    cannotChangeComposition: draw.cannotChangeComposition,
  }
}

function expectInvariants(draw: DrawResult, participants: Member[]) {
  const count = participants.length
  const ids = draw.assignments.map((assignment) => assignment.memberId).sort()
  expect(ids).toEqual(participants.map((participant) => participant.id).sort())
  expect(new Set(ids).size).toBe(count)
  expect(draw.plan.matchCount).toBe(Math.ceil(count / 10))
  expect(draw.plan.matchCount).toBeLessThanOrEqual(3)
  expect(draw.attempts).toBeGreaterThan(0)
  expect(draw.attempts).toBeLessThanOrEqual(MAX_RESHUFFLE_ATTEMPTS)

  const totals = draw.plan.matches.map((match) => match.total)
  expect(totals.reduce((sum, total) => sum + total, 0)).toBe(count)
  expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1)
  expect(totals.slice().sort((left, right) => left - right)).toEqual(
    matchSizes(count).slice().sort((left, right) => left - right),
  )

  const ends = new Set<number>()
  for (const assignment of draw.assignments) {
    expect(traceColumn(draw.ladder, assignment.startColumn)).toBe(assignment.endColumn)
    expect(draw.ladder.slots[assignment.endColumn]).toMatchObject({
      matchIndex: assignment.matchIndex,
      teamId: assignment.teamId,
    })
    ends.add(assignment.endColumn)
    const points = buildPathPoints(draw.ladder, assignment.startColumn)
    const last = points.at(-1)
    expect(last).toBeDefined()
    const endColumn = Math.round(
      ((last?.x ?? 0) - ladderMetrics.colWidth / 2) / ladderMetrics.colWidth,
    )
    expect(endColumn).toBe(assignment.endColumn)
  }
  expect(ends.size).toBe(count)
  expect(rungsAreValid(draw.ladder.rungs, count, draw.ladder.rowCount)).toBe(true)

  for (const match of draw.plan.matches) {
    expect(Math.abs(match.teams[0].size - match.teams[1].size)).toBeLessThanOrEqual(1)
    for (const team of match.teams) {
      expect(team.size).toBeGreaterThan(0)
      expect(team.size).toBeLessThanOrEqual(5)
      const actual = draw.assignments.filter(
        (assignment) => assignment.matchIndex === match.matchIndex && assignment.teamId === team.teamId,
      )
      expect(actual).toHaveLength(team.size)
    }
  }

  expect(isCoherentRound(toRound(draw, participants))).toBe(true)
}

describe('사다리 배정 불변 조건', () => {
  const seeds = [1, 7, 42, 99, 2026]

  for (let count = 2; count <= 30; count += 1) {
    for (const seed of seeds) {
      it(`${count}명 / 시드 ${seed}`, () => {
        const participants = people(count)
        const draw = createDraw(participants, null, mulberry32(seed + count * 17))
        expect(draw.sameComposition).toBe(false)
        expect(draw.cannotChangeComposition).toBe(false)
        expect(draw.attempts).toBe(1)
        expectInvariants(draw, participants)
      })
    }
  }
})

describe('다음 판 재배정', () => {
  it('같은 참여자를 누락과 중복 없이 다시 배정한다', () => {
    const participants = people(16)
    let previous = createDraw(participants, null, mulberry32(3))
    expectInvariants(previous, participants)

    for (let round = 0; round < 4; round += 1) {
      const next = createDraw(participants, teamGroups(previous.assignments), mulberry32(30 + round))
      expectInvariants(next, participants)
      expect(next.cannotChangeComposition).toBe(false)
      expect(next.sameComposition).toBe(false)
      previous = next
    }
  })

  it('2명은 다른 구성을 찾지 않고 한 번만 배정한다', () => {
    const participants = people(2)
    const first = createDraw(participants, null, mulberry32(1))
    const teams = [
      first.assignments.filter((assignment) => assignment.teamId === 'A').map((assignment) => assignment.memberId),
      first.assignments.filter((assignment) => assignment.teamId === 'B').map((assignment) => assignment.memberId),
    ]
    const second = createDraw(participants, teams, mulberry32(2))
    expect(second.attempts).toBe(1)
    expect(second.cannotChangeComposition).toBe(true)
    expect(second.sameComposition).toBe(true)
    expectInvariants(second, participants)
  })

  for (const count of [3, 6, 7, 10, 11, 14, 21, 30]) {
    it(`${count}명은 직전과 다른 팀 구성을 고른다`, () => {
      const participants = people(count)
      const first = createDraw(participants, null, mulberry32(count * 10))
      const teams = Object.values(
        first.assignments.reduce<Record<string, string[]>>((groups, assignment) => {
          const key = `${assignment.matchIndex}:${assignment.teamId}`
          groups[key] = [...(groups[key] ?? []), assignment.memberId]
          return groups
        }, {}),
      )
      const second = createDraw(participants, teams, mulberry32(count * 10 + 5))
      expect(second.sameComposition).toBe(false)
      expect(second.cannotChangeComposition).toBe(false)
      expectInvariants(second, participants)
    })
  }
})

describe('예상 구성', () => {
  it('예시 인원의 경기 수와 팀 규모를 설명한다', () => {
    expect(describePlan(2)?.summary).toBe('1경기 · 총 2팀 · 전원 배정')
    expect(describePlan(2)?.lines).toEqual(['2명 경기: 1명 vs 1명'])
    expect(describePlan(6)?.lines).toEqual(['6명 경기: 3명 vs 3명'])
    expect(describePlan(7)?.lines).toEqual(['7명 경기: 3명 vs 4명'])
    expect(describePlan(10)?.lines).toEqual(['10명 경기: 5명 vs 5명'])
    expect(describePlan(11)?.summary).toBe('2경기 · 총 4팀 · 전원 배정')
    expect(describePlan(11)?.lines).toEqual(['6명 경기: 3명 vs 3명', '5명 경기: 2명 vs 3명'])
    expect(describePlan(14)?.summary).toBe('2경기 · 총 4팀 · 전원 배정')
    expect(describePlan(14)?.lines).toEqual(['7명 경기 2개: 3명 vs 4명'])
    expect(describePlan(21)?.summary).toBe('3경기 · 총 6팀 · 전원 배정')
    expect(describePlan(21)?.lines).toEqual(['7명 경기 3개: 3명 vs 4명'])
    expect(describePlan(30)?.summary).toBe('3경기 · 총 6팀 · 전원 배정')
    expect(describePlan(30)?.lines).toEqual(['10명 경기 3개: 5명 vs 5명'])
  })
})

describe('팀 구성 비교', () => {
  it('팀 이름과 순서가 달라도 같은 구성으로 본다', () => {
    expect(compositionsEqual([['b', 'a'], ['c']], [['c'], ['a', 'b']])).toBe(true)
    expect(compositionsEqual([['a', 'b'], ['c', 'd']], [['a', 'c'], ['b', 'd']])).toBe(false)
  })

  it('다른 구성 중 직전 팀이 덜 유지되는 후보를 고른다', () => {
    const same = { sameComposition: true, preservedTeams: 2 }
    const partial = { sameComposition: false, preservedTeams: 1 }
    const fresh = { sameComposition: false, preservedTeams: 0 }
    expect(isBetterReshuffle(partial, same)).toBe(true)
    expect(isBetterReshuffle(same, partial)).toBe(false)
    expect(isBetterReshuffle(fresh, partial)).toBe(true)
    expect(isBetterReshuffle(partial, fresh)).toBe(false)
  })
})

describe('멤버와 선택', () => {
  it('공백과 중복 이름을 걸러 낸다', () => {
    let nextId = 0
    const first = addMemberNames([], [' 단비 ', '', '단비', '해상'], () => `id-${nextId++}`)
    expect(first.added).toEqual(['단비', '해상'])
    expect(first.skipped).toEqual(['단비'])
    const second = addMemberNames(first.members, ['해상'], () => 'id-2')
    expect(second.members.map((member) => member.name)).toEqual(['단비', '해상'])
    expect(splitNameInput('지수, 유진\n수빈，민수、채영')).toEqual(['지수', '유진', '수빈', '민수', '채영'])
  })

  it('이름 수정을 거절하거나 반영한다', () => {
    const members = [
      { id: 'a', name: '단비' },
      { id: 'b', name: '해상' },
    ]
    expect(renameMember(members, 'b', ' 단비 ').error).toMatch(/별칭/)
    expect(renameMember(members, 'b', '  ').error).toMatch(/입력/)
    expect(renameMember(members, 'b', ' 해상2 ').members[1]?.name).toBe('해상2')
  })

  it('삭제하면 참여자 선택에서도 빠진다', () => {
    const next = removeMemberFromState(
      {
        version: 1,
        members: [
          { id: 'a', name: '단비' },
          { id: 'b', name: '해상' },
        ],
        selectedIds: ['a', 'b'],
        revealed: false,
        currentResult: null,
        history: [],
      },
      'a',
    )
    expect(next.members.map((member) => member.id)).toEqual(['b'])
    expect(next.selectedIds).toEqual(['b'])
  })

  it('31번째 선택은 기존 선택을 유지하고 31명 전체 선택은 막는다', () => {
    const ids = Array.from({ length: 30 }, (_, index) => `m${index}`)
    const blocked = toggleSelected(ids, 'extra')
    expect(blocked.limited).toBe(true)
    expect(blocked.selectedIds).toEqual(ids)
    expect(selectAllIds([...ids, 'extra'])).toBeNull()
    expect(selectAllIds(ids)).toEqual(ids)
  })
})

describe('결과 텍스트', () => {
  it('라운드 번호와 이름 스냅샷을 텍스트로 만든다', () => {
    const participants = people(2)
    const draw = createDraw(participants, null, mulberry32(9))
    const round = toRound(draw, participants)
    round.assignments = round.assignments.map((assignment) =>
      assignment.memberId === 'member-1' ? { ...assignment, name: '<b>단비</b>' } : assignment,
    )
    const text = formatResultText(round)
    expect(text.startsWith('1라운드')).toBe(true)
    expect(text).toContain('<b>단비</b>')
    expect(text).toContain('1경기')
    expect(text).toContain('A팀')
    expect(text).toContain('B팀')
  })
})
