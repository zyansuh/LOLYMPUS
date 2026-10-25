import type { AppState, Member } from '../types.ts'

export function normalizeName(input: string): string {
  return input.trim()
}

export function splitNameInput(input: string): string[] {
  return input
    .split(/[\n,，、]/)
    .map((name) => normalizeName(name))
    .filter((name) => name.length > 0)
}

export function addMemberNames(
  members: readonly Member[],
  rawNames: readonly string[],
  createId: () => string,
): { members: Member[]; added: string[]; skipped: string[] } {
  const next = members.slice()
  const existing = new Set(next.map((member) => member.name))
  const added: string[] = []
  const skipped: string[] = []

  for (const rawName of rawNames) {
    const name = normalizeName(rawName)
    if (!name) continue
    if (existing.has(name)) {
      skipped.push(name)
      continue
    }
    existing.add(name)
    next.push({ id: createId(), name })
    added.push(name)
  }

  return { members: next, added, skipped }
}

export function renameMember(
  members: readonly Member[],
  id: string,
  rawName: string,
): { members: Member[]; error: string | null } {
  const name = normalizeName(rawName)
  if (!name) return { members: members.slice(), error: '이름을 입력해주세요.' }
  const conflict = members.some((member) => member.id !== id && member.name === name)
  if (conflict) {
    return {
      members: members.slice(),
      error: '같은 이름은 등록할 수 없어요. 동명이인은 구분되는 별칭으로 등록해주세요.',
    }
  }
  return {
    members: members.map((member) => (member.id === id ? { ...member, name } : member)),
    error: null,
  }
}

export function removeMemberFromState(state: AppState, id: string): AppState {
  return {
    ...state,
    members: state.members.filter((member) => member.id !== id),
    selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
  }
}

export const DUPLICATE_NAME_MESSAGE =
  '같은 이름은 등록할 수 없어요. 동명이인은 구분되는 별칭으로 등록해주세요.'
