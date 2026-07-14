import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'

const cdnArt = (id) =>
  `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`

const scryfallArt = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`

export default function PlayerAvatar({ username, avatarCardName, avatarScryfallId, size = 32, highlight = false }) {
  const { t } = useTheme()
  const [imgError, setImgError] = useState(false)

  const imgSrc = avatarScryfallId
    ? cdnArt(avatarScryfallId)
    : (avatarCardName ? scryfallArt(avatarCardName) : null)

  const showImg = !!imgSrc && !imgError

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      background: showImg ? '#1a1a2e' : (highlight ? t.primary : t.primaryBg),
      border: `1px solid ${highlight ? t.primaryBorder : t.primaryBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: highlight && showImg ? `0 0 0 2px ${t.primary}` : 'none',
    }}>
      {showImg
        ? <img
            src={imgSrc}
            alt={username}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
            onError={() => setImgError(true)}
          />
        : <span style={{
            fontSize: size * 0.4, fontWeight: 700,
            color: highlight ? t.primaryFg : t.primary,
            textTransform: 'uppercase', userSelect: 'none', lineHeight: 1,
          }}>
            {(username || '?').substring(0, 2)}
          </span>
      }
    </div>
  )
}
