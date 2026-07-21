/**
 * System-wide enums & constants. Kept framework-agnostic so they can be shared
 * with the frontend later via a generated types package.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  KITCHEN_OWNER: 'KITCHEN_OWNER',
  CUSTOMER: 'CUSTOMER',
  VALET_MANAGER: 'VALET_MANAGER',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ALL_ROLES = Object.values(ROLES) as Role[];

/** Roles that must clear an extra secret-code gate to authenticate. */
export const PRIVILEGED_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.KITCHEN_OWNER];

export const AUTH_PROVIDERS = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
} as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

export const TOKEN_TYPES = {
  EMAIL_VERIFY: 'EMAIL_VERIFY',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type TokenType = (typeof TOKEN_TYPES)[keyof typeof TOKEN_TYPES];

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  SECRET_CODE_FAILED: 'SECRET_CODE_FAILED',

  // Kitchen management
  KITCHEN_CREATED: 'KITCHEN_CREATED',
  KITCHEN_UPDATED: 'KITCHEN_UPDATED',
  KITCHEN_ACTIVATED: 'KITCHEN_ACTIVATED',
  KITCHEN_DEACTIVATED: 'KITCHEN_DEACTIVATED',

  // Room & QR management
  ROOM_CREATED: 'ROOM_CREATED',
  ROOM_UPDATED: 'ROOM_UPDATED',
  ROOM_DELETED: 'ROOM_DELETED',
  ROOM_ACTIVATED: 'ROOM_ACTIVATED',
  ROOM_DEACTIVATED: 'ROOM_DEACTIVATED',
  QR_GENERATED: 'QR_GENERATED',
  QR_DISABLED: 'QR_DISABLED',
  QR_REASSIGNED: 'QR_REASSIGNED',

  // Bookings
  ROOM_BOOKING_CREATED: 'ROOM_BOOKING_CREATED',
  ROOM_BOOKING_UPDATED: 'ROOM_BOOKING_UPDATED',
  BANQUET_BOOKING_CREATED: 'BANQUET_BOOKING_CREATED',
  BANQUET_BOOKING_UPDATED: 'BANQUET_BOOKING_UPDATED',

  // Menu & categories
  CATEGORY_CREATED: 'CATEGORY_CREATED',
  CATEGORY_UPDATED: 'CATEGORY_UPDATED',
  CATEGORY_DELETED: 'CATEGORY_DELETED',
  MENU_ITEM_CREATED: 'MENU_ITEM_CREATED',
  MENU_ITEM_UPDATED: 'MENU_ITEM_UPDATED',
  MENU_ITEM_DELETED: 'MENU_ITEM_DELETED',
  MENU_STOCK_CHANGED: 'MENU_STOCK_CHANGED',
  MENU_IMAGE_UPDATED: 'MENU_IMAGE_UPDATED',

  // Orders
  ORDER_PLACED: 'ORDER_PLACED',
  GUEST_ORDER_PLACED: 'GUEST_ORDER_PLACED',
  ORDER_LINKED: 'ORDER_LINKED',
  ORDER_LINK_FAILED: 'ORDER_LINK_FAILED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_ITEM_CANCELLED: 'ORDER_ITEM_CANCELLED',
  ORDER_NOTE_ADDED: 'ORDER_NOTE_ADDED',

  // Payments & refunds
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_WEBHOOK: 'PAYMENT_WEBHOOK',
  REFUND_PROCESSED: 'REFUND_PROCESSED',
  REFUND_FAILED: 'REFUND_FAILED',

  // Coupons
  COUPON_CREATED: 'COUPON_CREATED',
  COUPON_UPDATED: 'COUPON_UPDATED',
  COUPON_DELETED: 'COUPON_DELETED',
  COUPON_APPLIED: 'COUPON_APPLIED',

  // Valet Parking Management
  VALET_VEHICLE_CHECKIN: 'VALET_VEHICLE_CHECKIN',
  VALET_VEHICLE_REQUESTED: 'VALET_VEHICLE_REQUESTED',
  VALET_VEHICLE_BRINGING: 'VALET_VEHICLE_BRINGING',
  VALET_VEHICLE_READY: 'VALET_VEHICLE_READY',
  VALET_VEHICLE_DELIVERED: 'VALET_VEHICLE_DELIVERED',

  // Restaurant & Table Management
  TABLE_CREATED: 'TABLE_CREATED',
  TABLE_UPDATED: 'TABLE_UPDATED',
  TABLE_SEATED: 'TABLE_SEATED',
  TABLE_CLOSED: 'TABLE_CLOSED',
  RESERVATION_CREATED: 'RESERVATION_CREATED',
  RESERVATION_UPDATED: 'RESERVATION_UPDATED',
  RESERVATION_CANCELLED: 'RESERVATION_CANCELLED',
} as const;

