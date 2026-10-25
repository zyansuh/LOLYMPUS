import { describe, expect, it } from 'vitest'
import { createDraw } from './draw.ts'
import { mulberry32 } from './random.ts'
import { initialState, loadState, parseState, saveState, STORAGE_KEY } from './storage.ts'
import type { AppState, Member } from '../types.ts'

function memory() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

function people(count: number): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${index + 1}`,
    name: `멤버${index + 1}`,
  }))
}

describe('저장 데이터', () => {
  it('빈 값, 파싱 실패, 다른 버전은 초기 상태로 돌아간다', () => {
    expect(parseState(null)).toEqual(initialState())
    expect(parseState('{')).toEqual(initialState())
    expect(parseState('[]')).toEqual(initialState())
    expect(parseState(JSON.stringify({ version: 2, members: [{ id: 'a', name: '단비' }] }))).toEqual(
      initialState(),
    )
  })

  it('잘못된 결과는 버리고 멤버는 유지한다', () => {
    const parsed = parseState(
      JSON.stringify({
        version: 1,
        members: [
          { id: 'a', name: ' 단비 ' },
          { id: 'a', name: '중복' },
          { id: 'b', name: '해상' },
          { id: '', name: '빈아이디' },
          { name: '아이디없음' },
        ],
        selectedIds: ['a', 'missing', 'a', 'b'],
        revealed: true,
        currentResult: { id: 'broken' },
        history: [{ id: 'also-broken' }, null, 1],
      }),
    )
    expect(parsed.members).toEqual([
      { id: 'a', name: '단비' },
      { id: 'b', name: '해상' },
    ])
    expect(parsed.selectedIds).toEqual(['a', 'b'])
    expect(parsed.currentResult).toBeNull()
    expect(parsed.revealed).toBe(false)
    expect(parsed.history).toEqual([])
  })

  it('추첨 결과와 최근 기록을 저장하고 복원한다', () => {
    const participants = people(6)
    const first = createDraw(participants, null, mulberry32(4))
    const second = createDraw(
      participants,
      Object.values(
        first.assignments.reduce<Record<string, string[]>>((groups, assignment) => {
          const key = `${assignment.matchIndex}:${assignment.teamId}`
          groups[key] = [...(groups[key] ?? []), assignment.memberId]
          return groups
        }, {}),
      ),
      mulberry32(8),
    )
    const rounds = [first, second].map((draw, index) => ({
      id: `round-${index + 1}`,
      round: index + 1,
      createdAt: '2026-10-25T01:00:00.000Z',
      participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
      plan: draw.plan,
      ladder: draw.ladder,
      assignments: draw.assignments,
      sameComposition: draw.sameComposition,
      cannotChangeComposition: draw.cannotChangeComposition,
    }))
    const state: AppState = {
      version: 1,
      members: participants,
      selectedIds: participants.map((participant) => participant.id),
      revealed: true,
      currentResult: rounds[1] ?? null,
      history: rounds[0] ? [rounds[0]] : [],
    }
    const storage = memory()
    saveState(state, storage)
    const loaded = loadState(storage)
    expect(storage.getItem(STORAGE_KEY)).toContain('"version":1')
    expect(loaded.selectedIds).toEqual(state.selectedIds)
    expect(loaded.currentResult).toEqual(state.currentResult)
    expect(loaded.history).toEqual(state.history)
    expect(loaded.revealed).toBe(true)
  })
})
