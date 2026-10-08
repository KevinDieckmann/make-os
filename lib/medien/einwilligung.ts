// ─── Medien — Einwilligung der abgebildeten Person und Hinweisschild (Vorlagen; 09.10., Paket 5) ─────────────────────────────
// Kevin 09.10.: „Einwilligung per QR-Formular oder Unterschrift am Handy · Hinweisschild (ersetzt keine Einwilligung) · Widerruf sperrt
// sofort.“ Texte nach den ENTWÜRFEN in research/agenten/RECHT.md 6.4 — nicht veröffentlichen, bevor eine Anwältin sie gelesen hat.
// Hinweis, keine Rechtsberatung. Keine Namen und keine Firma im Code: der Verantwortliche kommt aus System › Datenschutz (Einrichtung).
//
// Nachweis (Art. 7 Abs. 1): der GANZE Wortlaut, wie er gezeigt wurde, und seine Fassung (Fingerabdruck der Vorlage) stehen an der
// Einwilligung; die Unterschrift liegt verschlüsselt im Medienspeicher. Der Browser zeigt den Text, den der Server liefert, und schickt die
// Fassung zurück — passt sie nicht mehr (Vorlage geändert), lehnt der Server ab (409).
// Rein (client-sicher).

import { KANAL_NAME, type EinwilligungZweck } from './typen';

export const EINWILLIGUNG_VORLAGE = 'Ich bin einverstanden, dass {{verantwortlicher}} Fotos und Videos, auf denen ich erkennbar bin{{anlass}}, verwendet für: {{zwecke}}. '
  + 'Die Einwilligung ist freiwillig. Ich kann sie jederzeit mit Wirkung für die Zukunft widerrufen ({{weg}}); dann verwenden wir die Aufnahmen nicht mehr und '
  + 'entfernen sie aus unseren Kanälen, soweit möglich. Bereits Gedrucktes kann nicht zurückgeholt werden.';
export const SORGEBERECHTIGT_ZUSATZ = ' Ich erteile diese Einwilligung als sorgeberechtigte Person für das abgebildete Kind.';
export const KI_ZWECK = 'Bearbeitung mit KI-Werkzeugen über Zuschnitt und Farbe hinaus';

export const HINWEISSCHILD_VORLAGE = 'Auf dieser Veranstaltung fotografieren und filmen wir für {{kanaele}}. Verantwortlich: {{verantwortlicher}}. '
  + 'Übersichtsaufnahmen stützen wir auf unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO); Nahaufnahmen machen wir nur mit Ihrer Einwilligung. '
  + 'Sie möchten nicht fotografiert werden? Sprechen Sie das Team an. Ton nehmen wir nur bei Vorträgen auf. Mehr Informationen und Ihre Rechte: {{weg}}.';

/** Fingerabdruck einer Vorlage (FNV-1a, 32 bit) — gleiche Vorlage = gleiche Fassung, im Browser und auf dem Server. */
export function fassungVon(vorlage: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < vorlage.length; i++) { h ^= vorlage.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `ew1-${h.toString(16).padStart(8, '0')}`;
}
export const EINWILLIGUNG_FASSUNG = fassungVon(EINWILLIGUNG_VORLAGE + SORGEBERECHTIGT_ZUSATZ + KI_ZWECK);

const zweckName = (z: EinwilligungZweck) => (z === 'ki' ? KI_ZWECK : KANAL_NAME[z]);

/** Der Wortlaut, wie er der Person gezeigt wird. `weg` = wie widerrufen wird (Adresse/Seite aus der Einrichtung). */
export function einwilligungWortlaut(o: { verantwortlicher: string; zwecke: readonly EinwilligungZweck[]; anlass?: string; weg: string; sorgeberechtigt?: boolean }): string {
  const zwecke = o.zwecke.length ? o.zwecke.map(zweckName).join(', ') : '—';
  return EINWILLIGUNG_VORLAGE
    .replace('{{verantwortlicher}}', o.verantwortlicher)
    .replace('{{anlass}}', o.anlass ? ` (${o.anlass})` : '')
    .replace('{{zwecke}}', zwecke)
    .replace('{{weg}}', o.weg) + (o.sorgeberechtigt ? SORGEBERECHTIGT_ZUSATZ : '');
}

/** Hinweisschild für den Eingang (Art. 13) — ersetzt keine Einwilligung. */
export function hinweisschild(o: { verantwortlicher: string; kanaele: string; weg: string }): string {
  return HINWEISSCHILD_VORLAGE.replace('{{kanaele}}', o.kanaele).replace('{{verantwortlicher}}', o.verantwortlicher).replace('{{weg}}', o.weg);
}
