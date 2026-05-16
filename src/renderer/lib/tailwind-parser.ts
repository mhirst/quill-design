// Categorizes Tailwind classes into design-system buckets

export interface ParsedClasses {
  layout: string[];
  spacing: string[];
  typography: string[];
  appearance: string[];
  other: string[];
}

const LAYOUT_PREFIXES = ['flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky', 'static', 'overflow', 'z-', 'col-', 'row-', 'items-', 'justify-', 'self-', 'place-', 'order-', 'grow', 'shrink', 'basis-', 'gap-', 'space-', 'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-', 'aspect-', 'float-', 'clear-', 'object-', 'inset-', 'top-', 'right-', 'bottom-', 'left-', 'flex-', 'grid-'];

const SPACING_PREFIXES = ['p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-'];

const TYPOGRAPHY_PREFIXES = ['font-', 'text-', 'leading-', 'tracking-', 'line-clamp-', 'truncate', 'whitespace-', 'break-', 'list-', 'align-', 'decoration-', 'underline', 'overline', 'line-through', 'no-underline', 'uppercase', 'lowercase', 'capitalize', 'normal-case', 'italic', 'not-italic', 'antialiased', 'subpixel-antialiased'];

const APPEARANCE_PREFIXES = ['bg-', 'border', 'rounded', 'shadow', 'ring', 'opacity-', 'outline-', 'cursor-', 'pointer-', 'select-', 'resize-', 'appearance-', 'accent-', 'caret-', 'fill-', 'stroke-', 'divide-', 'blur-', 'brightness-', 'contrast-', 'drop-shadow-', 'grayscale-', 'hue-rotate-', 'invert-', 'saturate-', 'sepia-', 'backdrop-', 'transition-', 'duration-', 'ease-', 'delay-', 'animate-', 'scale-', 'rotate-', 'translate-', 'skew-', 'origin-', 'will-change-'];

// Some classes are exact matches
const LAYOUT_EXACT = new Set(['flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky', 'static', 'table', 'contents', 'grow', 'shrink', 'truncate', 'overflow-auto', 'overflow-hidden', 'overflow-scroll', 'overflow-visible']);
const APPEARANCE_EXACT = new Set(['border', 'rounded', 'shadow', 'ring', 'underline', 'overline', 'line-through', 'no-underline', 'uppercase', 'lowercase', 'capitalize', 'normal-case', 'italic', 'not-italic', 'antialiased', 'subpixel-antialiased']);

function matchesPrefixList(cls: string, prefixes: string[]): boolean {
  for (const prefix of prefixes) {
    if (cls.startsWith(prefix)) return true;
  }
  return false;
}

export function parseTailwindClasses(className: string): ParsedClasses {
  const result: ParsedClasses = { layout: [], spacing: [], typography: [], appearance: [], other: [] };

  if (!className) return result;

  const classes = className.split(/\s+/).filter(Boolean);

  for (const cls of classes) {
    // Strip variant prefixes (hover:, focus:, md:, dark:, etc.) for matching purposes
    const base = cls.includes(':') ? cls.split(':').pop()! : cls;

    if (LAYOUT_EXACT.has(base) || matchesPrefixList(base, LAYOUT_PREFIXES)) {
      result.layout.push(cls);
    } else if (matchesPrefixList(base, SPACING_PREFIXES)) {
      result.spacing.push(cls);
    } else if (matchesPrefixList(base, TYPOGRAPHY_PREFIXES)) {
      result.typography.push(cls);
    } else if (APPEARANCE_EXACT.has(base) || matchesPrefixList(base, APPEARANCE_PREFIXES)) {
      result.appearance.push(cls);
    } else {
      result.other.push(cls);
    }
  }

  return result;
}

// Converts "rgb(r, g, b)" or "rgba(r, g, b, a)" → "#rrggbb"
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return rgb;
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Parses "16px 8px 16px 8px" → [top, right, bottom, left]
export function parseFourSides(value: string): [string, string, string, string] {
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]];
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]];
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]];
  return [parts[0], parts[1], parts[2], parts[3]];
}

// Parse "12px" → 12
export function parsePx(value: string): number {
  return parseFloat(value) || 0;
}
