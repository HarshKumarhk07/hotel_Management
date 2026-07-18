/** Shared API types mirroring the backend response shapes. */

export type FoodLabel = 'VEG' | 'NON_VEG' | 'JAIN';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export interface ScanResolution {
  room: { id: string; roomNumber: string; floor: number };
  kitchen: {
    _id: string;
    name: string;
    slug: string;
    timings?: { open: string; close: string; timezone: string };
    settings?: { serviceChargePercent: number; taxPercent: number };
  } | null;
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  taxPercent: number;
  prepTimeMinutes: number;
  foodLabel: FoodLabel;
  image?: string;
  isFeatured: boolean;
  isRecommended: boolean;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  items: PublicMenuItem[];
}

export interface PublicMenu {
  kitchen: {
    id: string;
    name: string;
    slug: string;
    settings?: { serviceChargePercent: number; taxPercent: number };
  };
  categories: PublicMenuCategory[];
}
