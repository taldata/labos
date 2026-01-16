import { useState, useEffect, useCallback, useRef } from 'react';
import logger from '../utils/logger';

/**
 * Custom hook for fetch requests with automatic cancellation on unmount
 * Prevents memory leaks and "Can't perform state update on unmounted component" warnings
 *
 * @param {string} url - The URL to fetch from
 * @param {Object} options - Fetch options
 * @param {boolean} immediate - Whether to fetch immediately (default: true)
 * @returns {Object} - { data, loading, error, refetch }
 */
export function useFetch(url, options = {}, immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (fetchUrl = url, fetchOptions = options) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(fetchUrl, {
        ...fetchOptions,
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(result);
        setLoading(false);
      }

      return result;
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        logger.debug('Fetch aborted', { url: fetchUrl });
        return;
      }

      logger.error('Fetch error', { url: fetchUrl, error: err.message });

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }

      throw err;
    }
  }, [url, options]);

  useEffect(() => {
    isMountedRef.current = true;

    if (immediate) {
      fetchData();
    }

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, immediate]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * Custom hook for manual fetch requests (not executed immediately)
 * Useful for POST, PUT, DELETE requests triggered by user actions
 *
 * @returns {Object} - { data, loading, error, execute }
 */
export function useLazyFetch() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (url, options = {}) => {
    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setData(result);
        setLoading(false);
      }

      return result;
    } catch (err) {
      // Ignore abort errors
      if (err.name === 'AbortError') {
        logger.debug('Fetch aborted', { url });
        return;
      }

      logger.error('Fetch error', { url, error: err.message });

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(err.message);
        setLoading(false);
      }

      throw err;
    }
  }, []);

  return { data, loading, error, execute };
}

export default useFetch;
