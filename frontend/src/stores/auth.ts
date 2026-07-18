import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'KITCHEN_OWNER' | 'CUSTOMER' | 'VALET_MANAGER';
  avatarUrl?: string;
  kitchenId?: string;
  isEmailVerified: boolean;
}

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: Status;
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: Status) => void;
}

/** In-memory auth state. The access token lives in the api module (memory only). */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),
  setStatus: (status) => set({ status }),
}));
