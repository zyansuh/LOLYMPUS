import { useState } from 'react'
import type { Member } from '../types.ts'
import { MAX_PARTICIPANTS } from '../lib/selection.ts'

type ParticipantSelectorProps = {
  members: Member[]
  selectedIds: string[]
  disabled: boolean
  onToggle: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
}

export function ParticipantSelector({
  members,
  selectedIds,
  disabled,
  onToggle,
  onSelectAll,
  onClear,
}: ParticipantSelectorProps) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [limitMessage, setLimitMessage] = useState<string | null>(null)
  const selected = new Set(selectedIds)
  const keyword = query.trim().toLocaleLowerCase()
  const visibleMembers = members.filter((member) =>
    member.name.toLocaleLowerCase().includes(keyword),
  )
  const selectedMembers = selectedIds.flatMap((id) => {
    const member = members.find((item) => item.id === id)
    return member ? [member] : []
  })
  const selectAllBlocked = members.length > MAX_PARTICIPANTS

  const toggle = (id: string) => {
    if (disabled) return
    if (!selected.has(id) && selectedIds.length >= MAX_PARTICIPANTS) {
      setLimitMessage('한 번에 최대 30명까지 선택할 수 있어요.')
      return
    }
    setLimitMessage(null)
    onToggle(id)
  }

  return (
    <section className="panel" aria-labelledby="participants-title">
      <div className="panel-heading">
        <h2 id="participants-title">오늘 참여자</h2>
        <p className="count-badge" aria-live="polite">
          {selectedIds.length} / {MAX_PARTICIPANTS}명
        </p>
      </div>

      {members.length === 0 ? (
        <p className="empty-copy">멤버를 먼저 등록해주세요</p>
      ) : (
        <>
          <div className="stack-form">
            <label htmlFor="participant-search">참여자 검색</label>
            <input
              id="participant-search"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="button-row">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || selectAllBlocked || members.length === 0}
              onClick={() => {
                setLimitMessage(null)
                onSelectAll()
              }}
            >
              전체 선택
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || selectedIds.length === 0}
              onClick={() => {
                setLimitMessage(null)
                onClear()
              }}
            >
              전체 해제
            </button>
            <button
              type="button"
              className="btn btn-secondary list-toggle"
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((open) => !open)}
            >
              {collapsed ? '목록 펼치기' : '목록 접기'}
            </button>
          </div>

          {selectAllBlocked ? (
            <p className="form-message">최대 30명까지 직접 선택해주세요</p>
          ) : null}
          {limitMessage ? (
            <p className="form-message" role="status">
              {limitMessage}
            </p>
          ) : null}

          <div className="participant-list" data-collapsed={collapsed ? 'true' : 'false'}>
            {visibleMembers.length === 0 ? (
              <p>검색 결과가 없어요.</p>
            ) : (
              <ul className="chips">
                {visibleMembers.map((member) => {
                  const pressed = selected.has(member.id)
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        className="chip"
                        aria-pressed={pressed}
                        disabled={disabled}
                        onClick={() => toggle(member.id)}
                      >
                        {pressed ? (
                          <span className="check" aria-hidden="true">
                            ✓
                          </span>
                        ) : (
                          <span className="check check-empty" aria-hidden="true" />
                        )}
                        <span>{member.name}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="selected-box">
            <h3>선택된 참여자</h3>
            {selectedMembers.length === 0 ? (
              <p className="muted">아직 선택한 참여자가 없어요.</p>
            ) : (
              <ul className="selected-names">
                {selectedMembers.map((member) => (
                  <li key={member.id}>{member.name}</li>
                ))}
              </ul>
            )}
          </div>

          {selectedIds.length < 2 ? <p className="form-message">2명 이상 선택해주세요</p> : null}
        </>
      )}
    </section>
  )
}
