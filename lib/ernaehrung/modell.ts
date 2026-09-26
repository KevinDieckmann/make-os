// ─── MAKE OS — Ernährung & Einkauf zu zweit: das Modell (rein, getestet) ─────
// Kevin (26.09.): „Lebensmittel bevorzugt nehmen, meine Bedürfnisse und
// Malins, was wir zuhause haben soll benutzt werden, und an jedem Gericht die
// Zubereitung.“ Entscheidungen: ihr zwei + Gäste/Kinder später, jeder pflegt
// sein Profil selbst, Lieferdienst (Warenkorb-Text), Vorlieben als
// Lebensmittel + Qualitätshinweis.
//
// Eine Datei (`ernaehrung`, Haushalt des Inhabers):
//   profile      — je Person (Konto oder Gast): Bedürfnisse, Unverträgliches, nie, gern, Ziel
//   lebensmittel — die Stammliste: was ihr bevorzugt nehmt („Haferflocken · Bio, grob“)
//   vorrat       — was gerade zuhause ist (Jarvis plant damit, die Liste lässt es weg)
//   gerichte     — Rezepte: Zutaten, Zubereitung, Dauer, Portionen, für wen
//   plan         — 7 Tage × 3 Mahlzeiten (Text) + planGerichte (Verweis aufs Rezept)
//   einkauf      — die Liste: Menge, Kategorie, für wen, von wem, Quelle
// Alles hier ist reine Logik ohne Speicherzugriff.

