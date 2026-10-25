// ─── „Angebot verschicken im Auftrag“ — die EINE eng gefasste Versand-Funktion (nur Server, 25.10.2026) ────────────────────────────────────
// Kevin 25.10.: angeforderte Angebote gehen automatisch raus, wenn ALLES stimmt, sonst zur Freigabe; Absender = ein vom Inhaber gewähltes Postfach.
// Eiserne Regel 3 („nichts verlässt das System ohne Freigabe“) hat dafür EINE dokumentierte Ausnahme (CLAUDE.md › Formulare): das Absenden des
// Vertrieblers zählt als Freigabe — NUR für diesen Weg und nur so eng:
//   · nur die Angebots-Mail (Betreff/Text aus der Vorlage der Einstellungen bzw. dem Standard + Datenschutzhinweis, keine KI, nichts vom Aufrufer)
//   · nur an die Empfänger-Adresse der Anfrage (am Eingang nur als Fingerabdruck — hier gegen die Adressen des Kontakts abgeglichen)
//   · nur das PDF DIESES Angebots als Anhang (Ablage-Eintrag mit `angebotId` = das Angebot, Art „angebot“)
//   · nur über das Postfach, das ein Inhaber in den Einstellungen gewählt hat (Business-Bereich, verbunden)
//   · gesendet über den vorhandenen Weg der Inbox (`inboxSenden`: § 7 UWG, Art. 18, Absender = Postfach, Spiegel/Verlauf) — keine zweite Sendelogik
// Die Funktion nimmt NUR die Kennung des Eingangs — Empfänger, Text, Anhang und Postfach kann kein Aufrufer setzen. Aufrufer: lib/crm/formulare-server.ts
// (automatischer Versand und die Freigabe „Senden“). Wächter: tests/angebot-formular-versand.test.ts.
// Protokoll: der Eingang trägt `versendet` (wann, über welches Postfach maskiert, wer auslöste) und den Empfänger als Fingerabdruck; dazu ein Eintrag
// im Änderungsprotokoll (nur Kennung + Feldname) und „versendet“ am Angebot.

import { loadJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { ladeCrm } from './speicher';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import { alleAdressen } from './emails';
import { gesellschaftenLaden, angebotVersendetVermerken } from './angebot-server';
import { mitVorgaben } from './gesellschaften';
import { datenschutzAngabenAus } from './netzwerken-recht';
import { angebotMail, ABSENDER_FEHLT, formularBestandName, type FormularEinstellungen } from './formulare';
import { aendereEingang, empfaengerHash, formularHaushalt, ladeFormular } from './formulare-speicher';
import { adresseMaskiert } from '@/lib/zugang/konten';
import { bereichVon } from '@/lib/einheiten';

export type VersandErgebnis = { ok: true; an: string; ueber: string } | { ok: false; status: number; fehler: string };
const nein = (status: number, fehler: string): VersandErgebnis => ({ ok: false, status, fehler });

/**
 * Ist das gewählte Absender-Postfach nutzbar? Ein wirksamer Inhaber, ein EIGENES Postfach mit Business-Bereich, verbunden (Gmail bereit bzw. IMAP
 * ohne abgelehnte Anmeldung). Liefert die Adresse (maskiert für Anzeige/Protokoll) oder den Grund.
 */
export async function absenderPruefen(a: FormularEinstellungen['absender']): Promise<{ ok: true; adresse: string } | { ok: false; grund: string }> {
  if (!a) return { ok: false, grund: ABSENDER_FEHLT };
  const { istInhaber } = await import('@/lib/zugang/haushalt-inhaber');
  if (!(await istInhaber(a.person))) return { ok: false, grund: 'Das gewählte Absender-Postfach gehört keinem Inhaber (mehr) — bitte neu wählen.' };
  const { ladePostfach } = await import('@/lib/postfach/register');
  const p = await ladePostfach(a.person, a.postfach);
  if (!p || p.quelle === 'whatsapp') return { ok: false, grund: 'Das gewählte Absender-Postfach gibt es nicht (mehr) — bitte neu wählen.' };
  if (!p.bereich || bereichVon(p.bereich) !== 'business') return { ok: false, grund: 'Das Absender-Postfach liegt nicht im Business-Bereich — Angebote gehen nur aus einem Business-Postfach.' };
  if (p.quelle === 'gmail') {
    const { gmailBereit } = await import('@/lib/gmail/abgleich');
    if (!(await gmailBereit(a.person).catch(() => false))) return { ok: false, grund: 'Gmail ist für das Absender-Postfach nicht (mehr) verbunden.' };
  } else {
    const { ladeImapStand } = await import('@/lib/postfach/spiegel');
    const z = (await ladeImapStand(a.person).catch(() => null))?.postfaecher?.[p.id];
    if (z?.fehlerAnmeldung) return { ok: false, grund: 'Das Absender-Postfach braucht eine neue Anmeldung (Inbox › Postfächer › Verbindung erneuern).' };
  }
  return { ok: true, adresse: p.adresse };
}

/**
 * Das Angebot eines Eingangs verschicken — NUR mit der Kennung des Eingangs (siehe Kopf). `ausgeloest` = Speichername der Person (Vertriebler intern
 * bzw. der Inhaber, der freigibt) oder `link` (externer Vertriebler). Sendet höchstens einmal je Eingang (`versendet` am Eingang).
 */
export async function angebotVerschickenImAuftrag(eingangId: string, o: { ausgeloest: string }): Promise<VersandErgebnis> {
  const wer: Wer = o.ausgeloest === 'link' ? { art: 'system' } : { art: 'person', person: o.ausgeloest };
  const h = await formularHaushalt();
  const b = await ladeFormular(h);
  const e = b.eingaenge.find(x => x.id === eingangId);
  if (!e || !e.angebotId || !e.kontaktId || !e.an) return nein(404, 'Diesen Eingang gibt es nicht (mehr).');
  if (e.versendet) return nein(409, 'Dieses Angebot ist schon verschickt.');
  if (e.status !== 'laeuft' && e.status !== 'freigabe') return nein(409, 'Dieser Eingang ist schon entschieden.');
  const abs = await absenderPruefen(b.einstellungen.absender);
  if (!abs.ok) return nein(409, abs.grund);
  const absender = b.einstellungen.absender!;

  // Das Angebot: gestellt, mit PDF, an genau diesen Kontakt — und die Ablage-Datei ist SEIN PDF.
  const crm = await ladeCrm();
  const a = (crm.angebote ?? []).find(x => x.id === e.angebotId);
  if (!a || a.status !== 'gestellt' || !a.pdfDateiId || !a.nummer) return nein(409, 'Das Angebot ist nicht gestellt — nichts verschickt.');
  if (a.kontaktId !== e.kontaktId) return nein(409, 'Das Angebot gehört nicht zu dieser Anfrage — nichts verschickt.');
  const { ablageName } = await import('@/lib/dateien/ablage');
  const datei = ((await loadJson<{ eintraege: { id: string; angebotId?: string; art?: string; datei?: { typ: string } }[] }>(ablageName(h)))?.eintraege ?? []).find(x => x.id === a.pdfDateiId);
  if (!datei || datei.angebotId !== a.id || datei.art !== 'angebot' || datei.datei?.typ !== 'application/pdf') return nein(409, 'Das PDF des Angebots liegt nicht in der Ablage — nichts verschickt.');

  // Empfänger: die Adresse der Anfrage (Fingerabdruck) unter den Adressen des Kontakts; Art. 18 und Werbesperre nie.
  const k = (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).find(x => x.id === e.kontaktId);
  if (!k) return nein(404, 'Der Kontakt steht nicht (mehr) in der Kartei — nichts verschickt.');
  if (k.eingeschraenkt) return nein(409, 'Verarbeitung eingeschränkt (Art. 18) — nichts verschickt.');
  if (k.werbesperre) return nein(409, 'Die Person hat eine Werbesperre — erst klären, nichts verschickt.');
  const an = alleAdressen(k).find(x => empfaengerHash(x) === e.an!.hash);
  if (!an) return nein(409, 'Die Adresse der Anfrage steht nicht (mehr) am Kontakt — nichts verschickt.');

  // Text: nur Vorlage + Gesellschaft + Datenschutzhinweis (Art. 13) — ohne vollständigen Hinweis nichts.
  const g = (await gesellschaftenLaden(h)).find(x => x.id === a.gesellschaft) ?? { id: a.gesellschaft };
  const { verantwortlicherLaden } = await import('@/lib/datenschutz/einrichtung-server');
  const ds = datenschutzAngabenAus((await verantwortlicherLaden()).v);
  if (ds.fehlt) return nein(409, 'Datenschutzhinweis unvollständig (Einstellungen › Datenschutz) — nichts verschickt.');
  const firma = (a.firmaId ? crm.firmen.find(f => f.id === a.firmaId)?.name : undefined) ?? a.empfaenger?.firma;
  const mail = angebotMail(b.einstellungen, { anrede: k.anrede === 'Du' ? 'Du' : 'Sie', vorname: k.vorname, nachname: k.nachname, ...(firma ? { firma } : {}), nummer: a.nummer, titel: a.titel, gueltigBis: a.gueltigBis, absender: mitVorgaben(g).name }, ds);

  // Erst „begonnen“ festhalten — ein Abbruch danach sendet nie ein zweites Mal von selbst (die Wiederaufnahme legt es zur Freigabe).
  await aendereEingang(e.id, x => ({ ...x, versandBegonnen: new Date().toISOString() }), h);
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  let r: { status: number; body: Record<string, unknown> };
  try {
    r = await inboxSenden(absender.person, {
      neu: { postfach: absender.postfach, betreff: mail.betreff }, an: [{ email: an, name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() }], text: mail.text,
      anhaenge: [{ datei: a.pdfDateiId }], uwgBestaetigt: false,
    }, wer);
  } catch (err) { r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.' } }; }
  if (r.status !== 200 || r.body.ok !== true) {
    // Nicht gesendet (der Inbox-Weg wirft vor dem Senden bzw. meldet den abgelehnten Versand) — „begonnen“ wieder lösen.
    await aendereEingang(e.id, x => { const { versandBegonnen: _v, ...rest } = x; return rest; }, h);
    return nein(r.status >= 400 ? r.status : 502, `Nicht verschickt: ${String(r.body.fehler ?? 'unbekannter Fehler')}`);
  }
  const ueber = adresseMaskiert(String(r.body.von ?? abs.adresse));
  const am = new Date().toISOString();
  await aendereEingang(e.id, x => ({ ...x, versendet: { am, ueber, von: o.ausgeloest } }), h);
  await angebotVersendetVermerken({ id: a.id, ueber, von: o.ausgeloest, wer });
  await protokolliere(formularBestandName(h), [{ liste: 'eingaenge', op: 'geaendert', id: e.id, felder: ['versendet'] }], wer).catch(() => { /* nur Protokoll */ });
  return { ok: true, an: e.an.maskiert, ueber };
}
