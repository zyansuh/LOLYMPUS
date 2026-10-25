import type { Ladder, Rung } from '../types.ts'
import { shuffle, type RandomInt } from './random.ts'

export const ladderMetrics = {
  colWidth: 84,
  rowHeight: 28,
  top: 12,
} as const

export type LadderMetrics = {
  colWidth: number
  rowHeight: number
  top: number
}

export type Point = {
  x: number
  y: number
}

export function defaultRowCount(columnCount: number): number {
  if (columnCount < 2) return 1
  return Math.min(14, Math.max(7, Math.round(columnCount * 0.45) + 6))
}

export function generateRungs(
  columnCount: number,
  randomInt: RandomInt,
  rowCount = defaultRowCount(columnCount),
): Rung[] {
  if (columnCount < 2) return []
  const rungs: Rung[] = []

  for (let row = 0; row < rowCount; row += 1) {
    const edges = shuffle(
      Array.from({ length: columnCount - 1 }, (_, index) => index),
      randomInt,
    )
    const usedColumns = new Set<number>()
    for (const left of edges) {
      if (usedColumns.has(left) || usedColumns.has(left + 1)) continue
      if (randomInt(100) < 65) {
        rungs.push({ row, left })
        usedColumns.add(left)
        usedColumns.add(left + 1)
      }
    }
  }

  return rungs.sort((left, right) => left.row - right.row || left.left - right.left)
}

export function rungsAreValid(rungs: readonly Rung[], columnCount: number, rowCount: number): boolean {
  const seen = new Set<string>()
  for (const rung of rungs) {
    if (!Number.isInteger(rung.row) || !Number.isInteger(rung.left)) return false
    if (rung.row < 0 || rung.row >= rowCount) return false
    if (rung.left < 0 || rung.left >= columnCount - 1) return false
    const key = `${rung.row}:${rung.left}`
    if (seen.has(key)) return false
    seen.add(key)
  }

  for (let row = 0; row < rowCount; row += 1) {
    const columns = new Set<number>()
    for (const rung of rungs) {
      if (rung.row !== row) continue
      if (columns.has(rung.left) || columns.has(rung.left + 1)) return false
      columns.add(rung.left)
      columns.add(rung.left + 1)
    }
  }

  return true
}

export function rungsByRow(rungs: readonly Rung[], rowCount: number): Array<Set<number>> {
  const rows = Array.from({ length: rowCount }, () => new Set<number>())
  for (const rung of rungs) {
    if (rung.row < 0 || rung.row >= rowCount) continue
    rows[rung.row]?.add(rung.left)
  }
  return rows
}

export function stepColumn(column: number, rungLefts: ReadonlySet<number>): number {
  if (rungLefts.has(column)) return column + 1
  if (column > 0 && rungLefts.has(column - 1)) return column - 1
  return column
}

export function traceColumn(ladder: Pick<Ladder, 'rungs' | 'rowCount'>, startColumn: number): number {
  const rows = rungsByRow(ladder.rungs, ladder.rowCount)
  let column = startColumn
  for (let row = 0; row < ladder.rowCount; row += 1) {
    column = stepColumn(column, rows[row] ?? new Set())
  }
  return column
}

export function columnX(column: number, colWidth: number = ladderMetrics.colWidth): number {
  return column * colWidth + colWidth / 2
}

export function ladderBottom(rowCount: number, metrics: LadderMetrics = ladderMetrics): number {
  return metrics.top + rowCount * metrics.rowHeight
}

export function ladderHeight(rowCount: number, metrics: LadderMetrics = ladderMetrics): number {
  return ladderBottom(rowCount, metrics) + metrics.top
}

export function buildPathPoints(
  ladder: Pick<Ladder, 'rungs' | 'rowCount'>,
  startColumn: number,
  metrics: LadderMetrics = ladderMetrics,
): Point[] {
  const rows = rungsByRow(ladder.rungs, ladder.rowCount)
  const points: Point[] = [{ x: columnX(startColumn, metrics.colWidth), y: metrics.top }]
  let column = startColumn

  for (let row = 0; row < ladder.rowCount; row += 1) {
    const y = metrics.top + (row + 1) * metrics.rowHeight
    const nextColumn = stepColumn(column, rows[row] ?? new Set())
    points.push({ x: columnX(column, metrics.colWidth), y })
    if (nextColumn !== column) {
      points.push({ x: columnX(nextColumn, metrics.colWidth), y })
      column = nextColumn
    }
  }

  return points
}

export function pointsToPath(points: readonly Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
    .join(' ')
}
