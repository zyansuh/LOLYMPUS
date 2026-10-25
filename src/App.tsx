import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LadderBoard } from './components/LadderBoard.tsx'
import { MatchPreview } from './components/MatchPreview.tsx'
import { MatchResults } from './components/MatchResults.tsx'
import { MemberManagerDialog } from './components/MemberManagerDialog.tsx'
import { ParticipantSelector } from './components/ParticipantSelector.tsx'
import { RoundHistory } from './components/RoundHistory.tsx'
import { usePersistentState } from './hooks/usePersistentState.ts'
import { teamGroups } from './lib/composition.ts'
import { createDraw } from './lib/draw.ts'
import { createId } from './lib/id.ts'
import {
  DUPLICATE_NAME_MESSAGE,
  addMemberNames,
  normalizeName,
  removeMemberFromState,
  renameMember,
  splitNameInput,
} from './lib/members.ts'
import { cryptoRandomInt } from './lib/random.ts'
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, sameIdSet, selectAllIds, toggleSelected } from './lib/selection.ts'
import { MAX_HISTORY } from './lib/storage.ts'
import type { AppState, RoundResult } from './types.ts'

type Phase = 'setup' | 'ready' | 'drawing' | 'done'

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function selectionMatches(result: RoundResult | null, selectedIds: readonly string[]): boolean {
  if (!result) return false
  return sameIdSet(
    result.participants.map((participant) => participant.id),
    selectedIds,
  )
}

function phaseOf(state: AppState, drawing: boolean): Phase {
  if (drawing) return 'drawing'
  if (!selectionMatches(state.currentResult, state.selectedIds)) return 'setup'
  return state.revealed ? 'done' : 'ready'
}

function latestCompletedRound(state: AppState): number {
  if (state.revealed && state.currentResult) return state.currentResult.round
  return state.history[0]?.round ?? 0
}

