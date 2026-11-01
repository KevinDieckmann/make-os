// ─── Newsletter-Anmeldung über die Website — intern (30.10., Branch `newsletter-anmeldung`) ──────────────────────────────────────────
// GET  → Haushalt des Inhabers mit Person (Dienstweg ohne Person 403): { istInhaber, einstellungen (Absender maskiert), bereit, gruende, wortlaut,
//        fassung, vorgabe (Texte und Datenschutz der Einrichtung als Platzhalter), absenderWahl (nur Inhaber: eigene Business-Postfächer),
//        liste (Stand, Datum, Adresse MASKIERT, CRM-Stand) } — nie Token-Fingerabdrücke, nie volle Adressen.
// POST { aktion: 'einstellungen', aktiv?, absender? (<Postfach-Kennung> | null), marke?, einwilligungstext?, website?, verantwortlich?, datenschutzLink? }
//      { aktion: 'loeschen', id }  ·  { aktion: 'crm', id } (Übernahme ins CRM noch einmal, nach einem Fehler)
//      → nur ein Inhaber per Sitzung (Dienstweg 403), mit Bau-Kennung. Einschalten nur, wenn alles da ist (`bereitPruefen`, sonst 409 mit Grund).
//      Die Wahl des Absender-Postfachs ist die Freigabe für die automatischen Bestätigungsmails (lib/newsletter/versand.ts).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { darfSteuern, NUR_STEUERN } from '@/lib/zugang/steuern';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { adresseMaskiert, namenVon } from '@/lib/zugang/konten';
import {
  ANMELDUNGEN, EINSTELLUNGEN, GRENZEN, ID_OK, MAILS_JE_TAG, TOKEN_TAGE, FRIST_UNBESTAETIGT_TAGE, datenschutzLinkSauber, einwilligungVorgabe, naechsteFassung, standVon,
  textSauber, websiteSauber, zeileSauber, type NewsletterAnmeldung, type NewsletterEinstellungen,
} from '@/lib/newsletter/regeln';
import { aendereAnmeldung, aendereAnmeldungen, aendereEinstellungen, ladeAnmeldungen, ladeEinstellungen } from '@/lib/newsletter/speicher';
import { bereitPruefen, datenschutzVon, insCrm, markeVon, websiteVon } from '@/lib/newsletter/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

