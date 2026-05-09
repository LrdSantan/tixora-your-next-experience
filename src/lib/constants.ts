export const EVENT_CATEGORIES = [
  'Music',
  'Tech',
  'Sports',
  'Arts',
  'Food & Drink',
  'Business',
  'Fashion',
  'Comedy',
  'Religion',
  'Education',
  'Other',
  'Concerts',
  'Theatre',
  'Festivals'
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  'Music': 'bg-purple-100 text-purple-700 border-purple-200',
  'Tech': 'bg-blue-100 text-blue-700 border-blue-200',
  'Sports': 'bg-green-100 text-green-700 border-green-200',
  'Arts': 'bg-pink-100 text-pink-700 border-pink-200',
  'Food & Drink': 'bg-orange-100 text-orange-700 border-orange-200',
  'Business': 'bg-slate-100 text-slate-700 border-slate-200',
  'Fashion': 'bg-rose-100 text-rose-700 border-rose-200',
  'Comedy': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Religion': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Education': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'Other': 'bg-neutral-100 text-neutral-700 border-neutral-200',
  'Concerts': 'bg-violet-100 text-violet-700 border-violet-200',
  'Theatre': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Festivals': 'bg-amber-100 text-amber-700 border-amber-200',
};
