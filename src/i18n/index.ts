import en from './en'

/**
 * Minimal i18n wrapper. One locale (British English) today. Every user-facing string goes
 * through t(), so a second locale is a new dictionary and not a refactor.
 * Variables use {name} placeholders. Plurals use the `key.one` and `key.other` convention via tn().
 */
const dict: Record<string, string> = en

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dict[key]
  if (s === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`)
    return key
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars })
}
