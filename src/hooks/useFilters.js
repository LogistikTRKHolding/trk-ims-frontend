// src/hooks/useFilters.js
// Custom hook for multiple filters management

import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook untuk manage multiple filters
 * 
 * @param {Array} filterKeys - Array of filter keys (e.g., ['status', 'kategori', 'armada'])
 * @param {Object} defaultValues - Default filter values (default: all 'all')
 * @returns {Object} - Filters state and handlers
 */
export const useFilters = (filterKeys = [], defaultValues = {}) => {
  const initialFilters = useMemo(() => {
    return filterKeys.reduce((acc, key) => ({
      ...acc,
      [key]: defaultValues[key] || 'all'
    }), {});
  }, [filterKeys, defaultValues]);

  const [filters, setFilters] = useState(initialFilters);

  // Set a specific filter
  const setFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear a specific filter
  const clearFilter = useCallback((key) => {
    setFilters(prev => ({ ...prev, [key]: 'all' }));
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // Check if has active filters
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => value !== 'all');
  }, [filters]);

  // Get active filters for display
  const activeFilters = useMemo(() => {
    return Object.entries(filters)
      .filter(([_, value]) => value !== 'all')
      .map(([key, value]) => ({ key, value }));
  }, [filters]);

  return {
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilters,
  };
};

export default useFilters;