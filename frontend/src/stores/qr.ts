import { create } from 'zustand';

interface QrState {
  isOpen: boolean;
  openScanner: () => void;
  closeScanner: () => void;
}

export const useQrStore = create<QrState>((set) => ({
  isOpen: false,
  openScanner: () => set({ isOpen: true }),
  closeScanner: () => set({ isOpen: false }),
}));
