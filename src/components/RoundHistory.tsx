import type { RoundResult } from '../types.ts'
import { MatchResults } from './MatchResults.tsx'

type RoundHistoryProps = {
  rounds: RoundResult[]
}

export function RoundHistory({ rounds }: RoundHistoryProps) {
  return (
    <section className="history" aria-labelledby="history-title">
      <h2 id="history-title" className="sr-only">
        이전 라운드
      </h2>
      {rounds.length === 0 ? (
        <p className="muted">아직 이전 라운드가 없어요.</p>
      ) : (
        <details className="history-root">
          <summary>이전 라운드 보기</summary>
          <div className="history-list">
            {rounds.map((round) => (
              <details key={round.id} className="history-item">
                <summary>
                  {round.round}라운드 · {round.participants.length}명
                </summary>
                <MatchResults result={round} />
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}
