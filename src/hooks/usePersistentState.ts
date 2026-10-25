import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../types.ts'
import { loadState, saveState } from '../lib/storage.ts'

export function usePersistentState(): [AppState, Dispatch<SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  return [state, setState]
}
