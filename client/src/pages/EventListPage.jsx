import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getEvents, getCategories } from '../services/eventService';
import EventCard from '../components/ui/EventCard';
import useDebounce from '../hooks/useDebounce';
import useDocumentTitle from '../hooks/useDocumentTitle';

const SORT_OPTIONS = [
  { value: 'date', label: 'Date (Soonest)' },
  { value: '-date', label: 'Date (Latest)' },
  { value: 'price', label: 'Price (Low to High)' },
  { value: '-price', label: 'Price (High to Low)' },
  { value: 'createdAt', label: 'Newest' },
];

const ITEMS_PER_PAGE = 9;

const DEFAULT_FILTERS = {
  search: '',
  category: '',
  city: '',
  dateFrom: '',
  dateTo: '',
  priceMin: '',
  priceMax: '',
  sort: 'date',
  upcoming: true,
  page: 1,
};

const EventListPage = () => {
  useDocumentTitle('Events');

  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isInitialMount = useRef(true);

  const filters = useMemo(() => ({
    search: searchParams.get('search') || DEFAULT_FILTERS.search,
    category: searchParams.get('category') || DEFAULT_FILTERS.category,
    city: searchParams.get('city') || DEFAULT_FILTERS.city,
    dateFrom: searchParams.get('dateFrom') || DEFAULT_FILTERS.dateFrom,
    dateTo: searchParams.get('dateTo') || DEFAULT_FILTERS.dateTo,
    priceMin: searchParams.get('priceMin') || DEFAULT_FILTERS.priceMin,
    priceMax: searchParams.get('priceMax') || DEFAULT_FILTERS.priceMax,
    sort: searchParams.get('sort') || DEFAULT_FILTERS.sort,
    upcoming: searchParams.get('upcoming') !== 'false',
    page: parseInt(searchParams.get('page'), 10) || DEFAULT_FILTERS.page,
  }), [searchParams]);

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await getCategories();
        const rawCat = res.data?.categories || res.data || res || [];
        const catArr = Array.isArray(rawCat) ? rawCat : [];
        const normalized = catArr.map((c) => ({
          name: c.name || (c.category ? c.category.charAt(0).toUpperCase() + c.category.slice(1) : ''),
          slug: c.slug || c.category || '',
          eventCount: c.eventCount ?? c.count ?? 0,
        }));
        setCategories(normalized);
      } catch {
        /* Categories are not critical */
      }
    };
    fetchCategories();
  }, []);

  const updateFilters = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);

      Object.entries(updates).forEach(([key, value]) => {
        const defaultVal = DEFAULT_FILTERS[key];
        const isDefault =
          value === defaultVal ||
          value === '' ||
          value === undefined ||
          value === null;

        if (key === 'upcoming' && value === true) {
          next.delete(key);
        } else if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });

      if (!updates.page) {
        next.delete('page');
      }

      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (debouncedSearch !== filters.search) {
      updateFilters({ search: debouncedSearch, page: 1 });
    }
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = {
          page: filters.page,
          limit: ITEMS_PER_PAGE,
          sort: filters.sort,
        };

        if (filters.search) params.search = filters.search;
        if (filters.category) params.category = filters.category;
        if (filters.city) params.city = filters.city;
        if (filters.dateFrom) params.dateFrom = filters.dateFrom;
        if (filters.dateTo) params.dateTo = filters.dateTo;
        if (filters.priceMin) params.priceMin = filters.priceMin;
        if (filters.priceMax) params.priceMax = filters.priceMax;
        if (filters.upcoming) params.upcoming = true;

        const res = await getEvents(params);
        const responseData = res.data || res;
        setEvents(responseData.events || []);
        setTotalEvents(responseData.total || 0);
        setTotalPages(responseData.totalPages || Math.ceil((responseData.total || 0) / ITEMS_PER_PAGE) || 1);
      } catch {
        setEvents([]);
        setTotalEvents(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [filters]);

  const handleFilterChange = useCallback((key, value) => {
    if ((key === 'priceMin' || key === 'priceMax') && value !== '' && Number(value) < 0) {
      value = '0';
    }
    updateFilters({ [key]: value, page: 1 });
  }, [updateFilters]);

  const handlePageChange = useCallback((newPage) => {
    updateFilters({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateFilters]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const activeFilters = useMemo(() => {
    const chips = [];
    if (filters.search) chips.push({ key: 'search', label: `Search: "${filters.search}"` });
    if (filters.category) chips.push({ key: 'category', label: `Category: ${filters.category}` });
    if (filters.city) chips.push({ key: 'city', label: `City: ${filters.city}` });
    if (filters.dateFrom) chips.push({ key: 'dateFrom', label: `From: ${filters.dateFrom}` });
    if (filters.dateTo) chips.push({ key: 'dateTo', label: `To: ${filters.dateTo}` });
    if (filters.priceMin) chips.push({ key: 'priceMin', label: `Min Price: ₹${filters.priceMin}` });
    if (filters.priceMax) chips.push({ key: 'priceMax', label: `Max Price: ₹${filters.priceMax}` });
    if (filters.sort !== DEFAULT_FILTERS.sort) {
      const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sort)?.label || filters.sort;
      chips.push({ key: 'sort', label: `Sort: ${sortLabel}` });
    }
    if (!filters.upcoming) chips.push({ key: 'upcoming', label: 'Including past events' });
    return chips;
  }, [filters]);

  const removeFilter = useCallback((key) => {
    if (key === 'search') setSearchInput('');
    if (key === 'upcoming') {
      updateFilters({ [key]: true, page: 1 });
    } else {
      updateFilters({ [key]: DEFAULT_FILTERS[key], page: 1 });
    }
  }, [updateFilters]);

  const startIndex = (filters.page - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(filters.page * ITEMS_PER_PAGE, totalEvents);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, filters.page - 1);
      let end = Math.min(totalPages - 1, filters.page + 1);

      if (filters.page <= 2) end = 4;
      if (filters.page >= totalPages - 1) start = totalPages - 3;

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }, [totalPages, filters.page]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Explore Events
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Discover events that match your interests
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="lg:hidden flex items-center gap-2 w-full px-4 py-3 mb-6
                     bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                     text-gray-700 dark:text-gray-300 font-medium shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {activeFilters.length > 0 && (
            <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              {activeFilters.length}
            </span>
          )}
          <svg className={`w-5 h-5 ml-auto transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Active Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {activeFilters.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                           bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300
                           rounded-full border border-primary-200 dark:border-primary-800"
              >
                {chip.label}
                <button
                  onClick={() => removeFilter(chip.key)}
                  className="p-0.5 rounded-full hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400
                         font-medium transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex gap-8">
          {/* ═══════════════ FILTER SIDEBAR ═══════════════ */}
          <aside className={`
            ${filtersOpen ? 'block' : 'hidden'} lg:block
            w-full lg:w-72 shrink-0
          `}>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                            shadow-sm p-5 space-y-5 lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700
                             dark:hover:text-primary-300 font-medium transition-colors"
                >
                  Clear Filters
                </button>
              </div>

              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    id="search"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search events..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Category
                </label>
                <select
                  id="category"
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                             outline-none cursor-pointer transition-colors"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.slug || cat.name} value={cat.slug || cat.name?.toLowerCase()}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange('city', e.target.value)}
                  placeholder="Enter city..."
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                             outline-none transition-colors"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none transition-colors"
                    aria-label="From date"
                  />
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none transition-colors"
                    aria-label="To date"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Price Range (INR ₹)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filters.priceMin}
                    onChange={(e) => handleFilterChange('priceMin', e.target.value)}
                    placeholder="Min"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none transition-colors"
                    aria-label="Minimum price"
                  />
                  <span className="text-gray-400 shrink-0">—</span>
                  <input
                    type="number"
                    min="0"
                    value={filters.priceMax}
                    onChange={(e) => handleFilterChange('priceMax', e.target.value)}
                    placeholder="Max"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none transition-colors"
                    aria-label="Maximum price"
                  />
                </div>
              </div>

              {/* Upcoming Only Toggle */}
              <div className="flex items-center justify-between">
                <label htmlFor="upcoming" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upcoming Only
                </label>
                <button
                  id="upcoming"
                  role="switch"
                  aria-checked={filters.upcoming}
                  onClick={() => handleFilterChange('upcoming', !filters.upcoming)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                              dark:focus:ring-offset-gray-800
                              ${filters.upcoming ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg
                                transform ring-0 transition duration-200 ease-in-out
                                ${filters.upcoming ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </div>
          </aside>

          {/* ═══════════════ MAIN CONTENT ═══════════════ */}
          <main className="flex-1 min-w-0">
            {/* Results Info */}
            {!loading && totalEvents > 0 && (
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing <span className="font-semibold text-gray-900 dark:text-white">{startIndex}–{endIndex}</span> of{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalEvents}</span> {totalEvents === 1 ? 'event' : 'events'}
                </p>

                <div className="flex items-center gap-2">
                  <label htmlFor="sort-inline" className="text-sm text-gray-500 dark:text-gray-400">Sort:</label>
                  <select
                    id="sort-inline"
                    value={filters.sort}
                    onChange={(e) => handleFilterChange('sort', e.target.value)}
                    className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                               outline-none cursor-pointer transition-colors"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl overflow-hidden
                                          border border-gray-200 dark:border-gray-700">
                    <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                    <div className="p-4 space-y-3">
                      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-full mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && events.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4
                              bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <svg className="w-24 h-24 text-gray-300 dark:text-gray-600 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                </svg>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No events found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
                  We couldn&apos;t find any events matching your criteria. Try adjusting your filters or search terms.
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg
                             hover:bg-primary-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Event Grid */}
            {!loading && events.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard key={event._id || event.id} event={event} />
                ))}
              </div>
            )}

            {/* ═══════════════ PAGINATION ═══════════════ */}
            {!loading && totalPages > 1 && (
              <nav className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4" aria-label="Pagination">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Page <span className="font-semibold text-gray-900 dark:text-white">{filters.page}</span> of{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                </p>

                <div className="flex items-center gap-1">
                  {/* Previous */}
                  <button
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={filters.page <= 1}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                    aria-label="Previous page"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>

                  {/* Page Numbers */}
                  {pageNumbers.map((pageNum, idx) =>
                    pageNum === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-2 text-sm text-gray-400 dark:text-gray-500">
                        ...
                      </span>
                    ) : (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors
                          ${filters.page === pageNum
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        aria-label={`Page ${pageNum}`}
                        aria-current={filters.page === pageNum ? 'page' : undefined}
                      >
                        {pageNum}
                      </button>
                    )
                  )}

                  {/* Next */}
                  <button
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={filters.page >= totalPages}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800"
                    aria-label="Next page"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </nav>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default EventListPage;
