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
  created_at: string;
  ticket_tiers: TicketTier[];
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  total_quantity: number;
  remaining_quantity: number;
}

export const EVENTS: Event[] = [
  {
    id: "1",
    title: "Burna Boy Live in Concert",
    description: "Experience the African Giant live at Eko Convention Centre. A night of unforgettable afrobeats, high-energy performances, and surprise guest appearances. Get ready for the concert of the year!",
    date: "2026-05-15",
    time: "19:00",
    venue: "Eko Convention Centre",
    city: "Lagos",
    category: "Concerts",
    banner_url: "",
    created_at: "2026-01-01",
    ticket_tiers: [
      { id: "t1", event_id: "1", name: "Regular", description: "General admission standing", price: 15000, total_quantity: 5000, remaining_quantity: 3200 },
      { id: "t2", event_id: "1", name: "VIP", description: "Reserved seating with complimentary drinks", price: 50000, total_quantity: 1000, remaining_quantity: 450 },
      { id: "t3", event_id: "1", name: "VVIP", description: "Front row, backstage access, meet & greet", price: 150000, total_quantity: 200, remaining_quantity: 80 },
    ],
  },
  {
    id: "2",
    title: "Wizkid: Made in Lagos Tour",
    description: "Star Boy takes the stage for an exclusive Lagos homecoming show. Feel the vibes of Essence, Joro, and all the hits live.",
    date: "2026-06-20",
    time: "20:00",
    venue: "Tafawa Balewa Square",
    city: "Lagos",
    category: "Concerts",
    banner_url: "",
    created_at: "2026-01-02",
    ticket_tiers: [
      { id: "t4", event_id: "2", name: "General", description: "Open ground access", price: 10000, total_quantity: 8000, remaining_quantity: 5500 },
      { id: "t5", event_id: "2", name: "VIP", description: "Elevated viewing area with bar", price: 45000, total_quantity: 1500, remaining_quantity: 800 },
    ],
  },
  {
    id: "3",
    title: "Lagos City Marathon 2026",
    description: "Join thousands of runners in Africa's premier marathon. From Ozumba Mbadiwe to Eko Atlantic — 42km of pure adrenaline through the heart of Lagos.",
    date: "2026-03-08",
    time: "06:30",
    venue: "National Stadium, Surulere",
    city: "Lagos",
    category: "Sports",
    banner_url: "",
    created_at: "2026-01-03",
    ticket_tiers: [
      { id: "t6", event_id: "3", name: "Participant", description: "Race entry with timing chip and jersey", price: 5000, total_quantity: 20000, remaining_quantity: 12000 },
      { id: "t7", event_id: "3", name: "Spectator VIP", description: "VIP viewing area with refreshments", price: 20000, total_quantity: 500, remaining_quantity: 300 },
    ],
  },
  {
    id: "4",
    title: "NPFL Super Cup: Enyimba vs Rangers",
    description: "The biggest rivalry in Nigerian football comes alive. Watch Enyimba take on Rangers in the Super Cup final at the Moshood Abiola Stadium.",
    date: "2026-04-25",
    time: "16:00",
    venue: "Moshood Abiola National Stadium",
    city: "Abuja",
    category: "Sports",
    banner_url: "",
    created_at: "2026-01-04",
    ticket_tiers: [
      { id: "t8", event_id: "4", name: "Regular", description: "Standard seating", price: 3000, total_quantity: 30000, remaining_quantity: 20000 },
      { id: "t9", event_id: "4", name: "VIP", description: "Covered VIP box with refreshments", price: 25000, total_quantity: 2000, remaining_quantity: 1200 },
      { id: "t10", event_id: "4", name: "VVIP", description: "Executive box with lounge access", price: 75000, total_quantity: 500, remaining_quantity: 350 },
    ],
  },
  {
    id: "5",
    title: "Bovi: Man on Fire Comedy Special",
    description: "Nigeria's king of comedy brings his sharpest material yet. Two hours of non-stop laughter guaranteed. Special appearances by your favorite comedians.",
    date: "2026-07-10",
    time: "19:30",
    venue: "The Civic Centre, Victoria Island",
    city: "Lagos",
    category: "Comedy",
    banner_url: "",
    created_at: "2026-01-05",
    ticket_tiers: [
      { id: "t11", event_id: "5", name: "Regular", description: "Standard seating", price: 10000, total_quantity: 2000, remaining_quantity: 1400 },
      { id: "t12", event_id: "5", name: "VIP", description: "Front section with complimentary drinks", price: 35000, total_quantity: 500, remaining_quantity: 280 },
    ],
  },
  {
    id: "6",
    title: "Abuja Food & Music Festival",
    description: "A 3-day celebration of Nigerian cuisine, live music, and culture. Over 50 food vendors, 20 artists, workshops, and family fun zones.",
    date: "2026-08-15",
    time: "10:00",
    venue: "Eagles Square",
    city: "Abuja",
    category: "Festivals",
    banner_url: "",
    created_at: "2026-01-06",
    ticket_tiers: [
      { id: "t13", event_id: "6", name: "Day Pass", description: "Single day access", price: 5000, total_quantity: 10000, remaining_quantity: 7500 },
      { id: "t14", event_id: "6", name: "Weekend Pass", description: "All 3 days access", price: 12000, total_quantity: 5000, remaining_quantity: 3800 },
      { id: "t15", event_id: "6", name: "VIP Weekend", description: "All access + VIP lounge + free food vouchers", price: 30000, total_quantity: 1000, remaining_quantity: 600 },
    ],
  },
];

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
