/** Curated list of top Google Fonts by popularity, grouped by category */

export interface GoogleFont {
  family: string;
  category: 'sans-serif' | 'serif' | 'monospace' | 'display' | 'handwriting';
}

export const GOOGLE_FONTS: GoogleFont[] = [
  // Sans-serif (most popular)
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Noto Sans', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Fira Sans', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Jost', category: 'sans-serif' },
  { family: 'Karla', category: 'sans-serif' },
  // Serif
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Noto Serif', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  // Monospace
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
  // Display
  { family: 'Oswald', category: 'display' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Abril Fatface', category: 'display' },
  { family: 'Fredoka One', category: 'display' },
  { family: 'Pacifico', category: 'display' },
  { family: 'Lobster', category: 'display' },
  { family: 'Comfortaa', category: 'display' },
  // Handwriting
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Sacramento', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
];

export const CATEGORY_LABELS: Record<GoogleFont['category'], string> = {
  'sans-serif': 'Sans Serif',
  'serif': 'Serif',
  'monospace': 'Monospace',
  'display': 'Display',
  'handwriting': 'Handwriting',
};

/** System fonts shown at the top, before Google Fonts */
export const SYSTEM_FONTS = [
  { family: 'Inter', stack: 'Inter, system-ui, sans-serif' },
  { family: 'System UI', stack: 'system-ui, -apple-system, sans-serif' },
  { family: 'Georgia', stack: 'Georgia, serif' },
  { family: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { family: 'Courier New', stack: '"Courier New", Courier, monospace' },
];
