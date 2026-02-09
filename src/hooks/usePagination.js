// src/hooks/usePagination.js
// Custom hook for pagination logic

import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook untuk pagination
 * 
 * @param {Array} data - Array of data to paginate
 * @param {number} defaultRowsPerPage - Default rows per page (default: 10)
 * @returns {Object} - Pagination state and handlers
 */
export const usePagination = (data = [], defaultRowsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [customRowsInput, setCustomRowsInput] = useState('');

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(data.length / rowsPerPage);
  }, [data.length, rowsPerPage]);

  // Get paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return data.slice(startIndex, startIndex + rowsPerPage);
  }, [data, currentPage, rowsPerPage]);

  // Handlers
  const handlePageChange = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const handleRowsPerPageChange = useCallback((newValue) => {
    setRowsPerPage(newValue);
    setCurrentPage(1); // Reset to first page
  }, []);

  const handleCustomRowsApply = useCallback(() => {
    const val = parseInt(customRowsInput);
    if (val > 0) {
      setRowsPerPage(val);
      setCurrentPage(1);
      setCustomRowsInput('');
    }
  }, [customRowsInput]);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  // Reset to page 1 when data changes
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    // Data
    paginatedData,
    
    // Pagination state
    currentPage,
    rowsPerPage,
    totalPages,
    totalRows: data.length,
    
    // Page navigation
    setCurrentPage: handlePageChange,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    resetPage,
    
    // Rows per page
    setRowsPerPage: handleRowsPerPageChange,
    customRowsInput,
    setCustomRowsInput,
    handleCustomRowsApply,
    
    // Pagination info
    startIndex: (currentPage - 1) * rowsPerPage + 1,
    endIndex: Math.min(currentPage * rowsPerPage, data.length),
  };
};

export default usePagination;