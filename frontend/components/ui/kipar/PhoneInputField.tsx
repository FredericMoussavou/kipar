'use client'

import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { CHARCOAL, TAUPE, BORDER, RED, BG } from '@/lib/theme'

interface PhoneInputFieldProps {
  value: string
  onChange: (val: string) => void
  error?: string
  placeholder?: string
  defaultCountry?: string
}

export default function PhoneInputField({
  value,
  onChange,
  error,
  placeholder = '+33 6 12 34 56 78',
  defaultCountry = 'FR',
}: PhoneInputFieldProps) {
  return (
    <div>
      <style>{`
        .kipar-phone-input .PhoneInputInput {
          width: 100%;
          background: ${BG};
          border: 1px solid ${error ? '#F87171' : BORDER};
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          color: ${CHARCOAL};
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        .kipar-phone-input .PhoneInputInput:focus {
          border-color: ${RED};
        }
        .kipar-phone-input .PhoneInputCountrySelect {
          background: ${BG};
          border: 1px solid ${error ? '#F87171' : BORDER};
          border-radius: 10px;
          padding: 10px 8px;
          font-size: 13px;
          color: ${CHARCOAL};
          outline: none;
          cursor: pointer;
          margin-right: 8px;
        }
        .kipar-phone-input {
          display: flex;
          align-items: center;
          gap: 0;
        }
        .kipar-phone-input .PhoneInputCountry {
          display: flex;
          align-items: center;
          margin-right: 8px;
        }
      `}</style>
      <PhoneInput
        className="kipar-phone-input"
        international
        defaultCountry={defaultCountry as any}
        value={value}
        onChange={(val) => onChange(val || '')}
        placeholder={placeholder}
        limitMaxLength={true}
      />
      {error && (
        <p style={{ fontSize: 11, color: RED, marginTop: 4 }}>{error}</p>
      )}
    </div>
  )
}

export { isValidPhoneNumber }
