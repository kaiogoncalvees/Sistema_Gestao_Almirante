import { parse, format } from 'date-fns';

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

export function parseDMY(s: string): Date {
  return parse(s, 'dd/MM/yyyy', new Date());
}

export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
