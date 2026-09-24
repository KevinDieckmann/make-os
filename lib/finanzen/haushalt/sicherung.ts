// ─── Sicherung im Format von Malins Cockpit ─────────────────────────────────
// Hin (Export) und zurück (Umzug). Malins Format: Beträge in Euro, Tabellen-
// namen wie in Supabase (zuordnungsregeln statt regeln), kein `stand`.

import type { Haushalt } from './typen';

const euro = (c: number | null | undefined) => (c === null || c === undefined ? null : Math.round(c) / 100);

export function alsMalinFormat(h: Haushalt) {
  const ohne = <T extends { stand?: number }>(x: T) => { const { stand: _s, ...rest } = x; return rest; };
  return {
    _typ: 'make-orga-sicherung', _version: 1, _erstellt: new Date().toISOString(), _quelle: 'MAKE OS',
    konten: h.stamm.konten.map(ohne),
    kategorien: h.stamm.kategorien.map(k => ({ ...ohne(k), monatsbudget: euro(k.monatsbudget) })),
    zuordnungsregeln: h.stamm.regeln.map(ohne),
    schulden: h.schulden.map(s => ({ ...ohne(s), startbetrag: euro(s.startbetrag), restbetrag: euro(s.restbetrag), rate: euro(s.rate) })),
    planwerte: h.planwerte.map(p => ({ ...ohne(p), sollwert: euro(p.sollwert) })),
    belege: h.belege.map(b => ({ ...ohne(b), betrag: euro(b.betrag) })),
    buchungen: h.buchungen.map(b => { const { stand: _s, geaendert: _g, ...rest } = b; return { ...rest, betrag: euro(b.betrag), updated_at: b.geaendert }; }),
  };
}
