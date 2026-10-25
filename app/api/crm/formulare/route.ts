// ─── Markttraktion › Formulare (25.10.2026) — „Angebot anfordern“, externe Links, Eingänge, Einstellungen ─────────────────────────────────
// GET  → { ok, istInhaber, katalog (aktive Business-Produkte, Katalog-Form), einstellungen (Absender maskiert, Vorlage, Platzhalter, Standard,
//          datenschutzFehlt), absenderWahl (nur Inhaber: eigene Business-Postfächer), links (nur Inhaber; ohne Fingerabdruck), eingaenge }
//        Eingänge: ein Inhaber sieht alle, jede andere Person nur ihre eigenen (Trennung serverseitig). Nie Adressen im Klartext.
// POST { aktion: 'anfordern', anfrageId, anfrage }  → die EINE Funktion `angebotAnfordern` (Quelle „intern“) — jede Person im Haushalt (auch „nur
//        Business“), nur per Sitzung (Dienstweg 403: ZOE, Takt und Skripte fordern nichts an), einmalig je anfrageId
//      { aktion: 'link-neu', name, email?, produkte, bis? }                 → nur Inhaber; der ganze Link steht NUR in dieser Antwort (`pfad`)
//      { aktion: 'link-aendern' | 'link-widerrufen' | 'link-erneuern' | 'link-entfernen', id, … } → nur Inhaber (erneuern: neuer Link, einmal gezeigt)
//      { aktion: 'einstellungen', absender?: <Postfach-Kennung> | null, betreff?, text? } → nur Inhaber; Absender = eigenes Business-Postfach
// Zugang: Haushalt des Inhabers (Modul Markttraktion). Schreiben nur per Sitzung (Dienstweg 403) mit Bau-Kennung.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, istInhaber, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { einmalig } from '@/lib/store/anfragen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { ladeCrm } from '@/lib/crm/speicher';
import { ladeFormular } from '@/lib/crm/formulare-speicher';
import { FormularFehler, angebotAnfordern, einstellungenSpeichern, internerKatalog, linkAendern, linkAnlegen } from '@/lib/crm/formulare-server';
import { absenderPruefen } from '@/lib/crm/angebot-versand';
import { eingangFuerNurBusiness, formularPostfachBereichOk, linkLage, MAIL_PLATZHALTER, MAIL_STANDARD, type Eingang, type ExternerLink } from '@/lib/crm/formulare';
import { adresseMaskiert, namenVon } from '@/lib/zugang/konten';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });

