export type RandomInt = (maxExclusive: number) => number

const UINT32_RANGE = 0x100000000

export function cryptoRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer')
  }
  if (maxExclusive === 1) return 0

  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0] ?? 0
  } while (value >= limit)

  return value % maxExclusive
}

export function mulberry32(seed: number): RandomInt {
  let state = seed >>> 0
  const nextUint = () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return (mixed ^ (mixed >>> 14)) >>> 0
  }

  return (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer')
    }
    if (maxExclusive === 1) return 0
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
    let value = nextUint()
    while (value >= limit) value = nextUint()
    return value % maxExclusive
  }
}

export function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const next = items.slice()
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new Error('randomInt returned a value outside the expected range')
    }
    const current = next[index]
    next[index] = next[swapIndex] as T
    next[swapIndex] = current as T
  }
  return next
}
