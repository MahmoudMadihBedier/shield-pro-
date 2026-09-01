import { useEffect, useState } from 'react'

/**
 * Debounce a rapidly changing value (e.g. a search box) so downstream network
 * queries only fire once the user pauses (`claude.md` B.7).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
