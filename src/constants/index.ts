import { menuPageModel } from '../types/menuPage';
import { booking_status } from 'generated/prisma';

export const menuPages: menuPageModel[] = [
  { text: 'Calendar', href: '/calendar' },
  { text: 'Bookings', href: '/bookings' },
  { text: 'Clients', href: '/clients' },
  { text: 'Payments', href: '/payments' },
  { text: 'Services', href: '/services' },
  { text: 'Therapists', href: '/therapists' },
  { text: 'Vouchers', href: '/vouchers' },
  { text: 'Tips', href: '/tips' },
  { text: 'Hours', href: '/hours' },
  { text: 'Stats', href: '/stats' },
  { text: 'Agenda', href: '/agenda' },
  { text: 'Guidelines', href: '/guidelines' },
];

export const drawerWidth: number = 240;

// The business operates in a single fixed timezone. All times are displayed, entered and
// bucketed in this zone regardless of the operator's device timezone (e.g. staff abroad).
// This is the single seam for a future per-business timezone setting.
export const BUSINESS_TIMEZONE = "Europe/Madrid";

export const BOOKING_DEFAULT_DURATIONS = [30, 60, 90, 120];

export const BOOKING_DEFAULT_PRICES = [30, 55, 60, 65, 80, 85, 90];

export const BOOKING_DEFAULT_SERVICES = ['Traditional Thai', 'Thai Oil', 'Relaxzy', 'Deep Tissue', 'Feet & Legs', 'Back & Shoulders'];

export const BOOKING_DEFAULT_STATUSES: booking_status[] = Object.values(booking_status) as booking_status[];

export const ORDERED_BOOKING_STATUSES: booking_status[] = [
  booking_status.completed,
  booking_status.confirmed,
  booking_status.pending,
  booking_status.cancelled,
];

export const STATUS_COLORS: Record<booking_status, { bg: string; border: string }> = {
  confirmed: { bg: "#1565c0", border: "#42a5f5" },
  completed: { bg: "rgba(4,62,0,1)", border: "#6FBF73" },
  cancelled:  { bg: "#546e7a", border: "#90a4ae" },
  pending:    { bg: "#e65100", border: "#ffb300" },
};

export const AGENDA_LENGTH = 30;

export const FETCH_LIMIT = 100;

export const PROTECTED_FIELDS = new Set(["id", "created_at"]);

// Placeholder "names" receptionists sometimes type for an unknown client. The correct
// path for an unknown client is the Walk-in toggle (empty contact fields), so these are
// hard-blocked to keep junk client records out of the DB. Entries are stored in their
// NORMALIZED form (lowercase, accent-stripped, punctuation→single space, trimmed) and
// compared against the normalized whole name — see isPlaceholderClientName().
export const PLACEHOLDER_CLIENT_NAMES = new Set([
  "walkin", "walk in",
  "anon", "anonimo", "anonima", "anonymous", "anonymus",
  "desconocido", "desconocida",
  "sin nombre", "nn",
  "cliente", "client", "customer",
  "na", "n a", "sn", "s n",
  "x", "xx", "xxx",
  "test", "prueba", "pruebas",
  "unknown",
]);