export type Tag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';
export interface Mahlzeiten { fruehstueck: string; mittag: string; abend: string }
export type Mahlzeit = keyof Mahlzeiten;
export const TAGE: Tag[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];
export const TAG_LABEL: Record<Tag, string> = { mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag', fr: 'Freitag', sa: 'Samstag', so: 'Sonntag' };
export const MAHLZEITEN: { k: Mahlzeit; label: string }[] = [{ k: 'fruehstueck', label: 'Früh' }, { k: 'mittag', label: 'Mittag' }, { k: 'abend', label: 'Abend' }];

export type Kategorie = 'obst-gemuese' | 'frische' | 'vorrat' | 'tiefkuehl' | 'getraenke' | 'haushalt' | 'sonst';
/** Reihenfolge = Laufweg im Laden bzw. Blöcke im Warenkorb. */
export const KATEGORIEN: { id: Kategorie; label: string }[] = [
  { id: 'obst-gemuese', label: 'Obst & Gemüse' },
  { id: 'frische', label: 'Frische (Milch, Eier, Fisch, Fleisch)' },
  { id: 'vorrat', label: 'Vorrat (trocken, Konserven, Öle)' },
  { id: 'tiefkuehl', label: 'Tiefkühl' },
  { id: 'getraenke', label: 'Getränke' },
  { id: 'haushalt', label: 'Haushalt' },
  { id: 'sonst', label: 'Sonstiges' },
];
export const KATEGORIE_LABEL: Record<Kategorie, string> = Object.fromEntries(KATEGORIEN.map(k => [k.id, k.label])) as Record<Kategorie, string>;

export interface Profil {
  /** speicher-Name des Kontos oder eine Gast-Kennung (`gast-…`). */
  person: string;
  name: string;
  /** Bedürfnisse und Regeln in eigenen Worten („anti-entzündlich, wenig Zucker, abends leicht“). */
  bedarf: string;
  unvertraeglich: string[];
  nie: string[];
  gern: string[];
  ziel: string;
  /** true = echtes Konto (pflegt nur die Person selbst), false = Gast/Kind (pflegt der Haushalt). */
  konto: boolean;
  stand: string;
}
export interface Lebensmittel { id: string; name: string; hinweis: string; kategorie: Kategorie; menge: string; bevorzugt: boolean; von: string }
export interface VorratPosten { id: string; name: string; menge: string; kategorie: Kategorie; seit: string; von: string }
export type Quelle = 'plan' | 'hand' | 'jarvis' | 'rezept' | 'stamm';
export interface EinkaufPosten { id: string; text: string; erledigt: boolean; menge?: string; kategorie?: Kategorie; fuer?: string[]; von?: string; quelle?: Quelle }
export interface Zutat { name: string; menge: string }
export interface Gericht {
  id: string; name: string; zutaten: Zutat[]; zubereitung: string[]; dauerMin: number | null; portionen: number;
  fuer: string[]; tags: string[]; quelle: 'jarvis' | 'hand'; angelegt: string;
  /** Lieblingsgericht — Jarvis plant es gern wieder ein, steht oben in „Unsere Gerichte“. */
  favorit: boolean;
  /** Eigene Notiz („Malin mag es ohne Feta“, „Reste am nächsten Tag“). */
  notiz: string;
  /** Foto (Dateiname unter .data/bilder-gerichte, vergeben von /api/ernaehrung/bild) — leer = keins. */
  bild: string;
}
export type PlanGerichte = Partial<Record<Tag, Partial<Record<Mahlzeit, string>>>>;

export interface ErnaehrungFile {
  grundsaetze: string;
  plan: Record<Tag, Mahlzeiten>;
  planGerichte: PlanGerichte;
  einkauf: EinkaufPosten[];
  profile: Profil[];
  lebensmittel: Lebensmittel[];
  vorrat: VorratPosten[];
  gerichte: Gericht[];
}

export const LISTEN = ['einkauf', 'profile', 'lebensmittel', 'vorrat', 'gerichte'] as const;
export type Liste = typeof LISTEN[number];

// ── Säubern (auch die Datei von vor dem 26.09.: Grundsätze + Plan + einkauf[text]) ──

const s = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n);
const liste = (v: unknown, n = 40, laenge = 60): string[] => (Array.isArray(v) ? v.map(x => s(x, laenge)).filter(Boolean).slice(0, n) : []);
const kat = (v: unknown): Kategorie => (KATEGORIEN.some(k => k.id === v) ? (v as Kategorie) : 'sonst');
export const neueId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function sauberDatei(f: Partial<ErnaehrungFile> | null, jetzt = new Date().toISOString()): ErnaehrungFile {
  const plan = {} as Record<Tag, Mahlzeiten>;
  for (const t of TAGE) {
    const m = f?.plan?.[t];
    plan[t] = { fruehstueck: s(m?.fruehstueck, 200), mittag: s(m?.mittag, 200), abend: s(m?.abend, 200) };
  }
  const planGerichte: PlanGerichte = {};
  for (const t of TAGE) {
    const m = f?.planGerichte?.[t];
    if (m && typeof m === 'object') {
      const e: Partial<Record<Mahlzeit, string>> = {};
      for (const k of MAHLZEITEN) if (s(m[k.k], 40)) e[k.k] = s(m[k.k], 40);
      if (Object.keys(e).length) planGerichte[t] = e;
    }
  }
  return {
    grundsaetze: s(f?.grundsaetze, 2000),
    plan, planGerichte,
    einkauf: (Array.isArray(f?.einkauf) ? f!.einkauf : []).slice(0, 200).map(p => ({
      id: s(p?.id, 40) || neueId('e'), text: s(p?.text, 120), erledigt: p?.erledigt === true,
      ...(s(p?.menge, 30) ? { menge: s(p?.menge, 30) } : {}),
      ...(p?.kategorie ? { kategorie: kat(p.kategorie) } : {}),
      ...(Array.isArray(p?.fuer) && p!.fuer!.length ? { fuer: liste(p!.fuer, 8, 40) } : {}),
      ...(s(p?.von, 40) ? { von: s(p?.von, 40) } : {}),
      ...(p?.quelle && ['plan', 'hand', 'jarvis', 'rezept', 'stamm'].includes(p.quelle) ? { quelle: p.quelle } : {}),
    })).filter(p => p.text),
    profile: (Array.isArray(f?.profile) ? f!.profile : []).slice(0, 12).map(p => ({
      person: s(p?.person, 40), name: s(p?.name, 60), bedarf: s(p?.bedarf, 1200),
      unvertraeglich: liste(p?.unvertraeglich), nie: liste(p?.nie), gern: liste(p?.gern), ziel: s(p?.ziel, 300),
      konto: p?.konto !== false, stand: s(p?.stand, 30) || jetzt,
    })).filter(p => /^[a-z0-9-]{1,40}$/.test(p.person)),
    lebensmittel: (Array.isArray(f?.lebensmittel) ? f!.lebensmittel : []).slice(0, 300).map(l => ({
      id: s(l?.id, 40) || neueId('l'), name: s(l?.name, 80), hinweis: s(l?.hinweis, 80), kategorie: kat(l?.kategorie),
      menge: s(l?.menge, 30), bevorzugt: l?.bevorzugt !== false, von: s(l?.von, 40),
    })).filter(l => l.name),
    vorrat: (Array.isArray(f?.vorrat) ? f!.vorrat : []).slice(0, 300).map(v => ({
      id: s(v?.id, 40) || neueId('v'), name: s(v?.name, 80), menge: s(v?.menge, 30), kategorie: kat(v?.kategorie),
      seit: s(v?.seit, 30) || jetzt, von: s(v?.von, 40),
    })).filter(v => v.name),
    gerichte: (Array.isArray(f?.gerichte) ? f!.gerichte : []).slice(0, 200).map(g => ({
      id: s(g?.id, 40) || neueId('g'), name: s(g?.name, 120),
      zutaten: (Array.isArray(g?.zutaten) ? g!.zutaten : []).slice(0, 40).map(z => ({ name: s(z?.name, 80), menge: s(z?.menge, 40) })).filter(z => z.name),
      zubereitung: liste(g?.zubereitung, 20, 400),
      dauerMin: typeof g?.dauerMin === 'number' && isFinite(g.dauerMin) ? Math.max(0, Math.min(600, Math.round(g.dauerMin))) : null,
      portionen: typeof g?.portionen === 'number' && isFinite(g.portionen) ? Math.max(1, Math.min(20, Math.round(g.portionen))) : 2,
      fuer: liste(g?.fuer, 8, 40), tags: liste(g?.tags, 8, 30),
      quelle: (g?.quelle === 'hand' ? 'hand' : 'jarvis') as Gericht['quelle'], angelegt: s(g?.angelegt, 30) || jetzt,
      favorit: g?.favorit === true, notiz: s(g?.notiz, 400), bild: /^[a-f0-9-]{10,60}\.(jpg|png|webp)$/.test(s(g?.bild, 80)) ? s(g?.bild, 80) : '',
    })).filter(g => g.name),
  };
}

