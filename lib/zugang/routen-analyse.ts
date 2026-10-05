// ─── MAKE OS — Welche Prüfung ruft eine Route? (statische Analyse, 05.10.) ────
// Rein (nur Text rein, Text raus): liest den Quelltext einer `app/api/**/route.ts` und ermittelt je exportierter
// Methode (GET, POST, …), welche Tor-Funktionen sie aufruft — direkt im Rumpf oder über eine Hilfsfunktion derselben
// Datei (beliebig tief, z. B. `async function zugang(req)` oben in der Datei). Genutzt vom Wächtertest
// tests/routen-register.test.ts gegen das Routen-Register (lib/zugang/routen-register.ts).
//
// Bewusst schlicht (Textmuster statt Parser): Funktionen auf oberster Ebene beginnen am Zeilenanfang
// (`export async function GET(`, `async function zugang(`, `const zugang = async (`); ihr Rumpf reicht bis zur
// nächsten Deklaration auf oberster Ebene. Kommentare werden vorher entfernt — ein Tor-Name im Kommentar zählt nie.

export const METHODEN = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type Methode = typeof METHODEN[number];

/**
 * Kommentare entfernen (Block und Zeile); `'//'` in einer URL wird nicht abgeschnitten. `texteLeeren`: zusätzlich den
 * Inhalt von '…'- und "…"-Zeichenketten durch Leerzeichen ersetzen (ein Tor-Name in einem Text ist kein Aufruf).
 * Vorlagen (`…${x}…`) bleiben stehen — in ihnen können echte Aufrufe stecken.
 */
export function ohneKommentare(q: string, texteLeeren = false): string {
  let aus = '';
  let i = 0;
  let inStr: string | null = null;
  while (i < q.length) {
    const c = q[i], n = q[i + 1];
    if (inStr) {
      const leeren = texteLeeren && inStr !== '`' && c !== inStr && c !== '\n';
      if (c === '\\') { aus += leeren ? '  ' : c + (n ?? ''); i += 2; continue; }
      aus += leeren ? ' ' : c;
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; aus += c; i++; continue; }
    if (c === '/' && n === '*') { const e = q.indexOf('*/', i + 2); i = e < 0 ? q.length : e + 2; continue; }
    if (c === '/' && n === '/') { const e = q.indexOf('\n', i); i = e < 0 ? q.length : e; continue; }
    // Regex-Literal grob überspringen (nach ( , = : [ ! & | ? ; { } oder Zeilenanfang) — sonst hielte /'/ einen String offen.
    if (c === '/') {
      const vor = aus.replace(/\s+$/, '').slice(-1);
      if (!vor || '(,=:[!&|?;{}'.includes(vor)) {
        let j = i + 1, klasse = false;
        while (j < q.length && q[j] !== '\n') {
          if (q[j] === '\\') { j += 2; continue; }
          if (q[j] === '[') klasse = true; else if (q[j] === ']') klasse = false;
          else if (q[j] === '/' && !klasse) break;
          j++;
        }
        if (q[j] === '/') { aus += q.slice(i, j + 1); i = j + 1; continue; }
      }
    }
    aus += c; i++;
  }
  return aus;
}

const DEKL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>)/;

/** Funktionen auf oberster Ebene: Name → Rumpf (Text bis zur nächsten Deklaration). */
export function funktionen(quelle: string): Map<string, string> {
  const zeilen = ohneKommentare(quelle, true).split('\n');
  const starts: { name: string; zeile: number }[] = [];
  zeilen.forEach((z, i) => {
    const m = DEKL.exec(z);
    if (m) starts.push({ name: m[1] ?? m[2], zeile: i });
    else if (/^(?:export\s+)?(?:const|let|interface|type|class|enum|import)\b/.test(z)) starts.push({ name: '', zeile: i });
  });
  const aus = new Map<string, string>();
  starts.forEach((s, k) => {
    if (!s.name) return;
    const ende = k + 1 < starts.length ? starts[k + 1].zeile : zeilen.length;
    aus.set(s.name, (aus.get(s.name) ?? '') + zeilen.slice(s.zeile, ende).join('\n'));
  });
  return aus;
}

/** Exportierte Methoden — auch `export const GET = weiter;` (Verweis auf eine Funktion der Datei). */
export function exportierteMethoden(quelle: string): Map<Methode, string> {
  const q = ohneKommentare(quelle, true);
  const aus = new Map<Methode, string>();
  for (const m of METHODEN) {
    if (new RegExp(`(^|\\n)export\\s+(async\\s+)?function\\s+${m}\\s*\\(`).test(q)) aus.set(m, m);
    const alias = new RegExp(`export\\s+const\\s+${m}\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*;`).exec(q);
    if (alias) aus.set(m, alias[1]);
  }
  return aus;
}

/** Ruft der Text `name(…)` bzw. `name<T>(…)` auf (nicht `x.name(`, nicht `anderername(`)? */
const ruft = (rumpf: string, name: string) => new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}\\s*(<[^()]*>)?\\s*\\(`).test(rumpf);

/**
 * Je Methode: welche der genannten Tor-Funktionen werden (transitiv über Funktionen derselben Datei) aufgerufen?
 * `tore` = Namen, nach denen gesucht wird (Standard-Tore plus eigene Prüfungen aus dem Register).
 */
export function torAufrufe(quelle: string, tore: readonly string[]): Map<Methode, Set<string>> {
  const fn = funktionen(quelle);
  const memo = new Map<string, Set<string>>();
  const besuch = (name: string, pfad: Set<string>): Set<string> => {
    const fertig = memo.get(name); if (fertig) return fertig;
    const rumpf = fn.get(name); const treffer = new Set<string>();
    if (!rumpf || pfad.has(name)) return treffer;
    const weiter = new Set(pfad).add(name);
    // Den eigenen Kopf („function zugang(“) nicht als Aufruf zählen.
    const ohneKopf = rumpf.replace(DEKL, '');
    for (const t of tore) if (ruft(ohneKopf, t)) treffer.add(t);
    for (const andere of fn.keys()) if (andere !== name && ruft(ohneKopf, andere)) for (const t of besuch(andere, weiter)) treffer.add(t);
    memo.set(name, treffer);
    return treffer;
  };
  const aus = new Map<Methode, Set<string>>();
  for (const [m, ziel] of exportierteMethoden(quelle)) aus.set(m, besuch(ziel, new Set()));
  return aus;
}
