import type { Provider, SourceKind } from './types'

export const PROVIDER_NAME: Record<Provider, string> = { metrica: 'Metrica', skillcorner: 'SkillCorner', statsbomb: 'StatsBomb', statsports: 'STATSports' }
export const KIND_KEY: Record<SourceKind, string> = { optical: 'kind.optical', gps: 'kind.gps', events: 'kind.events' }
