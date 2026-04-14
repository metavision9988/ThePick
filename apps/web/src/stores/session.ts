import { create } from 'zustand';
import type { FSRSRating } from '@thepick/shared';

interface StudyCard {
  id: string;
  cardType: string;
  content: string;
  answer: string | null;
}

interface StudySession {
  id: string;
  startedAt: string;
  examScope: string;
  totalCards: number;
}

interface SessionState {
  session: StudySession | null;
  cards: StudyCard[];
  currentIndex: number;
  isLoading: boolean;
  showingAnswer: boolean;
  error: string | null;

  startSession: (examScope: string, cards: StudyCard[]) => void;
  submitRating: (rating: FSRSRating) => void;
  nextCard: () => void;
  showAnswer: () => void;
  hideAnswer: () => void;
  endSession: () => void;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  session: null,
  cards: [],
  currentIndex: 0,
  isLoading: false,
  showingAnswer: false,
  error: null,

  startSession: (examScope, cards) =>
    set({
      session: {
        id: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        examScope,
        totalCards: cards.length,
      },
      cards,
      currentIndex: 0,
      showingAnswer: false,
      error: null,
    }),

  submitRating: (_rating) => {
    // FSRS scheduling will be wired in Step 1-10
    const { currentIndex, cards } = get();
    if (currentIndex < cards.length - 1) {
      set({ currentIndex: currentIndex + 1, showingAnswer: false });
    } else {
      set({ showingAnswer: false });
    }
  },

  nextCard: () => {
    const { currentIndex, cards } = get();
    if (currentIndex < cards.length - 1) {
      set({ currentIndex: currentIndex + 1, showingAnswer: false });
    }
  },

  showAnswer: () => set({ showingAnswer: true }),
  hideAnswer: () => set({ showingAnswer: false }),

  endSession: () =>
    set({
      session: null,
      cards: [],
      currentIndex: 0,
      showingAnswer: false,
    }),

  clearError: () => set({ error: null }),
}));
