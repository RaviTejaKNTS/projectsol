// src/state/currentBoard.ts
let _boardId: string | null = null;

export function setCurrentBoardId(id: string | null) {
  console.log('setCurrentBoardId called with:', id);
  _boardId = id ?? null;
  console.log('Current board ID is now:', _boardId);
}

export function getCurrentBoardId(): string | null {
  console.log('getCurrentBoardId called, returning:', _boardId);
  return _boardId;
}
