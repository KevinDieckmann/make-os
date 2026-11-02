// ─── Kontaktformular der Website — die Seite (31.10., Website-Anbau) ─────────────────────────────────────────────────────────────────────
// Ohne Sitzung erreichbar (middleware.ts `KONTAKTFORMULAR_OFFEN`), auch unter der Adresse der Website (Caddy gibt nur /anfrage und /api/anfrage an
// die App). Kommt AUS (Markttraktion › Marketing › Anfragen) bzw. ohne Verantwortlichen → neutrale Seite (not-found.tsx). Kopfdaten ohne Grundgerüst
// der Anwendung, nie der Name der Software (lib/oeffentlich/metadaten.ts).

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';
import { Kontaktformular } from '@/components/kontaktformular/Kontaktformular';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';
import { merken } from '@/lib/store/memo';
import { anlassAufloesen, kontaktformularBereit, kontaktformularStempel } from '@/lib/kontaktformular/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie Check, Buchung, Newsletter). */
const SEITE_FREI = 40;

/** Was die Seite braucht — kurz gemerkt. Nie Eingänge, nie Adressen. */
const seitenDaten = () => merken('kontaktformular-seite', 30_000, () => kontaktformularBereit());

export async function generateMetadata(): Promise<Metadata> {
  const d = await seitenDaten();
  return { ...OEFFENTLICH_META, title: d ? `Kontakt · ${d.marke}` : 'Kontakt' };
}

export default async function Seite({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const netz = netzVon(adresseAusKoepfen(await headers()));
  const schluessel = `kontaktformular-seite:${netz}`;
  if (!pruefe(schluessel).erlaubt) notFound();
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  const d = await seitenDaten();
  if (!d) notFound();
  // Anlass aus dem Knopf der Website (01.11.) — nur bekannte Formen, sonst das Formular ohne Anlass.
  const roh = (await searchParams).anlass;
  const anlass = await anlassAufloesen(typeof roh === 'string' ? roh : null);
  return <Kontaktformular marke={d.marke} gastgeber={d.gastgeber} hinweis={d.hinweis} erstgespraech={d.erstgespraech} website={d.website} stempel={kontaktformularStempel()} anlass={anlass} />;
}
