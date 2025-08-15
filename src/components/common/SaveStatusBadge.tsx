import React from 'react';

export const SaveStatusBadge: React.FC<{ status: 'idle'|'saving'|'saved'|'error', onForceSync?: () => void }> = ({ status, onForceSync }) => {
  const getIcon = () => {
    switch (status) {
      case 'idle':
        return <div className="h-3 w-3 rounded-full bg-zinc-400" />;
      case 'saving':
        return <div className="h-3 w-3 rounded-full bg-zinc-400 animate-pulse" />;
      case 'saved':
        return <div className="h-3 w-3 rounded-full bg-emerald-500" />;
      case 'error':
        return <div className="h-3 w-3 rounded-full bg-red-500" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-zinc-400" />;
    }
  };

  const getTooltip = () => {
    switch (status) {
      case 'idle':
        return 'Click to force sync';
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'All changes saved';
      case 'error':
        return 'Sync error - Click to retry';
      default:
        return 'Click to force sync';
    }
  };

  const isClickable = status === 'idle' || status === 'error';

  return (
    <button
      type="button"
      onClick={onForceSync && isClickable ? onForceSync : undefined}
      disabled={!isClickable}
      className={`hidden sm:flex items-center justify-center h-8 w-8 rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur shadow-sm transition-all duration-200 ${
        isClickable 
          ? 'hover:bg-white dark:hover:bg-zinc-900 hover:shadow-md cursor-pointer' 
          : 'cursor-default'
      } ${status === 'error' ? 'border-red-500/30' : ''}`}
      title={getTooltip()}
    >
      {getIcon()}
    </button>
  );
};
