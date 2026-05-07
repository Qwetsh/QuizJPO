export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || navigator.vendor || ''
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 1024
  return isMobileUA || isSmallScreen
}
