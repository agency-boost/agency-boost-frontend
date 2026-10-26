import { formatMonth } from '@/lib/format';

/** `2026-09` → `Sep 2026` — the shared formatter, under the name this screen has always used. */
export const monthLabel = formatMonth;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
