// Server component — injecte les CSS variables du thème dans <head>
// Aucun "use client" ici, c'est rendu côté serveur à chaque requête

type AccentShades = {
  bg: string
  bgHover: string
  light: string
  text: string
  ring: string
  darkText: string
}

// Mapping des 8 couleurs accent vers leurs nuances Tailwind correspondantes
const ACCENT_MAP: Record<string, AccentShades> = {
  '#2B44A0': { bg: '#2B44A0', bgHover: '#22388A', light: '#E6EAF7', text: '#2B44A0', ring: '#4A63BA', darkText: '#9FB2F2' },
  '#7c3aed': { bg: '#7c3aed', bgHover: '#6d28d9', light: '#ede9fe', text: '#6d28d9', ring: '#8b5cf6', darkText: '#a78bfa' },
  '#2563eb': { bg: '#2563eb', bgHover: '#1d4ed8', light: '#dbeafe', text: '#1d4ed8', ring: '#3b82f6', darkText: '#60a5fa' },
  '#16a34a': { bg: '#16a34a', bgHover: '#15803d', light: '#dcfce7', text: '#15803d', ring: '#22c55e', darkText: '#4ade80' },
  '#dc2626': { bg: '#dc2626', bgHover: '#b91c1c', light: '#fee2e2', text: '#b91c1c', ring: '#ef4444', darkText: '#f87171' },
  '#d97706': { bg: '#d97706', bgHover: '#b45309', light: '#fef3c7', text: '#b45309', ring: '#f59e0b', darkText: '#fbbf24' },
  '#db2777': { bg: '#db2777', bgHover: '#be185d', light: '#fce7f3', text: '#be185d', ring: '#ec4899', darkText: '#f472b6' },
  '#0891b2': { bg: '#0891b2', bgHover: '#0e7490', light: '#cffafe', text: '#0e7490', ring: '#22d3ee', darkText: '#67e8f9' },
  '#374151': { bg: '#374151', bgHover: '#1f2937', light: '#f3f4f6', text: '#1f2937', ring: '#6b7280', darkText: '#9ca3af' },
}

// A shop that never picked a colour gets the WISHOP indigo.
const DEFAULT_ACCENT = ACCENT_MAP['#2B44A0']

// Google Fonts à charger si ce n'est pas Geist (déjà chargé par Next.js)
const GOOGLE_FONTS: Record<string, string> = {
  Inter: 'Inter',
  Roboto: 'Roboto',
  Outfit: 'Outfit',
  Poppins: 'Poppins',
  "Bodoni Moda": 'Bodoni+Moda',
}

type Props = {
  accentColor?: string | null
  fontFamily?: string | null
}

export function ThemeStyle({ accentColor, fontFamily }: Props) {
  const accent = (accentColor && ACCENT_MAP[accentColor]) ? ACCENT_MAP[accentColor] : DEFAULT_ACCENT
  const font = fontFamily || 'Geist'
  const googleFontName = GOOGLE_FONTS[font]

  const css = `
    :root {
      --accent-bg: ${accent.bg};
      --accent-bg-hover: ${accent.bgHover};
      --accent-light: ${accent.light};
      --accent-text: ${accent.text};
      --accent-ring: ${accent.ring};
      --accent-dark-text: ${accent.darkText};
      --theme-font: ${googleFontName ? `'${googleFontName}'` : 'var(--font-app-sans)'}, system-ui, sans-serif;
      --store-heading: ${googleFontName ? `'${googleFontName}'` : 'var(--font-app-display)'};
    }
    body {
      font-family: var(--theme-font);
    }
  `

  return (
    <>
      {googleFontName && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="stylesheet"
            href={`https://fonts.googleapis.com/css2?family=${googleFontName}:wght@400;500;600;700&display=swap`}
          />
        </>
      )}
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  )
}
