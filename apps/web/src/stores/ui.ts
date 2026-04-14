import { create } from 'zustand';

interface UIState {
  isOnline: boolean;
  isSidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  setOnline: (online: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSidebarOpen: false,
  theme: 'system',

  setOnline: (online) => set({ isOnline: online }),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));
