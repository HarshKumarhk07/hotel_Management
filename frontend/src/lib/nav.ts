import {
  BarChart3,
  Boxes,
  Car,
  ChefHat,
  Clock,
  DoorOpen,
  Globe,
  Heart,
  Hotel,
  Image as ImageIcon,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  RotateCcw,
  ScrollText,
  Settings,
  Settings2,
  Tag,
  Ticket,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AuthUser } from '@/stores/auth';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Centralized, role-based navigation. Each portal renders exactly one of these
 * lists — there is no runtime role branching inside the sidebar components, and
 * no portal can ever render another role's modules.
 */

/** Super Admin portal — full administrative surface. Never shown to kitchen owners. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/', label: 'Go to Website', icon: Globe },
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/revenue', label: 'Revenue Dashboard', icon: BarChart3 },
  { href: '/admin/kitchens', label: 'Kitchens', icon: ChefHat },
  { href: '/admin/rooms/categories', label: 'Room Categories', icon: Hotel },
  { href: '/admin/rooms', label: 'Rooms & QR', icon: DoorOpen },
  { href: '/admin/housekeeping', label: 'Housekeeping', icon: Boxes },
  { href: '/admin/valet', label: 'Valet Parking', icon: Car },
  { href: '/admin/banquets', label: 'Banquet Halls', icon: Landmark },
  { href: '/admin/restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { href: '/admin/complaints', label: 'Service Tickets', icon: LifeBuoy },
  { href: '/admin/contact', label: 'Contact Messages', icon: MessageSquare },
  { href: '/admin/guests', label: 'Guests', icon: Users },
  { href: '/admin/feedback', label: 'Guest Feedback', icon: Heart },
  { href: '/admin/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/admin/orders', label: 'Orders', icon: ScrollText },
  { href: '/admin/banners', label: 'Promotions', icon: ImageIcon },
  { href: '/admin/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/admin/staff', label: 'Staff Management', icon: Users },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Global Settings', icon: Settings2 },
  { href: '/admin/audit', label: 'Audit log', icon: Tag },
];

/**
 * Kitchen portal — scoped strictly to the owner's own kitchen. Contains NO
 * administrative modules (no Banquet Halls, Gallery, Revenue, Analytics, Staff,
 * Promotions, Rooms, etc.). This is the single source of truth for Issue 8.
 */
export const KITCHEN_NAV: NavItem[] = [
  { href: '/', label: 'Go to Website', icon: Globe },
  { href: '/kitchen', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kitchen/queue', label: 'Live Queue', icon: ChefHat },
  { href: '/kitchen/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/kitchen/stock', label: 'Stock', icon: Boxes },
  { href: '/kitchen/orders', label: 'Orders', icon: ScrollText },
  { href: '/kitchen/operating-hours', label: 'Operating Hours', icon: Clock },
  { href: '/kitchen/refunds', label: 'Refunds', icon: RotateCcw },
  { href: '/kitchen/settings', label: 'Kitchen Settings', icon: Settings },
];

/** Home route for a role — used for post-login routing and gate redirects. */
export function homeForRole(role: AuthUser['role'] | undefined): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'KITCHEN_OWNER':
      return '/kitchen';
    case 'VALET_MANAGER':
      return '/valet';
    default:
      return '/';
  }
}
