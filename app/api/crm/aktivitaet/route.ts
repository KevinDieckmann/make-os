// ─── MAKE OS — Eine Aktivität am Kontakt ────────────────────────────────────
// „Ich habe X angeschrieben" — ein Aufruf, und der Kontakt weiß es: Aktivität
// protokolliert, letzter Kontakt gesetzt, Stufe vorwärts (nie zurück),
// Wiedervorlage angelegt. Wer es war, kommt aus dem Raum (Kevin oder Malin),
// nicht aus dem Body — sonst könnte ein Fenster im falschen Namen schreiben.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { personAus } from '@/lib/zoe/raum';
import { VORSCHLAG_KENNUNG, fuerPerson, wendeAktivitaetAn, wannSaeubern, wannInZukunft, ortSaeubern, STUFEN, AKTIVITAET_ARTEN, ERGEBNISSE, NOTIZ_FELDER, type Kontakt, type AktivitaetArt, type Stufe, type Ergebnis, type NotizVorlage } from '@/lib/make-one/crm';
import { notizAnwenden, istAktAnker, type NotizAktion } from '@/lib/crm/aktivitaeten';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { istDienst } from '@/lib/zugang/dienst';
import { folgeAus } from '@/lib/crm/heute';
import { localDay, tagePlus } from '@/lib/zeit';
import { sperren } from '@/lib/crm/sperrliste';
import { anlassPflicht } from '@/lib/crm/recht';
import { EINGESCHRAENKT_FEHLER } from '@/lib/crm/einschraenkung';
import { aendereCrm, ladeCrm } from '@/lib/crm/speicher';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { aktivitaetImCrm, followupDerPerson, FOLLOWUP_NOCHMAL } from '@/lib/crm/aktivitaet-folgen';
import { aufgabeErledigenNachFollowUp } from '@/lib/crm/followup-aufgabe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARTEN: readonly AktivitaetArt[] = AKTIVITAET_ARTEN.filter(a => a !== 'system');

// Seit 24.09. auch mit Ergebnis (Power Hour), Notizvorlage und nächstem Schritt:
// das Ergebnis setzt per Regel Wiedervorlage und Stufe (lib/crm/heute.ts),
// „Sperre“ setzt die Werbesperre — sofort und dauerhaft (Art. 21 DSGVO).
//
// 28.09. (H4):
//  · Meetings tragen `wann` (Tag bzw. Tag + Uhrzeit) und `ort` als Felder — der Text ist nur die Notiz.
//  · Eigene Notizen ändern/löschen: { aktion: 'aendern' | 'loeschen', id, anker, stand, text? } —
//    nur Art „notiz“, nur `von` = angemeldete Person (sonst 403), veralteter Stand → 409 mit dem
//    aktuellen Kontakt. Die alte Fassung bekommt eine Löschmarke (lib/crm/aktivitaet-marke.ts), damit
//    ein Speichern ohne Stand (ZOE, Import, altes Fenster) sie nicht zurückholt.
//  · Jede Antwort trägt den Kontakt mit `stand` (Fingerabdruck) und maskierter IBAN.
//  · Geplantes Meeting (wann in der Zukunft, Prüfbericht F1): kein „letzter Kontakt“, keine Stufe und
//    Wiedervorlage nach Regel — es zählt ab seinem Tag (Kadenz: `letzterKontaktVon`).
//
// 28.09. (U2):
//  · Ereigniszeit `wann` für ALLE Arten (#46): ein nachgetragener Anruf oder eine Mail trägt ihren Tag
//    (nie in der Zukunft — außer bei Meetings); „letzter Kontakt“ und Sortierung nutzen `wann ?? am`.
//  · Anruf bei gelber Telefon-Ampel (#58, mutmaßliche Einwilligung): nur mit `anlass` (Text, an der
//    Aktivität gespeichert; auch aus notiz.anlass) — sonst 409 mit `anlassPflicht: true`.
//  · Eingeschränkte Person (Art. 18, #51): nichts festhalten — 409 mit `eingeschraenkt: true`.
//
// 28.09. (Ablaufprüfung W1/f) — Folgen im CRM-Bestand, in EINER Sperre (`aendereCrm`, lib/crm/aktivitaet-folgen.ts):
//  · Deal-Ampel: Bezug auf einen offenen Deal (`ch-…`) oder Person mit genau EINEM offenen Deal →
//    `Chance.letzteAktivitaet` = heute (Berlin) — nicht bei einem erst geplanten Meeting, nie rückwärts.
//  · Ergebnis „Sperre“ (Werbewiderspruch): offene werbliche Follow-ups der Person (Mail, LinkedIn, Anruf)
//    werden mit Grund abgesagt, die Person verlässt aktive und Entwurfs-Kampagnen (Reparatur
//    `werbesperre-kampagne` aus lib/crm/verbindungen.ts).
//
// 08.10. (Sofort-Paket 4.1): `followupId` — die Power-Hour-Karte trägt ihr echtes Follow-up. Es wird in derselben CRM-Sperre
// mitgeführt (`aktivitaetImCrm`, Schritt 0): erledigt mit Ergebnis, bzw. bei „nicht erreicht“/Mailbox/Rückruf auf den Tag der
// Regel verschoben — dann setzt diese Route KEINE Wiedervorlage am Kontakt (keine zweite Erinnerung neben dem Follow-up).
// Eine verknüpfte Aufgabe wird wie beim Erledigen in der Follow-up-Liste mit erledigt.

