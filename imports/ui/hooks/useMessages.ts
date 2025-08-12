import { useEffect, useMemo } from 'react';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import { Mongo } from 'meteor/mongo';
import { MessageDoc, MessageType, MessagesCollection } from '/imports/api/messages';

export interface MessageSourceDoc { _id: string; value: string }
const MessageSources = new Mongo.Collection<MessageSourceDoc>('message_sources');
export const OfflineMessages = new Mongo.Collection<MessageDoc>(null);

export type SortDirection = 'asc' | 'desc';

export type FiltersState = {
  types: Record<MessageType, boolean>;
  source: string;
  search: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  sortDirection: SortDirection;
  pageSize: number;
};

function toPublicationParams(filters: FiltersState, limit: number) {
  // Keep publication generic: only limit and sort. All other filters are client-side
  return {
    limit,
    sortDirection: filters.sortDirection,
  } as const;
}

function buildSelector(filters: FiltersState): Mongo.Selector<MessageDoc> {
  const selector: Mongo.Selector<MessageDoc> = {};
  const enabledTypes = (Object.keys(filters.types) as MessageType[]).filter((t) => filters.types[t]);
  if (enabledTypes.length !== 4) selector.type = { $in: enabledTypes } as any;
  if (filters.source.trim()) selector.source = filters.source.trim();
  const createdAt: any = {};
  if (filters.startDate) {
    const s = new Date(filters.startDate);
    s.setHours(0, 0, 0, 0);
    createdAt.$gte = s;
  }
  if (filters.endDate) {
    const d = new Date(filters.endDate);
    d.setHours(23, 59, 59, 999);
    createdAt.$lte = d;
  }
  if (Object.keys(createdAt).length) selector.createdAt = createdAt;
  if (filters.search.trim()) {
    const r = new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    (selector as any).text = r;
  }
  return selector;
}

export function useMessages(filters: FiltersState, limit: number, paused: boolean) {
  // When live, send full filters to server; when paused, send only limit/sort
  const params = useMemo(() => {
    if (paused) return toPublicationParams({ ...filters, source: '', search: '', startDate: '', endDate: '' }, limit);
    return toPublicationParams(filters, limit);
  }, [filters, limit, paused]);

  const isLoading = useSubscribe('messages', params);
  const isLoadingSources = useSubscribe('messageSources');

  const selector = useMemo(() => buildSelector(filters), [filters]);
  const sort = useMemo(() => ({ createdAt: filters.sortDirection === 'asc' ? 1 : -1 }) as const, [filters.sortDirection]);
  // Pass non-reactive deps so the query is re-created when filters/sort change (important when paused)
  const messagesFromServer = useFind(() => MessagesCollection.find(selector, { sort }), [filters, sort]);
  const messagesFromOffline = useFind(
    () => (paused ? OfflineMessages.find(selector, { sort }) : OfflineMessages.find({ _id: '__none__' } as any)),
    [filters, sort, paused]
  );
  const messages = useMemo(() => {
    if (!paused) return messagesFromServer;
    const byId = new Map<string, MessageDoc>();
    for (const m of messagesFromServer) byId.set(m._id as string, m);
    for (const m of messagesFromOffline) byId.set(m._id as string, m);
    const arr = Array.from(byId.values());
    arr.sort((a, b) =>
      sort.createdAt === 1
        ? (a.createdAt as any) - (b.createdAt as any)
        : (b.createdAt as any) - (a.createdAt as any)
    );
    return arr;
  }, [paused, messagesFromServer, messagesFromOffline, sort]);

  // Cleanup offline cache when resuming live mode
  useEffect(() => {
    if (!paused) {
      try { OfflineMessages.remove({}); } catch {}
    }
  }, [paused]);
  const sourceDocs = useFind(() => MessageSources.find({}, { sort: { _id: 1 } }));
  const sourceOptions = useMemo(() => sourceDocs.map((d) => d.value), [sourceDocs]);

  const ready = paused ? true : (!isLoading() && !isLoadingSources());

  return { messages, sourceOptions, ready };
}

export { toPublicationParams, buildSelector };