// ── Kleine Helfer ──────────────────────────────────────────────────────────────

/** Für Vergleiche: klein, ohne Zusatz in Klammern, ohne Mengen, Umlaute vereinheitlicht. */
export function normal(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[0-9]+\s*(g|kg|ml|l|stück|stk|x|pck|packung|bund|dose|glas)\b/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}
const stamm = (w: string) => w.replace(/(en|er|es|e|n|s)$/g, '');
/** Meint derselbe Name dasselbe Lebensmittel? („Tomaten“ ~ „Tomate“, „Lachs (TK)“ ~ „Lachs“). */
export function gleichesLebensmittel(a: string, b: string): boolean {
  const x = normal(a), y = normal(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const sx = x.split(' ').map(stamm).filter(w => w.length > 2), sy = y.split(' ').map(stamm).filter(w => w.length > 2);
  if (!sx.length || !sy.length) return false;
  // Das erste sinntragende Wort muss passen — „Tomatenmark“ ist keine „Tomate“.
  return sx[0] === sy[0] && (sx.length === 1 || sy.length === 1 || sx.every(w => sy.includes(w)) || sy.every(w => sx.includes(w)));
}

const STICHWORTE: [Kategorie, RegExp][] = [
  ['tiefkuehl', /\b(tk|tiefkühl|gefror)/i],
  ['getraenke', /\b(wasser|saft|tee|kaffee|milchalternativ|hafermilch|mandelmilch|kokoswasser|sprudel|wein|bier|limo)/i],
  ['haushalt', /\b(spülmittel|spuelmittel|müllbeutel|muellbeutel|klopapier|toilettenpapier|küchenrolle|kuechenrolle|waschmittel|zahnpasta|seife|schwamm|folie|backpapier)/i],
  ['frische', /\b(milch|joghurt|joghurt|quark|käse|kaese|feta|mozzarella|butter|sahne|ei|eier|lachs|fisch|thunfisch|forelle|garnele|hähnchen|haehnchen|huhn|pute|rind|hack|schinken|tofu|tempeh|hummus)/i],
  ['obst-gemuese', /\b(tomate|gurke|paprika|zucchini|aubergine|brokkoli|blumenkohl|spinat|salat|rucola|karotte|möhre|moehre|zwiebel|knoblauch|kartoffel|süßkartoffel|suesskartoffel|avocado|apfel|äpfel|aepfel|banane|beere|zitrone|limette|orange|ingwer|kräuter|kraeuter|petersilie|basilikum|pilz|champignon|lauch|sellerie|kohl|kürbis|kuerbis|mango|birne|trauben|obst|gemüse|gemuese)/i],
  ['vorrat', /\b(reis|quinoa|hafer|haferflocken|nudel|pasta|linsen|kichererbsen|bohnen|mehl|öl|oel|olivenöl|olivenoel|essig|nüsse|nuesse|mandel|walnuss|samen|leinsamen|chia|honig|gewürz|gewuerz|salz|pfeffer|kurkuma|zimt|brühe|bruehe|tomatenmark|passata|kokosmilch|konserve|dose|müsli|muesli|brot|knäcke|knaecke|dattel|rosine|kakao|schokolade)/i],
];
/** Kategorie aus dem Namen raten — für Jarvis-Listen und Handeingaben ohne Wahl. */
export function kategorieRaten(name: string): Kategorie {
  for (const [k, re] of STICHWORTE) if (re.test(name)) return k;
  return 'sonst';
}

/** „2x Tomaten“, „500 g Lachs“, „Tomaten 2 Stück“ → Text + Menge. */
export function postenParsen(eingabe: string): { text: string; menge?: string } {
  const roh = eingabe.trim().replace(/\s+/g, ' ');
  let m = /^(\d+(?:[.,]\d+)?\s*(?:x|×|g|kg|ml|l|stück|stk|pck|packung|bund|dose|glas|flasche)?)\s+(.+)$/i.exec(roh);
  if (m && /\d/.test(m[1])) return { text: m[2].trim(), menge: m[1].replace(/\s*x$/i, '×').trim() };
  m = /^(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:x|×|g|kg|ml|l|stück|stk|pck|packung|bund|dose|glas|flasche))$/i.exec(roh);
  if (m) return { text: m[1].trim(), menge: m[2].replace(/\s*x$/i, '×').trim() };
  return { text: roh };
}