type Antwort = Record<string, unknown>;
const mitStandFuer = (k: Kontakt, person: string) => ({ ...fuerPerson(k, person), stand: fingerabdruck(k as unknown as Record<string, unknown>) });

async function notizAktion(req: Request, b: { aktion: NotizAktion; id?: string; anker?: string; stand?: string; text?: string }): Promise<NextResponse> {
  // Nur eine benannte Person — der Dienstweg ohne Person darf keine „eigenen“ Notizen ändern.
  const ich = personStreng(req);
  if (!ich) return NextResponse.json({ ok: false, fehler: 'Ohne angemeldete Person keine Änderung an Notizen.' }, { status: 403 });
  const id = String(b.id ?? '').trim();
  const anker = String(b.anker ?? '').trim();
  const stand = typeof b.stand === 'string' ? b.stand : '';
  if (!/^c-[a-z0-9-]{4,60}$/.test(id) || !istAktAnker(anker)) return NextResponse.json({ ok: false, fehler: 'id und anker nötig.' }, { status: 400 });
  if (!stand) return NextResponse.json({ ok: false, fehler: 'stand fehlt — ohne Stand wird nichts geändert.' }, { status: 400 });
  const heute = localDay();
  let raus: { status: number; body: Antwort } = { status: 404, body: { ok: false, fehler: `Kein Kontakt mit id ${id}.` } };
  await aendereKontakte<{ kontakte: Kontakt[] }>(current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    if (fingerabdruck(alt as unknown as Record<string, unknown>) !== stand) {
      raus = { status: 409, body: { ok: false, konflikt: true, fehler: 'Jemand hat diesen Kontakt inzwischen geändert — Stand neu geladen, bitte noch einmal.', kontakt: mitStandFuer(alt, ich) } };
      return f;
    }
    // Art. 18 (U2): an einer eingeschränkten Person wird nichts geändert.
    if (alt.eingeschraenkt) { raus = { status: 409, body: { ok: false, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true } }; return f; }
    const r = notizAnwenden(alt, { aktion: b.aktion, anker, text: b.text }, ich, heute, new Date().toISOString());
    if (!r.ok) { raus = { status: r.status, body: { ok: false, fehler: r.fehler } }; return f; }
    raus = { status: 200, body: { ok: true, kontakt: mitStandFuer(r.kontakt, ich), text: b.aktion === 'loeschen' ? 'Notiz gelöscht.' : r.unveraendert ? 'Unverändert.' : 'Notiz geändert.' } };
    if (r.unveraendert) return f;
    f.kontakte[i] = r.kontakt;
    return f;
  }, werAus(req));
  return NextResponse.json(raus.body, { status: raus.status });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { id?: string; art?: string; text?: string; stufe?: string; wiedervorlage?: string; von?: 'zoe'; ergebnis?: string; notiz?: Record<string, unknown>; naechster?: { text?: string; datum?: string }; bezug?: string; wann?: string; ort?: string; anlass?: string; aktion?: string; anker?: string; stand?: string; vorschlagId?: string; followupId?: string };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion === 'aendern' || b.aktion === 'loeschen') return notizAktion(req, { ...b, aktion: b.aktion });
  if (b.aktion !== undefined) return NextResponse.json({ ok: false, fehler: 'aktion ist aendern oder loeschen.' }, { status: 400 });
  const id = String(b.id ?? '').trim();
  const art = String(b.art ?? '') as AktivitaetArt;
  if (!id || !ARTEN.includes(art)) return NextResponse.json({ error: `id und art (${ARTEN.join('|')}) nötig.` }, { status: 400 });
  const text = String(b.text ?? '').trim().slice(0, 3000);
  const erg = ERGEBNISSE.includes(b.ergebnis as Ergebnis) ? (b.ergebnis as Ergebnis) : undefined;
  const notiz = b.notiz && typeof b.notiz === 'object'
    ? Object.fromEntries(NOTIZ_FELDER.map(f => [f.id, String(b.notiz![f.id] ?? '').trim().slice(0, 1500)]).filter(([, v]) => v)) as NotizVorlage : undefined;
  const naechster = b.naechster && String(b.naechster.text ?? '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(b.naechster.datum ?? ''))
    ? { text: String(b.naechster.text).trim().slice(0, 300), datum: String(b.naechster.datum) } : undefined;
  const bezug = /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(b.bezug ?? '')) ? String(b.bezug) : undefined;
  const wunschStufe = b.stufe && STUFEN.includes(b.stufe as Stufe) ? (b.stufe as Stufe) : undefined;
  const wunschWv = b.wiedervorlage && /^\d{4}-\d{2}-\d{2}$/.test(b.wiedervorlage) ? b.wiedervorlage : undefined;
  const von = b.von === 'zoe' ? 'zoe' : personAus(req);
  const heute = localDay();
  // Ereigniszeit (U2 #46): für alle Arten; ein ungültiges `wann` fällt weg (kein Fantasiedatum), nur ein Meeting
  // darf in der Zukunft liegen.
  const wann = wannSaeubern(b.wann);
  if (wann && art !== 'termin' && wannInZukunft(wann, new Date().toISOString())) return NextResponse.json({ ok: false, fehler: 'wann liegt in der Zukunft — nur Meetings dürfen geplant werden.' }, { status: 400 });
  const anlass = String(b.anlass ?? notiz?.anlass ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
  // Das echte Follow-up der Power-Hour-Karte (08.10., 4.1) — nur ein offenes dieser Person zählt.
  const followupId = typeof b.followupId === 'string' && /^fu-[a-z0-9-]{1,80}$/.test(b.followupId) ? b.followupId : undefined;
  // Kontext der Telefon-Ampel (U2 #58): aktives Mandat / offener Deal mit der Person — nur für Anrufe (bzw. mit Follow-up) laden.
  const crm = art === 'anruf' || followupId ? await ladeCrm() : null;
  const ctx = crm && art === 'anruf' ? { hatMandat: crm.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(id)), hatChance: crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(id)) } : {};
  const fu = followupId && crm ? (crm.followups ?? []).find(f => f.id === followupId && followupDerPerson(f, id)) : undefined;
  /** „Noch einmal“ (nicht erreicht, Mailbox, Rückruf) mit Follow-up: es wandert auf den Tag der Regel — keine Wiedervorlage am Kontakt. */
  const fuNochmalAm = fu && erg && FOLLOWUP_NOCHMAL.includes(erg) ? folgeAus(erg, heute, 'neu').wiedervorlage : undefined;

  // Aus einem ZOE-Vorschlag (29.09.): steht die Aktivität schon am Kontakt, wird nichts doppelt angelegt (idempotent).
  const vorschlagId = typeof b.vorschlagId === 'string' && VORSCHLAG_KENNUNG.test(b.vorschlagId) ? b.vorschlagId : undefined;
  // Herkunft (29.09., #94): aus einem ZOE-Vorschlag (nur über den Dienstweg der Freigabe) → quelle 'zoe', freigegeben von
  // der Person, die im Stapel geklickt hat (x-make-person).
  const ausZoe = !!vorschlagId && istDienst(req);
  let schonDa = false;
  let ergebnis: Kontakt | null = null;
  let abgelehnt: { status: number; body: Antwort } | null = null;
  /** Geplantes Meeting (in der Zukunft) — zählt noch nicht als Aktivität am Deal. */
  let nurGeplant = false;
  await aendereKontakte<{ kontakte: Kontakt[] }>(current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    const alt = f.kontakte[i];
    if (vorschlagId && (alt.aktivitaeten ?? []).some(a => a.vorschlagId === vorschlagId)) { schonDa = true; ergebnis = alt; return f; }
    // Art. 18 (U2): eine eingeschränkte Person wird nicht weiter verarbeitet — auch kein Verlauf.
    if (alt.eingeschraenkt) { abgelehnt = { status: 409, body: { ok: false, fehler: EINGESCHRAENKT_FEHLER, eingeschraenkt: true } }; return f; }
    // Mutmaßliche Einwilligung (U2 #58): gelbe Telefon-Ampel → nur mit konkretem Anlass.
    if (art === 'anruf' && !anlass && anlassPflicht(alt, ctx)) {
      abgelehnt = { status: 409, body: { ok: false, anlassPflicht: true, fehler: 'Anruf nur mit konkretem Anlass aus der Beziehung (mutmaßliche Einwilligung, § 7 Abs. 2 UWG) — bitte den Anlass eintragen.' } };
      return f;
    }
    const folge = erg ? folgeAus(erg, heute, alt.stufe) : null;
    const jetzt = new Date().toISOString();
    // Geplantes Meeting (wann in der Zukunft, 28.09., F1): noch kein Kontakt — keine Folge-Regeln, nur Ausdrückliches.
    const geplant = art === 'termin' && wannInZukunft(wann, jetzt);
    nurGeplant = geplant;
    let neu = wendeAktivitaetAn(alt, {
      art, text: text || undefined, von, ergebnis: erg, ...(vorschlagId ? { vorschlagId } : {}), ...(ausZoe ? { quelle: 'zoe' as const, freigegebenVon: personStreng(req) ?? undefined } : {}), notiz: notiz && Object.keys(notiz).length ? notiz : undefined, bezug,
      ...(wann ? { wann } : {}), ...(art === 'termin' ? { ort: ortSaeubern(b.ort) } : {}), ...(art === 'anruf' && anlass ? { anlass } : {}),
      stufe: wunschStufe ?? (geplant ? undefined : folge?.stufe), wiedervorlage: wunschWv ?? naechster?.datum ?? (geplant ? undefined : folge?.wiedervorlage),
    }, heute, jetzt, tagePlus);
    // Das Follow-up bleibt die eine Erinnerung (4.1): keine Wiedervorlage aus Regel oder Art daneben. Eine künftige bleibt, wie sie war;
    // eine schon fällige ist mit diesem Anlauf abgearbeitet (sonst käme die Karte morgen doppelt wieder).
    if (fuNochmalAm && !wunschWv && !naechster) neu = { ...neu, wiedervorlage: alt.wiedervorlage && alt.wiedervorlage > heute ? alt.wiedervorlage : undefined };
    if (naechster) neu = { ...neu, naechsterSchritt: naechster };
    else if (!geplant && erg && alt.naechsterSchritt && alt.naechsterSchritt.datum <= heute && (erg === 'gespraech' || erg === 'termin')) neu = { ...neu, naechsterSchritt: undefined };
    if (folge?.werbesperre) neu = { ...neu, werbesperre: { seit: heute, grund: text || 'Widerspruch im Gespräch' }, wiedervorlage: undefined, naechsterSchritt: undefined };
    ergebnis = neu;
    f.kontakte[i] = neu;
    return f;
  }, werAus(req));
  const nein = abgelehnt as { status: number; body: Antwort } | null;
  if (nein) return NextResponse.json(nein.body, { status: nein.status });
  if (!ergebnis) return NextResponse.json({ error: `Kein Kontakt mit id ${id}.` }, { status: 404 });
  if (schonDa) return NextResponse.json({ ok: true, schonDa: true, kontakt: mitStandFuer(ergebnis as Kontakt, personStreng(req) ?? '') });
  // Werbesperre (Ergebnis „Sperre“): auch auf die gehashte Sperrliste (K2 #60) — ein Import legt die Person nie neu an.
  const gespeichert = ergebnis as Kontakt | null;
  if (gespeichert?.werbesperre) await sperren([gespeichert], 'werbesperre', heute);
  // Folgen im CRM-Bestand in EINER Sperre (lib/crm/aktivitaet-folgen.ts): Kampagnen-Ergebnis (Karte aus einer Kampagne —
  // Power Hour ↔ Kampagne), letzte Aktivität am Deal, bei „Sperre“ werbliche Follow-ups absagen und raus aus Kampagnen.
  const folgen = { kontakt: gespeichert!, bezug, ergebnis: erg, von, heute, jetzt: new Date().toISOString(), geplant: nurGeplant, ...(fu ? { followupId: fu.id } : {}), ...(fuNochmalAm ? { followupNochmalAm: fuNochmalAm } : {}) };
  const vorab = await ladeCrm();
  let fuFolge: ReturnType<typeof aktivitaetImCrm>['followup'] = null;
  if (aktivitaetImCrm(vorab, folgen).geaendert) await aendereCrm(c => { const r = aktivitaetImCrm(c, folgen); fuFolge = r.followup; return r.crm; });
  const fuF = fuFolge as ReturnType<typeof aktivitaetImCrm>['followup'];
  // Follow-up = Aufgabe (29.09., #99): die verknüpfte Aufgabe wird mit erledigt — derselbe Weg wie in der Follow-up-Liste.
  if (fuF?.wie === 'erledigt' && fuF.aufgabeId) await aufgabeErledigenNachFollowUp(fuF, personStreng(req) ?? von);
  const fuText = fuF?.wie === 'erledigt' ? 'Follow-up erledigt.' : fuF?.wie === 'verschoben' ? `Follow-up kommt am ${fuF.faellig} wieder.` : '';
  const regel = erg ? folgeAus(erg, heute, 'neu').hinweis : undefined;
  // Private Notizen sieht nur, wer sie schrieb — auch in dieser Antwort; ohne ausdrückliche Person keine (Regel 5).
  return NextResponse.json({ ok: true, kontakt: ergebnis ? mitStandFuer(ergebnis, personStreng(req) ?? '') : ergebnis, hinweis: [fuF?.wie === 'verschoben' ? undefined : regel, fuText].filter(Boolean).join(' ') || undefined, ...(fuF ? { followup: { id: fuF.id, wie: fuF.wie, ...(fuF.faellig ? { faellig: fuF.faellig } : {}) } } : {}) });
}
