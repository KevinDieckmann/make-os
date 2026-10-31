// ─── Markttraktion › Marketing › Homepage-Funde (30.10.2026, KAMPAGNE_HOMEPAGE_PLAN.md) ──────────────────────────────────────
// GET  → { ok, istInhaber, eingerichtet, einstellungen (Absender maskiert, Risiko), risikoHinweis, funde (ohne Token), zahlen, lauf, produkte,
//          gebietsVorlagen, absenderWahl (nur Inhaber) }
// POST { aktion: 'einrichten' }                                  → Kampagne + Segment (einmal) — nur Inhaber
//      { aktion: 'einstellungen', stadt?, gebiete?, branchen?, jeAbend?, absender?: <Postfach>|null, gesellschaft?, produktId? } — nur Inhaber
//      { aktion: 'risiko', an: boolean }                         → „eigenes Risiko“ (Mail/Anruf ohne Einwilligung) — nur Inhaber, nur per Sitzung
//      { aktion: 'hand', fund: {...} }                           → Fund von Hand (z. B. auf Google Maps gesehen)
//      { aktion: 'verwerfen', id, grund? }                       → bleibt bekannt, kommt nie wieder
//      { aktion: 'lauf' }                                        → Abendlauf jetzt (im Hintergrund, KI-Tor), nur Inhaber
//      { aktion: 'import', datei: { format: 'make-os-funde', funde: [...] } } → Funde aus einer Recherche-Datei (≤ 200), nur Inhaber; Körper ≤ 1 MB
//      { aktion: 'senden', id }                                  → übernommenen Fund nachsenden (gleiche Bedingungen wie die Freigabe)
// Zugang: Haushalt des Inhabers (Modul Markttraktion). Schreiben nur per Sitzung (Dienstweg 403) mit Bau-Kennung. Übernommen wird über den
// ZOE-Stapel (Art `fund`) — nicht hier.

