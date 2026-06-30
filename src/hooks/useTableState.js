import { useState, useMemo, useCallback } from 'react';

/**
 * Custom hook for table state management: search, sort, selection, and pagination.
 *
 * @param {Object} options
 * @param {Array} options.data - The full dataset to operate on
 * @param {Function} options.searchFn - Function(item, query) => boolean for filtering
 * @param {string} options.defaultSortField - Default sort field
 * @param {string} options.defaultSortDir - Default sort direction ('asc' or 'desc')
 * @param {number} options.pageSize - Items per page (default 50)
 */
export function useTableState({
  data = [],
  searchFn = () => true,
  defaultSortField = 'created_at',
  defaultSortDir = 'desc',
  pageSize = 50,
} = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortDir, setSortDir] = useState(defaultSortDir);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filter + sort
  const processedData = useMemo(() => {
    let result = data;

    // Search
    if (searchQuery.trim()) {
      result = result.filter(item => searchFn(item, searchQuery.trim().toLowerCase()));
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      let cmp;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else {
        cmp = String(aVal || '').localeCompare(String(bVal || ''));
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [data, searchQuery, sortField, sortDir, searchFn]);

  const handleSort = useCallback((field) => {
    setSortField(prevSortField => {
      if (prevSortField === field) {
        setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      return field;
    });
  }, []);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.length === processedData.length ? [] : processedData.map(item => item.id)
    );
  }, [processedData]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const resetPage = useCallback(() => setPage(0), []);

  return {
    searchQuery,
    setSearchQuery,
    sortField,
    sortDir,
    handleSort,
    selectedIds,
    setSelectedIds,
    handleToggleSelect,
    handleToggleSelectAll,
    clearSelection,
    processedData,
    page,
    setPage,
    hasMore,
    setHasMore,
    resetPage,
    pageSize,
  };
}
