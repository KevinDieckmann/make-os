// ─── Website — Überblick (Zustand je Weg) und Eingänge (nur Server, 31.10.) ───────────────────────────────────────────────────────────
// Sammelt nur aus den vorhandenen Beständen — keine Kopie, kein eigener Eingang:
//   Zustand je öffentlichem Weg (Check, Kontaktformular, Newsletter, Bausteine, Unterlagen, Erstgespräch) an · aus · unvollständig, mit „was fehlt“ + Weg.
//   Eingänge: Anfragen über die Website (Aktivität „Anfrage über Website: …“ an der Person — Check, Kontaktformular, Unterlagen, Terminbuchung), Bestellungen
//   der Bausteine, Newsletter-Anmeldungen (Adresse maskiert) — je Zeile Herkunft, Tag und Link in die Akte bzw. die Verwaltung.
// Nur an den Haushalt des Inhabers (die Route prüft). Eingeschränkte/gesperrte Personen fehlen (`webseiteTreffer`). Wirft je Quelle nie — eine fehlende
// Quelle steht als „nicht prüfbar“ da.

import { localDay, tagVon } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { anzeigename } from '@/lib/make-one/crm';
import type { Kpi } from '@/lib/crm/kennzahlen';

export type WegZustand = 'an' | 'aus' | 'unvollstaendig' | 'unklar';
export interface WegLage { id: 'check' | 'kontaktformular' | 'newsletter' | 'bausteine' | 'unterlagen' | 'erstgespraech'; name: string; pfad: string; zustand: WegZustand; fehlt: string[]; weg: string }

async function sicher<T>(f: () => Promise<T>): Promise<T | null> { try { return await f(); } catch { return null; } }

export async function wegeLage(): Promise<WegLage[]> {
  const raus: WegLage[] = [];
  const check = await sicher(async () => {
    const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
    const { hinweisLaden } = await import('@/lib/check/server');
    const e = await ladeCheckEinstellungen();
    const hinweis = await hinweisLaden(e);
    return { e, hinweis };
  });
  raus.push(check ? {
    id: 'check', name: 'Checks', pfad: '/check', weg: WEG.website('checks'),
    zustand: !check.e.aktiv ? 'aus' : check.hinweis ? 'an' : 'unvollstaendig', fehlt: check.hinweis ? [] : ['Verantwortlicher (Einstellungen › Datenschutz)'],
  } : { id: 'check', name: 'Checks', pfad: '/check', weg: WEG.website('checks'), zustand: 'unklar', fehlt: ['nicht prüfbar'] });

  const kf = await sicher(async () => {
    const { ladeKontaktformularEinstellungen, kontaktformularBereit } = await import('@/lib/kontaktformular/server');
    const [e, b] = await Promise.all([ladeKontaktformularEinstellungen(), kontaktformularBereit()]);
    return { aktiv: e.aktiv, bereit: !!b };
  });
  raus.push(kf ? {
    id: 'kontaktformular', name: 'Kontaktformular', pfad: '/anfrage', weg: WEG.website('formulare'),
    zustand: !kf.aktiv ? 'aus' : kf.bereit ? 'an' : 'unvollstaendig', fehlt: kf.aktiv && !kf.bereit ? ['Verantwortlicher (Einstellungen › Datenschutz)'] : [],
  } : { id: 'kontaktformular', name: 'Kontaktformular', pfad: '/anfrage', weg: WEG.website('formulare'), zustand: 'unklar', fehlt: ['nicht prüfbar'] });

  const nl = await sicher(async () => {
    const { ladeEinstellungen } = await import('@/lib/newsletter/speicher');
    const { bereitPruefen } = await import('@/lib/newsletter/server');
    const e = await ladeEinstellungen();
    return { aktiv: e.aktiv, ...(await bereitPruefen(e, { ohneSchalter: true })) };
  });
  raus.push(nl ? {
    id: 'newsletter', name: 'Newsletter-Anmeldung', pfad: '/newsletter', weg: WEG.website('formulare'),
    zustand: !nl.aktiv ? 'aus' : nl.gruende.length ? 'unvollstaendig' : 'an', fehlt: nl.gruende,
  } : { id: 'newsletter', name: 'Newsletter-Anmeldung', pfad: '/newsletter', weg: WEG.website('formulare'), zustand: 'unklar', fehlt: ['nicht prüfbar'] });

  const bs = await sicher(async () => {
    const { bausteineLage, katalogLaden } = await import('@/lib/bausteine/server');
    const [l, k] = await Promise.all([bausteineLage(), katalogLaden()]);
    return { aktiv: l.e.aktiv, gruende: [...l.gruende, ...(k.length ? [] : ['Katalog der Bausteine ist leer'])] };
  });
  raus.push(bs ? {
    id: 'bausteine', name: 'Bausteine bestellen', pfad: '/api/bestellung', weg: WEG.website('bausteine'),
    zustand: !bs.aktiv ? 'aus' : bs.gruende.length ? 'unvollstaendig' : 'an', fehlt: bs.gruende,
  } : { id: 'bausteine', name: 'Bausteine bestellen', pfad: '/api/bestellung', weg: WEG.website('bausteine'), zustand: 'unklar', fehlt: ['nicht prüfbar'] });

  const ul = await sicher(async () => {
    const { katalogLaden } = await import('@/lib/unterlagen/server');
    const { websiteLage } = await import('@/lib/oeffentlich/website-post');
    const [k, l] = await Promise.all([katalogLaden(), websiteLage()]);
    return { anzahl: k.length, lage: !!l };
  });
  raus.push(ul ? {
    id: 'unterlagen', name: 'Unterlagen per E-Mail', pfad: '/api/unterlage', weg: WEG.website('bausteine'),
    zustand: !ul.anzahl ? 'aus' : ul.lage ? 'an' : 'unvollstaendig', fehlt: ul.anzahl && !ul.lage ? ['Website-Absender (Postfach) und Verantwortlicher'] : [],
  } : { id: 'unterlagen', name: 'Unterlagen per E-Mail', pfad: '/api/unterlage', weg: WEG.website('bausteine'), zustand: 'unklar', fehlt: ['nicht prüfbar'] });

  const eg = await sicher(async () => {
    const { erstgespraechWohin } = await import('./server');
    return erstgespraechWohin();
  });
  raus.push({
    id: 'erstgespraech', name: 'Erstgespräch buchen', pfad: '/erstgespraech', weg: WEG.website('formulare'),
    zustand: !eg ? 'unklar' : eg.art === 'buchung' ? 'an' : 'unvollstaendig',
    fehlt: eg?.art === 'buchung' ? [] : ['Buchungsseite wählen — sonst zeigt /erstgespraech „gerade keine Termine“'],
  });
  return raus;
}

