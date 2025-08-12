import React, { useEffect, useRef, useState } from 'react';
import { MessageDoc } from '/imports/api/messages';

type Props = {
  messages: MessageDoc[];
  onIntersect: () => void;
  paused?: boolean;
  fetchOlderWhenPaused?: (before: Date | null) => Promise<void>;
};

export const MessagesList: React.FC<Props> = ({ messages, onIntersect, paused, fetchOlderWhenPaused }) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingGuardRef = useRef(false);
  const [isHttpLoading, setIsHttpLoading] = useState(false);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !loadingGuardRef.current) {
          loadingGuardRef.current = true;
          if (paused && fetchOlderWhenPaused) {
            setIsHttpLoading(true);
            const last = messages[messages.length - 1];
            fetchOlderWhenPaused(last ? new Date(last.createdAt) : null)
              .finally(() => {
                setIsHttpLoading(false);
                setTimeout(() => { loadingGuardRef.current = false; }, 250);
              });
          } else {
            onIntersect();
            setTimeout(() => { loadingGuardRef.current = false; }, 250);
          }
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, paused, fetchOlderWhenPaused, messages.length]);

  return (
    <div className="list-group shadow-sm" style={{ minHeight: 200 }}>
      {messages.map((m) => (
        <div key={m._id} data-type={m.type} className="list-group-item list-group-item-action d-flex align-items-start justify-content-between">
          <div className="me-3 flex-grow-1">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className={`badge bg-${m.type === 'error' ? 'danger' : m.type === 'warn' ? 'warning text-dark' : m.type === 'debug' ? 'secondary' : 'info'}`}>{m.type}</span>
              <small className="text-muted">{new Date(m.createdAt).toLocaleString()}</small>
              <span className="badge bg-dark">{m.source}</span>
            </div>
            <div className="text-break">{m.text}</div>
          </div>
        </div>
      ))}
      {isHttpLoading && (
        <div className="list-group-item text-center text-muted">Loading older…</div>
      )}
      <div ref={loadMoreRef} />
    </div>
  );
};