/** Eine Zeile, wie sie an den Browser geht — Adresse maskiert, kein Token-Fingerabdruck. */
function zeile(a: NewsletterAnmeldung, jetzt: Date) {
  return {
    id: a.id, stand: standVon(a, jetzt), email: adresseMaskiert(a.email), ...(a.vorname ? { vorname: true } : {}),
    angemeldet: a.angemeldet, ...(a.mailGesendet ? { mailGesendet: a.mailGesendet } : {}), ...(a.bestaetigt ? { bestaetigt: a.bestaetigt } : {}),
    ...(a.versandFehler ? { versandFehler: a.versandFehler } : {}), ...(a.gesperrt ? { gesperrt: a.gesperrt } : {}), fassung: a.fassung,
    ...(a.crm ? { crm: { status: a.crm.status, ...(a.crm.kontaktId ? { kontaktId: a.crm.kontaktId } : {}), ...(a.crm.status !== 'ok' && a.crm.grund ? { grund: a.crm.grund } : {}) } } : {}),
  };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const jetzt = new Date();
  const [e, b, inhaber, namen] = await Promise.all([ladeEinstellungen(), ladeAnmeldungen(), darfSteuern(z.person), namenVon().catch(() => ({} as Record<string, string>))]);
  const { bereit, gruende } = await bereitPruefen(e);
  const ds = await datenschutzVon(e);
  let absenderWahl: { id: string; name: string }[] | undefined;
  if (inhaber) {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    const { formularPostfachBereichOk } = await import('@/lib/crm/formulare');
    absenderWahl = (await ladePostfaecher(z.person)).filter(p => p.quelle !== 'whatsapp' && formularPostfachBereichOk(p.bereich)).map(p => ({ id: p.id, name: `${p.anzeigename} · ${adresseMaskiert(p.adresse)}` }));
  }
  const liste = [...b.anmeldungen].sort((x, y) => (y.bestaetigt ?? y.angemeldet).localeCompare(x.bestaetigt ?? x.angemeldet)).map(a => zeile(a, jetzt));
  leseZugriff(req, 'kontakte', { anzahl: liste.length });
  const { absender, ...rest } = e;
  return NextResponse.json({
    ok: true, istInhaber: inhaber,
    einstellungen: { ...rest, absender: absender ? { postfach: absender.postfach, person: namen[absender.person] ?? absender.person, eigenes: absender.person === z.person } : null },
    bereit: !!bereit, gruende, ...(bereit ? { wortlaut: bereit.wortlaut, fassung: bereit.fassung } : {}),
    vorgabe: { text: einwilligungVorgabe(), marke: markeVon({ ...e, marke: undefined }), website: websiteVon({ ...e, website: undefined }), verantwortlich: ds.einrichtung.verantwortlich, datenschutzLink: ds.einrichtung.link },
    regeln: { tokenTage: TOKEN_TAGE, mailsJeTag: MAILS_JE_TAG, fristTage: FRIST_UNBESTAETIGT_TAGE },
    ...(absenderWahl ? { absenderWahl } : {}),
    liste,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  // Marketing steuern (02.11., Prüfung D): Inhaber ODER volles Mitglied des Haushalts (lib/zugang/steuern.ts).
  if (!(await darfSteuern(z.person))) return fehler(NUR_STEUERN, 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (x) { return jsonZuGross(x) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);

  if (b.aktion === 'einstellungen') {
    // Felder prüfen (nie kürzen: zu lang → 400 mit Grund). `null`/'' = leeren (Vorgabe).
    const felder: Partial<Record<keyof NewsletterEinstellungen, unknown>> = {};
    const pruefe = (feld: 'marke' | 'verantwortlich', max: number, name: string) => {
      if (!(feld in b)) return null;
      const v = zeileSauber(b[feld], max);
      if (v === null) return `${name}: höchstens ${max} Zeichen, eine Zeile, ohne < > { }.`;
      felder[feld] = v; return null;
    };
    const f1 = pruefe('marke', GRENZEN.marke, 'Name') ?? pruefe('verantwortlich', GRENZEN.verantwortlich, 'Verantwortlich');
    if (f1) return fehler(f1, 400);
    if ('einwilligungstext' in b) { const v = textSauber(b.einwilligungstext); if (v === null) return fehler(`Einwilligungstext: 20 bis ${GRENZEN.text} Zeichen, ohne < >; als Platzhalter nur {marke}.`, 400); felder.einwilligungstext = v; }
    if ('website' in b) { const v = websiteSauber(b.website); if (v === null) return fehler('Adresse der Website: nur https://… ohne Pfad (z. B. https://example.invalid).', 400); felder.website = v; }
    if ('datenschutzLink' in b) { const v = datenschutzLinkSauber(b.datenschutzLink); if (v === null) return fehler('Link zur Datenschutzerklärung: eine https-Adresse.', 400); felder.datenschutzLink = v; }
    let absender: NewsletterEinstellungen['absender'] | null | undefined;
    if ('absender' in b) {
      if (b.absender === null || b.absender === '') absender = null;
      else {
        const kandidat = { person: z.person, postfach: typeof b.absender === 'string' ? b.absender : '', gesetztAm: new Date().toISOString() };
        const { absenderPruefen } = await import('@/lib/crm/angebot-versand');
        const ok = await absenderPruefen(kandidat);
        if (!ok.ok) return fehler(ok.grund, 400);
        absender = kandidat;
      }
    }
    const alt = await ladeEinstellungen();
    const zusammen = (x: NewsletterEinstellungen): NewsletterEinstellungen => {
      const neu: NewsletterEinstellungen = { ...x };
      for (const [k, v] of Object.entries(felder) as [keyof NewsletterEinstellungen, string][]) { if (v) (neu as unknown as Record<string, unknown>)[k] = v; else delete (neu as unknown as Record<string, unknown>)[k]; }
      if (absender === null) delete neu.absender; else if (absender) neu.absender = absender;
      if (typeof b.aktiv === 'boolean') neu.aktiv = b.aktiv;
      return neu;
    };
    // Einschalten nur, wenn alles da ist — sonst bleibt die Seite neutral und niemand wartet auf eine Mail, die nie kommt.
    const probe = zusammen(alt);
    if (probe.aktiv) {
      const r = await bereitPruefen(probe, { ohneSchalter: true });
      if (!r.bereit) return fehler(`Noch nicht einschaltbar: ${r.gruende.join(' ')}`, 409);
    }
    const e = await aendereEinstellungen(x => {
      const neu = zusammen(x);
      return { ...neu, fassung: naechsteFassung(x, neu, markeVon(x), markeVon(neu)), geaendert: new Date().toISOString(), geaendertVon: z.person };
    });
    await protokolliere(EINSTELLUNGEN, [{ liste: 'einstellungen', op: 'geaendert', id: 'einstellungen', felder: Object.keys(felder).concat('absender' in b ? ['absender'] : [], typeof b.aktiv === 'boolean' ? ['aktiv'] : []) }], wer).catch(() => { /* nur Protokoll */ });
    return NextResponse.json({ ok: true, fassung: e.fassung, aktiv: e.aktiv });
  }

  const id = typeof b.id === 'string' && ID_OK.test(b.id) ? b.id : null;
  if (!id) return fehler('Unbekannt.', 404);

  if (b.aktion === 'loeschen') {
    let weg = false;
    await aendereAnmeldungen(x => {
      const rest = x.anmeldungen.filter(a => a.id !== id);
      weg = rest.length !== x.anmeldungen.length;
      return weg ? { ...x, anmeldungen: rest } : x;
    });
    if (!weg) return fehler('Unbekannt.', 404);
    await protokolliere(ANMELDUNGEN, [{ liste: 'anmeldungen', op: 'geloescht', id }], wer).catch(() => { /* nur Protokoll */ });
    return NextResponse.json({ ok: true });
  }

  if (b.aktion === 'crm') {
    const a = (await ladeAnmeldungen()).anmeldungen.find(x => x.id === id);
    if (!a) return fehler('Unbekannt.', 404);
    if (!a.bestaetigt) return fehler('Erst nach der Bestätigung durch die Person.', 409);
    if (a.crm?.status === 'ok') return NextResponse.json({ ok: true, zeile: zeile(a, new Date()) });
    const crm = await insCrm(a);
    const neu = await aendereAnmeldung(id, x => ({ ...x, crm }));
    return NextResponse.json({ ok: crm.status === 'ok', ...(neu ? { zeile: zeile(neu, new Date()) } : {}), ...(crm.status !== 'ok' ? { fehler: crm.grund ?? 'Nicht übernommen.' } : {}) }, { status: crm.status === 'ok' ? 200 : 409 });
  }

  return fehler('aktion: einstellungen, loeschen oder crm.', 400);
}
