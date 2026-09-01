import { useEffect, useState } from 'react'

/**
 * Returns `value` delayed by `ms`. Use it to debounce search / filter inputs
 * that trigger a network request (`claude.md` B.7) so a repository query fires
 * only once the user pauses typing.
 */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])

  return debounced
}
