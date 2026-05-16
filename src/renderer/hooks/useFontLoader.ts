/**
 * Lazy-loads Google Font stylesheets on demand.
 * Each unique family is only loaded once per session.
 */

const loaded = new Set<string>();

export function loadGoogleFont(family: string): void {
  if (loaded.has(family)) return;
  loaded.add(family);

  const encoded = encodeURIComponent(family);
  const href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@100;200;300;400;500;600;700;800;900&display=swap`;

  // Skip if already in DOM
  if (document.querySelector(`link[href*="${encoded}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Preload a list of fonts (e.g. on app start for common picks) */
export function preloadFonts(families: string[]): void {
  families.forEach(loadGoogleFont);
}
