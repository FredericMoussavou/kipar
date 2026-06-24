import { ImageResponse } from 'next/og'
import { RED, CHARCOAL, WHITE, SAND } from '@/lib/theme'

export const alt = 'KIPAR. Transport de colis entre particuliers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: CHARCOAL,
          padding: '90px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: 150, fontWeight: 800, color: WHITE, letterSpacing: '-5px' }}>KIPAR</span>
          <span style={{ fontSize: 150, fontWeight: 800, color: RED, letterSpacing: '-5px' }}>.</span>
        </div>
        <div style={{ display: 'flex', fontSize: 48, color: SAND, marginTop: 28, maxWidth: 980 }}>
          Transport de colis entre particuliers
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: RED, marginTop: 46, fontWeight: 600 }}>
          Europe · Afrique · réseau de voyageurs vérifiés
        </div>
      </div>
    ),
    { ...size },
  )
}