/** Website-Zahlen 30 Tage — dieselben Kennzahlen wie im Traktions-Index (lib/crm/webseite-zahlen.ts). */
export async function websiteZahlen(heute = localDay()): Promise<Kpi[]> {
  const z = await sicher(async () => {
    const { webseiteKennzahlen } = await import('@/lib/crm/webseite-zahlen');
    const { webseiteStandLaden } = await import('@/lib/crm/webseite-zahlen-server');
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const [k, w] = await Promise.all([kontakteFuerVerarbeitung(), webseiteStandLaden()]);
    return webseiteKennzahlen(k, w, heute);
  });
  return z ?? [];
}

export interface Eingang { art: 'anfrage' | 'termin' | 'bestellung' | 'newsletter'; tag: string; wer: string; herkunft: string; href: string }

const maskiert = (email: string): string => { const [n, d] = email.split('@'); return d ? `${n.slice(0, 1)}…@${d}` : '…'; };

/** Alle Website-Eingänge der letzten `tage` Tage, neueste zuerst (höchstens 300). */
export async function websiteEingaenge(heute = localDay(), tage = 90): Promise<Eingang[]> {
  const raus: Eingang[] = [];
  await sicher(async () => {
    const { webseiteTreffer } = await import('@/lib/crm/webseite-zahlen');
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const k = await kontakteFuerVerarbeitung();
    for (const art of ['anfrage', 'termin'] as const) {
      for (const t of webseiteTreffer(k, heute, art, tage)) {
        raus.push({ art, tag: t.tag, wer: anzeigename(t.kontakt), herkunft: t.text.replace(/^Anfrage über Website:\s*/, '').slice(0, 120), href: WEG.akte(t.kontakt.id) });
      }
    }
  });
  await sicher(async () => {
    const { bestellungenStand } = await import('@/lib/bausteine/server');
    const s = await bestellungenStand();
    for (const b of [...s.offen, ...s.erledigt]) {
      raus.push({ art: 'bestellung', tag: tagVon(b.am), wer: [b.name, b.firma].filter(Boolean).join(' · ') || 'Bestellung', herkunft: `Baustein: ${b.titel} · ${b.status}`, href: b.kontaktId ? WEG.akte(b.kontaktId) : WEG.website('bausteine') });
    }
  });
  await sicher(async () => {
    const { ladeAnmeldungen } = await import('@/lib/newsletter/speicher');
    for (const a of (await ladeAnmeldungen()).anmeldungen) {
      raus.push({ art: 'newsletter', tag: tagVon(a.angemeldet), wer: maskiert(a.email), herkunft: a.bestaetigt ? 'Newsletter · bestätigt' : 'Newsletter · wartet auf Bestätigung', href: a.crm?.kontaktId ? WEG.akte(a.crm.kontaktId) : WEG.website('formulare') });
    }
  });
  const ab = new Date(`${heute}T12:00:00Z`); ab.setUTCDate(ab.getUTCDate() - tage + 1);
  const grenze = ab.toISOString().slice(0, 10);
  return raus.filter(e => e.tag >= grenze).sort((a, b) => b.tag.localeCompare(a.tag)).slice(0, 300);
}
