import { useEffect, useState } from 'react';

/**
 * Returns a copy of `value` that only updates after `delayMs` of silence.
 * Use it to drive expensive effects (network requests) from free-text inputs
 * so typing does not fire one request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
