import { Category } from '@prisma/client'

interface CatIconProps {
  category: Category
  size?: number
  color?: string
}

export default function CatIcon({ category, size = 20, color = 'currentColor' }: CatIconProps) {
  const s = size
  const c = color
  const stroke = { stroke: c, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (category) {
    case 'MUSIC':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg>)
    case 'FOOD_DRINK':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M6 3v6a3 3 0 003 3v9" /><path d="M12 3v18" /><path d="M18 3v6c0 1.5-1 3-3 3" /></svg>)
    case 'ART_GALLERIES':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="9" cy="9" r="1.2" fill={c} /><circle cx="15" cy="9" r="1.2" fill={c} /><circle cx="16.5" cy="13" r="1.2" fill={c} /><path d="M12 21a3 3 0 003-3c0-2-3-2-3-4" /></svg>)
    case 'FAMILY_KIDS':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5" /><path d="M14 20c.4-2.5 2-4 3.5-4s2.5 1.2 3 3" /></svg>)
    case 'COMEDY':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M8 14c1 2 2.5 3 4 3s3-1 4-3" /><path d="M8.5 9.5l1 1M14.5 10.5l1-1" /></svg>)
    case 'MOVIES':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></svg>)
    case 'THEATER':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M4 4h16v8a8 8 0 01-16 0z" /><circle cx="9" cy="10" r="0.8" fill={c} /><circle cx="15" cy="10" r="0.8" fill={c} /><path d="M9 14c1 1 2 1.5 3 1.5s2-.5 3-1.5" /></svg>)
    case 'SPORTS_RECREATION':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M3 20l5-9 4 6 3-4 6 7" /><circle cx="17" cy="6" r="2" /></svg>)
    case 'COMMUNITY_GOVERNMENT':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M3 20h18" /><path d="M5 20V10l7-5 7 5v10" /><path d="M9 20v-5h6v5" /></svg>)
    case 'CLASSES_WORKSHOPS':
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><path d="M3 6l9-3 9 3-9 3z" /><path d="M7 8v5c0 2 2.5 3 5 3s5-1 5-3V8" /></svg>)
    default:
      return (<svg width={s} height={s} viewBox="0 0 24 24" {...stroke}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M9 3v4M15 3v4" /></svg>)
  }
}
