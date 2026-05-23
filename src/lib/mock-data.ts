export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  category: string;
  banner_url: string;
  cover_image_url?: string;
  status?: string;
  organizer_id?: string;
  organizer_email?: string;
  organizer_phone?: string;
  created_at: string;
  ticket_tiers: TicketTier[];
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  payout_status?: string;
  is_multi_day?: boolean;
  event_days?: string[];
  is_private?: boolean;
  event_type?: 'ticketed' | 'rsvp';
  rsvp_limit?: number | null;
  organizer_name?: string;
  organizer_avatar?: string;
  organizer_bio?: string;
  organizer_profile?: {
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  } | null;
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  total_quantity: number;
  remaining_quantity: number;
  waitlist_enabled?: boolean;
}

export interface RegistrationQuestion {
  id: string;
  event_id: string;
  question_text: string;
  question_type: 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox';
  options?: string[];
  is_required: boolean;
  display_order: number;
}

export interface RegistrationAnswer {
  question_id: string;
  answer: string;
}

export const EVENTS: Event[] = [];

export const CATEGORIES = [
  { name: "Concerts", icon: "Music" },
  { name: "Sports", icon: "Trophy" },
  { name: "Theatre", icon: "Drama" },
  { name: "Comedy", icon: "Laugh" },
  { name: "Festivals", icon: "PartyPopper" },
];

export function formatPrice(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
