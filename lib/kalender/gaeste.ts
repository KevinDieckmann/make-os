// ─── Kalender — Gäste am Termin (rein, client-sicher, 30.09., Paket K3) ─────
// Kevin 29.09.: „Echte Einladung nach Klick“. Gäste kommen aus dem CRM (Kontakt mit E-Mail) oder als frei
// eingegebene Adresse. Die ADRESSE steht danach nur im Termin (ATTENDEE, iCloud verschickt); MAKE OS merkt sich im
// Neben-Bestand `kalender-bezug` nur die Kontakt-Kennungen (`gastKontakte`). Vor jedem Schreiben, das Post an Gäste
// auslöst, fragt die Oberfläche „Einladung an n Personen über iCloud senden?“ — die Route erzwingt es (409 ohne
// `einladungBestaetigt`).
//
// Regeln für Kontakte (CLAUDE.md › CRM): Art. 18 (eingeschränkt) nie wählbar — die Suche liefert sie nicht, die Route
// lehnt auch frei eingegebene Adressen einer eingeschränkten Person ab. Werbesperre: ein 1:1-Termin ist keine Werbung —
// wählbar, aber mit Hinweis.

/** Antwort eines Gastes (PARTSTAT): zugesagt · abgesagt · vielleicht · offen (noch keine Antwort). */
export type Teilnahme = 'zugesagt' | 'abgesagt' | 'vielleicht' | 'offen';
export const TEILNAHMEN: readonly Teilnahme[] = ['zugesagt', 'abgesagt', 'vielleicht', 'offen'];
export const TEILNAHME_LABEL: Record<Teilnahme, string> = { zugesagt: 'zugesagt', abgesagt: 'abgesagt', vielleicht: 'vielleicht', offen: 'keine Antwort' };
export const TEILNAHME_ZEICHEN: Record<Teilnahme, string> = { zugesagt: '✓', abgesagt: '✕', vielleicht: '?', offen: '·' };

/** Ein Gast am Termin (aus dem ATTENDEE gelesen). */
export interface Teilnehmer { email: string; name?: string; status: Teilnahme; optional?: true }
/** Ein Gast beim Anlegen/Ändern. */
export interface Gast { email: string; name?: string }
/** Ein Gast im Dialog: dazu die Kontakt-Kennung (→ `gastKontakte`) und ob die Person eine Werbesperre hat (nur Hinweis). */
export interface GastWahl extends Gast { kontaktId?: string; werbesperre?: true }

/** „mailto:Anna@Example.invalid“ → „anna@example.invalid“ (sonst undefined). */
export function adresseAus(v: unknown): string | undefined {
  const t = typeof v === 'string' ? v.trim().replace(/^mailto:/i, '').trim().toLowerCase() : '';
  return /^[^\s@<>"(),;:]{1,64}@[^\s@<>"(),;:]{1,190}\.[^\s@<>"(),;:.]{2,63}$/.test(t) ? t : undefined;
}

/** Einen Gast in die Liste (ohne Doppelte nach Adresse). */
export function gastDazu(liste: readonly GastWahl[], g: GastWahl): GastWahl[] {
  const email = adresseAus(g.email);
  if (!email || liste.some(x => x.email === email)) return [...liste];
  return [...liste, { ...g, email }];
}

/** Text der Rückfrage vor dem Schreiben. */
export function einladungFrage(was: 'einladung' | 'aenderung' | 'absage' | 'antwort', n: number): string {
  if (was === 'antwort') return 'Antwort an die einladende Person über iCloud senden?';
  const wort = was === 'einladung' ? 'Einladung' : was === 'absage' ? 'Absage' : 'Änderung';
  return `${wort} an ${n} ${n === 1 ? 'Person' : 'Personen'} über iCloud senden?`;
}

/** Zusagen/Absagen zählen („2 zugesagt · 1 offen“) — für die Kopfzeile am Termin. */
export function antwortenZaehlen(t: readonly Pick<Teilnehmer, 'status'>[]): string {
  const n = (s: Teilnahme) => t.filter(x => x.status === s).length;
  return (['zugesagt', 'vielleicht', 'abgesagt', 'offen'] as Teilnahme[]).filter(s => n(s)).map(s => `${n(s)} ${TEILNAHME_LABEL[s]}`).join(' · ');
}
