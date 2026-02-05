// src/hooks/useSorting.js
// Custom hook for sorting logic

import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook untuk sorting data
 * 
 * @param {Array} data - Array of data to sort
 * @param {Object} defaultConfig - Default sort config { key: 'id', direction: 'asc' }
 * @returns {Object} - Sorting state and handlers
 */
export const useSorting = (data = [], defaultConfig = { key: 'id', direction: 'asc' }) => {
  const [sortConfig, setSortConfig] = useState(defaultConfig);

  // Request sort on a specific key
  const requestSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Reset sort to default
  const resetSort = useCallback(() => {
    setSortConfig(defaultConfig);
  }, [defaultConfig]);

  // Apply sorting
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!sortConfig.key) return data;

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';

      // Handle different data types
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // String comparison
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aStr > bStr) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [data, sortConfig]);

  // Get sort indicator for UI
  const getSortIndicator = useCallback((key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  }, [sortConfig]);

  return {
    sortedData,
    sortConfig,
    requestSort,
    resetSort,
    getSortIndicator,
  };
};

export default useSorting;