export function imVorrat(name: string, vorrat: VorratPosten[]): VorratPosten | undefined {
  return vorrat.find(v => gleichesLebensmittel(v.name, name));
}
export function aufDerListe(name: string, einkauf: EinkaufPosten[]): EinkaufPosten | undefined {
  return einkauf.find(p => !p.erledigt && gleichesLebensmittel(p.text, name));
}

/** Welche Zutaten eines Gerichts fehlen (nicht im Vorrat, nicht schon offen auf der Liste). */
export function fehlendeZutaten(g: Pick<Gericht, 'zutaten'>, vorrat: VorratPosten[], einkauf: EinkaufPosten[]): Zutat[] {
  return g.zutaten.filter(z => !imVorrat(z.name, vorrat) && !aufDerListe(z.name, einkauf));
}

/** Aus einem Namen ein Listen-Posten — bevorzugte Stammprodukte liefern Hinweis und Kategorie. */
export function postenAus(name: string, lebensmittel: Lebensmittel[], extra: Partial<EinkaufPosten> = {}): EinkaufPosten {
  const st = lebensmittel.find(l => gleichesLebensmittel(l.name, name));
  const text = st ? (st.hinweis ? `${st.name} · ${st.hinweis}` : st.name) : name;
  return { id: neueId('e'), text, erledigt: false, kategorie: st?.kategorie ?? kategorieRaten(name), ...(st?.menge && !extra.menge ? { menge: st.menge } : {}), ...extra };
}

/** Die offene Liste als Warenkorb-Text (Lieferdienst): je Kategorie ein Block, je Zeile Menge + Posten. */
export function warenkorbText(einkauf: EinkaufPosten[], datum = new Date()): string {
  const offen = einkauf.filter(p => !p.erledigt);
  const bloecke: string[] = [];
  for (const k of KATEGORIEN) {
    const l = offen.filter(p => (p.kategorie ?? 'sonst') === k.id);
    if (!l.length) continue;
    bloecke.push(`${k.label.replace(/ \(.*\)$/, '')}:\n${l.map(p => `– ${p.menge ? `${p.menge} ` : ''}${p.text}`).join('\n')}`);
  }
  return `Einkauf ${datum.toLocaleDateString('de-DE')} · ${offen.length} Posten\n\n${bloecke.join('\n\n')}`;
}

