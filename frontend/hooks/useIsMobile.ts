import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

export function useBreakpoint() {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const check = () => setWidth(window.innerWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return {
    width,
    isXS: width > 0 && width < 390,   // iPhone SE, Galaxy petits
    isMobile: width > 0 && width < 768, // Mobile standard
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  }
}
