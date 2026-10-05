// ─── Pseudonymisierung in automatischen Läufen (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────────────────────
// Automatische Läufe (Takt) brauchen selten zu wissen, WER ein Kontakt ist — nur, dass es derselbe ist. Deshalb ersetzt
// `askText` in Hintergrund-Läufen die Namen und Adressen der CRM-Kontakte durch Platzhalter, bevor der Prompt das Haus
// verlässt, und übersetzt die Antwort lokal zurück:
//
//   „Anna Beispiel“ / „Beispiel, Anna“ → [K17]      anna@example.invalid → [K17-mail]
//
// Die Nummer hängt an der Stelle des Kontakts in der nach Kennung sortierten Kartei — innerhalb eines Laufs (auch über
// mehrere Runden einer Werkzeug-Schleife) also stabil; die Zuordnung verlässt nie den Server.
// Grenzen (ehrlich): ersetzt werden nur Namen, die als Kontakt in der Kartei stehen, und nur vollständig (Vor- UND
// Nachname bzw. die Adresse). Ein Name, der nur im Freitext einer Notiz steht und keinem Kontakt gehört, bleibt stehen.
// Rein, ohne Abhängigkeiten — getestet in tests/ki-datenschutz.test.ts.

export interface PseudoPerson { id: string; vorname?: string; nachname?: string; email?: string }

const ZEICHEN = '\\p{L}\\p{N}';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

export interface Pseudonymisierer {
  /** Text → Text mit Platzhaltern. */
  ersetze(text: string): string;
  /** Platzhalter → echte Namen/Adressen. */
  zurueck(text: string): string;
  /** Tiefe Kopie mit ersetzten Texten (Nachrichten-Listen der API) — Schlüssel wie type/id/name bleiben unberührt. */
  tiefErsetzen<T>(wert: T): T;
  tiefZurueck<T>(wert: T): T;
  /** Wie viele verschiedene Personen bisher ersetzt wurden. */
  ersetzt(): number;
}

/** Felder, die nie Personentext tragen (Blocktypen, Kennungen, Bilder). „name“ wird bewusst ersetzt: Werkzeug-Namen
 *  (snake_case) treffen nie einen vollen Personennamen, Werkzeug-Eingaben mit einem Feld „name“ aber schon. */
const UNBERUEHRT = new Set(['type', 'id', 'tool_use_id', 'cache_control', 'media_type', 'data', 'role']);

export function pseudonymisierer(personen: readonly PseudoPerson[]): Pseudonymisierer {
  const sortiert = [...personen].filter(p => p && typeof p.id === 'string').sort((a, b) => a.id.localeCompare(b.id));
  // Begriff (klein) → Platzhalter; Platzhalter → echter Text.
  const begriffe: { muster: string; ziel: string }[] = [];
  const zurueckTab = new Map<string, string>();
  sortiert.forEach((p, i) => {
    const k = `K${i + 1}`;
    const vn = norm(p.vorname ?? ''), nn = norm(p.nachname ?? '');
    if (vn.length >= 2 && nn.length >= 2) {
      const voll = `${vn} ${nn}`;
      begriffe.push({ muster: voll, ziel: `[${k}]` }, { muster: `${nn}, ${vn}`, ziel: `[${k}]` });
      zurueckTab.set(`[${k}]`, voll);
    }
    const mail = norm(p.email ?? '').toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { begriffe.push({ muster: mail, ziel: `[${k}-mail]` }); zurueckTab.set(`[${k}-mail]`, mail); }
  });
  // Längste zuerst, damit „Anna Maria Beispiel“ vor „Maria Beispiel“ greift.
  begriffe.sort((a, b) => b.muster.length - a.muster.length);
  const tab = new Map(begriffe.map(b => [b.muster.toLocaleLowerCase('de-DE'), b.ziel]));
  const re = begriffe.length
    ? new RegExp(`(?<![${ZEICHEN}@.])(?:${begriffe.map(b => escape(b.muster).replace(/ /g, '\\s+')).join('|')})(?![${ZEICHEN}@])`, 'giu')
    : null;
  const benutzt = new Set<string>();
  const ersetze = (text: string): string => {
    if (!re || !text) return text;
    return text.replace(re, treffer => {
      const ziel = tab.get(norm(treffer).toLocaleLowerCase('de-DE'));
      if (!ziel) return treffer;
      benutzt.add(ziel.replace(/-mail\]$/, ']'));
      return ziel;
    });
  };
  const zurueck = (text: string): string => (text ? text.replace(/\[K\d+(?:-mail)?\]/g, t => zurueckTab.get(t) ?? t) : text);
  // Zurück übersetzt wird überall (auch Werkzeug-Eingaben mit einem Feld „name“) — Platzhalter schreibt nur das Modell.
  const tief = (f: (s: string) => string, auslassen: ReadonlySet<string>) => {
    const lauf = (v: unknown, schluessel?: string): unknown => {
      if (typeof v === 'string') return schluessel && auslassen.has(schluessel) ? v : f(v);
      if (Array.isArray(v)) return v.map(x => lauf(x));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, lauf(x, k)]));
      return v;
    };
    return <T,>(w: T): T => lauf(w) as T;
  };
  return { ersetze, zurueck, tiefErsetzen: tief(ersetze, UNBERUEHRT), tiefZurueck: tief(zurueck, new Set(['data'])), ersetzt: () => benutzt.size };
}
