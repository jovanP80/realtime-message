import React from 'react';
import { FiltersState, SortDirection } from '../hooks/useMessages';

type Props = {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  sourceOptions: string[];
  onReset: () => void;
};

export const FiltersBar: React.FC<Props> = ({ filters, onChange, sourceOptions, onReset }) => {
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body p-3">
        <form className="row g-3" onSubmit={(e) => e.preventDefault()}>
          <div className="col-12 col-md-4">
            <label className="form-label">Search</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input className="form-control" value={filters.search} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Find messages…" />
            </div>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Source</label>
            <select className="form-select" value={filters.source} onChange={(e) => onChange({ ...filters, source: e.target.value })}>
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Sort</label>
            <select className="form-select" value={filters.sortDirection} onChange={(e) => onChange({ ...filters, sortDirection: e.target.value as SortDirection })}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={filters.startDate} onChange={(e) => onChange({ ...filters, startDate: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={filters.endDate} onChange={(e) => onChange({ ...filters, endDate: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label">Page size</label>
            <select className="form-select" value={filters.pageSize} onChange={(e) => onChange({ ...filters, pageSize: Number(e.target.value) })}>
              {[25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {(['info','warn','error','debug'] as const).map((t) => (
                <div key={t} className="form-check form-check-inline">
                  <input className="form-check-input" type="checkbox" id={`type-${t}`} checked={filters.types[t]} onChange={() => onChange({ ...filters, types: { ...filters.types, [t]: !filters.types[t] } })} />
                  <label className="form-check-label" htmlFor={`type-${t}`}>{t}</label>
                </div>
              ))}
              <div className="ms-auto d-flex gap-2">
                <button type="button" className="btn btn-danger" onClick={onReset}><i className="bi bi-arrow-counterclockwise me-1"></i>Reset</button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};


