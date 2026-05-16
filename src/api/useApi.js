// src/api/useApi.js
// Generic hook that wraps an async API call with loading + error state.

import { useState, useCallback } from "react";

/**
 * @param {Function} apiFn  — async function that returns the API data
 * @returns {{ call, data, loading, error, reset }}
 */
export function useApi(apiFn) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || "Unexpected error");
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { call, data, loading, error, reset };
}
