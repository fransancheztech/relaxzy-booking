export interface StatsRevenueStreamAmounts {
  cash: number;
  credit_card: number;
  refunds: number;
}

export interface StatsRevenuePeriodPoint {
  period: string;
  bookings: StatsRevenueStreamAmounts;
  vouchers: StatsRevenueStreamAmounts;
  // Tips are not real revenue; surfaced as an opt-in stream on the revenue-over-time
  // chart only. Always refunds: 0 (tips have no refunds).
  tips: StatsRevenueStreamAmounts;
}

export interface StatsRevenueByTherapist {
  therapist_id: string;
  therapist_name: string;
  revenue: number;
}

export interface StatsBookingsByService {
  service_name: string;
  count: number;
  revenue: number;
}

export interface StatsBookingsByDayOfWeek {
  day_of_week: number;
  day_label: string;
  count: number;
}

export interface StatsBookingsByTimeSlot {
  hour: number;
  count: number;
}

export interface StatsBookingsByDuration {
  duration_minutes: number;
  count: number;
}

export interface StatsTipsMethodTotals {
  count: number;
  gross: number;
  net: number;
}

export interface StatsTipsByTherapist {
  therapist_id: string;
  therapist_name: string;
  cash: StatsTipsMethodTotals;
  credit_card: StatsTipsMethodTotals;
}

export interface StatsTicketDistribution {
  bucket: string;
  count: number;
}

export interface StatsTipsTherapist {
  therapist_id: string;
  therapist_name: string;
}

export interface StatsTipsPeriodPoint {
  period: string;
  by_therapist: Record<string, { cash: number; credit_card: number }>;
}

export interface StatsVoucherBySource {
  source: string;
  count: number;
  value: number;
}

export interface StatsVoucherPeriodPoint {
  period: string;
  sold: number;
  redeemed: number;
}

export interface StatsTopClient {
  client_id: string;
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
  /** Every booking row, so a couples visit booked under one client counts twice. */
  bookings_individual: number;
  /** A booking group counts once, which is the number of actual visits. */
  bookings_grouped: number;
  /** Purchase-side spend: booking payments net of refunds + voucher purchases. A gift
   *  voucher is credited to both buyer and recipient, so these do not sum to revenue. */
  spend_all: number;
  spend_cash: number;
  spend_card: number;
}

/** One time a booking rule was broken. */
export interface StatsTherapistRuleIncident {
  /** Business date, yyyy-MM-dd. */
  day: string;
  /** Booked hours that day, the length of the run, or the late massage's length. */
  hours: number;
  /** The run, or the late massage, as HH:mm in business time. */
  start?: string;
  end?: string;
  /** Extended days: the other days over 7 h in the 7 days up to this one. */
  other_days?: string[];
}

/** Breaks of the booking rules guideline (BOOKINGS RULES › scheduling constraints). */
export interface StatsTherapistRules {
  /** Days with more than 7 h 30 booked. */
  days_over_limit: StatsTherapistRuleIncident[];
  /** Days with more than 7 h (up to 7 h 30) beyond the 2 allowed in any 7 days. */
  extended_over_allowance: StatsTherapistRuleIncident[];
  /** Runs of more than 3 h of massages without a 15-minute break. */
  long_chains: StatsTherapistRuleIncident[];
  /** Massages starting after 19:30, the latest allowed start. */
  late_starts: StatsTherapistRuleIncident[];
}

export interface StatsTherapistRow {
  therapist_id: string;
  therapist_name: string;
  active: boolean;
  /** Chart color slot (0–7): fixed per therapist, so a therapist keeps her color across periods. */
  color_slot: number;
  /** Days with at least one booking. */
  days_worked: number;
  bookings: number;
  /** Time actually booked: overlapping bookings of one therapist count once. */
  booked_hours: number;
  avg_hours_per_day: number;
  /** Bookings where the client asked for this therapist. */
  requested: number;
  distinct_clients: number;
  /** Payments for these bookings (charges − refunds), by appointment date. */
  revenue: number;
  /** Booked hours per service name. */
  hours_by_service: Record<string, number>;
  rules: StatsTherapistRules;
}

export interface StatsTherapistsPeriodPoint {
  period: string;
  /** Average booked hours per working day in the period, per therapist id. */
  by_therapist: Record<string, number>;
}

export interface StatsTherapists {
  therapists: StatsTherapistRow[];
  over_time: StatsTherapistsPeriodPoint[];
  /** Service names, most booked hours first. */
  services: string[];
  team: {
    booked_hours: number;
    /** One therapist working one day. */
    therapist_days: number;
    avg_hours_per_day: number;
    requested: number;
    assigned_bookings: number;
    /** Bookings in the period with no therapist: left out of everything else here. */
    unassigned_bookings: number;
    /** Days with two or more therapists working, the ones balance can be judged on. */
    balance_days: number;
    /** Average gap, in hours, between the busiest and the least busy therapist of a day. */
    avg_balance_gap: number;
    /** Days where that gap was 2 h or more. */
    big_gap_days: number;
    /** Longest run of consecutive days where every working therapist had more than 6 h. */
    all_over_six_streak: number;
    all_over_six_streak_end: string | null;
  };
}

export interface StatsResponse {
  meta: {
    from: string;
    to: string;
    date_bucket: "day" | "week" | "month";
    // Attribution basis for booking-payment revenue figures.
    basis: "payment" | "service";
  };

  revenue: {
    total: number;
    cash: number;
    credit_card: number;
    refunds_total: number;
    over_time: StatsRevenuePeriodPoint[];
    /** The same figures per business day, whatever over_time's bucket: feeds the Top days table. */
    by_day: StatsRevenuePeriodPoint[];
    by_therapist: StatsRevenueByTherapist[];
  };

  bookings: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    confirmed: number;
    cancellation_rate: number;
    avg_per_day: number;
    total_booked_hours: number;
    avg_session_minutes: number;
    by_service: StatsBookingsByService[];
    by_day_of_week: StatsBookingsByDayOfWeek[];
    by_time_slot: StatsBookingsByTimeSlot[];
    by_duration: StatsBookingsByDuration[];
  };

  financial: {
    avg_ticket: number;
    revenue_per_hour: number;
    p25_ticket: number;
    p75_ticket: number;
    ticket_distribution: StatsTicketDistribution[];
  };

  clients: {
    total_unique: number;
    total_all_time: number;
    new_in_period: number;
    returning_in_period: number;
    retention_rate: number;
    avg_bookings_per_client: number;
    repeat_frequency_days: number;
    new_over_time: { period: string; count: number }[];
    top: StatsTopClient[];
  };

  therapists: StatsTherapists;

  tips: {
    tip_count: number; // all methods, current roster — for the section gate
    by_method: { cash: StatsTipsMethodTotals; credit_card: StatsTipsMethodTotals };
    by_therapist: StatsTipsByTherapist[];
    // Over-time card: includes deleted/inactive therapists on purpose.
    over_time: StatsTipsPeriodPoint[];
    over_time_therapists: StatsTipsTherapist[];
  };

  vouchers: {
    sold_count: number;
    sold_value: number;
    redeemed_count: number;
    redeemed_value: number;
    outstanding_balance: number;
    active_count: number;
    expired_count: number;
    expired_balance: number;
    by_source: StatsVoucherBySource[];
    over_time: StatsVoucherPeriodPoint[];
  };
}
