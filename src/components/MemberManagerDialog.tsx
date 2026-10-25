import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, RefObject } from 'react'
import type { Member } from '../types.ts'
import { DUPLICATE_NAME_MESSAGE } from '../lib/members.ts'

const FOCUSABLE = [
  'a[href]',
  'button:not(:disabled)',
  'input:not(:disabled)',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type MemberManagerDialogProps = {
  members: Member[]
  onClose: () => void
  onAdd: (name: string) => string | null
  onAddMany: (raw: string) => { message: string; clear: boolean }
  onRename: (id: string, name: string) => string | null
  onDelete: (id: string) => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

export function MemberManagerDialog({
  members,
  onClose,
  onAdd,
  onAddMany,
  onRename,
  onDelete,
  returnFocusRef,
}: MemberManagerDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [bulk, setBulk] = useState('')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    const returnTo = returnFocusRef.current
    if (!dialog) return

    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hasAttribute('disabled'),
      )

    const frame = window.requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>('#member-name')?.focus()
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      returnTo?.focus()
    }
  }, [onClose, returnFocusRef])

  const visibleMembers = members.filter((member) =>
    member.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  const submitOne = (event: FormEvent) => {
    event.preventDefault()
    const error = onAdd(name)
    setMessage(error)
    if (!error) setName('')
  }

  const submitMany = () => {
    const feedback = onAddMany(bulk)
    setMessage(feedback.message)
    if (feedback.clear) setBulk('')
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editingId) return
    const error = onRename(editingId, editingName)
    setMessage(error)
    if (!error) {
      setEditingId(null)
      setEditingName('')
    }
  }

  const onBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-tape" aria-hidden="true" />
        <div className="modal-body">
          <h2 id={titleId} className="modal-title">
            멤버 노트
          </h2>
          <p className="muted">
            한 명씩 추가하거나, 줄바꿈 또는 쉼표로 여러 명을 등록할 수 있어요.
          </p>

          <form className="stack-form" onSubmit={submitOne}>
            <label htmlFor="member-name">이름</label>
            <div className="inline-fields">
              <input
                id="member-name"
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                추가
              </button>
            </div>
          </form>

          <div className="stack-form">
            <label htmlFor="bulk-names">여러 명 추가</label>
            <textarea
              id="bulk-names"
              rows={4}
              value={bulk}
              placeholder="줄바꿈 또는 쉼표로 구분해 입력하세요"
              onChange={(event) => setBulk(event.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={submitMany}>
              일괄 추가
            </button>
          </div>

          {message ? (
            <p className="form-message" role="status">
              {message}
            </p>
          ) : null}
          <p className="muted">{DUPLICATE_NAME_MESSAGE}</p>

          <div className="stack-form">
            <label htmlFor="member-search">멤버 검색</label>
            <input
              id="member-search"
              value={query}
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <h3 className="section-label">등록된 멤버 {members.length}명</h3>
          {members.length === 0 ? (
            <p>등록된 멤버가 없어요.</p>
          ) : visibleMembers.length === 0 ? (
            <p>검색 결과가 없어요.</p>
          ) : (
            <ul className="member-list">
              {visibleMembers.map((member) => (
                <li key={member.id}>
                  {editingId === member.id ? (
                    <form className="member-edit" onSubmit={saveEdit}>
                      <label className="sr-only" htmlFor={`edit-${member.id}`}>
                        이름 수정
                      </label>
                      <input
                        id={`edit-${member.id}`}
                        value={editingName}
                        autoComplete="off"
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                      <button type="submit" className="btn btn-primary">
                        저장
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingId(null)
                          setEditingName('')
                        }}
                      >
                        취소
                      </button>
                    </form>
                  ) : (
                    <div className="member-row">
                      <span>{member.name}</span>
                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label={`${member.name} 수정`}
                          onClick={() => {
                            setEditingId(member.id)
                            setEditingName(member.name)
                            setMessage(null)
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-label={`${member.name} 삭제`}
                          onClick={() => onDelete(member.id)}
                        >
                          삭제
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary btn-wide" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  )
}
