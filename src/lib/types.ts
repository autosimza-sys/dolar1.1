export type RateType = "main" | "travel" | "indicator";

export type Channel = "email" | "whatsapp";

export type AlertCondition =
  | "above"
  | "below"
  | "mep_below"
  | "mep_above_blue"
  | "gap_above"
  | "rate_up"
  | "rate_down"
  | "fixed_term_better"
  | "dollar_vs_fixed_term"
  | "travel_opportunity"
  | "clp_strong_move"
  | "brl_strong_move"
  | "eur_strong_move";

export type Profile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  is_premium: boolean;
  created_at: string;
};

export type Rate = {
  id?: string;
  code: string;
  name: string;
  country: string;
  flag: string;
  type: RateType;
  buy_price: number | null;
  sell_price: number | null;
  variation: number;
  source: string | null;
  is_visible: boolean;
  updated_at: string;
};

export type UserAlert = {
  id: string;
  user_id: string;
  rate_code: string;
  condition_type: AlertCondition;
  target_value: number;
  channel: Channel;
  is_active: boolean;
  created_at: string;
};

export type AlertLog = {
  id: string;
  alert_id: string;
  user_id: string;
  message: string;
  sent_at: string;
};

export type EducationCard = {
  id: string;
  title: string;
  content: string;
  category: "dolar" | "plazo fijo" | "inflacion" | "ahorro" | "viajes" | "errores comunes";
  related_alert_type: AlertCondition;
  is_visible: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  mercado_pago_payment_id: string | null;
  status: "pending" | "active" | "paused" | "cancelled" | "expired";
  plan: "free" | "premium_monthly";
  started_at: string | null;
  expires_at: string | null;
};

export type FavoriteRate = {
  id: string;
  user_id: string;
  rate_code: string;
  created_at: string;
};