/** Socket.io event names shared between the API and the dashboards. */
export const SOCKET_EVENTS = {
  ORDER_NEW: 'order:new',
  ORDER_UPDATED: 'order:updated',
  ORDER_CANCELLED: 'order:cancelled',
  PAYMENT_UPDATED: 'payment:updated',
  REFUND_UPDATED: 'refund:updated',
  NOTIFICATION_NEW: 'notification:new',
  VALET_NEW: 'valet:new',
  VALET_UPDATED: 'valet:updated',
  TABLE_STATUS_CHANGED: 'table:status',
} as const;

export const NOTIFICATION_CHANNELS = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
} as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

/** Notification categories — drive the icon/grouping on the client. */
export const NOTIFICATION_TYPES = {
  ORDER_RECEIVED: 'ORDER_RECEIVED',
  ORDER_ACCEPTED: 'ORDER_ACCEPTED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  ORDER_OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  REFUND_UPDATE: 'REFUND_UPDATE',
  KITCHEN_NEW_ORDER: 'KITCHEN_NEW_ORDER',
  KITCHEN_CANCELLATION: 'KITCHEN_CANCELLATION',
  ADMIN_PAYMENT_FAILED: 'ADMIN_PAYMENT_FAILED',
  ADMIN_REFUND_REQUEST: 'ADMIN_REFUND_REQUEST',
  ADMIN_HIGH_CANCELLATION: 'ADMIN_HIGH_CANCELLATION',
  VALET_REQUEST: 'VALET_REQUEST',
  VALET_STATUS_UPDATE: 'VALET_STATUS_UPDATE',
  TABLE_ORDER_RECEIVED: 'TABLE_ORDER_RECEIVED',
  TABLE_BILL_READY: 'TABLE_BILL_READY',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/** Customer-facing message per order status, used by the notification service. */
export const ORDER_STATUS_NOTIFICATION: Record<
  string,
  { type: NotificationType; title: string; message: string } | undefined
> = {
  ACCEPTED: {
    type: NOTIFICATION_TYPES.ORDER_ACCEPTED,
    title: 'Order accepted',
    message: 'The kitchen has accepted your order and will start preparing it shortly.',
  },
  PREPARING: {
    type: NOTIFICATION_TYPES.ORDER_PREPARING,
    title: 'Order being prepared',
    message: 'Your food is being prepared.',
  },
  READY: {
    type: NOTIFICATION_TYPES.ORDER_READY,
    title: 'Order ready',
    message: 'Your order is ready.',
  },
  OUT_FOR_DELIVERY: {
    type: NOTIFICATION_TYPES.ORDER_OUT_FOR_DELIVERY,
    title: 'On the way',
    message: 'Your order is on its way to your room.',
  },
  DELIVERED: {
    type: NOTIFICATION_TYPES.ORDER_DELIVERED,
    title: 'Delivered',
    message: 'Your order has been delivered. Enjoy your meal!',
  },
  REJECTED: {
    type: NOTIFICATION_TYPES.ORDER_REJECTED,
    title: 'Order could not be accepted',
    message: 'Unfortunately the kitchen could not accept your order. Any payment will be refunded.',
  },
};
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const ORDER_STATUS = {
  NEW_ORDER: 'NEW_ORDER',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export const ALL_ORDER_STATUSES = Object.values(ORDER_STATUS) as OrderStatus[];

/**
 * Allowed forward transitions for the order lifecycle. Any status can move to
 * CANCELLED/REJECTED via the dedicated cancel flow (not this map). Terminal
 * states have no successors.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW_ORDER: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED],
  ACCEPTED: [ORDER_STATUS.PREPARING],
  PREPARING: [ORDER_STATUS.READY],
  READY: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED],
  OUT_FOR_DELIVERY: [ORDER_STATUS.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

/** States in which an order may still be cancelled. */
export const CANCELLABLE_STATUSES: OrderStatus[] = [
  ORDER_STATUS.NEW_ORDER,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
];

export const PAYMENT_METHODS = {
  RAZORPAY: 'RAZORPAY',
  COD: 'COD',
  ROOM_BILLING: 'ROOM_BILLING',
  TABLE_BILLING: 'TABLE_BILLING',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const REFUND_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  REQUESTED: 'REQUESTED',
  INITIATED: 'INITIATED',
  PROCESSING: 'PROCESSING',
  REFUNDED: 'REFUNDED',
  FAILED: 'FAILED',
} as const;
export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

export const DISCOUNT_TYPES = {
  FIXED: 'FIXED',
  PERCENT: 'PERCENT',
} as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[keyof typeof DISCOUNT_TYPES];

export const FOOD_LABELS = {
  VEG: 'VEG',
  NON_VEG: 'NON_VEG',
  JAIN: 'JAIN',
} as const;
export type FoodLabel = (typeof FOOD_LABELS)[keyof typeof FOOD_LABELS];
export const ALL_FOOD_LABELS = Object.values(FOOD_LABELS) as FoodLabel[];

/**
 * Granular permissions for the future staff/RBAC module. The three core roles
 * map to permission bundles today; staff accounts will get explicit grants.
 */
export const PERMISSIONS = {
  MENU_MANAGE: 'menu:manage',
  ORDER_VIEW: 'order:view',
  ORDER_UPDATE_STATUS: 'order:update_status',
  ORDER_CANCEL: 'order:cancel',
  ORDER_REFUND: 'order:refund',
  ORDER_NOTE: 'order:note',
  COUPON_MANAGE: 'coupon:manage',
  ROOM_MANAGE: 'room:manage',
  KITCHEN_MANAGE: 'kitchen:manage',
  ANALYTICS_VIEW: 'analytics:view',
  STAFF_MANAGE: 'staff:manage',
  SHIFT_MANAGE: 'shift:manage',
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

export const STAFF_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
} as const;
export type StaffStatus = (typeof STAFF_STATUS)[keyof typeof STAFF_STATUS];

export const SHIFT_STATUS = {
  SCHEDULED: 'SCHEDULED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  MISSED: 'MISSED',
} as const;
export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];

/** bcrypt cost factor — 12 rounds per security spec. */
export const BCRYPT_ROUNDS = 12;

/** Hex length of verification / reset token raw values (before hashing). */
export const SECURE_TOKEN_BYTES = 32;

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export const REFRESH_COOKIE_NAME = 'kds_rt';

// ─── Restaurant & Table Management ─────────────────────────────────────────

export const TABLE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RESERVED:  'RESERVED',
  OCCUPIED:  'OCCUPIED',
  BILLING:   'BILLING',
  INACTIVE:  'INACTIVE',
} as const;
export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];
export const ALL_TABLE_STATUSES = Object.values(TABLE_STATUS) as TableStatus[];

/** Allowed status transitions for restaurant tables. */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  AVAILABLE: ['OCCUPIED', 'RESERVED'],
  RESERVED:  ['OCCUPIED', 'AVAILABLE'],
  OCCUPIED:  ['BILLING', 'AVAILABLE'],
  BILLING:   ['AVAILABLE'],
  INACTIVE:  [],
};

export const RESERVATION_STATUS = {
  PENDING:   'PENDING',
  CONFIRMED: 'CONFIRMED',
  SEATED:    'SEATED',
  COMPLETED: 'COMPLETED',
  NO_SHOW:   'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type ReservationStatus = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];
export const ALL_RESERVATION_STATUSES = Object.values(RESERVATION_STATUS) as ReservationStatus[];

// ─────────────────────────────────────────────────────────────────────────────

export const PASSWORD_POLICY = {
  minLength: 8,
  // at least one lowercase, one uppercase, one digit, one special char
  regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
  message:
    'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
};
