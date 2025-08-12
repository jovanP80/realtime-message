import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Meteor } from 'meteor/meteor';
 
import { OfflineMessages } from './hooks/useMessages';
 
import { FiltersState, useMessages } from './hooks/useMessages';
import { FiltersBar } from './components/FiltersBar';
import { MessagesList } from './components/MessagesList';
import { Toolbar } from './components/Toolbar';

const DEFAULT_FILTERS: FiltersState = {
  types: { info: true, warn: true, error: true, debug: true },
  source: '',
  search: '',
  startDate: '',
  endDate: '',
  sortDirection: 'desc',
  pageSize: 50,
};

export const MessagesPage: React.FC = () => {
  const [filtersDraft, setFiltersDraft] = useState<FiltersState>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [pages, setPages] = useState<number>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limit = useMemo(() => Math.max(filters.pageSize, pages * filters.pageSize), [filters.pageSize, pages]);
  const { messages, sourceOptions, ready } = useMessages(filters, limit, paused);

  const onIntersect = useCallback(() => setPages((p) => p + 1), []);

  const fetchOlderWhenPaused = useCallback(async (before: Date | null) => {
    if (!paused) return;
    const enabledTypes = (Object.keys(filters.types) as Array<keyof typeof filters.types>).filter((t) => filters.types[t]);
    const qs = new URLSearchParams();
    if (enabledTypes.length && enabledTypes.length < 4) qs.set('types', enabledTypes.join(','));
    if (filters.source.trim()) qs.set('source', filters.source.trim());
    if (filters.search.trim()) qs.set('search', filters.search.trim());
    if (filters.startDate) qs.set('startDate', filters.startDate);
    if (filters.endDate) qs.set('endDate', filters.endDate);
    qs.set('limit', String(filters.pageSize));
    qs.set('sortDirection', filters.sortDirection);
    if (before) qs.set('before', before.toISOString());

    try {
      const res = await fetch(`/api/messages?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data: any;
      try {
        data = await res.json();
      } catch {
        data = [];
      }
      const docs: any[] = Array.isArray(data) ? data : [];
      const local: any = (OfflineMessages as any); // use offline collection
      for (const raw of docs) {
        const doc = { ...raw };
        if (doc.createdAt && typeof doc.createdAt === 'string') {
          doc.createdAt = new Date(doc.createdAt);
        }
        if (!local.findOne({ _id: doc._id })) {
          try {
            local.insert(doc);
          } catch {}
        }
      }
    } catch (e) {
      // swallow; UI shows spinner briefly
    }
  }, [paused, filters]);

  // Scroll-to-top button visibility
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPages(1);
  }, [filters]);

  // Type toggles handled within FiltersBar via onChange

  const onReset = () => {
    setFiltersDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  // Auto-apply filters with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(filtersDraft);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filtersDraft]);

  // Persist filters and paused state
  useEffect(() => {
    try {
      localStorage.setItem('messages.filters', JSON.stringify(filters));
      localStorage.setItem('messages.paused', JSON.stringify(paused));
    } catch {}
  }, [filters, paused]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('messages.filters');
      const savedPaused = localStorage.getItem('messages.paused');
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalized: FiltersState = {
          ...DEFAULT_FILTERS,
          types: parsed?.types ?? DEFAULT_FILTERS.types,
          source: parsed?.source ?? DEFAULT_FILTERS.source,
          search: parsed?.search ?? DEFAULT_FILTERS.search,
          startDate: typeof parsed?.startDate === 'string' ? parsed.startDate : DEFAULT_FILTERS.startDate,
          endDate: typeof parsed?.endDate === 'string' ? parsed.endDate : DEFAULT_FILTERS.endDate,
          sortDirection: parsed?.sortDirection === 'asc' ? 'asc' : 'desc',
          pageSize: typeof parsed?.pageSize === 'number' ? parsed.pageSize : DEFAULT_FILTERS.pageSize,
        };
        setFiltersDraft(normalized);
        setFilters(normalized);
      }
      if (savedPaused) setPaused(JSON.parse(savedPaused));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    if (paused) {
      Meteor.reconnect();
      setPaused(false);
    } else {
      Meteor.disconnect();
      setPaused(true);
    }
  }, [paused]);

  return (
    <div className="container py-3">
      <Toolbar paused={paused} onTogglePause={togglePause} count={messages.length} />

      <FiltersBar
        filters={filtersDraft}
        onChange={setFiltersDraft}
        sourceOptions={sourceOptions}
        onReset={onReset}
      />

      {!ready && (
        <div className="alert alert-info py-2">Loading…</div>
      )}

      <MessagesList
        messages={messages}
        onIntersect={onIntersect}
        paused={paused}
        fetchOlderWhenPaused={fetchOlderWhenPaused}
      />

      {showTop && (
        <button
          aria-label="Scroll to top"
          title="Scroll to top"
          onClick={scrollToTop}
          className="btn btn-primary rounded-circle position-fixed d-flex align-items-center justify-content-center"
          style={{ width: 48, height: 48, right: 20, bottom: 20 }}
        >
          <i className="bi bi-arrow-up"></i>
        </button>
      )}
    </div>
  );
};


