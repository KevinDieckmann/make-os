// ─── Kalender — WebDAV-Antworten lesen (rein, getestet) ─────────────────────
// iCloud antwortet auf PROPFIND/REPORT mit „multistatus“-XML. Wir brauchen
// daraus wenige, feste Felder (href, etag, Name, Farbe, ctag, Kalenderdaten).
// Bewusst ohne XML-Bibliothek: die Form ist eng, die Präfixe wechseln
// (d:, D:, ohne) — die Muster hier nehmen jedes Präfix und keins.

export interface DavAntwort {
  href: string;
  /** Eigenschaften aus dem propstat mit Status 200 — Rohtext (XML-Inhalt). */
  props: Record<string, string>;
}

const P = '(?:[A-Za-z][\\w.-]*:)?';

function entschluesseln(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, x: string) => x)
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Alle Vorkommen eines Elements (beliebiges Präfix) — Inhalt roh. */
function elemente(xml: string, name: string): string[] {
  const re = new RegExp(`<${P}${name}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${P}${name}\\s*>)`, 'g');
  const raus: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) raus.push(m[1] ?? '');
  return raus;
}

/** Text eines Elements (erstes Vorkommen), entschlüsselt und getrimmt. */
export function text(xml: string, name: string): string | undefined {
  const e = elemente(xml, name)[0];
  return e === undefined ? undefined : entschluesseln(e).trim();
}

/** Die Antworten eines multistatus — je href die Eigenschaften, die es gibt (200). */
export function antworten(xml: string, felder: string[]): DavAntwort[] {
  const raus: DavAntwort[] = [];
  for (const block of elemente(xml, 'response')) {
    const href = text(block, 'href');
    if (!href) continue;
    const props: Record<string, string> = {};
    const stats = elemente(block, 'propstat');
    for (const st of stats.length ? stats : [block]) {
      const status = text(st, 'status');
      if (status && !/\s2\d\d\s/.test(` ${status} `)) continue;
      const prop = elemente(st, 'prop')[0] ?? st;
      for (const f of felder) {
        if (props[f] !== undefined) continue;
        const roh = elemente(prop, f)[0];
        if (roh !== undefined) props[f] = f === 'calendar-data' ? entschluesseln(roh) : roh;
      }
    }
    raus.push({ href: decodeURI(href), props });
  }
  return raus;
}

/** Ist die Sammlung ein Kalender (und kein Postfach, keine Erinnerungsliste)? */
export function istTerminKalender(props: Record<string, string>): boolean {
  const art = props.resourcetype ?? '';
  if (!new RegExp(`<${P}calendar[\\s/>]`).test(art)) return false;
  const comps = props['supported-calendar-component-set'];
  // Ohne Angabe gilt: alles erlaubt. Sonst muss VEVENT dabei sein.
  return !comps || /name\s*=\s*["']VEVENT["']/i.test(comps);
}

/** Eine href relativ zum Server → volle Adresse (nur iCloud). */
export function adresse(basis: string, href: string): string {
  return new URL(href, basis).toString();
}

export const etagSauber = (e?: string) => (e ? entschluesseln(e).trim() : undefined);

/** Rohinhalt einer Eigenschaft als Klartext (Entitäten aufgelöst). */
export const klartext = (roh?: string) => (roh === undefined ? undefined : entschluesseln(roh).trim());
