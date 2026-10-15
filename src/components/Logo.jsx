import { useId } from 'react'

// El icono de la app: una copia enmarcada con su pie de foto. Es el mismo dibujo que build/icon.svg.
function Logo({ size = 32 }) {
  const clip = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" className="shrink-0">
      <rect width="256" height="256" rx="56" fill="#1d4e89" />
      <rect x="50" y="36" width="156" height="184" rx="5" fill="#fcfcfb" />
      <clipPath id={clip}>
        <rect x="65" y="51" width="126" height="118" />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect x="65" y="51" width="126" height="118" fill="#7aa9e6" />
        <circle cx="157" cy="86" r="14" fill="#ffe08c" />
        <path d="M65 138 Q96 110 128 133 T191 125 V169 H65Z" fill="#4f8d5a" />
        <path d="M65 157 Q100 136 134 154 T191 148 V169 H65Z" fill="#2a7248" />
      </g>
      <rect x="84" y="186" width="88" height="8" rx="4" fill="#1d4e89" />
      <rect x="104" y="201" width="48" height="6" rx="3" fill="#1d4e89" opacity=".4" />
    </svg>
  )
}

export default Logo
