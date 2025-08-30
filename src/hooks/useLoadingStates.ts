// src/hooks/useLoadingStates.ts
import { useState, useCallback } from 'react';

export interface LoadingStates {
  createTask: boolean;
  updateTask: boolean;
  deleteTask: boolean;
  moveTask: boolean;
  completeTask: boolean;
  createColumn: boolean;
  updateColumn: boolean;
  deleteColumn: boolean;
  moveColumn: boolean;
  updateLabels: boolean;
  general: boolean;
}

export interface LoadingActions {
  setLoading: (operation: keyof LoadingStates, loading: boolean) => void;
  setGeneralLoading: (loading: boolean) => void;
  isAnyLoading: () => boolean;
  isOperationLoading: (operation: keyof LoadingStates) => boolean;
}

export function useLoadingStates(): [LoadingStates, LoadingActions] {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    createTask: false,
    updateTask: false,
    deleteTask: false,
    moveTask: false,
    completeTask: false,
    createColumn: false,
    updateColumn: false,
    deleteColumn: false,
    moveColumn: false,
    updateLabels: false,
    general: false,
  });

  const setLoading = useCallback((operation: keyof LoadingStates, loading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [operation]: loading
    }));
  }, []);

  const setGeneralLoading = useCallback((loading: boolean) => {
    setLoading('general', loading);
  }, [setLoading]);

  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(loading => loading);
  }, [loadingStates]);

  const isOperationLoading = useCallback((operation: keyof LoadingStates) => {
    return loadingStates[operation];
  }, [loadingStates]);

  const actions: LoadingActions = {
    setLoading,
    setGeneralLoading,
    isAnyLoading,
    isOperationLoading,
  };

  return [loadingStates, actions];
}
