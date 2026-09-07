import { describe, expect, it } from 'vitest'

import { parseReps, pickCompleteReps, serializeReps } from '../reps'

describe('serializeReps / parseReps', () => {
  it('round-trips a list of attribution rows', () => {
    const reps = [
      { user_id: 'u1', branch_id: 'b1' },
      { user_id: 'u2', branch_id: 'b2' },
    ]
    expect(parseReps(serializeReps(reps))).toEqual(reps)
  })

  it('treats absent / blank / malformed JSON as an empty list', () => {
    for (const raw of [null, undefined, '', '   ', 'not json', '{}', '[{"user_id":"u1"}]']) {
      expect(parseReps(raw)).toEqual([])
    }
  })
})

describe('pickCompleteReps', () => {
  it('drops rows missing either id — the editor seeds blank rows', () => {
    expect(
      pickCompleteReps([
        { user_id: 'u1', branch_id: 'b1' },
        { user_id: '', branch_id: 'b2' },
        { user_id: 'u3', branch_id: '' },
        { user_id: '', branch_id: '' },
      ]),
    ).toEqual([{ user_id: 'u1', branch_id: 'b1' }])
  })

  it('returns an empty list for undefined', () => {
    expect(pickCompleteReps(undefined)).toEqual([])
  })
})
