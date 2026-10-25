import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RoundResult } from '../types.ts'
import {
  buildPathPoints,
  columnX,
  ladderBottom,
  ladderHeight,
  ladderMetrics,
  pointsToPath,
} from '../lib/ladder.ts'
import { roundBadge } from '../lib/format.ts'

type LadderBoardProps = {
  result: RoundResult
  progress: number
  drawing: boolean
  highlightId: string | null
  onHighlight: (memberId: string | null) => void
}

export function LadderBoard({
  result,
  progress,
  drawing,
  highlightId,
  onHighlight,
}: LadderBoardProps) {
  const columnCount = result.ladder.participantIds.length
  const width = columnCount * ladderMetrics.colWidth
  const height = ladderHeight(result.ladder.rowCount)
  const bottom = ladderBottom(result.ladder.rowCount)
  const names = result.ladder.participantIds.map((memberId, index) => {
    const assignment = result.assignments.find((item) => item.memberId === memberId)
    return { memberId, name: assignment?.name ?? '', index }
  })
  const highlighted = names.find((column) => column.memberId === highlightId) ?? null
  const paths = useMemo(
    () =>
      names.map((column) => ({
        memberId: column.memberId,
        d: pointsToPath(buildPathPoints(result.ladder, column.index)),
      })),
    [names, result.ladder],
  )

  return (
    <section className="panel ladder-panel" aria-labelledby="ladder-title">
      <div className="panel-heading">
        <h2 id="ladder-title">사다리</h2>
        <p className="round-badge">{roundBadge(result.round)}</p>
      </div>
      <p className="muted">이름을 누르면 그 경로를 따라가 볼 수 있어요.</p>
      <p className="ladder-current" aria-live="polite">
        {highlighted ? `${highlighted.name} 경로` : '선택한 참여자 이름이 여기에 표시돼요.'}
      </p>
      <div
        className="ladder-scroll"
        tabIndex={0}
        role="region"
        aria-label="사다리 가로 스크롤 영역"
        aria-busy={drawing}
      >
        <div className="ladder-canvas" style={{ width }}>
          <div
            className="ladder-names"
            style={{ gridTemplateColumns: `repeat(${columnCount}, ${ladderMetrics.colWidth}px)` }}
          >
            {names.map((column) => {
              const pressed = highlightId === column.memberId
              return (
                <button
                  key={column.memberId}
                  type="button"
                  className={pressed ? 'ladder-name is-active' : 'ladder-name'}
                  aria-pressed={pressed}
                  title={column.name}
                  onClick={() => onHighlight(pressed ? null : column.memberId)}
                  onFocus={() => onHighlight(column.memberId)}
                >
                  {column.name}
                </button>
              )
            })}
          </div>
          <svg
            className="ladder-svg"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
          >
            {names.map((column) => (
              <line
                key={`vertical-${column.memberId}`}
                x1={columnX(column.index)}
                y1={ladderMetrics.top}
                x2={columnX(column.index)}
                y2={bottom}
                stroke="#34332F"
                strokeWidth="2.5"
              />
            ))}
            {result.ladder.rungs.map((rung) => (
              <line
                key={`rung-${rung.row}-${rung.left}`}
                x1={columnX(rung.left)}
                y1={ladderMetrics.top + (rung.row + 1) * ladderMetrics.rowHeight}
                x2={columnX(rung.left + 1)}
                y2={ladderMetrics.top + (rung.row + 1) * ladderMetrics.rowHeight}
                stroke="#34332F"
                strokeWidth="2.5"
              />
            ))}
            {paths.map((path) => (
              <TracePath
                key={path.memberId}
                d={path.d}
                progress={progress}
                emphasized={highlightId === null || highlightId === path.memberId}
                muted={highlightId !== null && highlightId !== path.memberId}
              />
            ))}
          </svg>
          <div
            className="ladder-slots"
            style={{ gridTemplateColumns: `repeat(${columnCount}, ${ladderMetrics.colWidth}px)` }}
          >
            {result.ladder.slots.map((slot, index) => (
              <div key={`${slot.teamId}-${index}`} className={`slot slot-${slot.teamId}`}>
                <span>{slot.matchIndex + 1}경기</span>
                <span>{slot.teamId}팀</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="scroll-hint">좌우로 이동해 전체 사다리를 확인하세요</p>
    </section>
  )
}

function TracePath({
  d,
  progress,
  emphasized,
  muted,
}: {
  d: string
  progress: number
  emphasized: boolean
  muted: boolean
}) {
  const ref = useRef<SVGPathElement>(null)
  const [length, setLength] = useState(0)

  useLayoutEffect(() => {
    setLength(ref.current?.getTotalLength() ?? 0)
  }, [d])

  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={emphasized && !muted ? '#215743' : '#5C675F'}
      strokeWidth={emphasized && !muted ? 4 : 2.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      opacity={muted ? 0.18 : 0.95}
      strokeDasharray={length > 0 ? length : undefined}
      strokeDashoffset={length > 0 && progress < 1 ? length * (1 - progress) : 0}
    />
  )
}
