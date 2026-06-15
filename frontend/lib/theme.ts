export const COLORS = {
  red: 'var(--k-red)',
  charcoal: 'var(--k-charcoal)',
  charcoal2: 'var(--k-charcoal-2)',
  taupe: 'var(--k-taupe)',
  bg: 'var(--k-bg)',
  white: 'var(--k-white)',
  sand: 'var(--k-sand)',
  border: 'var(--k-border)',
  green: '#16A34A',
  amber: '#F59E0B',
  lime: '#4ADE80',
  orange: '#F97316',
} as const

export const {
  red: RED,
  charcoal: CHARCOAL,
  charcoal2: CHARCOAL2,
  taupe: TAUPE,
  bg: BG,
  white: WHITE,
  sand: SAND,
  border: BORDER,
  green: GREEN,
  amber: AMBER,
  lime: LIME,
  orange: ORANGE,
} = COLORS

// Design system - rayons de bordure
export const RADIUS = {
  card: 16,    // cartes, panneaux, containers
  inner: 12,   // inputs, sous-blocs, petits boutons
  pill: 99,    // badges, toggles, boutons ronds
  hero: 24,    // grands bandeaux (HeroHeader)
} as const

// Design system - elevations (ombres)
export const SHADOW = {
  card: '0 2px 8px rgba(0,0,0,0.05)',     // carte au repos
  raised: '0 4px 16px rgba(0,0,0,0.10)',  // carte elevee / hover
  overlay: '0 8px 24px rgba(0,0,0,0.12)', // dropdown, modale, popover
} as const
