'use client'

/**
 * KycPlaneLoader — animation d'attente KYC (Lot B).
 * Un avion suit un arc pointille origine -> destination, en boucle.
 * SVG + CSS pur, aucune dependance. Remplace le spinner pendant le polling KYC.
 */
export default function KycPlaneLoader() {
  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '0 auto 16px' }}>
      <svg width="180" height="72" viewBox="0 0 180 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <path id="kyc-arc" d="M 16 56 Q 90 -4 164 56" />
        </defs>
        {/* arc pointille */}
        <use href="#kyc-arc" stroke="#E5E1DC" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
        {/* progression rouge qui se remplit */}
        <use href="#kyc-arc" stroke="#DC0029" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="200" strokeDashoffset="200">
          <animate attributeName="stroke-dashoffset" from="200" to="0" dur="2.4s" repeatCount="indefinite" />
        </use>
        {/* villes */}
        <circle cx="16" cy="56" r="4" fill="#DC0029" />
        <circle cx="164" cy="56" r="4" fill="#1A1A1A" />
        {/* avion qui suit l'arc */}
        <g>
          <animateMotion dur="2.4s" repeatCount="indefinite" rotate="auto">
            <mpath href="#kyc-arc" />
          </animateMotion>
          <path d="M -7 0 L 7 0 M 7 0 L 1 -4 M 7 0 L 1 4" stroke="#DC0029" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" transform="rotate(0)" />
        </g>
      </svg>
    </div>
  )
}
