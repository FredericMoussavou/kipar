import { useState, useEffect } from 'react'

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

function getBreakpoint(w: number): Breakpoint {
  if (w < 390) return 'xs'   // Galaxy SE, petits Android
  if (w < 768) return 'sm'   // Mobile standard
  if (w < 1024) return 'md'  // Tablette
  if (w < 1440) return 'lg'  // Desktop S
  return 'xl'                // Desktop L
}

export function useResponsive() {
  const [bp, setBp] = useState<Breakpoint>('lg')

  useEffect(() => {
    const check = () => setBp(getBreakpoint(window.innerWidth))
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isMobile = bp === 'xs' || bp === 'sm'
  const isTablet = bp === 'md'
  const isDesktop = bp === 'lg' || bp === 'xl'
  const isXS = bp === 'xs'

  return {
    bp,
    isMobile,
    isTablet,
    isDesktop,
    isXS,

    // Padding horizontal page
    paddingH: bp === 'xs' ? 16 : bp === 'sm' ? 20 : bp === 'md' ? 32 : 48,

    // Padding vertical section
    paddingV: bp === 'xs' ? 24 : bp === 'sm' ? 32 : bp === 'md' ? 48 : 64,

    // Gap entre elements
    gap: bp === 'xs' ? 12 : bp === 'sm' ? 16 : bp === 'md' ? 24 : 32,

    // Gap large (sections)
    gapLg: bp === 'xs' ? 24 : bp === 'sm' ? 32 : bp === 'md' ? 48 : 80,

    // Font sizes
    fontSizeHero: bp === 'xs' ? 32 : bp === 'sm' ? 38 : bp === 'md' ? 48 : 64,
    fontSizeH1: bp === 'xs' ? 24 : bp === 'sm' ? 28 : bp === 'md' ? 32 : 40,
    fontSizeH2: bp === 'xs' ? 18 : bp === 'sm' ? 20 : bp === 'md' ? 24 : 28,
    fontSizeH3: bp === 'xs' ? 15 : bp === 'sm' ? 16 : bp === 'md' ? 18 : 20,
    fontSizeBody: bp === 'xs' ? 13 : bp === 'sm' ? 14 : bp === 'md' ? 15 : 16,
    fontSizeSmall: bp === 'xs' ? 11 : bp === 'sm' ? 12 : bp === 'md' ? 12 : 13,

    // Border radius
    radiusCard: bp === 'xs' ? 12 : bp === 'sm' ? 14 : 16,
    radiusBtn: bp === 'xs' ? 10 : 12,

    // Padding bouton
    paddingBtn: bp === 'xs' ? '11px 18px' : bp === 'sm' ? '12px 20px' : '14px 28px',

    // Max width conteneur
    maxWidth: bp === 'md' ? 768 : bp === 'lg' ? 1024 : bp === 'xl' ? 1200 : undefined,

    // Colonnes grille
    gridCols: bp === 'xs' || bp === 'sm' ? 1 : bp === 'md' ? 2 : 3,

    // Bottom nav height (pour padding bas de page)
    bottomNavH: isMobile ? 80 : 0,
  }
}
