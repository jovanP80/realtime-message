import React from 'react';

type Props = {
  paused: boolean;
  onTogglePause: () => void;
};

export const Toolbar: React.FC<Props> = ({ paused, onTogglePause }) => {
  return (
    <div className="card shadow-sm border-0 mb-3">
      <div className="card-body py-2 d-flex align-items-center">
        <div className="d-flex align-items-center gap-2">
          <span className={`badge rounded-pill ${paused ? 'text-dark bg-warning' : 'bg-success'}`}>
            <i className={`bi me-1 ${paused ? 'bi-pause-circle' : 'bi-broadcast-pin'}`}></i>
            {paused ? 'Paused' : 'Live'}
          </span>
        </div>
        <div className="ms-auto d-flex gap-2">
          <button type="button" className={`btn ${paused ? 'btn-warning' : 'btn-secondary'}`} onClick={onTogglePause}>
            {paused ? 'Resume Sync' : 'Pause Sync'}
          </button>
        </div>
      </div>
    </div>
  );
};


