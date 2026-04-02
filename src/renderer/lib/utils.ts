import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractJsx(text: string): string | null {
  const match = /```(?:jsx?|tsx?)\n([\s\S]+?)```/.exec(text);
  return match ? match[1].trim() : null;
}

export function stripJsxBlock(text: string): string {
  return text.replace(/```(?:jsx?|tsx?)\n[\s\S]+?```/g, '').trim();
}
