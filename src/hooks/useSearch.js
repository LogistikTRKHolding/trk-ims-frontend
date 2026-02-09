// src/hooks/useSearch.js
// Custom hook for search functionality with debounce

import { useState, useEffect } from 'react';

/**
 * Custom hook untuk search dengan debounce
 * 
 * @param {number} delay - Debounce delay in milliseconds (default: 300)
 * @returns {Object} - Search state and handlers
 */
export const useSearch = (delay = 300) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, delay]);

  const clearSearch = () => {
    setSearchQuery('');
  };

  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    clearSearch,
  };
};

export default useSearch;