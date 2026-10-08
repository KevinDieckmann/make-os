// ─── KI-VO Art. 50: KI-erzeugte Inhalte erkennbar machen (05.10.) ───────────────────────────────────────────────────
// Wo ein Text von ZOE stammt und an Dritte gehen KANN (Mail-Antworten, Ansprachen, LinkedIn-/Content-Entwürfe, ZOE-
// Antworten), trägt die Antwort der Route ein maschinenlesbares Kennzeichen `ki` und die Oberfläche eine dezente Marke
// („KI-Entwurf“, components/os/KiMarke.tsx). Versendet wird ohnehin nur nach Prüfung durch einen Menschen (Human-in-the-
// Loop, Eiserne Regel 3) — Art. 50 Abs. 4 UAbs. 2 nimmt menschlich geprüfte/redigierte Texte aus; die Marke erinnert
// genau daran. Rein, ohne Abhängigkeiten (außer dem reinen Anbieter-Katalog).
// Seit 09.10. (Paket 6a, Anbieter-Tor) nennt das Kennzeichen den tatsächlichen Anbieter (askText liefert `anbieter`), nicht mehr fest
// „Anthropic“. Ohne Angabe: Anthropic direkt — der Weg, den askText ohne Anbieter-Tor nimmt.

import { anbieterVon, istAnbieterId, type AnbieterId } from '@/lib/ki/anbieter';

export interface KiKennzeichen {
  /** Immer true — der Text ist (ganz oder teilweise) von einem KI-System erzeugt. */
  erzeugt: true;
  /** Wer: ZOE (Modell eines Drittanbieters). */
  durch: string;
  /** Kurzer Hinweis für die Oberfläche. */
  hinweis: string;
  /** Wann (ISO). */
  zeit: string;
  /** Zugang und Modell (seit 09.10., maschinenlesbar). */
  anbieter?: AnbieterId;
  modell?: string;
}

export const KI_HINWEIS = 'KI-Entwurf — vor dem Weitergeben prüfen und anpassen';

/** Kurzname des Modell-Anbieters für „ZOE (KI-Modell von …)“. */
export const ANBIETER_KURZ: Record<AnbieterId, string> = {
  anthropic: 'Anthropic',
  'anthropic-vertex-eu': 'Anthropic über Google Vertex (EU)',
  'google-vertex': 'Google (Gemini)',
  mistral: 'Mistral',
};

/**
 * Das Kennzeichen. Alt: `kiKennzeichen()` bzw. `kiKennzeichen(new Date())`; neu: `kiKennzeichen({ anbieter, modell })` mit dem Anbieter aus
 * der Antwort von askText: `r.anbieter`.
 */
export function kiKennzeichen(opt: Date | { anbieter?: string; modell?: string; jetzt?: Date } = {}): KiKennzeichen {
  const o = opt instanceof Date ? { jetzt: opt } : opt;
  const anbieter: AnbieterId = istAnbieterId(o.anbieter) ? o.anbieter : 'anthropic';
  const modell = typeof o.modell === 'string' && /^[a-z0-9][a-z0-9.@-]{1,60}$/.test(o.modell) ? o.modell : undefined;
  return {
    erzeugt: true, durch: `ZOE (KI-Modell von ${ANBIETER_KURZ[anbieter] ?? anbieterVon(anbieter).name})`, hinweis: KI_HINWEIS, zeit: (o.jetzt ?? new Date()).toISOString(),
    anbieter, ...(modell ? { modell } : {}),
  };
}
