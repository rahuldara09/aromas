'use client';

// usePOSSync was a desktop-only Electron hook for syncing offline SQLite bills.
// Electron has been removed — this hook is now a no-op that returns empty state.

interface SyncState {
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  isSyncing: boolean;
}

const INITIAL_STATE: SyncState = {
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  isSyncing: false,
};

export function usePOSSync(_vendorId: string | null | undefined): SyncState {
  return INITIAL_STATE;
}
