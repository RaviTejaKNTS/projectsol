// src/state/currentBoard.ts
import { create } from 'zustand';

console.log('Creating currentBoard store');

interface CurrentBoardState {
  boardId: string | null;
  setCurrentBoardId: (id: string | null) => void;
  getCurrentBoardId: () => string | null;
}

export const useCurrentBoard = create<CurrentBoardState>((set, get) => ({
  boardId: null,
  setCurrentBoardId: (id: string | null) => {
    console.log('setCurrentBoardId called with:', id);
    set({ boardId: id });
    console.log('Current board ID is now:', id);
  },
  getCurrentBoardId: () => {
    const { boardId } = get();
    console.log('getCurrentBoardId called, returning:', boardId);
    return boardId;
  },
}));

console.log('CurrentBoard store created successfully');

// Legacy functions for backward compatibility
export function setCurrentBoardId(id: string | null) {
  useCurrentBoard.getState().setCurrentBoardId(id);
}

export function getCurrentBoardId(): string | null {
  return useCurrentBoard.getState().getCurrentBoardId();
}