/** Nach Kategorie gruppiert, Reihenfolge = Laufweg. */
export function gruppiert(einkauf: EinkaufPosten[]): { kategorie: Kategorie; label: string; posten: EinkaufPosten[] }[] {
  return KATEGORIEN.map(k => ({ kategorie: k.id, label: k.label, posten: einkauf.filter(p => (p.kategorie ?? 'sonst') === k.id) })).filter(g => g.posten.length);
}

// ── Änderungen (PATCH): kleine Schritte statt „ganze Datei zurückschreiben“ ────
// Zu zweit am Handy: wer einen Posten abhakt, darf nicht die Änderung des
// anderen überschreiben. Deshalb je Schritt ein Eintrag.

export type Op =
  | { liste: Liste; op: 'upsert'; eintrag: Record<string, unknown> }
  | { liste: Liste; op: 'delete'; id: string }
  | { feld: 'plan'; tag: Tag; mahlzeit: Mahlzeit; wert: string; gerichtId?: string | null }
  | { feld: 'grundsaetze'; wert: string }
  | { feld: 'erledigtWeg' }
  | { feld: 'erledigtInVorrat'; von: string };

// ── Gerichte-Bibliothek (26.09., Kevin: „ein Bereich, wo wir unsere Gerichte abspeichern“) ──

/** Zutaten aus Freitext, eine je Zeile: „200 g Lachs“, „Lachs – 2 Filets“, „Salz: 1 Prise“, „Zitrone“. */
export function zutatenAusText(text: string): Zutat[] {
  return text.split(/\n|;/).map(z => z.trim()).filter(Boolean).slice(0, 40).map(z => {
    const m = /^(.+?)\s*[–—:-]\s*(.+)$/.exec(z);
    if (m && !/^\d/.test(m[1])) return { name: m[1].trim().slice(0, 80), menge: m[2].trim().slice(0, 40) };
    const p = postenParsen(z);
    return { name: p.text.slice(0, 80), menge: (p.menge ?? '').slice(0, 40) };
  }).filter(z => z.name);
}

/** Zubereitung aus Freitext: eine Zeile je Schritt, führende Nummern („1.“, „2)“) fallen weg. */
export function schritteAusText(text: string): string[] {
  return text.split('\n').map(z => z.replace(/^\s*(?:\d+[.)]|[-–•*])\s*/, '').trim()).filter(Boolean).slice(0, 20).map(z => z.slice(0, 400));
}

