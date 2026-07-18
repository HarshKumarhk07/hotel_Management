import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FoodLabel, PublicMenuItem } from '@/lib/types';

export interface CartLine {
  menuItem: string;
  name: string;
  price: number;
  taxPercent: number;
  foodLabel: FoodLabel;
  image?: string;
  quantity: number;
  note?: string;
}

interface CartState {
  /** The cart is pinned to one kitchen + room (from the scanned QR). */
  kitchenId?: string;
  kitchenName?: string;
  roomId?: string;
  roomNumber?: string;
  serviceChargePercent: number;
  lines: CartLine[];

  setContext: (ctx: {
    kitchenId: string;
    kitchenName: string;
    roomId: string;
    roomNumber: string;
    serviceChargePercent: number;
  }) => void;
  add: (item: PublicMenuItem, qty?: number) => void;
  setQty: (menuItem: string, qty: number) => void;
  remove: (menuItem: string) => void;
  setNote: (menuItem: string, note: string) => void;
  clear: () => void;
  count: () => number;
  totals: () => { subtotal: number; tax: number; serviceCharge: number; total: number };
}

/**
 * Client-side cart (persisted to localStorage) used while browsing. At checkout
 * it is synced to the server cart, then the server recomputes authoritative
 * prices — so this is a convenience/UX layer, never the source of truth on money.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      serviceChargePercent: 0,
      lines: [],

      setContext: (ctx) => {
        const current = get().kitchenId;
        // Switching kitchens (new QR) starts a fresh cart.
        if (current && current !== ctx.kitchenId) {
          set({ ...ctx, lines: [] });
        } else {
          set({ ...ctx });
        }
      },

      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.menuItem === item.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.menuItem === item.id ? { ...l, quantity: Math.min(99, l.quantity + qty) } : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              {
                menuItem: item.id,
                name: item.name,
                price: item.price,
                taxPercent: item.taxPercent,
                foodLabel: item.foodLabel,
                image: item.image,
                quantity: qty,
              },
            ],
          };
        }),

      setQty: (menuItem, qty) =>
        set((state) => ({
          lines:
            qty <= 0
              ? state.lines.filter((l) => l.menuItem !== menuItem)
              : state.lines.map((l) => (l.menuItem === menuItem ? { ...l, quantity: qty } : l)),
        })),

      remove: (menuItem) =>
        set((state) => ({ lines: state.lines.filter((l) => l.menuItem !== menuItem) })),

      setNote: (menuItem, note) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.menuItem === menuItem ? { ...l, note } : l)),
        })),

      clear: () => set({ lines: [] }),

      count: () => get().lines.reduce((n, l) => n + l.quantity, 0),

      totals: () => {
        const { lines, serviceChargePercent } = get();
        let subtotal = 0;
        let tax = 0;
        for (const l of lines) {
          const lineSub = l.price * l.quantity;
          subtotal += lineSub;
          tax += (lineSub * l.taxPercent) / 100;
        }
        const round = (n: number) => Math.round(n * 100) / 100;
        const serviceCharge = round((subtotal * serviceChargePercent) / 100);
        subtotal = round(subtotal);
        tax = round(tax);
        return { subtotal, tax, serviceCharge, total: round(subtotal + tax + serviceCharge) };
      },
    }),
    { name: 'kds-cart' },
  ),
);
