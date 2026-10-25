import { useEffect, useRef, useState } from 'react'
import type { RoundResult } from '../types.ts'
import { formatResultText, matchesForDisplay, roundBadge } from '../lib/format.ts'

type MatchResultsProps = {
  result: RoundResult
  highlightedId?: string | null
  onHighlight?: (memberId: string) => void
}

export function MatchResults({ result, highlightedId = null, onHighlight }: MatchResultsProps) {
  const matches = matchesForDisplay(result)
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState<string | null>(null)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setCopied(false)
    setFallback(null)
  }, [result.id])

  useEffect(() => {
    if (!fallback) return
    fallbackRef.current?.focus()
    fallbackRef.current?.select()
  }, [fallback])

  const copy = async () => {
    const text = formatResultText(result)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setFallback(null)
    } catch {
      setCopied(false)
      setFallback(text)
    }
  }

  return (
    <section className="results" aria-labelledby={`results-${result.id}`}>
      <div className="panel-heading">
        <div>
          <p className="round-badge">{roundBadge(result.round)}</p>
          <h2 id={`results-${result.id}`}>{result.round}라운드 결과</h2>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          결과 복사
        </button>
      </div>

      {result.cannotChangeComposition ? (
        <p className="form-message" role="status">
          현재 인원으로는 팀 구성을 바꿀 수 없어요.
        </p>
      ) : null}
      {result.sameComposition && !result.cannotChangeComposition ? (
        <p className="form-message" role="status">
          이번 추첨은 직전과 같은 팀 구성이에요. 다시 섞을 수 있어요.
        </p>
      ) : null}
      {copied ? (
        <p className="form-message" role="status">
          복사했어요.
        </p>
      ) : null}
      {fallback ? (
        <div className="copy-fallback">
          <p>복사하지 못했어요. 아래 텍스트를 선택해 복사해주세요.</p>
          <textarea ref={fallbackRef} readOnly value={fallback} rows={8} />
        </div>
      ) : null}

      <div className="match-list">
        {matches.map((match) => (
          <article key={match.matchIndex} className="match-card">
            <h3 className="match-tab">{match.matchIndex + 1}경기</h3>
            <div className="teams">
              <TeamColumn
                teamId={match.teams[0].teamId}
                members={match.teams[0].members}
                highlightedId={highlightedId}
                onHighlight={onHighlight}
              />
              <p className="vs">vs</p>
              <TeamColumn
                teamId={match.teams[1].teamId}
                members={match.teams[1].members}
                highlightedId={highlightedId}
                onHighlight={onHighlight}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function TeamColumn({
  teamId,
  members,
  highlightedId,
  onHighlight,
}: {
  teamId: RoundResult['assignments'][number]['teamId']
  members: RoundResult['assignments']
  highlightedId: string | null
  onHighlight?: (memberId: string) => void
}) {
  return (
    <section className={`team-block team-${teamId}`}>
      <header>
        <h4>
          {teamId}팀
        </h4>
        <p>{members.length}명</p>
      </header>
      <ul>
        {members.map((member) => (
          <li key={member.memberId}>
            {onHighlight ? (
              <button
                type="button"
                className={highlightedId === member.memberId ? 'name-button is-active' : 'name-button'}
                onClick={() => onHighlight(member.memberId)}
              >
                {member.name}
              </button>
            ) : (
              member.name
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
