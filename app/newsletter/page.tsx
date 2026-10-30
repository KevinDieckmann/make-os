// ─── Newsletter-Anmeldung über die Website — die Seite (30.10., Branch `newsletter-anmeldung`) ─────────────────────────────────────────
// Ohne Sitzung erreichbar (middleware.ts `NEWSLETTER_OFFEN`), auch unter fokusinnovation.de/newsletter (Caddy leitet nur diesen Pfad an die App).
// Formular (E-Mail, Vorname freiwillig, Häkchen mit dem Einwilligungstext — nicht vorausgewählt, Honigtopf, Datenschutz in Kürze) und die
// Bestätigung über `/newsletter#t=<token>` (Token NUR im Fragment — geht nie an den Server, nicht ins Log; die Seite schickt es erst nach dem Klick
// auf „Anmeldung bestätigen“, weil Mail-Programme und Virenscanner Links vorab öffnen). Kommt AUS (Einstellung unter Markttraktion › Marketing ›
// Newsletter) — dann die neutrale Seite (not-found.tsx). Kopfdaten ohne Grundgerüst der Anwendung, nie der Name der Software.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';
import { NewsletterAnmeldung } from '@/components/newsletter/NewsletterAnmeldung';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';
import { merken } from '@/lib/store/memo';
import { datenschutzZeilen } from '@/lib/newsletter/regeln';
import { newsletterStempel } from '@/lib/newsletter/speicher';
import { newsletterBereit } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie Check und Buchung). */
const SEITE_FREI = 40;

/** Was die Seite braucht — kurz gemerkt (jede Schreibung in einen Bestand macht es ungültig). Nie Anmeldungen, nie Adressen. */
async function seitenDaten() {
  return merken('newsletter-seite', 30_000, async () => {
    const b = await newsletterBereit();
    if (!b) return null;
    return { marke: b.marke, wortlaut: b.wortlaut, fassung: b.fassung, hinweis: { zeilen: datenschutzZeilen(b.verantwortlich, b.datenschutzLink), link: b.datenschutzLink } };
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const d = await seitenDaten();
  return { ...OEFFENTLICH_META, title: d ? `Newsletter · ${d.marke}` : 'Newsletter' };
}

export default async function Seite() {
  const netz = netzVon(adresseAusKoepfen(await headers()));
  const schluessel = `newsletter-seite:${netz}`;
  if (!pruefe(schluessel).erlaubt) notFound();
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  const d = await seitenDaten();
  if (!d) notFound();
  return <NewsletterAnmeldung {...d} stempel={newsletterStempel()} />;
}
