// Der Wochenplaner ist seit 29.09. (K5, Kevin: „Ein Kalender, Planen als Modus“) der Modus „Planen“ im Kalender.
// Alte Links (Lesezeichen, Brain, ZOE-Verlauf, Kennzahl-Links) landen hier und werden mit Tag und Space umgeleitet.
import { redirect } from 'next/navigation';

export default async function WochenplanUmleitung(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const eins = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = new URLSearchParams({ modus: 'planen' });
  const tag = eins(sp.tag), space = eins(sp.space);
  if (tag && /^\d{4}-\d{2}-\d{2}$/.test(tag)) q.set('tag', tag);
  if (space === 'privat' || space === 'business') q.set('space', space);
  redirect(`/os/kalender?${q.toString()}`);
}