import { NextResponse, after } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, istInhaber, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { ladeCrm } from '@/lib/crm/speicher';
import { adresseMaskiert, namenVon } from '@/lib/zugang/konten';
import { formularPostfachBereichOk } from '@/lib/crm/formulare';
import { ladeFunde, fundSicht, FundeFehler } from '@/lib/funde/speicher';
import { GEBIETS_VORLAGEN, OSM_NAMENSNENNUNG } from '@/lib/funde/osm';
import { RISIKO_HINWEIS } from '@/lib/funde/entwurf';
import { fundReihenfolge } from '@/lib/funde/telefon';
import { ARTEN_VORLAGEN, FUND_BRANCHEN, istFundBranche, type FundeEinstellungen } from '@/lib/funde/typen';
import { einstellungenAendern, fundeImportieren, fundVerwerfen, fundVonHand, handEingabeSaeubern, kampagneEinrichten, risikoSetzen } from '@/lib/funde/einrichten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const [inhaber, b, crm, namen] = await Promise.all([istInhaber(z.person), ladeFunde(), ladeCrm(), namenVon().catch(() => ({} as Record<string, string>))]);
  const e = b.einstellungen;
  const kampagne = e.kampagneId ? crm.kampagnen.find(k => k.id === e.kampagneId && !k.geloeschtAm) : undefined;
  // Reihenfolge: wer zuerst angerufen wird — Handy vor Festnetz vor nur Mail, dann Website-Bedarf (lib/funde/telefon.ts).
  const funde = [...b.funde].sort(fundReihenfolge).slice(0, 300).map(fundSicht);
  const zahlen = { vorbereitet: 0, uebernommen: 0, gesendet: 0, verworfen: 0, angesehen: 0, mitHandy: 0, mitTelefon: 0 };
  for (const f of b.funde) {
    if (f.status === 'vorbereitet' || f.status === 'neu') zahlen.vorbereitet++;
    else if (f.status === 'uebernommen') zahlen.uebernommen++;
    else if (f.status === 'gesendet') zahlen.gesendet++;
    else zahlen.verworfen++;
    if (f.angesehenAm) zahlen.angesehen++;
    if (f.status !== 'verworfen' && f.status !== 'gesperrt') { if (f.mobil) zahlen.mitHandy++; if (f.mobil || f.telefon) zahlen.mitTelefon++; }
  }
  leseZugriff(req, 'firmen', { anzahl: funde.length });
  let absenderWahl: { id: string; name: string }[] | undefined;
  if (inhaber) {
    const { ladePostfaecher } = await import('@/lib/postfach/register');
    absenderWahl = (await ladePostfaecher(z.person)).filter(p => p.quelle !== 'whatsapp' && formularPostfachBereichOk(p.bereich)).map(p => ({ id: p.id, name: `${p.anzeigename} · ${adresseMaskiert(p.adresse)}` }));
  }
  const abs = e.absender;
  return NextResponse.json({
    ok: true, istInhaber: inhaber, eingerichtet: !!kampagne,
    ...(kampagne ? { kampagne: { id: kampagne.id, name: kampagne.name, status: kampagne.status } } : {}),
    einstellungen: {
      ...(e.stadt ? { stadt: e.stadt } : {}), gebiete: e.gebiete, gebietIndex: e.gebietIndex, branchen: e.branchen, jeAbend: e.jeAbend,
      ...(e.gesellschaft ? { gesellschaft: e.gesellschaft } : {}), ...(e.arten ? { arten: e.arten } : {}), nurMitMail: !!e.nurMitMail, nurMitTelefon: !!e.nurMitTelefon, ...(e.produktId ? { produktId: e.produktId } : {}), ...(e.segmentId ? { segmentId: e.segmentId } : {}),
      absender: abs ? { postfach: abs.postfach, person: namen[abs.person] ?? abs.person, eigenes: abs.person === z.person } : null,
      eigenesRisiko: e.eigenesRisiko ? { seit: e.eigenesRisiko.seit, von: namen[e.eigenesRisiko.von] ?? e.eigenesRisiko.von } : null,
    },
    risikoHinweis: RISIKO_HINWEIS, namensnennung: OSM_NAMENSNENNUNG,
    funde, zahlen, ...(b.lauf ? { lauf: b.lauf } : {}),
    produkte: crm.leistungen.filter(l => l.status === 'aktiv').map(l => ({ id: l.id, name: l.name })),
    branchen: FUND_BRANCHEN, gebietsVorlagen: GEBIETS_VORLAGEN, artenVorlagen: ARTEN_VORLAGEN,
    ...(absenderWahl ? { absenderWahl } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  // 1 MB: eine Import-Datei mit bis zu 200 Funden (sonst reichen wenige KB).
  try { b = await jsonBegrenzt(req, 1024 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const wer = werAus(req);
  const inhaber = await istInhaber(z.person);
  try {
    switch (b.aktion) {
      case 'hand': {
        const f = await fundVonHand(handEingabeSaeubern(b.fund), z.person, wer);
        return NextResponse.json({ ok: true, fund: fundSicht(f) });
      }
      case 'verwerfen': {
        if (typeof b.id !== 'string') return fehler('id fehlt.', 400);
        const grund = typeof b.grund === 'string' ? b.grund : '';
        if (grund.length > 200) return fehler('Grund zu lang (höchstens 200 Zeichen) — nichts gespeichert.', 413);
        await fundVerwerfen(b.id, grund, z.person, wer);
        return NextResponse.json({ ok: true });
      }
      case 'senden': {
        if (typeof b.id !== 'string') return fehler('id fehlt.', 400);
        const { fundNachsenden } = await import('@/lib/funde/uebernehmen');
        const r = await fundNachsenden(b.id, z.person);
        return r.ok ? NextResponse.json({ ok: true, text: r.text, gesendet: r.gesendet }) : fehler(r.fehler, r.status);
      }
    }
    if (!inhaber) return fehler('Einrichten, Einstellungen, Risiko und den Lauf steuert nur ein Inhaber.', 403);
    switch (b.aktion) {
      case 'einrichten': return NextResponse.json({ ok: true, ...(await kampagneEinrichten(z.person, wer)) });
      case 'import': {
        const r = await fundeImportieren(b.datei, z.person, wer);
        return NextResponse.json({ ok: true, ...r, text: `${r.neu} Funde übernommen${r.uebersprungen.length ? `, ${r.uebersprungen.length} übersprungen` : ''} — sie warten im ZOE-Stapel auf Freigabe.` });
      }
      case 'risiko': {
        if (typeof b.an !== 'boolean') return fehler('an: true oder false.', 400);
        const e = await risikoSetzen(b.an, z.person, wer);
        return NextResponse.json({ ok: true, eigenesRisiko: !!e.eigenesRisiko });
      }
      case 'einstellungen': {
        const teil: Partial<FundeEinstellungen> = {};
        if (typeof b.stadt === 'string') teil.stadt = b.stadt;
        if (Array.isArray(b.gebiete)) teil.gebiete = b.gebiete.filter((x): x is string => typeof x === 'string');
        if (Array.isArray(b.branchen)) teil.branchen = b.branchen.filter(istFundBranche);
        if (b.jeAbend !== undefined) teil.jeAbend = Number(b.jeAbend);
        if (typeof b.gesellschaft === 'string') teil.gesellschaft = b.gesellschaft;
        if (typeof b.produktId === 'string') teil.produktId = b.produktId;
        if (Array.isArray(b.arten)) teil.arten = b.arten.filter((x): x is string => typeof x === 'string' && /^[a-z_]{2,40}$/.test(x)).slice(0, 20);
        if (typeof b.nurMitMail === 'boolean') teil.nurMitMail = b.nurMitMail;
        if (typeof b.nurMitTelefon === 'boolean') teil.nurMitTelefon = b.nurMitTelefon;
        if (b.absender === null) teil.absender = undefined;
        else if (typeof b.absender === 'string') {
          const { ladePostfach } = await import('@/lib/postfach/register');
          const p = await ladePostfach(z.person, b.absender);
          if (!p || p.quelle === 'whatsapp' || !formularPostfachBereichOk(p.bereich)) return fehler('Nur ein eigenes Business-Postfach kann Absender sein.', 400);
          teil.absender = { person: z.person, postfach: p.id };
        }
        const e = await einstellungenAendern(teil, wer);
        return NextResponse.json({ ok: true, jeAbend: e.jeAbend, gebiete: e.gebiete.length });
      }
      case 'lauf': {
        const { modellSchranke } = await import('@/lib/zugang/umfang');
        const schranke = modellSchranke(req); if (schranke) return schranke;
        const person = z.person;
        after(async () => {
          const { fundeLauf } = await import('@/lib/funde/lauf');
          await fundeLauf({ person }).catch(err => console.error('[funde] Lauf:', err instanceof Error ? err.message.slice(0, 160) : err));
        });
        return NextResponse.json({ ok: true, text: 'Lauf gestartet — die Funde erscheinen in einigen Minuten hier und im ZOE-Stapel.' });
      }
      default: return fehler('aktion: einrichten, einstellungen, risiko, hand, import, verwerfen, lauf oder senden.', 400);
    }
  } catch (e) {
    if (e instanceof FundeFehler) return fehler(e.message, e.status);
    console.error('[crm/funde]', (e as Error)?.message);
    return fehler('Nicht gespeichert — interner Fehler.', 500);
  }
}
