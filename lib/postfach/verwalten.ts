// ─── Postfächer — hinzufügen, erneuern, trennen (Server, 06.10.2026) ──────────────────────────────────────────────
// Die Abläufe der Verbinden-Oberfläche an EINER Stelle (Route /api/inbox/postfaecher):
//   hinzufuegen  Eingabe prüfen → EINMAL beim Anbieter anmelden + Ordner lesen (lib/postfach/pruefen.ts) → erst dann Register + Passwort
//                speichern → erster Abgleich im Hintergrund. Scheitert die Anmeldung, wird NICHTS gespeichert.
//   erneuern     neues Passwort genauso prüfen, dann speichern und die Sperre „Anmeldung abgelehnt“ aufheben → Abgleich
//   trennen      IDLE beenden, Spiegel (Köpfe + Texte) löschen, Inbox-Zustand des Postfachs löschen, Register-Eintrag + Passwort löschen.
//                Gmail: nur Gmail ausschalten (die Google-Verbindung für den Kalender bleibt) + Register-Eintrag.

import { gmailAusschalten } from '@/lib/google/trennen';
import { googleAdresse } from '@/lib/google/verbindung';
import { zustandOhnePostfach } from '@/lib/inbox/zustand';
import { VOREINSTELLUNGEN } from './anbieter';
import { imapAbgleichen } from './abgleich';
import { verbindungPruefen } from './pruefen';
import { ladePostfach, neuesPostfachPruefen, postfachAendern, postfachAnlegen, registerEntfernen, RegisterFehler, serverAus, zugangErneuern } from './register';
import { aendereImapStand, spiegelEntfernen } from './spiegel';
import { waechterStoppen } from './takt';
import { GMAIL_POSTFACH, type Postfach } from './typen';

export const demoErlaubt = (): boolean => process.env.MAKE_OS_DEMO === '1';

export async function postfachHinzufuegen(person: string, b: Record<string, unknown>): Promise<Postfach> {
  const e = await neuesPostfachPruefen(b, demoErlaubt());
  const { imap } = serverAus(e.anbieter, { imap: e.imap, smtp: e.smtp });
  const v = VOREINSTELLUNGEN[e.anbieter];
  const pr = await verbindungPruefen({ anbieter: e.anbieter, imap, benutzer: v.imapBenutzer(e.adresse), passwort: e.passwort, adresse: e.adresse });
  const p = await postfachAnlegen(person, { ...e, ordner: pr.ordner, idle: pr.idle });
  void imapAbgleichen(person, p.id).catch(() => { /* der Fehler steht im Stand, der Takt versucht es wieder */ });
  return p;
}

export async function postfachErneuern(person: string, id: string, passwort: string): Promise<void> {
  const p = await ladePostfach(person, id);
  if (!p || p.quelle !== 'imap' || !p.imap || !p.anbieter) throw new RegisterFehler('Dieses Postfach gibt es nicht.', 404);
  if (!passwort || /[\r\n\u0000]/.test(passwort)) throw new RegisterFehler('Bitte das neue Passwort eintragen.');
  const pr = await verbindungPruefen({ anbieter: p.anbieter, imap: p.imap, benutzer: p.benutzer ?? p.adresse, passwort, adresse: p.adresse });
  await zugangErneuern(person, id, passwort, { ordner: { ...pr.ordner, ...(p.ordner?.archiv && !pr.ordner.archiv ? { archiv: p.ordner.archiv } : {}) }, idle: pr.idle });
  await aendereImapStand(person, cur => {
    const alt = cur.postfaecher[id];
    if (!alt) return null;
    const { fehler: _f, fehlerAt: _fa, fehlerAnmeldung: _fn, fehlerFolge: _ff, pauseBis: _p, getrenntGemeldet: _g, ...rest } = alt;
    return { ...cur, postfaecher: { ...cur.postfaecher, [id]: rest } };
  });
  void imapAbgleichen(person, id, { erzwingen: true }).catch(() => { /* steht im Stand */ });
}

/** Bereich, Name, Absendername, Signatur (Gmail: legt den Register-Eintrag an). */
export async function postfachEinstellen(person: string, id: string, b: Record<string, unknown>): Promise<Postfach> {
  const gmail = id === GMAIL_POSTFACH ? await googleAdresse(person) : null;
  if (id === GMAIL_POSTFACH && !gmail) throw new RegisterFehler('Gmail ist nicht verbunden.', 409);
  return postfachAendern(person, id, b, gmail);
}

export async function postfachTrennen(person: string, id: string): Promise<{ war: boolean; nachrichten: number }> {
  if (id === GMAIL_POSTFACH) {
    const war = await gmailAusschalten(person);
    await registerEntfernen(person, id);
    await zustandOhnePostfach(person, 'gm~');
    return { war, nachrichten: 0 };
  }
  const p = await ladePostfach(person, id);
  if (!p) return { war: false, nachrichten: 0 };
  await waechterStoppen(person, id);
  const n = await spiegelEntfernen(person, id);
  await zustandOhnePostfach(person, `im~${id}~`);
  await registerEntfernen(person, id);
  return { war: true, nachrichten: n };
}
