/**
 * Accessible color presets for dynamic filter tags
 */

export interface ColorPreset {
  id: string;
  name: string;
  bg: string; // Tailwind class or Hex
  textColor: string; // Tailwind class or Hex
  border: string;
  badgeClass: string;
}

export const FILTER_COLOR_PRESETS: ColorPreset[] = [
  {
    id: 'amber',
    name: 'كهرماني / ذهبي',
    bg: '#FEF3C7',
    textColor: '#92400E',
    border: '#FDE68A',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  {
    id: 'emerald',
    name: 'أخضر زمردي',
    bg: '#D1FAE5',
    textColor: '#065F46',
    border: '#A7F3D0',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  {
    id: 'rose',
    name: 'وردي / أحمر ناعم',
    bg: '#FFE4E6',
    textColor: '#9F1239',
    border: '#FECDD3',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
  },
  {
    id: 'indigo',
    name: 'نيلي / كحلي هادئ',
    bg: '#E0E7FF',
    textColor: '#3730A3',
    border: '#C7D2FE',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
  {
    id: 'orange',
    name: 'برتقالي دافئ',
    bg: '#FFEDD5',
    textColor: '#9A3412',
    border: '#FED7AA',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
  },
  {
    id: 'teal',
    name: 'تركواز / فيروزي',
    bg: '#CCFBF1',
    textColor: '#115E59',
    border: '#99F6E4',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
  },
  {
    id: 'purple',
    name: 'أرجواني غني',
    bg: '#F3E8FF',
    textColor: '#6B21A8',
    border: '#E9D5FF',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
  },
  {
    id: 'neutral',
    name: 'رمادي محايد',
    bg: '#F3F4F6',
    textColor: '#1F2937',
    border: '#E5E7EB',
    badgeClass: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  },
];

export function getColorPreset(idOrHex: string): ColorPreset {
  const found = FILTER_COLOR_PRESETS.find((p) => p.id === idOrHex || p.bg === idOrHex);
  return found || FILTER_COLOR_PRESETS[0];
}
