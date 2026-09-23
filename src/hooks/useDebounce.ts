import { useState, useEffect } from "react";

/**
 * Debounces a value — useful for search inputs that trigger DB queries.
 * Only updates the returned value after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