/** Die Bibliothek durchsuchen (Name, Zutaten, Tags) und ordnen: Lieblinge zuerst, dann die neuesten. */
export function gerichteFiltern(gerichte: Gericht[], suche = '', tag = ''): Gericht[] {
  const q = normal(suche);
  return gerichte
    .filter(g => !tag || g.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
    .filter(g => !q || normal(g.name).includes(q) || g.zutaten.some(z => normal(z.name).includes(q)) || g.tags.some(t => normal(t).includes(q)))
    .slice().sort((a, b) => Number(b.favorit) - Number(a.favorit) || b.angelegt.localeCompare(a.angelegt) || a.name.localeCompare(b.name));
}

/** Die häufigsten Tags der Bibliothek — als Filter-Chips. */
export function tagsHaeufig(gerichte: Gericht[], n = 8): string[] {
  const z = new Map<string, number>();
  for (const g of gerichte) for (const t of g.tags) { const k = t.trim(); if (k) z.set(k, (z.get(k) ?? 0) + 1); }
  return [...z.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(e => e[0]);
}

/** Wo ein Gericht diese Woche im Plan steht. */
export function imPlan(planGerichte: PlanGerichte, gerichtId: string): { tag: Tag; mahlzeit: Mahlzeit }[] {
  const aus: { tag: Tag; mahlzeit: Mahlzeit }[] = [];
  for (const t of TAGE) for (const m of MAHLZEITEN) if (planGerichte[t]?.[m.k] === gerichtId) aus.push({ tag: t, mahlzeit: m.k });
  return aus;
}

/** Ein gespeichertes Gericht zu einem getippten Plan-Text (gleicher Name) — dann hängt das Rezept automatisch dran. */
export function gerichtZuName(gerichte: Gericht[], name: string): Gericht | undefined {
  const n = normal(name);
  return n ? gerichte.find(g => normal(g.name) === n) : undefined;
}

export function wendeAn(f: ErnaehrungFile, ops: Op[], person: string, jetzt = new Date().toISOString()): { datei: ErnaehrungFile; abgelehnt: string[] } {
  const abgelehnt: string[] = [];
  let d: ErnaehrungFile = { ...f, plan: { ...f.plan }, planGerichte: { ...f.planGerichte }, einkauf: [...f.einkauf], profile: [...f.profile], lebensmittel: [...f.lebensmittel], vorrat: [...f.vorrat], gerichte: [...f.gerichte] };
  for (const op of ops) {
    if ('feld' in op) {
      if (op.feld === 'plan') {
        if (!TAGE.includes(op.tag) || !MAHLZEITEN.some(m => m.k === op.mahlzeit)) { abgelehnt.push('plan'); continue; }
        d.plan[op.tag] = { ...d.plan[op.tag], [op.mahlzeit]: s(op.wert, 200) };
        const pg = { ...(d.planGerichte[op.tag] ?? {}) };
        if (op.gerichtId === null || op.gerichtId === undefined) delete pg[op.mahlzeit]; else pg[op.mahlzeit] = s(op.gerichtId, 40);
        d.planGerichte[op.tag] = pg;
      } else if (op.feld === 'grundsaetze') {
        d.grundsaetze = s(op.wert, 2000);
      } else if (op.feld === 'erledigtWeg') {
        d.einkauf = d.einkauf.filter(p => !p.erledigt);
      } else if (op.feld === 'erledigtInVorrat') {
        // Was eingekauft (abgehakt) ist, ist jetzt zuhause.
        const neu = d.einkauf.filter(p => p.erledigt);
        for (const p of neu) {
          if (imVorrat(p.text, d.vorrat)) continue;
          d.vorrat.push({ id: neueId('v'), name: p.text.split(' · ')[0], menge: p.menge ?? '', kategorie: p.kategorie ?? kategorieRaten(p.text), seit: jetzt, von: s(op.von, 40) || person });
        }
        d.einkauf = d.einkauf.filter(p => !p.erledigt);
      }
      continue;
    }
    if (!LISTEN.includes(op.liste)) { abgelehnt.push(String(op.liste)); continue; }
    if (op.liste === 'profile') {
      // Ein Konto-Profil pflegt nur die Person selbst; Gäste pflegt der Haushalt.
      if (op.op === 'upsert') {
        const e = op.eintrag as Partial<Profil>;
        const ziel = s(e.person, 40) || person;
        const alt = d.profile.find(p => p.person === ziel);
        const istKonto = alt ? alt.konto : e.konto !== false;
        if (istKonto && ziel !== person) { abgelehnt.push('profile:fremd'); continue; }
        const neu = sauberDatei({ profile: [{ ...(alt ?? {}), ...e, person: ziel, konto: istKonto, stand: jetzt } as Profil] }, jetzt).profile[0];
        if (!neu) { abgelehnt.push('profile'); continue; }
        d.profile = alt ? d.profile.map(p => (p.person === ziel ? neu : p)) : [...d.profile, neu];
      } else {
        const alt = d.profile.find(p => p.person === op.id);
        if (alt && alt.konto && alt.person !== person) { abgelehnt.push('profile:fremd'); continue; }
        d.profile = d.profile.filter(p => p.person !== op.id);
      }
      continue;
    }
    const name = op.liste;
    if (op.op === 'delete') { (d as unknown as Record<string, { id: string }[]>)[name] = (d[name] as { id: string }[]).filter(x => x.id !== op.id); continue; }
    const roh = op.eintrag;
    const id = s(roh.id, 40) || neueId(name[0]);
    const vorhanden = (d[name] as { id: string }[]).find(x => x.id === id);
    const zusammen = { ...(vorhanden ?? {}), ...roh, id, ...(vorhanden ? {} : { von: s(roh.von, 40) || person }) };
    const sauber = sauberDatei({ [name]: [zusammen] } as Partial<ErnaehrungFile>, jetzt)[name][0];
    if (!sauber) { abgelehnt.push(name); continue; }
    const listeNeu = vorhanden ? (d[name] as { id: string }[]).map(x => (x.id === id ? sauber : x)) : [...(d[name] as { id: string }[]), sauber];
    d = { ...d, [name]: listeNeu };
  }
  return { datei: d, abgelehnt };
}

/** Wie viele der 21 Mahlzeiten-Felder gefüllt sind. */
export function gefuellt(f: Pick<ErnaehrungFile, 'plan'>): number {
  return TAGE.reduce((n, t) => n + MAHLZEITEN.filter(m => f.plan[t][m.k]).length, 0);
}
