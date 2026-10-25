import { describePlan } from '../lib/plan.ts'

type MatchPreviewProps = {
  participantCount: number
}

export function MatchPreview({ participantCount }: MatchPreviewProps) {
  const preview = describePlan(participantCount)
  if (!preview) return null

  return (
    <section className="preview" aria-label="예상 경기 구성">
      <h2>예상 구성</h2>
      <p className="preview-summary">{preview.summary}</p>
      <ul>
        {preview.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
