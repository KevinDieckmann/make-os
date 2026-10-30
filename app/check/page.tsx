// ─── Öffentlicher Innovations-Check — die Seite (24.10., Branch `innovations-check`) ─────────────────────────────
// Landingpage + Strecke mit Zoe in EINEM Bild (Bauanleitung Abschnitt 7/9, Kevins Klickrunde 24.10.): Frage 1 ist ein Klick,
// Kontaktdaten erst nach dem Kurzcheck (überspringbar), Ergebnis sofort mit Stufe, Netzdiagramm und Branchensatz. Ohne Sitzung
// erreichbar (middleware.ts `CHECK_OFFEN`), auch unter fokusinnovation.de/check (Caddy leitet nur diesen Pfad an die App).
// Kommt AUSGESCHALTET (Einstellung unter Markttraktion › Marketing › Innovations-Check) — dann 404. Die Seite liest keinen Stand
// einer Sitzung: Katalog (ohne Punkte), Zoes Sätze und der Datenschutzhinweis kommen vom Server, die Sitzung entsteht erst mit dem
// ersten Klick (keine leeren Sitzungen für jeden Aufruf). Gedrosselt je Netz wie die Buchungsseite.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InnovationsCheck } from '@/components/check/InnovationsCheck';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';
import { merken } from '@/lib/store/memo';
import { vorlageVon, STANDARD_VORLAGE } from '@/lib/check/katalog';
import { oeffentlicherKatalog } from '@/lib/check/oeffentlich';
import { begruessung, gespraechSatz, kontaktSatz, WAHL_SATZ } from '@/lib/check/zoe-texte';
import { HINWEIS_FASSUNG } from '@/lib/check/datenschutz';
import { ladeCheckEinstellungen } from '@/lib/check/speicher';
import { zoeKontext, hinweisLaden } from '@/lib/check/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { searchParams: Promise<{ q?: string }> };

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie die Buchungsseite). */
const SEITE_FREI = 40;
const QUELLE_OK = /^[a-z0-9_-]{1,40}$/;

/** Alles, was die Seite ohne Sitzung braucht — kurz gemerkt (jede Schreibung in einen Bestand macht es ungültig). */
async function seitenDaten() {
  return merken('check-seite', 30_000, async () => {
    const e = await ladeCheckEinstellungen();
    const v = vorlageVon(STANDARD_VORLAGE);
    const hinweis = await hinweisLaden();
    if (!e.aktiv || !v || !hinweis) return null;
    const k = await zoeKontext(e);
    return {
      marke: k.marke,
      katalog: oeffentlicherKatalog(v),
      zoe: { begruessung: begruessung(k), kontakt: kontaktSatz(k), wahl: WAHL_SATZ, gespraech: gespraechSatz(k) },
      hinweis: { zeilen: hinweis.zeilen, link: hinweis.link, fassung: HINWEIS_FASSUNG },
      stufen: v.regeln.stufen.map(s => ({ stufe: s.stufe, name: s.name })),
    };
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const d = await seitenDaten();
  return { title: d ? `Innovations-Check · ${d.marke}` : 'Innovations-Check', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function Seite({ searchParams }: Props) {
  const netz = netzVon(adresseAusKoepfen(await headers()));
  const schluessel = `check-seite:${netz}`;
  if (!pruefe(schluessel).erlaubt) notFound();
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  const d = await seitenDaten();
  if (!d) notFound();
  const q = (await searchParams).q;
  return <InnovationsCheck {...d} quelle={typeof q === 'string' && QUELLE_OK.test(q) ? q : undefined} />;
}
