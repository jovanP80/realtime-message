import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { MessageDoc, MessageType, MessagesCollection } from '/imports/api/messages';
import { WebApp } from 'meteor/webapp';

type SortDirection = 'asc' | 'desc';

type MessagesPublicationParams = {
  types?: MessageType[];
  source?: string;
  search?: string;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
  sortDirection?: SortDirection;
};

// Helpers to build server-side selector when not paused
function parseDateInputToLocal(dateStr: string, boundary: 'start' | 'end'): Date | null {
  if (typeof dateStr !== 'string') return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateStr);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    if (boundary === 'start') return new Date(year, month, day, 0, 0, 0, 0);
    return new Date(year, month, day, 23, 59, 59, 999);
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function buildSelector(params: MessagesPublicationParams): Mongo.Selector<MessageDoc> {
  const selector: Mongo.Selector<MessageDoc> = {};
  const { types, source, search } = params;

  if (types && Array.isArray(types) && types.length > 0) {
    (selector as any).type = { $in: types };
  }

  if (source && typeof source === 'string' && source.trim().length > 0) {
    (selector as any).source = source.trim();
  }

  const createdAt: any = {};
  const hasStart = typeof params.startDate === 'string' && params.startDate.length > 0;
  const hasEnd = typeof params.endDate === 'string' && params.endDate.length > 0;
  let sd: Date | null = null;
  let ed: Date | null = null;
  if (hasStart) sd = parseDateInputToLocal(params.startDate as string, 'start');
  if (hasEnd) ed = parseDateInputToLocal(params.endDate as string, 'end');
  if (!hasStart && ed) {
    const d = new Date(ed);
    sd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  if (sd) createdAt.$gte = sd;
  if (ed) createdAt.$lte = ed;
  if (Object.keys(createdAt).length > 0) {
    (selector as any).createdAt = createdAt;
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    (selector as any).text = regex;
  }

  return selector;
}

function clampLimit(limit?: number): number {
  const DEFAULT_LIMIT = 30;
  const MAX_LIMIT = 1000;
  if (typeof limit !== 'number' || Number.isNaN(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

Meteor.startup(async () => {
  // Indexes for performance
  const rc = MessagesCollection.rawCollection();
  await rc.createIndex?.({ createdAt: -1 });
  await rc.createIndex?.({ type: 1 });
  await rc.createIndex?.({ source: 1 });

  // Publications
  Meteor.publish('messages', function (params: MessagesPublicationParams = {}) {
    const sortDirection: SortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';
    const limit = clampLimit(params.limit);
    const sort: Mongo.SortSpecifier = { createdAt: sortDirection === 'asc' ? 1 : -1 };
    // If client sends filters blank (paused mode), this resolves to {} and returns rolling window
    const selector = buildSelector(params);
    return MessagesCollection.find(selector, { sort, limit });
  });

  // Publish distinct sources as a lightweight reactive list
  Meteor.publish('messageSources', function () {
    const subscription = this;
    const knownSources = new Set<string>();
    const handle = MessagesCollection.find({}, { fields: { source: 1 } }).observeChanges({
      added(_id, fields: Partial<MessageDoc>) {
        const s = fields.source as string | undefined;
        if (typeof s === 'string' && !knownSources.has(s)) {
          knownSources.add(s);
          subscription.added('message_sources', s, { value: s });
        }
      },
    });
    subscription.ready();
    subscription.onStop(() => handle.stop());
  });

  // Server-side generator of random messages
  const TYPES: MessageType[] = ['info', 'warn', 'error', 'debug'];
  const SOURCES = ['sensor-1', 'sensor-2', 'api', 'worker', 'cron', 'gateway'];
  const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'kappa', 'lambda', 'omega'];

  function randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomText(): string {
    const len = 5 + Math.floor(Math.random() * 15);
    const parts: string[] = [];
    for (let i = 0; i < len; i += 1) parts.push(randomChoice(WORDS));
    return parts.join(' ');
  }

  async function insertRandomMessage() {
    const doc: MessageDoc = {
      type: randomChoice(TYPES),
      source: randomChoice(SOURCES),
      text: randomText(),
      createdAt: new Date(),
    };
    await MessagesCollection.insertAsync(doc);
  }

  // Generate a message every 500ms
  Meteor.setInterval(() => {
    void insertRandomMessage();
  }, 500);

  // Minimal HTTP API for fetching historical pages (works when DDP paused)
  WebApp.connectHandlers.use('/api/messages', (req, res, next) => {
    if (req.method !== 'GET') return next();
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const qp = Object.fromEntries(url.searchParams.entries());
      const limit = clampLimit(Number(qp.limit));
      const sortDirection: SortDirection = qp.sortDirection === 'asc' ? 'asc' : 'desc';
      const types = qp.types ? (qp.types.split(',').filter(Boolean) as MessageType[]) : undefined;
      const source = qp.source || undefined;
      const search = qp.search || undefined;
      const startDate = qp.startDate || undefined;
      const endDate = qp.endDate || undefined;
      const before = qp.before || undefined; // ISO date string
      // const beforeId = qp.beforeId || undefined; // reserved for future tie-breaker

      const selector: any = buildSelector({ types, source, search, startDate, endDate });

      // Cursor pagination by createdAt (and _id tiebreaker)
      if (before) {
        const bd = new Date(before);
        if (!Number.isNaN(bd.getTime())) {
          selector.createdAt = selector.createdAt || {};
          if (sortDirection === 'desc') selector.createdAt.$lt = bd;
          else selector.createdAt.$gt = bd;
        }
      }
      const sort: Mongo.SortSpecifier = sortDirection === 'asc' ? { createdAt: 1, _id: 1 } : { createdAt: -1, _id: -1 };
      const cursor = MessagesCollection.find(selector, { sort, limit });
      const docs = cursor.fetch();

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify(docs));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'internal_error' }));
    }
  });
});
