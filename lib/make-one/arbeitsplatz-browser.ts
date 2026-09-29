// ─── MAKE OS — Arbeitsplatz im Browser ──────────────────────────────────────
// Seit 23.09. gibt es keinen Personen-Schalter mehr: wer da ist, steht in der
// Sitzung. Der Server legt beim Anmelden ein lesbares Cookie (make-os-wer) ab,
// damit der Browser den Namen kennt, ohne erst zu fragen. Der Modus
// (alles · business · privat) bleibt eine Sache dieses Rechners.

export type Person = string;
export type ModusWahl = 'alles' | 'business' | 'privat';

const M = 'make-os-modus';

export function personLesen(): Person {
  try {
    const t = /(?:^|;\s*)make-os-wer=([^;]*)/.exec(document.cookie);
    return t ? decodeURIComponent(t[1]) : '';
  } catch { return ''; }
}

/**
 * Steht der Browser auf der Anmeldeseite oder einer öffentlichen Seite (Buchungsseite `/buchen/…`, 29.09. K4)? Dort
 * fragen die Kontexte nichts ab — ohne Sitzung gäbe es nur 401, und eine Seite für Gäste lädt nie Daten des Haushalts.
 */
export function aufAnmeldeseite(): boolean {
  try { const p = window.location.pathname; return p === '/anmelden' || p.startsWith('/anmelden/') || p.startsWith('/buchen/'); } catch { return false; }
}

/** Angemeldet aus Sicht des Browsers: Namens-Zettel da und nicht auf der Anmeldeseite — erst dann abfragen. */
export function angemeldetImBrowser(): boolean {
  return !!personLesen() && !aufAnmeldeseite();
}

/** Den lesbaren Namens-Zettel vergessen (die Sitzung ist nicht mehr gültig — der Server antwortete 401). */
export function werVergessen(): void {
  try { document.cookie = 'make-os-wer=; Max-Age=0; path=/'; } catch { /* egal */ }
}

/** @deprecated Seit 23.09. setzt der Login die Person. Bleibt als Leerlauf, bis alle Aufrufer weg sind. */
export function personSpiegeln(_person?: Person): void { /* nichts mehr zu spiegeln */ }

export function modusLesen(): ModusWahl {
  try {
    const m = localStorage.getItem(M);
    return m === 'business' || m === 'privat' ? m : 'alles';
  } catch { return 'alles'; }
}

/**
 * Auf Wechsel horchen — die Seitenleiste ruft das Ereignis aus, damit Gruß,
 * Zurufe und Mitschrift sofort mitziehen, ohne dass die Seite neu lädt.
 */
export function beiWechsel(fn: (d: { person: Person; modus: ModusWahl }) => void): () => void {
  const h = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {};
    fn({ person: d.person ?? personLesen(), modus: d.modus ?? modusLesen() });
  };
  window.addEventListener('make-os-arbeitsplatz', h);
  return () => window.removeEventListener('make-os-arbeitsplatz', h);
}
