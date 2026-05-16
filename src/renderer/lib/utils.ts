import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely replace a Tailwind class using tailwind-merge so conflicting
 * utilities (including variants like hover:, focus:, dark:) are handled
 * correctly. Pass the full current class string and the new class to add.
 *
 * tailwind-merge understands that e.g. `bg-red-500` conflicts with `bg-blue-300`
 * and keeps only the last one — which is exactly what we want for inspector patches.
 */
export function patchTailwindClass(currentClasses: string, newClass: string): string {
  return twMerge(currentClasses, newClass);
}

export function extractJsx(text: string): string | null {
  const match = /```(?:jsx?|tsx?)\n([\s\S]+?)```/.exec(text);
  return match ? match[1].trim() : null;
}

export function stripJsxBlock(text: string): string {
  return text.replace(/```(?:jsx?|tsx?)\n[\s\S]+?```/g, '').trim();
}
