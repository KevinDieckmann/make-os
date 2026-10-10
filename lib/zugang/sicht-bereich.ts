// ─── Sicht Privat · Business an der Anfrage — die EINE Regel (10.10., Branch `sweep-bereiche`) ─────────────────────────────────────
// Entscheidung 10.10.: „Business-Themen sind Business-Themen und Privat Privat — wir haben im Business-Bereich keinen Bereich, der Familie und
// Partnerschaft heißt. Guck, dass das nicht mehr passiert.“ (rein, Server UND Browser — keine Abhängigkeiten)
//
//   · Die Oberfläche schickt den Bereich des Kopf-Schalters als `?space=privat|business` (bzw. die Seite ihren eigenen Bereich).
//   · Routen, die NUR einem Bereich dienen (Familie, Gesundheit, Haushalt … bzw. Markttraktion, Business-Index …), stehen hier in
//     `ROUTEN_BEREICH`: mit `?space=` des ANDEREN Bereichs antwortet die Middleware 403 (`sichtFremd`), bevor die Route läuft — eine Karte
//     der Business-Sicht bekommt so nie Familie oder Gesundheit, auch nicht aus Versehen.
//   · Routen mit Inhalten beider Bereiche (Aufgaben, Planung, Kalender, Glocke, Inbox, Zeit …) filtern mit `?space=` SELBST (je Bereich die
//     vorhandene Filterstelle: `spaceVonAufgabe`, `wirksamerSpace`, `meilensteinSpace`, `imBereich` …); ohne `?space=` wie bisher (globale
//     Zustände im Browser, z. B. TasksContext, brauchen den ganzen Bestand für den Schreibweg mit Stand je Zeile).
// Konten „nur Business“ (`finanzRecht: 'business'`) filtert weiter die Konto-Sicht (lib/zugang/konto-sicht.ts) — unabhängig von `?space=`.
// Wächter: tests/sicht-business-privat.test.ts — ALLE lesenden Routen aus dem Routen-Register mit `?space=business` bzw. `?space=privat`
// (neue Routen und Bestände fallen automatisch darunter).

export type Sicht = 'privat' | 'business';

/** `?space=` → Sicht; fehlt bzw. das alte „alles“ → null (wie bisher: alles); alles andere → undefined (die Route darf 400 antworten). */
export function sichtAus(v: string | null | undefined): Sicht | null | undefined {
  if (!v || v === 'alles' || v === 'alle') return null;
  return v === 'privat' || v === 'business' ? v : undefined;
}

/** Die Sicht einer Anfrage aus `?space=` (ungültig → null: die Middleware sperrt dann nichts, die Route entscheidet selbst). */
export function sichtDerAnfrage(req: Request | URL | URLSearchParams | string): Sicht | null {
  const q = req instanceof URLSearchParams ? req : new URL(typeof req === 'string' ? req : req instanceof URL ? req.href : req.url, 'http://x').searchParams;
  return sichtAus(q.get('space')) ?? null;
}

/**
 * Routen (Pfad unter `/api`, ohne Schrägstrich am Ende), die NUR einem Bereich dienen. Ein Eintrag gilt für sich und alles darunter
 * (`crm` → `crm/bestand`, `crm/lead` …). Eine neue Route, die nur Privates bzw. nur Business liefert: hier eintragen — oder mit
 * `?space=` selbst filtern (der Wächter verlangt eins von beiden).
 */
export const ROUTEN_BEREICH: Readonly<Record<string, Sicht>> = {
  // Privat: Familie & Partnerschaft, Gesundheit (Art. 9), Haushalt, Privat-Index, Ernährung, Sport, WHOOP. (Der Wachstums-Score `performance` filtert
  // selbst je Sicht — `?sicht=`, lib/fokus/wirkung.ts.)
  'familie': 'privat',
  'gesundheit': 'privat',
  'haushalt': 'privat',
  'privat': 'privat',
  'ernaehrung': 'privat',
  'sport': 'privat',
  'whoop': 'privat',
  'import/whoop': 'privat',
  'state/vitals': 'privat',
  'state/health': 'privat',
  'state/journal': 'privat',
  'state/ernaehrung': 'privat',
  'state/rituale': 'privat',
  'state/streak': 'privat',
  'state/haut': 'privat',
  // Business: Markttraktion (CRM, Heads, Netzwerken), Business-Index, Unternehmen, Kapazität (Arbeit), Prospecting.
  'crm': 'business',
  'heads': 'business',
  'netzwerken': 'business',
  'business': 'business',
  'gesellschaften': 'business',
  'aufgaben/crm': 'business',
  'prospecting': 'business',
  'controlling': 'business',
  // Fulfillment (10.10.): Vorlagen, Fälle, Kunden-Link intern, Dossiers, Personenteil — und der öffentliche Kunden-Link (Mandate sind Business).
  'fulfillment': 'business',
  'kunde': 'business',
};

/** Normalisiert `/api/x/y/` bzw. `x/y` zu `x/y`. */
const pfadUnterApi = (pfad: string): string => pfad.replace(/^\/?api\//, '').replace(/^\/+|\/+$/g, '');

/** Der Bereich einer Route (Präfix-Treffer, der längste gewinnt) — oder null (Route mit Inhalten beider Bereiche bzw. neutral). */
export function routenBereich(pfad: string): Sicht | null {
  const p = pfadUnterApi(pfad);
  let best: string | null = null;
  for (const k of Object.keys(ROUTEN_BEREICH)) if ((p === k || p.startsWith(`${k}/`)) && (!best || k.length > best.length)) best = k;
  return best ? ROUTEN_BEREICH[best] : null;
}

/** Gehört die Route zum ANDEREN Bereich als die Sicht der Anfrage? (Middleware → 403.) */
export function sichtFremd(pfad: string, sicht: Sicht | null | undefined): boolean {
  if (!sicht) return false;
  const b = routenBereich(pfad);
  return !!b && b !== sicht;
}

export const SICHT_NAME: Record<Sicht, string> = { privat: 'Privat', business: 'Business' };
/** Antworttext der Sperre — sagt nur den Bereich, nie einen Inhalt. */
export const sichtFremdText = (sicht: Sicht): string =>
  `Gehört nicht zur Sicht ${SICHT_NAME[sicht]} — ${sicht === 'business' ? 'Privates' : 'Business-Themen'} zeigt diese Sicht nicht.`;
