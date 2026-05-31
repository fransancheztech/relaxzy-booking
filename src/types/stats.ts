export interface StatsRevenuePeriodPoint {
  period: string;
  total: number;
  cash: number;
  credit_card: number;
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

export interface StatsTipsByTherapist {
  therapist_id: string;
  therapist_name: string;
  tip_count: number;
  gross_amount: number;
  net_amount: number;
}

export interface StatsTicketDistribution {
  bucket: string;
  count: number;
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

export interface StatsResponse {
  meta: {
    from: string;
    to: string;
    date_bucket: "day" | "week" | "month";
  };

  revenue: {
    total: number;
    cash: number;
    credit_card: number;
    refunds_total: number;
    over_time: StatsRevenuePeriodPoint[];
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
  };

  tips: {
    total_gross: number;
    total_net: number;
    tip_count: number;
    by_therapist: StatsTipsByTherapist[];
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
