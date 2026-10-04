// Finanzplanung (27.09.2026 eigener Bereich unter den Agenten) — seit 04.10. ein Reiter unter Finanzen (Kevin: „einmal bei Privat,
// einmal Business bei Business“). Alte Links und Lesezeichen /os/finanzplan?u=… landen in der Privat-Sicht (dort ist alles);
// alle Parameter (u, monat, zeile, sz, feld, steuern …) bleiben erhalten.
import { redirect } from 'next/navigation';
import { finanzplanAdresse } from '@/lib/finanzen/plan/hilfen';

export const dynamic = 'force-dynamic';

export default async function FinanzplanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(q ?? {})) if (typeof v === 'string') params[k] = v;
  redirect(finanzplanAdresse('privat', params));
}