function App() {
  const [state, setState] = usePersistentState()
  const [memberOpen, setMemberOpen] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [progress, setProgress] = useState(1)
  const [animationToken, setAnimationToken] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const memberButtonRef = useRef<HTMLButtonElement>(null)
  const stateRef = useRef(state)
  const phaseRef = useRef<Phase>('setup')
  const lockRef = useRef(false)
  const runRef = useRef(0)
  const hydratedRef = useRef(false)
  stateRef.current = state
  const phase = phaseOf(state, isDrawing)
  phaseRef.current = phase

  const closeMembers = useCallback(() => setMemberOpen(false), [])

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    if (state.currentResult && !state.revealed) setProgress(0)
  }, [state.currentResult, state.revealed])

  useEffect(() => {
    if (!isDrawing) return
    const runId = runRef.current + 1
    runRef.current = runId
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      if (runRef.current !== runId) return
      const value = Math.min(1, (now - start) / 1100)
      setProgress(value)
      if (value < 1) {
        frame = requestAnimationFrame(step)
        return
      }
      setIsDrawing(false)
      setState((current) => ({ ...current, revealed: true }))
      lockRef.current = false
      phaseRef.current = 'done'
    }
    frame = requestAnimationFrame(step)
    return () => {
      if (runRef.current === runId) runRef.current += 1
      cancelAnimationFrame(frame)
    }
  }, [animationToken, isDrawing])

  const selectedMembers = state.selectedIds.flatMap((id) => {
    const member = state.members.find((item) => item.id === id)
    return member ? [member] : []
  })

  const applySelection = (selectedIds: string[]) => {
    if (phaseRef.current === 'drawing') return
    const current = stateRef.current
    const changed = current.selectedIds.join('\0') !== selectedIds.join('\0')
    const nextResult = changed && current.currentResult && !current.revealed ? null : current.currentResult
    setState((snapshot) => ({
      ...snapshot,
      selectedIds,
      currentResult: changed && snapshot.currentResult && !snapshot.revealed ? null : snapshot.currentResult,
    }))
    setHighlightId(null)
    if (nextResult && current.revealed && selectionMatches(nextResult, selectedIds)) setProgress(1)
    phaseRef.current = phaseOf(
      { ...current, selectedIds, currentResult: nextResult },
      false,
    )
  }

  const buildResult = (): RoundResult | null => {
    const current = stateRef.current
    const participants = current.selectedIds.flatMap((id) => {
      const member = current.members.find((item) => item.id === id)
      return member ? [member] : []
    })
    if (participants.length < MIN_PARTICIPANTS || participants.length > MAX_PARTICIPANTS) return null

    const completed = current.revealed ? current.currentResult : null
    const samePeople = completed
      ? sameIdSet(
          completed.participants.map((participant) => participant.id),
          participants.map((participant) => participant.id),
        )
      : false
    const draw = createDraw(
      participants,
      samePeople && completed ? teamGroups(completed.assignments) : null,
      cryptoRandomInt,
    )

    return {
      id: createId(),
      round: latestCompletedRound(current) + 1,
      createdAt: new Date().toISOString(),
      participants: participants.map((participant) => ({ id: participant.id, name: participant.name })),
      plan: draw.plan,
      ladder: draw.ladder,
      assignments: draw.assignments,
      sameComposition: draw.sameComposition,
      cannotChangeComposition: draw.cannotChangeComposition,
    }
  }

  const storeResult = (result: RoundResult, revealed: boolean) => {
    setState((current) => ({
      ...current,
      history:
        current.revealed && current.currentResult
          ? [current.currentResult, ...current.history].slice(0, MAX_HISTORY)
          : current.history,
      currentResult: result,
      revealed,
    }))
  }

  const beginAnimation = () => {
    if (prefersReducedMotion()) {
      setProgress(1)
      setIsDrawing(false)
      setState((current) => ({ ...current, revealed: true }))
      lockRef.current = false
      phaseRef.current = 'done'
      return
    }
    setProgress(0)
    setIsDrawing(true)
    setAnimationToken((token) => token + 1)
  }

  const finishImmediately = () => {
    runRef.current += 1
    setProgress(1)
    setIsDrawing(false)
    setState((current) => ({ ...current, revealed: true }))
    lockRef.current = false
    phaseRef.current = 'done'
  }

  const onPrimary = () => {
    if (lockRef.current || phaseRef.current === 'drawing') return
    if (stateRef.current.selectedIds.length < MIN_PARTICIPANTS) return
    const currentPhase = phaseRef.current

    if (currentPhase === 'ready') {
      lockRef.current = true
      phaseRef.current = 'drawing'
      setHighlightId(null)
      beginAnimation()
      return
    }

    lockRef.current = true
    const result = buildResult()
    if (!result) {
      lockRef.current = false
      return
    }
    const autoStart = currentPhase === 'done'
    const reduce = prefersReducedMotion()
    setHighlightId(null)
    if (autoStart && !reduce) {
      phaseRef.current = 'drawing'
      setProgress(0)
      storeResult(result, false)
      beginAnimation()
      return
    }
    if (autoStart && reduce) {
      phaseRef.current = 'done'
      setProgress(1)
      storeResult(result, true)
      lockRef.current = false
      return
    }
    phaseRef.current = 'ready'
    setProgress(0)
    storeResult(result, false)
    lockRef.current = false
  }

  const addOne = (raw: string): string | null => {
    const name = normalizeName(raw)
    if (!name) return '이름을 입력해주세요.'
    if (stateRef.current.members.some((member) => member.name === name)) return DUPLICATE_NAME_MESSAGE
    const member = { id: createId(), name }
    setState((current) => {
      if (current.members.some((item) => item.id === member.id || item.name === name)) return current
      return { ...current, members: [...current.members, member] }
    })
    return null
  }

  const addMany = (raw: string): { message: string; clear: boolean } => {
    const names = splitNameInput(raw)
    if (names.length === 0) return { message: '이름을 입력해주세요.', clear: false }
    const result = addMemberNames(stateRef.current.members, names, createId)
    if (result.added.length === 0) return { message: DUPLICATE_NAME_MESSAGE, clear: false }
    setState((current) => {
      const known = new Set(current.members.map((member) => member.id))
      const newcomers = result.members.filter((member) => !known.has(member.id))
      if (newcomers.length === 0) return current
      return { ...current, members: [...current.members, ...newcomers] }
    })
    if (result.skipped.length > 0) {
      return {
        message: `${result.added.length}명을 추가했어요. ${DUPLICATE_NAME_MESSAGE}`,
        clear: true,
      }
    }
    return { message: `${result.added.length}명을 추가했어요.`, clear: true }
  }

  const rename = (id: string, raw: string): string | null => {
    let error: string | null = null
    setState((current) => {
      const result = renameMember(current.members, id, raw)
      error = result.error
      if (result.error) return current
      const renamed = result.members.find((member) => member.id === id)
      const currentResult =
        renamed && current.currentResult && !current.revealed
          ? {
              ...current.currentResult,
              participants: current.currentResult.participants.map((participant) =>
                participant.id === id ? { ...participant, name: renamed.name } : participant,
              ),
              assignments: current.currentResult.assignments.map((assignment) =>
                assignment.memberId === id ? { ...assignment, name: renamed.name } : assignment,
              ),
            }
          : current.currentResult
      return { ...current, members: result.members, currentResult }
    })
    return error
  }

  const remove = (id: string) => {
    if (phaseRef.current === 'drawing') return
    setHighlightId(null)
    setState((current) => {
      const next = removeMemberFromState(current, id)
      const selectionChanged = next.selectedIds.length !== current.selectedIds.length
      if (selectionChanged && current.currentResult && !current.revealed) {
        return { ...next, currentResult: null }
      }
      return next
    })
  }

  const showLadder = phase !== 'setup' && state.currentResult !== null
  const showResults = phase === 'done' && state.currentResult !== null
  const invalidated = state.currentResult !== null && state.revealed && phase === 'setup'
  const pastRounds = invalidated && state.currentResult ? [state.currentResult, ...state.history] : state.history
  const nextRound = latestCompletedRound(state) + 1
  const primaryLabel =
    phase === 'drawing'
      ? '추첨 중'
      : phase === 'ready'
        ? '추첨 시작'
        : phase === 'done'
          ? '다음 판 · 팀 다시 섞기'
          : nextRound === 1
            ? '1라운드 팀 추첨'
            : `${nextRound}라운드 팀 추첨`
  const primaryDisabled = isDrawing || selectedMembers.length < MIN_PARTICIPANTS
  const hint =
    state.members.length === 0
      ? '멤버를 먼저 등록해주세요'
      : selectedMembers.length < MIN_PARTICIPANTS
        ? '2명 이상 선택해주세요'
        : null

  return (
    <div className="page">
      <header className="site-header">
        <Link to="/" className="brand" aria-label="롤림푸스 홈">
          <span className="brand-ko">롤림푸스</span>
          <span className="brand-en">LOLYMPUS</span>
        </Link>
        <button
          ref={memberButtonRef}
          type="button"
          className="btn btn-secondary member-button"
          disabled={isDrawing}
          onClick={() => setMemberOpen(true)}
        >
          멤버 관리
        </button>
      </header>

      <main className="note">
        <div className="tape" aria-hidden="true" />
        <div className="rule-band" aria-hidden="true" />
        <div className="note-heading">
          <h1>오늘의 팀 편성</h1>
          <p>멤버와 결과는 이 브라우저에 저장됩니다</p>
        </div>

        <div className="workspace">
          <ParticipantSelector
            members={state.members}
            selectedIds={state.selectedIds}
            disabled={isDrawing}
            onToggle={(id) => {
              const next = toggleSelected(stateRef.current.selectedIds, id)
              if (!next.limited) applySelection(next.selectedIds)
            }}
            onSelectAll={() => {
              const ids = selectAllIds(stateRef.current.members.map((member) => member.id))
              if (ids) applySelection(ids)
            }}
            onClear={() => applySelection([])}
          />

          <div className="stage">
            <MatchPreview participantCount={selectedMembers.length} />
            {invalidated ? (
              <p className="banner" role="status">
                참여자가 바뀌어 현재 사다리가 무효화되었어요. 다음 추첨부터 새 참여자로 진행합니다.
              </p>
            ) : null}
            {phase === 'ready' ? (
              <p className="banner" role="status">
                사다리를 만들었어요. 추첨 시작을 누르면 경로가 공개돼요.
              </p>
            ) : null}
            {showLadder && state.currentResult ? (
              <LadderBoard
                result={state.currentResult}
                progress={progress}
                drawing={isDrawing}
                highlightId={highlightId}
                onHighlight={setHighlightId}
              />
            ) : (
              <section className="panel placeholder">
                <h2>사다리</h2>
                <p>참여자를 고르고 팀 추첨을 시작하면 사다리가 여기에 표시돼요.</p>
              </section>
            )}
          </div>
        </div>

        {showResults && state.currentResult ? (
          <MatchResults
            result={state.currentResult}
            highlightedId={highlightId}
            onHighlight={setHighlightId}
          />
        ) : (
          <section className="results results-empty">
            <h2>결과</h2>
            <p>참여자를 고르고 팀 추첨을 시작하면 경기별 팀이 여기에 표시돼요.</p>
          </section>
        )}

        <div className="action-bar">
          {phase === 'drawing' ? (
            <button type="button" className="btn btn-secondary btn-wide" onClick={finishImmediately}>
              결과 바로 보기
            </button>
          ) : null}
          <button
            type="button"
            className={phase === 'done' ? 'btn btn-primary btn-next' : 'btn btn-primary btn-next'}
            disabled={primaryDisabled}
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
          {hint ? (
            <p id="draw-hint" className="form-message">
              {hint}
            </p>
          ) : null}
        </div>

        <RoundHistory rounds={pastRounds} />
      </main>

      <p className="sr-only" aria-live="polite">
        {isDrawing
          ? '팀 추첨을 진행하고 있어요.'
          : showResults && state.currentResult
            ? `${state.currentResult.round}라운드 결과가 준비되었어요.`
            : ''}
      </p>

      {memberOpen ? (
        <MemberManagerDialog
          members={state.members}
          onClose={closeMembers}
          onAdd={addOne}
          onAddMany={addMany}
          onRename={rename}
          onDelete={remove}
          returnFocusRef={memberButtonRef}
        />
      ) : null}
    </div>
  )
}

export default App