/** Ein Link, wie er an den Browser geht — nie der Fingerabdruck. */
const linkSicht = (l: ExternerLink, heute: string) => {
  const { tokenHash: _t, ...rest } = l;
  return { ...rest, lage: linkLage(l, heute) };
};

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const heute = localDay();
  // Trennung serverseitig (25.10.): ein Konto „nur Business“ sieht weder Produkte noch Eingänge einer Privat-Arbeits-Einheit (Selbstständigkeit).
  const { privatAusgeblendetFuer } = await import('@/lib/zugang/konto-sicht-server');
  const nurBusiness = await privatAusgeblendetFuer(z.person);
  const [inhaber, b, crm, katalog, namen] = await Promise.all([istInhaber(z.person), ladeFormular(), ladeCrm(), internerKatalog({ nurBusiness }), namenVon().catch(() => ({} as Record<string, string>))]);
  const linkName = new Map(b.links.map(l => [l.id, l.name] as const));
  const gesellschaftVon = (e: Eingang) => e.gesellschaft ?? (e.angebotId ? (crm.angebote ?? []).find(x => x.id === e.angebotId)?.gesellschaft : undefined);
  // Trennung serverseitig: ein Inhaber sieht alle Eingänge, jede andere Person nur die eigenen — ein Konto „nur Business“ nie die einer Privat-Einheit.
  const sichtbar = b.eingaenge.filter(e => (inhaber || (e.quelle === 'intern' && e.von === z.person)) && (!nurBusiness || eingangFuerNurBusiness(gesellschaftVon(e))));
  const eingaenge = [...sichtbar].sort((x, y) => y.am.localeCompare(x.am)).slice(0, 200).map((e: Eingang) => {
    const a = e.angebotId ? (crm.angebote ?? []).find(x => x.id === e.angebotId) : undefined;
    return {
      id: e.id, am: e.am, quelle: e.quelle, status: e.status, produkte: e.produkte, gruende: e.gruende ?? [],
      vertriebler: e.quelle === 'link' ? `Link: ${linkName.get(e.linkId ?? '') ?? 'entfernt'}` : (namen[e.von ?? ''] ?? e.von ?? ''),
      ...(e.firmaId ? { firma: crm.firmen.find(f => f.id === e.firmaId)?.name ?? '' } : {}), ...(e.kontaktId ? { kontaktId: e.kontaktId } : {}),
      ...(e.angebotId ? { angebotId: e.angebotId } : {}), ...(a?.nummer ?? e.nummer ? { nummer: a?.nummer ?? e.nummer } : {}),
      ...(e.an ? { an: e.an.maskiert } : {}), ...(e.vorschlagId ? { vorschlagId: e.vorschlagId } : {}), ...(e.versendet ? { versendet: e.versendet } : {}),
      ...(e.entschieden ? { entschieden: { am: e.entschieden.am, art: e.entschieden.art, von: namen[e.entschieden.von] ?? e.entschieden.von, ...(e.entschieden.grund ? { grund: e.entschieden.grund } : {}) } } : {}),
    };
  });
  leseZugriff(req, 'firmen', { anzahl: eingaenge.length });
  const abs = b.einstellungen.absender;
  const absOk = await absenderPruefen(abs);
  const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const { datenschutzAngabenAus } = await import('@/lib/crm/netzwerken-recht');
  const ds = datenschutzAngabenAus((await verantwortlicherLaden()).v);
  let absenderWahl: { id: string; name: string }[] | undefined;
  if (inhaber) {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    absenderWahl = (await ladePostfaecher(z.person)).filter(p => p.quelle !== 'whatsapp' && formularPostfachBereichOk(p.bereich)).map(p => ({ id: p.id, name: `${p.anzeigename} · ${adresseMaskiert(p.adresse)}` }));
  }
  return NextResponse.json({
    ok: true, istInhaber: inhaber, katalog,
    einstellungen: {
      absender: abs ? { postfach: abs.postfach, person: namen[abs.person] ?? abs.person, ...(absOk.ok ? { adresse: adresseMaskiert(absOk.adresse) } : {}), eigenes: abs.person === z.person } : null,
      absenderOk: absOk.ok, ...(absOk.ok ? {} : { absenderGrund: absOk.grund }),
      ...(b.einstellungen.betreff ? { betreff: b.einstellungen.betreff } : {}), ...(b.einstellungen.text ? { text: b.einstellungen.text } : {}),
      platzhalter: MAIL_PLATZHALTER, standard: MAIL_STANDARD, datenschutzFehlt: !!ds.fehlt,
    },
    ...(absenderWahl ? { absenderWahl } : {}),
    links: inhaber ? b.links.map(l => linkSicht(l, heute)) : [], ...(inhaber ? {} : { linksNurInhaber: true }),
    eingaenge,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);
  try {
    if (b.aktion === 'anfordern') {
      const r = await einmalig<Record<string, unknown>>('angebot-anfordern', b.anfrageId, () => angebotAnfordern(b.anfrage, { art: 'intern', person: z.person }, { anfrageId: b.anfrageId, wer }), undefined, { wer: z.person });
      return NextResponse.json(r.body, { status: r.status });
    }
    // Alles Weitere verwaltet nur ein Inhaber.
    if (!(await istInhaber(z.person))) return fehler('Links und Einstellungen verwaltet nur ein Inhaber.', 403);
    switch (b.aktion) {
      case 'link-neu': {
        const r = await linkAnlegen(b, z.person);
        return NextResponse.json({ ok: true, link: linkSicht(r.link, localDay()), pfad: r.pfad });
      }
      case 'link-aendern': case 'link-widerrufen': case 'link-erneuern': case 'link-entfernen': {
        const art = String(b.aktion).slice(5) as 'aendern' | 'widerrufen' | 'erneuern' | 'entfernen';
        const r = await linkAendern(b.id, art, (b.felder && typeof b.felder === 'object' ? b.felder : {}) as Record<string, unknown>);
        return NextResponse.json({ ok: true, ...(r.link ? { link: linkSicht(r.link, localDay()) } : {}), ...(r.pfad ? { pfad: r.pfad } : {}) });
      }
      case 'einstellungen': {
        const e = await einstellungenSpeichern(b, z.person);
        return NextResponse.json({ ok: true, einstellungen: { ...(e.absender ? { absender: { postfach: e.absender.postfach } } : {}), ...(e.betreff ? { betreff: e.betreff } : {}), ...(e.text ? { text: e.text } : {}) } });
      }
      default: return fehler('aktion: anfordern, link-neu, link-aendern, link-widerrufen, link-erneuern, link-entfernen oder einstellungen.', 400);
    }
  } catch (e) {
    if (e instanceof FormularFehler) return fehler(e.message, e.status, e.extra);
    console.error('[crm/formulare]', (e as Error)?.message);
    return fehler('Nicht gespeichert — interner Fehler.', 500);
  }
}
