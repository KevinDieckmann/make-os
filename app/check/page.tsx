// ─── Öffentlicher Innovations-Check — die Seite (24.10., Branch `innovations-check`) ─────────────────────────────
// Landingpage + Strecke mit Zoe in EINEM Bild (Bauanleitung Abschnitt 7/9, Kevins Klickrunde 24.10.): Frage 1 ist ein Klick,
// Kontaktdaten erst nach dem Kurzcheck (überspringbar), Ergebnis sofort mit Stufe, Netzdiagramm und Branchensatz. Ohne Sitzung
// erreichbar (middleware.ts `CHECK_OFFEN`), auch unter fokusinnovation.de/check (Caddy leitet nur diesen Pfad an die App).
// Seit 30.10. drei Checks auf derselben Seite: `/check` = Innovations-Check, `/check?thema=vertrieb` = Vertriebscheck,
// `/check?thema=sichtbarkeit` = Sichtbarkeitstest (lib/check/katalog.ts `VORLAGE_JE_THEMA`) — kein neuer Pfad, Caddy und Middleware bleiben.
// Kommt AUSGESCHALTET (Einstellung unter Markttraktion › Marketing › Innovations-Check) — dann 404. Die Seite liest keinen Stand
// einer Sitzung: Katalog (ohne Punkte), Zoes Sätze und der Datenschutzhinweis kommen vom Server, die Sitzung entsteht erst mit dem
// ersten Klick (keine leeren Sitzungen für jeden Aufruf). Gedrosselt je Netz wie die Buchungsseite.

import type { Metadata } from 'next';
import { OEFFENTLICH_META } from '@/lib/oeffentlich/metadaten';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { InnovationsCheck } from '@/components/check/InnovationsCheck';
import { pruefe, fehlschlag, adresseAusKoepfen, netzVon } from '@/lib/zugang/drossel';
import { merken } from '@/lib/store/memo';
import { vorlageVon, vorlageFuerThema, VORLAGEN, AKTIVE_VORLAGEN, checkPfad } from '@/lib/check/katalog';
import { oeffentlicherKatalog } from '@/lib/check/oeffentlich';
import { begruessung, gespraechSatz, kontaktSatz, kontaktSatzLang, WAHL_SATZ } from '@/lib/check/zoe-texte';
import { HINWEIS_FASSUNG } from '@/lib/check/datenschutz';
import { ladeCheckEinstellungen } from '@/lib/check/speicher';
import { zoeKontext, hinweisLaden } from '@/lib/check/server';
import { preload } from 'react-dom';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { searchParams: Promise<{ q?: string; thema?: string }> };

/** So viele Aufrufe der Seite je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie die Buchungsseite). */
const SEITE_FREI = 40;
const QUELLE_OK = /^[a-z0-9_-]{1,40}$/;

/** Alles, was die Seite ohne Sitzung braucht — kurz gemerkt je Check (jede Schreibung in einen Bestand macht es ungültig). */
async function seitenDaten(vorlageId: string) {
  return merken(`check-seite:${vorlageId}`, 30_000, async () => {
    const e = await ladeCheckEinstellungen();
    const v = vorlageVon(vorlageId);
    const hinweis = await hinweisLaden(e);
    if (!e.aktiv || !v || !hinweis) return null;
    const k = await zoeKontext(e);
    // Newsletter-Häkchen nur, wenn die Anmeldung der Instanz läuft — mit genau dem Wortlaut, der als Einwilligung gespeichert wird.
    const { newsletterBereit } = await import('@/lib/newsletter/server');
    const nl = await newsletterBereit().catch(() => null);
    // Geht der Bericht wirklich per Mail (Website-Absender eingerichtet)? Sonst verspricht der ausführliche Check keine Mail.
    const { websiteLage } = await import('@/lib/oeffentlich/website-post');
    const perMail = !!(await websiteLage().catch(() => null));
    return {
      marke: k.marke,
      ...(e.claim ? { claim: e.claim } : {}),
      // Kopf wie auf der Website (30.10.): Logo, Link zur Website, Erstgespräch über die gewählte Buchungsseite.
      kopf: { ...(e.logo ? { logo: e.logo } : {}), ...(e.website ? { website: e.website } : {}), ...(e.buchungSlug ? { erstgespraech: `/buchen/${e.buchungSlug}` } : {}) },
      katalog: oeffentlicherKatalog(v),
      seite: v.seite,
      // Die anderen Checks der Instanz (30.10. abends: in der Karte über dem Gespräch, „Weitere Checks“).
      weitere: Object.values(VORLAGEN).filter(x => x.id !== v.id && AKTIVE_VORLAGEN.includes(x.id)).map(x => ({ name: x.name, pfad: checkPfad(x.id), text: (x.seite.bereiche ?? []).map(b => b.name).join(' · ') })),
      zoe: { begruessung: begruessung(k, v.seite.einleitung), kontakt: kontaktSatz(k), kontaktLang: kontaktSatzLang(k, perMail), wahl: WAHL_SATZ, gespraech: gespraechSatz(k) },
      hinweis: { zeilen: hinweis.zeilen, link: hinweis.link, fassung: HINWEIS_FASSUNG },
      ...(nl ? { newsletter: { wortlaut: nl.wortlaut, fassung: nl.fassung } } : {}),
      // Zoe-Begleiterin (31.10., Website-Anbau): feste Texte, Weg zum Kontaktformular nur, wenn es läuft.
      begleiter: { gastgeber: k.gastgeber, kontakt: (await (await import('@/lib/kontaktformular/server')).kontaktformularBereit().catch(() => null)) ? '/anfrage' : null },
    };
  });
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const d = await seitenDaten(vorlageFuerThema((await searchParams).thema));
  return { ...OEFFENTLICH_META, title: d ? `${d.katalog.name} · ${d.marke}` : 'Check', ...(d ? { description: `${d.seite.titel} ${d.seite.text}` } : {}) };
}

export default async function Seite({ searchParams }: Props) {
  // Die Schrift der Check-Seite früh laden (31.10., Prüfung Technik: sie kam am Handy erst nach 2 s).
  preload('/schriften/schibsted-grotesk-latin.woff2', { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  const netz = netzVon(adresseAusKoepfen(await headers()));
  const schluessel = `check-seite:${netz}`;
  if (!pruefe(schluessel).erlaubt) notFound();
  fehlschlag(schluessel, Date.now(), SEITE_FREI);
  const sp = await searchParams;
  const d = await seitenDaten(vorlageFuerThema(sp.thema));
  if (!d) notFound();
  const q = sp.q;
  return <InnovationsCheck {...d} quelle={typeof q === 'string' && QUELLE_OK.test(q) ? q : undefined} />;
}
