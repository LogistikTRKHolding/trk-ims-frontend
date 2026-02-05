import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Custom hook untuk data table dengan fitur lengkap:
 * - Data fetching
 * - Search dengan debounce
 * - Multiple filters (including date filters)
 * - Sorting
 * - Pagination
 * - Statistics
 * - Date filtering (single date & date range)
 */
export const useDataTable = ({
  fetchData,
  filterKeys = [],
  searchKeys = [],
  dateFilterKey = null, // NEW: Key untuk filter tanggal (e.g., 'tanggal', 'created_at')
  defaultSort = null,
  defaultRowsPerPage = 10,
  calculateStats = null,
}) => {
  // Data states
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Filter states
  const [filters, setFilters] = useState(
    filterKeys.reduce((acc, key) => ({ ...acc, [key]: 'all' }), {})
  );

  // NEW: Date filter states
  const [dateFilterMode, setDateFilterMode] = useState('all'); // 'all' | 'single' | 'range'
  const [singleDate, setSingleDate] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Sorting state
  const [sortConfig, setSortConfig] = useState(
    defaultSort || { key: null, direction: 'asc' }
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [customRowsInput, setCustomRowsInput] = useState('');

  // Ref untuk stable fetchData reference
  const fetchDataRef = useRef(fetchData);

  // Update ref when fetchData changes
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial data load
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchDataRef.current();
        if (isMounted) {
          setAllData(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load data');
          setAllData([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // NEW: Helper function to convert date string to YYYY-MM-DD format
  const convertToDateInputFormat = useCallback((dateStr) => {
    if (!dateStr) return '';
    
    try {
      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      let date;
      
      // DD/MM/YYYY format
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        date = new Date(year, month - 1, day);
      }
      // DD-MM-YYYY format
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('-');
        date = new Date(year, month - 1, day);
      }
      // ISO format or other formats
      else {
        date = new Date(dateStr);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', dateStr);
        return '';
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error converting date:', error);
      return '';
    }
  }, []);

  // NEW: Helper function to compare dates
  const compareDates = useCallback((dateStr1, dateStr2) => {
    const date1 = new Date(convertToDateInputFormat(dateStr1));
    const date2 = new Date(convertToDateInputFormat(dateStr2));
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) {
      return null;
    }
    
    // Set time to 00:00:00 for date-only comparison
    date1.setHours(0, 0, 0, 0);
    date2.setHours(0, 0, 0, 0);
    
    return date1.getTime() - date2.getTime();
  }, [convertToDateInputFormat]);

  // Filtered data (search + filters + date filter)
  const filteredData = useMemo(() => {
    let result = [...allData];

    // Apply search filter
    if (debouncedSearchQuery && searchKeys.length > 0) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = String(item[key] || '').toLowerCase();
          return value.includes(query);
        })
      );
    }

    // Apply regular filters
    filterKeys.forEach((key) => {
      if (filters[key] && filters[key] !== 'all') {
        result = result.filter((item) => {
          const itemValue = item[key];
          const filterValue = filters[key];
          
          // Handle boolean values
          if (typeof itemValue === 'boolean') {
            return String(itemValue) === filterValue;
          }
          
          return String(itemValue).toLowerCase() === String(filterValue).toLowerCase();
        });
      }
    });

    // NEW: Apply date filter
    if (dateFilterKey && dateFilterMode !== 'all') {
      result = result.filter((item) => {
        const itemDate = item[dateFilterKey];
        if (!itemDate) return false;

        // Single date filter
        if (dateFilterMode === 'single' && singleDate) {
          const comparison = compareDates(itemDate, singleDate);
          return comparison === 0;
        }

        // Date range filter
        if (dateFilterMode === 'range') {
          let passesFilter = true;

          if (dateRangeStart) {
            const comparison = compareDates(itemDate, dateRangeStart);
            if (comparison === null || comparison < 0) {
              passesFilter = false;
            }
          }

          if (passesFilter && dateRangeEnd) {
            const comparison = compareDates(itemDate, dateRangeEnd);
            if (comparison === null || comparison > 0) {
              passesFilter = false;
            }
          }

          return passesFilter;
        }

        return true;
      });
    }

    return result;
  }, [
    allData,
    debouncedSearchQuery,
    searchKeys,
    filters,
    filterKeys,
    dateFilterKey,
    dateFilterMode,
    singleDate,
    dateRangeStart,
    dateRangeEnd,
    compareDates,
  ]);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }

      // Handle strings
      const comparison = String(aValue).localeCompare(String(bValue), 'id', {
        numeric: true,
        sensitivity: 'base',
      });

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, rowsPerPage]);

  // Pagination info
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const totalRows = sortedData.length;

  // Statistics (if calculateStats provided)
  const stats = useMemo(() => {
    if (!calculateStats) return null;
    return calculateStats(filteredData, allData);
  }, [filteredData, allData, calculateStats]);

  // Filter helpers
  const setFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters((prev) => ({ ...prev, [key]: 'all' }));
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(
      filterKeys.reduce((acc, key) => ({ ...acc, [key]: 'all' }), {})
    );
    setSearchQuery('');
    setDateFilterMode('all');
    setSingleDate('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setCurrentPage(1);
  }, [filterKeys]);

  const hasActiveFilters = useMemo(() => {
    const hasRegularFilters = Object.values(filters).some((v) => v !== 'all');
    const hasSearch = debouncedSearchQuery.length > 0;
    const hasDateFilter = dateFilterMode !== 'all';
    return hasRegularFilters || hasSearch || hasDateFilter;
  }, [filters, debouncedSearchQuery, dateFilterMode]);

  const activeFilters = useMemo(() => {
    const active = [];
    
    // Regular filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== 'all') {
        active.push({ key, value, type: 'filter' });
      }
    });
    
    // Search
    if (debouncedSearchQuery) {
      active.push({ key: 'search', value: debouncedSearchQuery, type: 'search' });
    }
    
    // Date filters
    if (dateFilterMode === 'single' && singleDate) {
      active.push({ key: 'date', value: singleDate, type: 'date-single' });
    }
    if (dateFilterMode === 'range' && (dateRangeStart || dateRangeEnd)) {
      const rangeValue = `${dateRangeStart || '...'} - ${dateRangeEnd || '...'}`;
      active.push({ key: 'date', value: rangeValue, type: 'date-range' });
    }
    
    return active;
  }, [filters, debouncedSearchQuery, dateFilterMode, singleDate, dateRangeStart, dateRangeEnd]);

  // Sorting helpers
  const requestSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  // Pagination helpers
  const handleCustomRowsApply = useCallback(() => {
    const value = parseInt(customRowsInput);
    if (!isNaN(value) && value > 0) {
      setRowsPerPage(value);
      setCurrentPage(1);
      setCustomRowsInput('');
    }
  }, [customRowsInput]);

  // NEW: Date filter helpers
  const setQuickDateFilter = useCallback((type) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch(type) {
      case 'today':
        setDateFilterMode('single');
        setSingleDate(todayStr);
        setCurrentPage(1);
        break;
        
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        setDateFilterMode('single');
        setSingleDate(yesterday.toISOString().split('T')[0]);
        setCurrentPage(1);
        break;
        
      case 'this-week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + (6 - today.getDay()));
        setDateFilterMode('range');
        setDateRangeStart(weekStart.toISOString().split('T')[0]);
        setDateRangeEnd(weekEnd.toISOString().split('T')[0]);
        setCurrentPage(1);
        break;
        
      case 'this-month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateFilterMode('range');
        setDateRangeStart(monthStart.toISOString().split('T')[0]);
        setDateRangeEnd(monthEnd.toISOString().split('T')[0]);
        setCurrentPage(1);
        break;
        
      case 'last-month':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        setDateFilterMode('range');
        setDateRangeStart(lastMonthStart.toISOString().split('T')[0]);
        setDateRangeEnd(lastMonthEnd.toISOString().split('T')[0]);
        setCurrentPage(1);
        break;
        
      default:
        break;
    }
  }, []);

  const clearDateFilter = useCallback(() => {
    setDateFilterMode('all');
    setSingleDate('');
    setDateRangeStart('');
    setDateRangeEnd('');
    setCurrentPage(1);
  }, []);

  // Refresh function
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchDataRef.current();
      setAllData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
      setAllData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Data
    data: paginatedData,
    allData,
    filteredData,
    sortedData,
    loading,
    error,

    // Search
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,

    // Filters
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilters,

    // Date Filters (NEW)
    dateFilterMode,
    setDateFilterMode,
    singleDate,
    setSingleDate,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    setQuickDateFilter,
    clearDateFilter,

    // Sorting
    sortConfig,
    requestSort,

    // Pagination
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    customRowsInput,
    setCustomRowsInput,
    handleCustomRowsApply,
    totalPages,
    totalRows,

    // Stats
    stats,

    // Utilities
    refresh,
  };
};