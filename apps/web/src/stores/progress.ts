import { create } from 'zustand';
import { db } from '@/lib/db';

interface ProgressStats {
  totalReviews: number;
  correctCount: number;
  masteredCount: number;
  dueCount: number;
}

interface ProgressState {
  stats: ProgressStats | null;
  isLoading: boolean;
  error: string | null;

  loadStats: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useProgressStore = create<ProgressState>()((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  loadStats: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const records = await db.userProgress.where('userId').equals(userId).toArray();

      const now = new Date().toISOString();
      const stats: ProgressStats = {
        totalReviews: records.reduce((sum, r) => sum + (r.totalReviews ?? 0), 0),
        correctCount: records.reduce((sum, r) => sum + (r.correctCount ?? 0), 0),
        masteredCount: records.filter((r) => (r.fsrsInterval ?? 0) >= 21).length,
        dueCount: records.filter((r) => r.fsrsNextReview !== null && r.fsrsNextReview <= now)
          .length,
      };

      set({ stats, isLoading: false });
    } catch (err) {
      console.error('[progress] loadStats failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to load progress';
      set({ error: message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
