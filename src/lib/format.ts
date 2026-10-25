import type { Assignment, RoundResult, TeamId } from '../types.ts'

export type DisplayTeam = {
  teamId: TeamId
  members: Assignment[]
}

export type DisplayMatch = {
  matchIndex: number
  teams: [DisplayTeam, DisplayTeam]
}

export function matchesForDisplay(result: RoundResult): DisplayMatch[] {
  return result.plan.matches.map((match) => {
    const teams = match.teams.map((team) => ({
      teamId: team.teamId,
      members: result.assignments
        .filter(
          (assignment) =>
            assignment.matchIndex === match.matchIndex && assignment.teamId === team.teamId,
        )
        .slice()
        .sort((left, right) => left.endColumn - right.endColumn),
    }))
    const left = teams[0]
    const right = teams[1]
    if (!left || !right) throw new Error('match is missing a team')
    return { matchIndex: match.matchIndex, teams: [left, right] }
  })
}

export function formatResultText(result: RoundResult): string {
  const lines = [`${result.round}라운드`, '']
  for (const match of matchesForDisplay(result)) {
    lines.push(`${match.matchIndex + 1}경기`)
    for (const team of match.teams) {
      const names = team.members.map((member) => member.name).join(', ')
      lines.push(`${team.teamId}팀 (${team.members.length}명): ${names}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export function roundBadge(round: number): string {
  return `ROUND ${String(round).padStart(2, '0')}`
}
