export { User, type IUser } from './User';
export { Kitchen, type IKitchen } from './Kitchen';
export { Room, type IRoom, type IRoomQr } from './Room';
export { Category, type ICategory } from './Category';
export {
  MenuItem,
  type IMenuItem,
  type IMenuImage,
  type IAvailabilityWindow,
} from './MenuItem';
export { Cart, type ICart, type ICartItem } from './Cart';
export {
  Order,
  type IOrder,
  type IOrderItem,
  type IStatusHistory,
  type IInternalNote,
} from './Order';
export { RefreshToken, type IRefreshToken } from './RefreshToken';
export { VerificationToken, type IVerificationToken } from './VerificationToken';
export { AuditLog, type IAuditLog } from './AuditLog';
export { Notification, type INotification } from './Notification';
export { Coupon, type ICoupon } from './Coupon';
export { CouponRedemption, type ICouponRedemption } from './CouponRedemption';
export { CouponUserCounter, type ICouponUserCounter } from './CouponUserCounter';

// Future-ready schemas (prepared, not yet wired to routes): staff accounts,
// role-based permissions, shift management, and activity tracking.
export { Role, type IRole } from './future/Role';
export { Staff, type IStaff } from './future/Staff';
export { Shift, type IShift } from './future/Shift';
export { StaffActivity, type IStaffActivity } from './future/StaffActivity';

// Valet Parking Management Module Models
export { Vehicle, type IVehicle, type ValetStatus, type IVehiclePhoto, type IVehicleHistory } from './Vehicle';
export { ParkingSlot, type IParkingSlot } from './ParkingSlot';
export { ValetActivity, type IValetActivity } from './ValetActivity';

// Restaurant & Table Management Module Models
export { RestaurantTable, type IRestaurantTable, type ITableSession } from './RestaurantTable';
export { TableReservation, type ITableReservation } from './TableReservation';

// Banner / Offer Management
export { Banner, type IBanner } from './Banner';

// Banquet Hall Module Models
export { BanquetHall, type IBanquetHall } from './BanquetHall';
export { BanquetBooking, type IBanquetBooking } from './BanquetBooking';

// Room Booking Module Models
export { RoomBooking, type IRoomBooking } from './RoomBooking';
export { BookingInvoice, type IBookingInvoice } from './BookingInvoice';

// Restaurant Waitlist Module Models
export { Waitlist, type IWaitlist } from './Waitlist';

// Complaint and Feedback Models
export { Complaint, type IComplaint } from './Complaint';
export { Feedback, type IFeedback } from './Feedback';

// Gallery Model
export { GalleryImage, type IGalleryImage } from './GalleryImage';
