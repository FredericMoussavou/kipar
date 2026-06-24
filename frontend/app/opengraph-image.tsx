import { ImageResponse } from 'next/og'

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
          backgroundColor: '#3D3D3D',
          padding: '90px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ fontSize: 150, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-5px' }}>KIPAR</span>
          <span style={{ fontSize: 150, fontWeight: 800, color: '#DC0029', letterSpacing: '-5px' }}>.</span>
        </div>
        <div style={{ display: 'flex', fontSize: 48, color: '#F0EDE8', marginTop: 28, maxWidth: 980 }}>
          Transport de colis entre particuliers
        </div>
        <div style={{ display: 'flex', fontSize: 34, color: '#DC0029', marginTop: 46, fontWeight: 600 }}>
          Europe · Afrique · réseau de voyageurs vérifiés
        </div>
      </div>
    ),
    { ...size },
  )
}
