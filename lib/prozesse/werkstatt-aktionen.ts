// ─── Prozesse · Werkstatt — Bauen auf der Fläche, rein (Etappe B2, 21.10.; ANALYSE_100.md Punkte 8, 16, 17, 22, 25, 43) ──────────────────────────────────
// Jede Änderung der Werkstatt ist eine reine Funktion über der FASSUNG des Entwurfs (Knoten + Notiz-Zettel) — die Oberfläche hält die Fassung, schreibt sie über
// EINEN Weg (POST /api/prozesse/werkstatt `entwurf`, Stand/409) und merkt sich die vorige für „Rückgängig“. Gespeichert wird wie im Modell (lib/prozesse/fluss.ts):
// die Reihenfolge im Strang einer Phase (`rang`) und die Zweige (`zweige`). Hier:
//   · anlegen (am „+“ eines Ausgangs, über Tab bzw. Alt+Pfeil), verbinden (Faden ziehen), lösen, löschen, umbenennen, Lage, Pfeil-Beschriftung;
//   · Phasen anlegen, umbenennen, löschen (nur leer), „Teilprozess bilden“ (Punkt 8: die Phase an einer Stelle teilen, an der kein Zweig quer liegt);
//   · Rückgängig/Wiederholen (Punkt 16 — die Geschichte des Fulfillment-Editors gehoben: dort Ops, hier ganze Fassungen, weil die Werkstatt den Entwurf ganz
//     speichert), Kopieren/Einfügen MIT Kanten (Zweige zwischen den gewählten Knoten gehen mit, neue Kennungen);
//   · Notiz-Zettel.
// Jede Funktion liefert die neue Fassung und eine deutsche Ansage (Vorleser, Punkt 17) — oder einen Grund, warum es nicht geht (nichts geändert). Das
// Freigabe-Schloss setzt nie die Werkstatt, sondern die Regel beim Speichern (lib/prozesse/schloss.ts); löschen lässt es sich nicht.
// Werkstatt-Fäden (24.10., Bau-Test): EINE Regel für jede Bau-Aktion — sie ändert nie, wohin ein ANDERER Ausgang führt. Weil „weiter“ ohne Zweig „der nächste im
// Strang“ heißt, verschöbe ein Einfügen in den Strang still das Ziel anderer Ausgänge. Darum merkt `festschreiben` vorher die aufgelösten Ziele aller Ausgänge
// (lib/prozesse/fluss.ts `ausgangsZiele` — dieselbe Auflösung wie Motor und Probelauf) und schreibt danach jedes geänderte Ziel eines NICHT bedienten Ausgangs
// ausdrücklich fest (Sprung `zweige.ja`, über Phasen bzw. „Lauf endet“ `danach`). Der bediente Ausgang führt in den Neuen, der Neue dorthin, wohin der Ausgang
// vorher führte (die Kette bleibt ganz). Ohne Bau-Aktion bleibt alles bit-gleich.
// Tests: tests/prozesse-werkstatt-aktionen.test.ts, tests/prozesse-werkstatt-faeden.test.ts (Eigenschaft über alle Vorlagen, Bau-Test als Regression).

import type { Befund, KnotenLage, NotizZettel, ProzessForm, ProzessKnoten, Zweige } from './definition';
import { alleSchritte, ausgangsZiele, flussPruefen, kinder, phasen, schritteDer, seitenZiele, wurzel, type Ausgang } from './fluss';

type K = ProzessKnoten<ProzessForm>;
/** Was die Werkstatt ändert: die Knoten und die Notiz-Zettel des Entwurfs. */
export interface Fassung { knoten: K[]; zettel?: NotizZettel[] }
export type Ergebnis = { ok: true; fassung: Fassung; ansage: string; waehle?: string[] } | { ok: false; grund: string };
/** Neue Kennungen (`fk-<uuid>` — die Form, die der Schreibweg für neue Knoten verlangt). */
export type Kennung = () => string;

const ok = (knoten: K[], f: Fassung, ansage: string, waehle?: string[]): Ergebnis => ({ ok: true, fassung: { ...f, knoten }, ansage, ...(waehle ? { waehle } : {}) });
const nein = (grund: string): Ergebnis => ({ ok: false, grund });
const titel = (k: Pick<K, 'titel'> | undefined) => `„${k?.titel ?? ''}“`;
const nachRang = (a: K, b: K) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const ZWEIGE = ['ja', 'nein', 'fehler', 'abgelaufen'] as const;

/** Ränge der Kinder eines Eltern-Knotens lückenlos 1 … n in der gegebenen Reihenfolge. */
function rangSetzen(kn: K[], reihe: readonly string[]): K[] {
  const r = new Map(reihe.map((id, i) => [id, i + 1]));
  return kn.map(k => (r.has(k.id) && k.rang !== r.get(k.id) ? { ...k, rang: r.get(k.id)! } : k));
}
/** Die Kinder eines Eltern-Knotens in Rang-Reihenfolge (Kennungen). */
const reiheVon = (kn: readonly K[], elternId: string) => kn.filter(k => k.elternId === elternId).sort(nachRang).map(k => k.id);
/** Ist das ein Schloss (Freigabe der Regel)? */
const istSchloss = (k: K | undefined) => !!k && k.form === 'freigabe' && !!k.schloss;
/** Phase eines Schritts. */
export function phaseVon(f: Pick<Fassung, 'knoten'>, id: string): string | null {
  return alleSchritte(f).find(x => x.schritt.id === id)?.phase.id ?? null;
}
const mitZweig = (k: K, art: (typeof ZWEIGE)[number], ziel: string | null): K => {
  const z: Zweige = { ...(k.zweige ?? {}) };
  if (ziel) z[art] = ziel; else delete z[art];
  const n: K = { ...k };
  if (Object.keys(z).length) n.zweige = z; else delete n.zweige;
  return n;
};

// ── Werkstatt-Fäden (24.10.): eine Bau-Aktion ändert nie, wohin ein ANDERER Ausgang führt ─────────────────────────────────────────────────────────────

/** Die Abzweige (neben dem Strang) — „ja“ ist der Hauptausgang bzw. ein Sprung. */
type ZweigArt = 'nein' | 'fehler' | 'abgelaufen';
/** Der Schlüssel eines Ausgangs — wie `ausgangsZiele` (lib/prozesse/fluss.ts) ihn rechnet. */
const schluessel = (von: string, a: Ausgang | 'ausstieg') => `${von}|${a}`;
const zerlegt = (s: string): [string, string] => { const i = s.lastIndexOf('|'); return [s.slice(0, i), s.slice(i + 1)]; };
/** Formen, deren Hauptausgang einen Sprung `zweige.ja` tragen kann — sonst `danach`. Die Erinnerung nicht: ihr „ja“ heißt „danach zurück zu …“ (Runden). */
const SPRUNG_FORM: ReadonlySet<ProzessForm> = new Set(['schritt', 'nachricht', 'termin', 'abstimmung', 'entscheidung', 'agent', 'warten', 'schleife', 'teilprozess']);
const istZweigArt = (a: string): a is ZweigArt => a === 'nein' || a === 'fehler' || a === 'abgelaufen';

/**
 * Der Hauptausgang eines Knotens als Schlüssel: `haupt` = wohin er wirklich führt (steht ein Schloss dahinter: dessen „freigegeben“), `alle` = was sich mit ihm
 * bewegt (sein eigener Faden, das „freigegeben“ des Schlosses, der Ausstieg einer Erinnerung).
 */
export function hauptAusgang(kn: readonly K[], id: string): { haupt: string; alle: string[] } {
  const k = kn.find(x => x.id === id);
  const l = kn.find(x => x.form === 'freigabe' && x.schloss?.fuer === id);
  const eigen = schluessel(id, k && (k.form === 'entscheidung' || k.form === 'freigabe') ? 'ja' : 'weiter');
  const haupt = l ? schluessel(l.id, 'ja') : eigen;
  return { haupt, alle: [eigen, haupt, schluessel(id, 'ausstieg')] };
}
/** Wohin der Hauptausgang jetzt führt (rein) — `null` = der Lauf endet. */
export function hauptZiel(kn: readonly K[], id: string): string | null {
  return ausgangsZiele({ knoten: [...kn] }).get(hauptAusgang(kn, id).haupt) ?? null;
}
/** Ohne Festlegung des Hauptausgangs (Sprung bzw. `danach`) — dann gilt der Strang. */
function ohneHaupt(k: K): K {
  let n: K = k.form !== 'freigabe' && k.zweige?.ja ? mitZweig(k, 'ja', null) : k;
  if (n.danach) { n = { ...n }; delete n.danach; }
  return n;
}
/**
 * Den Hauptausgang eines Knotens auf `ziel` setzen (rein; nur dieser Knoten, `null` = „Lauf endet“): führt der Strang ohne Festlegung schon dorthin, bleibt es
 * dabei (außer `immer` — eine ausdrückliche Wahl im Panel); sonst ein Sprung `zweige.ja` (gleiche Phase, Formen mit Sprung) bzw. `danach` (über Phasen, an Freigabe,
 * Auslöser und Erinnerung, „Lauf endet“). An einem Schloss gilt es für seinen Schritt.
 */
function hauptSetzen(kn: readonly K[], id: string, ziel: string | null, immer = false): K[] {
  const k = kn.find(x => x.id === id);
  if (!k || k.form === 'ende') return [...kn];
  if (istSchloss(k)) return hauptSetzen(kn, k.schloss!.fuer, ziel, immer);
  const o = ohneHaupt(k);
  const neu = kn.map(x => (x.id === id ? o : x));
  if (!immer && hauptZiel(neu, id) === ziel) return neu;
  const f = { knoten: neu };
  const pk = phaseVon(f, id), pz = ziel === null ? null : phaseVon(f, ziel);
  const n: K = ziel !== null && SPRUNG_FORM.has(o.form ?? 'schritt') && pk && pk === pz ? mitZweig(o, 'ja', ziel) : { ...o, danach: ziel === null ? { ende: true } : { ziel } };
  return neu.map(x => (x.id === id ? n : x));
}
/** Den Ausstieg einer Erinnerung mit „danach zurück zu …“ festlegen (`danach` — ihr Sprung „ja“ bleibt). */
function ausstiegSetzen(kn: readonly K[], id: string, ziel: string | null): K[] {
  const ohne = kn.map(x => { if (x.id !== id || !x.danach) return x; const n = { ...x }; delete n.danach; return n; });
  if ((ausgangsZiele({ knoten: ohne }).get(schluessel(id, 'ausstieg')) ?? null) === ziel) return ohne;
  return kn.map(x => (x.id === id ? { ...x, danach: ziel === null ? { ende: true as const } : { ziel } } : x));
}
/** Einen Ausgang (Schlüssel) auf `ziel` setzen (rein). */
function ausgangFest(kn: readonly K[], s: string, ziel: string | null): K[] {
  const [von, a] = zerlegt(s);
  const k = kn.find(x => x.id === von);
  if (!k) return [...kn];
  if (a === 'ausstieg') return ausstiegSetzen(kn, von, ziel);
  if (istZweigArt(a)) return kn.map(x => (x.id === von ? mitZweig(x, a, ziel) : x));
  return hauptSetzen(kn, von, ziel);
}
/** Welche Ausgänge eine Aktion an `von` bedient: der Hauptausgang (mit Schloss und Ausstieg) bzw. genau dieser Zweig. */
function bedientVon(kn: readonly K[], von: string, a: Ausgang): Set<string> {
  const k = kn.find(x => x.id === von);
  if (k && istSchloss(k) && (a === 'ja' || a === 'weiter')) return new Set(hauptAusgang(kn, k.schloss!.fuer).alle);
  return new Set(istZweigArt(a) ? [schluessel(von, a)] : hauptAusgang(kn, von).alle);
}

/**
 * Die Regel festschreiben (rein): vergleicht die aufgelösten Ziele aller Ausgänge vorher und nachher und legt jedes geänderte Ziel eines NICHT bedienten Ausgangs
 * ausdrücklich fest. Ausgänge gelöschter Knoten und Ausgänge, deren Ziel gelöscht wurde, zählen nicht (Löschen: „Zweige, die darauf zeigten, lösen sich“). Bleibt
 * danach etwas anders (darf nicht sein), kommt ein Grund statt der Änderung — nie still.
 */
export function festschreiben(vorher: Pick<Fassung, 'knoten'>, knoten: readonly K[], bedient: ReadonlySet<string> = new Set()): { ok: true; knoten: K[] } | { ok: false; grund: string } {
  const z0 = ausgangsZiele(vorher);
  const da = new Map(knoten.map(k => [k.id, k]));
  const zaehlt = (s: string, ziel: string | null): boolean => {
    if (bedient.has(s)) return false;
    const k = da.get(zerlegt(s)[0]);
    if (!k || (istSchloss(k) && !da.has(k.schloss!.fuer))) return false;
    return ziel === null || da.has(ziel);
  };
  let kn = [...knoten];
  for (let runde = 0; runde < 6; runde++) {
    const z1 = ausgangsZiele({ knoten: kn });
    const anders = [...z0].filter(([s, ziel]) => zaehlt(s, ziel) && z1.get(s) !== ziel);
    if (!anders.length) return { ok: true, knoten: kn };
    for (const [s, ziel] of anders) kn = ausgangFest(kn, s, ziel);
  }
  return { ok: false, grund: 'Das würde ändern, wohin ein anderer Ausgang führt — nichts geändert.' };
}
/** Abschluss jeder Bau-Aktion: die Regel festschreiben, dann (wenn verlangt) die Fluss-Prüfung — sonst ein Grund, nichts geändert. */
function abschliessen(f: Fassung, kn: readonly K[], bedient: ReadonlySet<string>, ansage: string, o: { waehle?: string[]; pruefen?: string | false } = {}): Ergebnis {
  const r = festschreiben(f, kn, bedient);
  if (!r.ok) return nein(r.grund);
  const e = ok(r.knoten, f, ansage, o.waehle);
  return o.pruefen === false ? e : geprueft(f, e, o.pruefen ?? 'Geht so nicht');
}
/** Kennungen in die Reihe eines Eltern-Knotens setzen — hinter `nach` (`null` = an den Anfang), Ränge lückenlos. */
function einreihen(kn: readonly K[], elternId: string, ids: readonly string[], nach: string | null): K[] {
  const reihe = reiheVon(kn, elternId).filter(x => !ids.includes(x));
  const i = nach === null ? -1 : reihe.indexOf(nach);
  return rangSetzen([...kn], [...reihe.slice(0, i + 1), ...ids, ...reihe.slice(i + 1)]);
}
/** Der letzte Auslöser am Anfang der Reihe (ein neuer Schritt hinter einem Auslöser kommt dahinter — Auslöser stehen am Anfang). */
const letzterAusloeser = (kn: readonly K[], elternId: string): string | null => [...reiheVon(kn, elternId)].reverse().find(id => kn.find(x => x.id === id)?.form === 'ausloeser') ?? null;
/** Hat der Knoten einen eigenen, festgelegten Hauptausgang (Sprung bzw. `danach`)? Vorschläge des Heads bringen ihn mit — dann bleibt er. */
const eigenerHaupt = (k: K): boolean => !!k.danach || (!!k.zweige?.ja && k.form !== 'freigabe');

// ── Anlegen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einen neuen Knoten anlegen (rein). `nach` = der Knoten, an dessen Ausgang `ausgang` er hängt — GENAU an diesen Ausgang (Werkstatt-Fäden, 24.10.): der Ausgang
 * führt danach in den Neuen, der Neue dorthin, wohin der Ausgang vorher führte (die Kette bleibt ganz; bei „nein“ ohne Zweig bzw. „Fehler“: der Lauf endet). Alle
 * anderen Ausgänge führen danach dorthin, wohin sie vorher führten (`festschreiben`). Im Strang steht der Neue direkt hinter der Quelle (hinter ihrem Schloss, an
 * einem Auslöser hinter dem letzten Auslöser); an nein · Fehler · abgelaufen ist er ein Abzweig. `vor` = vor diesem Knoten (Alt+←): was in ihn führte, führt in den
 * Neuen. Ohne beides: ans Ende der Phase — hinter ihren letzten Schritt, dessen „weiter“ bisher in den Strang ging. Ein Auslöser kommt an den Anfang.
 * `platz` = gespeicherte Lage; mit `platzSchaffen` rücken die Schritte rechts davon eine Spalte weiter.
 */
export function anlegen(f: Fassung, neu: K, o: { nach?: string | null; vor?: string; phaseId?: string; ausgang?: Ausgang; platz?: KnotenLage; platzSchaffen?: number }): Ergebnis {
  let kn = [...f.knoten];
  if (kn.some(k => k.id === neu.id)) return nein('Diese Kennung gibt es schon.');
  const ps = phasen(f);
  let quelle = o.nach ? kn.find(k => k.id === o.nach) : undefined;
  if (o.nach && !quelle) return nein('Den Knoten, an den angehängt werden soll, gibt es nicht (mehr).');
  let ausgang: Ausgang = o.ausgang ?? 'weiter';
  // Am Schloss ist „freigegeben“ der Hauptausgang seines Schritts.
  if (quelle && istSchloss(quelle) && (ausgang === 'ja' || ausgang === 'weiter')) { quelle = kn.find(k => k.id === quelle!.schloss!.fuer) ?? quelle; ausgang = 'weiter'; }
  const vor = o.vor ? kn.find(k => k.id === o.vor) : undefined;
  const phaseId = (quelle && phaseVon(f, quelle.id)) ?? (vor && phaseVon(f, vor.id)) ?? o.phaseId ?? ps[0]?.id;
  if (!phaseId) return nein('Erst eine Phase anlegen.');
  if (quelle?.form === 'ende') return nein(`${titel(quelle)} ist ein Ende — dahinter geht es nicht weiter.`);
  if (vor?.form === 'ausloeser' && neu.form !== 'ausloeser') return nein('Vor einem Auslöser steht nichts — der Prozess beginnt mit ihm.');
  const elternId = quelle?.elternId ?? vor?.elternId ?? phaseId;
  let n: K = { ...neu, elternId };
  if (o.platz) n.pos = { x: Math.round(o.platz.x), y: Math.round(o.platz.y) };
  // Platz schaffen: die Schritte derselben Phase rechts vom neuen Platz rücken weiter (nur gespeicherte Lagen — die automatische ordnet sich selbst).
  if (o.platz && o.platzSchaffen) {
    const inPhase = new Set(schritteDer(f, phaseId).map(s => s.id));
    kn = kn.map(k => (inPhase.has(k.id) && k.pos && k.pos.x >= o.platz!.x - 1 ? { ...k, pos: { ...k.pos, x: k.pos.x + o.platzSchaffen! } } : k));
  }
  const z0 = ausgangsZiele(f);
  if (n.form === 'ausloeser') {
    // Ein Auslöser steht immer am Anfang der ersten Phase — hinter den vorhandenen; jeder führt in den ersten Schritt (kein anderer Ausgang ändert sich).
    const erste = ps[0]?.id ?? phaseId;
    n = { ...n, elternId: erste };
    kn = einreihen([...kn, n], erste, [n.id], letzterAusloeser(kn, erste));
    return abschliessen(f, kn, new Set(), `Auslöser ${titel(n)} angelegt — am Anfang des Prozesses.`, { waehle: [n.id], pruefen: false });
  }
  const eigen = eigenerHaupt(n);
  if (vor) {
    // Vor einem Knoten: alles, was in ihn führte, führt jetzt in den Neuen — der Neue führt in ihn.
    const bedient = [...z0].filter(([s, z]) => z === vor.id && zerlegt(s)[0] !== vor.id).map(([s]) => s);
    const reihe = reiheVon(kn, elternId);
    kn = einreihen([...kn, n], elternId, [n.id], reihe[reihe.indexOf(vor.id) - 1] ?? null);
    for (const s of bedient) kn = ausgangFest(kn, s, n.id);
    if (!eigen) kn = hauptSetzen(kn, n.id, vor.id);
    return abschliessen(f, kn, new Set(bedient), `${titel(n)} angelegt, vor ${titel(vor)}.`, { waehle: [n.id], pruefen: false });
  }
  if (!quelle) {
    // Ans Ende der Phase: hinter ihren letzten Schritt im Strang (bzw. — leere Phase — hinter den letzten davor); ging dessen „weiter“ bisher in den Strang,
    // geht er jetzt in den Neuen und der Neue dorthin. Sonst steht der Neue lose da (der Lauf endet hinter ihm).
    const reihe = reiheVon(kn, elternId);
    const seite = seitenZiele(f.knoten);
    const strang = alleSchritte(f).filter(x => !seite.has(x.schritt.id) && !istSchloss(x.schritt));
    const pi = ps.findIndex(p => p.id === phaseId);
    const vg = [...strang].reverse().find(x => ps.findIndex(p => p.id === x.phase.id) <= pi)?.schritt;
    kn = einreihen([...kn, n], elternId, [n.id], reihe.at(-1) ?? null);
    if (vg && vg.form !== 'ende' && !eigenerHaupt(vg)) {
      const T = z0.get(hauptAusgang(f.knoten, vg.id).haupt) ?? null;
      // Am Anfang stehen Auslöser: jeder, der in den Strang ging, geht jetzt in den Neuen.
      const vgs = vg.form === 'ausloeser' ? strang.map(x => x.schritt).filter(x => x.form === 'ausloeser' && !x.danach) : [vg];
      for (const x of vgs) kn = hauptSetzen(kn, x.id, n.id);
      if (!eigen) kn = hauptSetzen(kn, n.id, T);
      return abschliessen(f, kn, new Set(vgs.flatMap(x => hauptAusgang(f.knoten, x.id).alle)), `${titel(n)} angelegt, am Ende der Phase.`, { waehle: [n.id], pruefen: false });
    }
    if (!eigen) kn = hauptSetzen(kn, n.id, null);
    return abschliessen(f, kn, new Set(), `${titel(n)} angelegt, am Ende der Phase — noch ohne Eingang.`, { waehle: [n.id], pruefen: false });
  }
  // An einem Ausgang der Quelle — wohin er bisher führte (ein „abgelaufen“ am Warten ohne eigenes Ziel geht den Weg von „weiter“).
  const istZweig = istZweigArt(ausgang);
  const h = hauptAusgang(kn, quelle.id);
  const T: string | null = istZweig
    ? (quelle.zweige?.[ausgang as ZweigArt] ?? (ausgang === 'abgelaufen' && quelle.form === 'warten' ? z0.get(h.haupt) ?? null : null))
    : (z0.get(h.haupt) ?? null);
  // In die Reihe: hinter das Schloss der Quelle bzw. die Quelle; an einem Auslöser hinter den letzten Auslöser.
  const sl = kn.find(k => k.schloss?.fuer === quelle!.id && k.elternId === quelle!.elternId);
  const anker = quelle.form === 'ausloeser' ? letzterAusloeser(kn, elternId) ?? quelle.id : sl ? sl.id : quelle.id;
  kn = einreihen([...kn, n], elternId, [n.id], anker);
  if (istZweig) kn = kn.map(k => (k.id === quelle!.id ? mitZweig(k, ausgang as ZweigArt, n.id) : k));
  else kn = hauptSetzen(kn, quelle.id, n.id);
  if (!eigen) kn = hauptSetzen(kn, n.id, T);
  const bedient = istZweig ? new Set([schluessel(quelle.id, ausgang)]) : new Set(h.alle);
  const wo = istZweig ? `am Ausgang „${ausgang}“ von ${titel(quelle)}` : `hinter ${titel(quelle)}`;
  return abschliessen(f, kn, bedient, `${titel(n)} angelegt ${wo}.`, { waehle: [n.id] });
}

/**
 * Den Typ eines Auslösers wechseln (rein, Bau-Test 24.10.: „Von Hand“ → Ereignis, Zeitplan, Webhook …) — statt eines zweiten Auslösers. Kennung, Platz im Strang,
 * Lage, Beschriftung und sein Ausgang bleiben; der Name auch, außer er war der Name des alten Typs (`altName`). Ein weiterer Auslöser nur bewusst über `anlegen`.
 */
export function ausloeserWechseln(f: Fassung, id: string, neu: K, o: { altName?: string } = {}): Ergebnis {
  const k = f.knoten.find(x => x.id === id);
  if (!k || k.form !== 'ausloeser') return nein('Das ist kein Auslöser.');
  if (neu.form !== 'ausloeser') return nein('Ein Auslöser wird nur gegen einen Auslöser getauscht.');
  const name = !k.titel.trim() || (o.altName && k.titel === o.altName) ? neu.titel : k.titel;
  const n: K = { ...neu, id: k.id, elternId: k.elternId, rang: k.rang, titel: name, ...(k.pos ? { pos: k.pos } : {}), ...(k.pfeilText ? { pfeilText: k.pfeilText } : {}), ...(k.danach ? { danach: k.danach } : {}) };
  delete n.zweige;
  return abschliessen(f, f.knoten.map(x => (x.id === id ? n : x)), new Set(), `Auslöser von ${titel(k)} gewechselt: jetzt „${neu.titel}“.`, { waehle: [id], pruefen: false });
}

// ── Verbinden, lösen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einen Faden ziehen (rein): genau dieser Ausgang führt danach zum Ziel, alle anderen bleiben, wie sie waren (Werkstatt-Fäden, 24.10.). „weiter“ holt das Ziel direkt
 * hinter die Quelle in den Strang (die Reihenfolge folgt den Fäden — die Fläche liest sich von links nach rechts); ein Abzweig bleibt Abzweig seines Ursprungs (die
 * Quelle springt dann zu ihm); ja an einer Entscheidung bzw. nein · Fehler · abgelaufen setzen den Zweig. Fäden bleiben in ihrer Phase; ein Abzweig gehört genau
 * einem Schritt.
 */
export function verbinden(f: Fassung, von: string, aus: Ausgang, nach: string): Ergebnis {
  const kn = f.knoten;
  const a = kn.find(k => k.id === von), b = kn.find(k => k.id === nach);
  if (!a || !b) return nein('Diesen Knoten gibt es nicht (mehr).');
  // „freigegeben“ am Schloss geht dorthin, wohin sein Knoten ginge — also den Knoten verbinden; an einer Freigabe ist „ja“ der Strang.
  if (istSchloss(a) && (aus === 'ja' || aus === 'weiter')) return verbinden(f, a.schloss!.fuer, 'weiter', nach);
  const ausgang: Ausgang = a.form === 'freigabe' && aus === 'ja' ? 'weiter' : aus;
  if (von === nach) return nein('Ein Schritt zeigt nicht auf sich selbst.');
  if (b.form === 'ausloeser') return nein('In einen Auslöser führt kein Faden — er startet den Prozess.');
  if (a.form === 'ende') return nein(`${titel(a)} ist ein Ende.`);
  const pa = phaseVon(f, von), pb = phaseVon(f, nach);
  if (!pa || !pb) return nein('Fäden verbinden Schritte.');
  if (pa !== pb) return nein('Fäden bleiben in ihrer Phase — erst den Schritt in die Phase ziehen.');
  if (istSchloss(b)) return nein(`Das Schloss gehört zu „${kn.find(k => k.id === b.schloss!.fuer)?.titel ?? ''}“ — es steht immer direkt dahinter.`);
  const bedient = bedientVon(kn, von, ausgang);
  if (istZweigArt(ausgang)) {
    const ursprung = seitenZiele(kn).get(nach);
    if (ursprung && ursprung !== von) return nein(`${titel(b)} ist schon der Abzweig von ${titel(kn.find(k => k.id === ursprung))}.`);
    return abschliessen(f, kn.map(k => (k.id === von ? mitZweig(k, ausgang, nach) : k)), bedient, `${titel(a)} → ${titel(b)} (${ausgang}).`, { pruefen: false });
  }
  // ja an einer Entscheidung: der Zweig zeigt aufs Ziel (die Reihenfolge bleibt).
  if (a.form === 'entscheidung' && ausgang === 'ja') return abschliessen(f, hauptSetzen(kn, von, nach), bedient, `${titel(a)} → ${titel(b)} (ja).`, { pruefen: false });
  // Ein Abzweig (nein · Fehler · abgelaufen eines anderen) bleibt Abzweig seines Ursprungs — die Quelle springt zu ihm.
  if (seitenZiele(kn).has(nach)) return abschliessen(f, hauptSetzen(kn, von, nach), bedient, `${titel(a)} geht jetzt weiter bei ${titel(b)}.`, { pruefen: false });
  // weiter: B direkt hinter A (gleicher Eltern-Knoten wie A) — bzw. hinter A's Freigabe-Schloss.
  const sl = kn.find(k => k.schloss?.fuer === von && k.elternId === a.elternId);
  const reihe = reiheVon(kn, a.elternId ?? pa).filter(id => id !== nach);
  if (reihe.indexOf(sl ? sl.id : von) < 0) return nein('Die Reihenfolge ließ sich nicht bestimmen.');
  let neu = einreihen(kn.map(k => (k.id === nach ? { ...k, elternId: a.elternId } : k)), a.elternId ?? pa, [nach], sl ? sl.id : von);
  neu = hauptSetzen(neu, von, nach);
  return abschliessen(f, neu, bedient, `${titel(b)} folgt jetzt auf ${titel(a)}.`, { pruefen: false });
}

/**
 * Wohin ein Ausgang führt, im Panel wählen (rein, Werkstatt-Fäden 24.10.): JEDER Ausgang — auch „weiter“ einer Aufgabe, Mail oder Wartezeit. „der nächste Schritt“
 * = keine Festlegung (der Strang), „Lauf endet“ = ausdrücklich, ein Schritt = dieselbe Funktion wie der Faden (`verbinden`). Die anderen Ausgänge bleiben.
 */
export type AusgangWahl = { art: 'naechster' } | { art: 'ende' } | { art: 'schritt'; id: string };
export function ausgangSetzen(f: Fassung, von: string, ausgang: Ausgang, w: AusgangWahl): Ergebnis {
  const a = f.knoten.find(k => k.id === von);
  if (!a) return nein('Diesen Knoten gibt es nicht (mehr).');
  if (istSchloss(a) && (ausgang === 'ja' || ausgang === 'weiter')) return ausgangSetzen(f, a.schloss!.fuer, 'weiter', w);
  if (w.art === 'schritt') return verbinden(f, von, ausgang, w.id);
  if (istZweigArt(ausgang)) return a.zweige?.[ausgang] ? loesen(f, von, ausgang) : nein('Dieser Ausgang endet schon hier.');
  if (a.form === 'ende') return nein(`${titel(a)} ist ein Ende.`);
  const bedient = bedientVon(f.knoten, von, ausgang);
  if (w.art === 'ende') return abschliessen(f, hauptSetzen(f.knoten, von, null, true), bedient, `${titel(a)}: hier endet der Lauf.`, { pruefen: false });
  return abschliessen(f, f.knoten.map(k => (k.id === von ? ohneHaupt(k) : k)), bedient, `${titel(a)} geht zum nächsten Schritt im Ablauf.`, { pruefen: false });
}

// ── Werkstatt bau-fertig (22.10., n8n-Niveau): nachgiebig bauen, ohne das Modell umzubauen ─────────────────────────────────────────────────────────────
// Das Modell bleibt „Strang je Phase + Abzweige“ (lib/prozesse/fluss.ts). Die Oberfläche wird nachgiebig: ein Faden über Phasen holt das Ziel in die Phase
// (mit Ansage), ein „+“ mitten auf dem Faden fügt dazwischen ein, das Kantenende lässt sich umhängen. Jede dieser Hilfen prüft danach den Fluss
// (`flussPruefen`) — entsteht ein NEUER Fehler, bleibt alles, wie es war (ein Grund, nichts geändert). Nie still.

/** Ein Faden, wie die Fläche ihn kennt (Kante aus `kantenVon`). */
export interface KanteRef { von: string; nach: string | null; ausgang: Ausgang }

/** Der erste NEUE Fehler der Fluss-Prüfung nach einer Änderung (rein) — null = es ist kein neuer dazugekommen. */
export function neuerFlussFehler(vorher: Pick<Fassung, 'knoten'>, nachher: Pick<Fassung, 'knoten'>): Befund | null {
  const alt = new Set(flussPruefen(vorher).filter(b => b.stufe === 'fehler').map(b => b.text));
  return flussPruefen(nachher).find(b => b.stufe === 'fehler' && !alt.has(b.text)) ?? null;
}
/** Ergebnis nur übernehmen, wenn der Fluss keinen neuen Fehler bekommt (sonst der Grund, nichts geändert). */
function geprueft(vorher: Fassung, e: Ergebnis, vorsatz = 'Geht so nicht'): Ergebnis {
  if (!e.ok) return e;
  const f = neuerFlussFehler(vorher, e.fassung);
  return f ? nein(`${vorsatz}: ${f.text}`) : e;
}

/**
 * Warum auf diesem Faden kein „+“ zum Dazwischen-Einfügen steht (rein) — null = es geht. Seit 24.10. (Werkstatt-Fäden) auch auf Abzweigen und ihrem Weg zurück:
 * der Neue hängt GENAU an diesem Ausgang und führt dorthin, wohin der Faden führte.
 */
export function zwischenGrund(f: Pick<Fassung, 'knoten'>, k: KanteRef): string | null {
  if (!k.nach) return 'Dieser Faden endet hier — am Ausgang „+“ anhängen.';
  const a = f.knoten.find(x => x.id === k.von), b = f.knoten.find(x => x.id === k.nach);
  if (!a || !b) return 'Diesen Schritt gibt es nicht (mehr).';
  if (!phaseVon(f, a.id) || !phaseVon(f, b.id)) return 'Fäden verbinden Schritte.';
  if (istSchloss(b)) return 'Das Freigabe-Schloss steht immer direkt hinter seinem Schritt — hinter dem Schloss einfügen.';
  if (b.form === 'ausloeser') return 'In einen Auslöser führt kein Faden.';
  if (a.form === 'ende') return `${titel(a)} ist ein Ende.`;
  return null;
}

/**
 * Einen neuen Schritt mitten auf einen Faden setzen (rein, Punkt 3 — das „+“ in der Mitte jedes Fadens): er hängt GENAU an dem Ausgang, von dem der Faden kommt,
 * und führt dorthin, wohin der Faden führte (`anlegen` am Ausgang); alle anderen Ausgänge bleiben (Werkstatt-Fäden, 24.10.).
 */
export function zwischenEinfuegen(f: Fassung, k: KanteRef, neu: K, o: { platz?: KnotenLage; platzSchaffen?: number } = {}): Ergebnis {
  const grund = zwischenGrund(f, k);
  if (grund) return nein(grund);
  const a = f.knoten.find(x => x.id === k.von)!, b = f.knoten.find(x => x.id === k.nach)!;
  const r = anlegen(f, neu, { nach: a.id, ausgang: k.ausgang, ...(o.platz ? { platz: o.platz } : {}), ...(o.platzSchaffen ? { platzSchaffen: o.platzSchaffen } : {}) });
  if (!r.ok) return nein(`Dazwischen einfügen geht hier nicht: ${r.grund}`);
  const q = istSchloss(a) ? f.knoten.find(x => x.id === a.schloss!.fuer) ?? a : a;
  return { ...r, ansage: `${titel(neu)} eingefügt zwischen ${titel(q)} und ${titel(b)}.` };
}

/** Ein Schritt mit allem, was zu ihm gehört: sein Freigabe-Schloss und seine Abzweige (rekursiv) — wandert er in eine andere Phase, wandern sie mit. */
function mitAnhang(kn: readonly K[], id: string): Set<string> {
  const m = new Set([id]);
  const seite = seitenZiele(kn);
  let n = -1;
  while (n !== m.size) {
    n = m.size;
    for (const k of kn) {
      if (k.schloss && m.has(k.schloss.fuer)) m.add(k.id);
      const u = seite.get(k.id);
      if (u && m.has(u)) m.add(k.id);
    }
  }
  return m;
}

/** Einen Schritt (mit Schloss und Abzweigen) ans Ende einer anderen Phase holen (rein) — die Lage von Hand fällt weg (die Phase ordnet ihn selbst). */
function inPhaseHolen(f: Fassung, id: string, phaseId: string): Fassung {
  const m = mitAnhang(f.knoten, id);
  const reihe = [...reiheVon(f.knoten, phaseId).filter(x => !m.has(x)), ...alleSchritte(f).map(x => x.schritt.id).filter(x => m.has(x))];
  const kn = f.knoten.map(k => { if (!m.has(k.id)) return k; const { pos: _p, ...rest } = k; return { ...rest, elternId: phaseId } as K; });
  return { ...f, knoten: rangSetzen(kn, reihe) };
}

/**
 * Verbinden über Phasen (rein, Punkt 4): liegt das Ziel in einer anderen Phase, holt die Werkstatt es (mit Schloss und Abzweigen) in die Phase der Quelle —
 * Fäden bleiben in ihrer Phase, das Modell bleibt gleich — und sagt es an. Entstünde dabei ein Fehler (z. B. ein Sprung aus der alten Phase auf das Ziel), bleibt
 * alles, wie es war.
 */
export function verbindenFrei(f: Fassung, von: string, aus: Ausgang, nach: string): Ergebnis {
  const a0 = f.knoten.find(k => k.id === von), b = f.knoten.find(k => k.id === nach);
  if (!a0 || !b) return nein('Diesen Knoten gibt es nicht (mehr).');
  const a = istSchloss(a0) && (aus === 'ja' || aus === 'weiter') ? f.knoten.find(k => k.id === a0.schloss!.fuer) ?? a0 : a0;
  const pa = phaseVon(f, a.id), pb = phaseVon(f, nach);
  const bedient = bedientVon(f.knoten, von, aus);
  if (!pa || !pb || pa === pb || b.form === 'ausloeser' || istSchloss(b) || a.form === 'ende' || a.id === nach) return regel(f, verbinden(f, von, aus, nach), bedient, 'Verbinden geht so nicht');
  const geholt = inPhaseHolen(f, nach, pa);
  const r = verbinden(geholt, von, aus, nach);
  if (!r.ok) return r;
  const ph = f.knoten.find(k => k.id === pa)?.titel ?? '';
  return regel(f, { ...r, ansage: `${titel(b)} liegt jetzt in der Phase „${ph}“ (Fäden bleiben in ihrer Phase). ${r.ansage}` }, bedient, `${titel(b)} in die Phase „${ph}“ zu holen geht nicht`);
}
/** Ein Ergebnis gegen die Fassung VOR der ganzen Aktion auf die Regel prüfen (nur die bedienten Ausgänge ändern sich) und danach den Fluss. */
function regel(f: Fassung, e: Ergebnis, bedient: ReadonlySet<string>, vorsatz: string): Ergebnis {
  if (!e.ok) return e;
  const r = festschreiben(f, e.fassung.knoten, bedient);
  if (!r.ok) return nein(r.grund);
  return geprueft(f, { ...e, fassung: { ...e.fassung, knoten: r.knoten } }, vorsatz);
}

/**
 * Das Ende eines Fadens umhängen (rein, Punkt 4 — Kantenende greifen und auf einen anderen Schritt ziehen):
 *   ein Sprung „weiter bei …“ bzw. das „ja“ einer Entscheidung → zeigt auf das neue Ziel;
 *   der Strang („weiter“) → das neue Ziel folgt direkt (das alte kommt danach — die Reihenfolge lässt sich nur umhängen, nicht lösen);
 *   nein · Fehler · abgelaufen → der Abzweig zeigt auf das neue Ziel;
 *   vom Abzweig zurück in den Ablauf → ein Sprung „weiter bei …“ zum neuen Ziel.
 * Über Phasen wie `verbindenFrei`; entsteht ein neuer Fehler, bleibt alles, wie es war.
 */
export function umhaengen(f: Fassung, k: KanteRef, ziel: string): Ergebnis {
  if (k.nach === ziel) return nein('Der Faden hängt schon dort.');
  const a = f.knoten.find(x => x.id === k.von), z = f.knoten.find(x => x.id === ziel);
  if (!a || !z) return nein('Diesen Knoten gibt es nicht (mehr).');
  const nachK = k.nach ? f.knoten.find(x => x.id === k.nach) : undefined;
  if (nachK && istSchloss(nachK) && nachK.schloss!.fuer === a.id) return nein('Das Freigabe-Schloss steht immer direkt hinter seinem Schritt — dieser Faden lässt sich nicht umhängen.');
  if (istZweigArt(k.ausgang)) return verbindenFrei(f, k.von, k.ausgang, ziel);
  const quelle = istSchloss(a) ? f.knoten.find(x => x.id === a.schloss!.fuer) ?? a : a;
  const sprung = quelle.form === 'entscheidung' ? !!quelle.zweige?.ja : quelle.form !== 'freigabe' && !!quelle.zweige?.ja;
  const seite = seitenZiele(f.knoten).has(quelle.id);
  if (!sprung && !seite) return verbindenFrei(f, k.von, k.ausgang === 'ja' && quelle.form === 'entscheidung' ? 'ja' : 'weiter', ziel);
  // Sprung bzw. Rückweg eines Abzweigs: „weiter bei …“ zeigt auf das neue Ziel (über Phasen: erst holen).
  if (quelle.form === 'freigabe' || quelle.form === 'ende') return nein(`${titel(quelle)} hat keinen Sprung, der sich umhängen ließe.`);
  if (z.form === 'ausloeser') return nein('In einen Auslöser führt kein Faden — er startet den Prozess.');
  if (istSchloss(z)) return nein(`Das Schloss gehört zu „${f.knoten.find(x => x.id === z.schloss!.fuer)?.titel ?? ''}“ — es steht immer direkt dahinter.`);
  const pq = phaseVon(f, quelle.id), pz = phaseVon(f, ziel);
  if (!pq || !pz) return nein('Fäden verbinden Schritte.');
  const basis = pq === pz ? f : inPhaseHolen(f, ziel, pq);
  const kn = basis.knoten.map(x => (x.id === quelle.id ? mitZweig(x, 'ja', ziel) : x));
  const geholt = pq === pz ? '' : ` ${titel(z)} liegt jetzt in der Phase „${f.knoten.find(x => x.id === pq)?.titel ?? ''}“.`;
  return regel(f, ok(kn, f, `${titel(quelle)} geht jetzt weiter bei ${titel(z)}.${geholt}`), bedientVon(f.knoten, k.von, k.ausgang), 'Umhängen geht so nicht');
}

/** Ein Fall der Mehrfach-Entscheidung (Punkt 15): Name, Bedingungen („wenn …“) und wohin es dann geht (ein Schritt der Phase; ohne = weiter im Ablauf). */
export interface MehrfachFall { titel: string; bedingungen: import('./definition').Bedingung[]; verknuepfung?: 'und' | 'oder'; ziel?: string | null }
export const MEHRFACH_MAX = 8;

/**
 * „Mehrfach-Entscheidung“ als Bau-Hilfe (rein, Punkt 15 — der Switch aus n8n): wird SOFORT zu einer Kaskade aus Rauten nach Regel — das Modell bleibt, wie es ist.
 * Fall 1 = die erste Raute am Hauptausgang von `nach`; jeder weitere Fall = die Raute am „nein“ der vorigen; „sonst“ = das „nein“ der letzten Raute (der Lauf endet
 * bzw. eine Aufgabe „von Hand prüfen“). „ja“ eines Falls → sein Ziel bzw. „weiter im Ablauf“ = dorthin, wohin der Ausgang von `nach` vorher führte; dorthin geht
 * auch die Aufgabe „sonst“. Kein anderer Ausgang ändert sich (Werkstatt-Fäden, 24.10.). Die Rauten tragen die Verknüpfung „alle Bedingungen“, wenn nichts gewählt ist.
 * Ein Fall braucht mindestens eine Bedingung; Ziele sind Schritte derselben Phase. Prüft den Fluss wie jede Hilfe (Kreis, Phase) — sonst ein Grund, nichts geändert.
 */
export function mehrfachEntscheidung(f: Fassung, o: { nach: string; faelle: readonly MehrfachFall[]; sonst?: 'ende' | 'aufgabe'; kennung: Kennung }): Ergebnis {
  const q0 = f.knoten.find(k => k.id === o.nach);
  if (!q0) return nein('Den Knoten, an den angehängt werden soll, gibt es nicht (mehr).');
  const quelle = istSchloss(q0) ? f.knoten.find(k => k.id === q0.schloss!.fuer) ?? q0 : q0;
  if (o.faelle.length < 2) return nein('Eine Mehrfach-Entscheidung hat mindestens zwei Fälle — für einen Fall reicht eine Raute.');
  if (o.faelle.length > MEHRFACH_MAX) return nein(`Höchstens ${MEHRFACH_MAX} Fälle — sonst lieber einen Teilprozess bilden.`);
  const leer = o.faelle.findIndex(x => !x.bedingungen.length || !x.titel.trim());
  if (leer >= 0) return nein(`Fall ${leer + 1}: Name und mindestens eine Bedingung fehlen.`);
  const ph = phaseVon(f, quelle.id);
  for (const x of o.faelle) {
    if (!x.ziel) continue;
    const z = f.knoten.find(k => k.id === x.ziel);
    if (!z || phaseVon(f, z.id) !== ph || z.form === 'ausloeser' || istSchloss(z)) return nein(`„${x.titel}“: das Ziel muss ein Schritt derselben Phase sein.`);
  }
  // Wohin der Ausgang bisher führte — „weiter im Ablauf“ der Fälle ohne eigenes Ziel.
  const weiterImAblauf = hauptZiel(f.knoten, quelle.id);
  const raute = (x: MehrfachFall): K => ({
    id: o.kennung(), titel: x.titel.trim(), rang: 0, form: 'entscheidung', bahn: 'system', katalog: { id: 'entscheidung.regel' },
    raute: { art: 'regel', bedingungen: x.bedingungen, verknuepfung: x.verknuepfung ?? 'und' },
  });
  const r1 = raute(o.faelle[0]);
  let e = anlegen(f, r1, { nach: quelle.id, ausgang: quelle.form === 'entscheidung' || quelle.form === 'freigabe' ? 'ja' : 'weiter' });
  if (!e.ok) return e;
  let kn = e.fassung.knoten;
  const rauten: [K, MehrfachFall][] = [[r1, o.faelle[0]]];
  let vorige = r1.id;
  const neu = [r1.id];
  for (const x of o.faelle.slice(1)) {
    const r = raute(x);
    e = anlegen({ ...e.fassung, knoten: kn }, r, { nach: vorige, ausgang: 'nein' });
    if (!e.ok) return e;
    kn = e.fassung.knoten;
    rauten.push([r, x]);
    vorige = r.id;
    neu.push(r.id);
  }
  // Ein gewähltes Ziel steht ausdrücklich an der Raute; „weiter im Ablauf“ nur, wenn der Strang nicht ohnehin dorthin führt.
  for (const [r, x] of rauten) kn = hauptSetzen(kn, r.id, x.ziel ?? weiterImAblauf, !!x.ziel);
  if (o.sonst === 'aufgabe') {
    const t: K = { id: o.kennung(), titel: 'Sonst: von Hand prüfen', rang: 0, form: 'schritt', bahn: 'mensch', katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Sonst: von Hand prüfen', wer: 'rolle:zustaendig' } } };
    e = anlegen({ ...e.fassung, knoten: kn }, t, { nach: vorige, ausgang: 'nein' });
    if (!e.ok) return e;
    kn = hauptSetzen(e.fassung.knoten, t.id, weiterImAblauf);
    neu.push(t.id);
  }
  return abschliessen(f, kn, new Set(hauptAusgang(f.knoten, quelle.id).alle),
    `Mehrfach-Entscheidung mit ${o.faelle.length} Fällen angelegt — als ${o.faelle.length} Rauten nach Regel hintereinander${o.sonst === 'aufgabe' ? ', „sonst“ als Aufgabe' : ', „sonst“ endet der Lauf'}.`,
    { waehle: neu, pruefen: 'Die Mehrfach-Entscheidung geht so nicht' });
}

/** Einen Zweig lösen (rein) — der Strang („weiter“) lässt sich nicht lösen, nur umhängen. */
export function loesen(f: Fassung, von: string, ausgang: Ausgang): Ergebnis {
  const a = f.knoten.find(k => k.id === von);
  if (!a) return nein('Diesen Knoten gibt es nicht (mehr).');
  if (ausgang === 'weiter') return nein('Die Reihenfolge lässt sich nicht lösen — nur umhängen (Faden zu einem anderen Schritt ziehen).');
  if (!a.zweige?.[ausgang]) return nein('Dieser Ausgang ist schon frei.');
  // Der frei gewordene Schritt bleibt, wo er hinführte; was sonst auf ihn bzw. hinter ihm lag, ebenso (Werkstatt-Fäden, 24.10.).
  return abschliessen(f, f.knoten.map(k => (k.id === von ? mitZweig(k, ausgang, null) : k)), bedientVon(f.knoten, von, ausgang), `Ausgang „${ausgang}“ von ${titel(a)} gelöst.`, { pruefen: false });
}

// ── Löschen, ändern ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Schritte löschen (rein): mit ihren Kindern; Zweige, die darauf zeigten, lösen sich. Ein Freigabe-Schloss bleibt (die Regel setzt es). */
export function loeschen(f: Fassung, ids: readonly string[]): Ergebnis {
  const kn = f.knoten;
  const schritte = new Set(alleSchritte(f).map(x => x.schritt.id));
  const gruppen = new Set(kn.filter(k => kn.some(c => c.elternId === k.id) && kn.find(p => p.id === k.elternId) && !phasen(f).some(p => p.id === k.id) && k.id !== wurzel(kn)?.id).map(k => k.id));
  const gesperrt = ids.map(id => kn.find(k => k.id === id)).filter(istSchloss);
  const weg = new Set(ids.filter(id => (schritte.has(id) || gruppen.has(id)) && !istSchloss(kn.find(k => k.id === id))));
  if (!weg.size) return nein(gesperrt.length ? `Ein Freigabe-Schloss lässt sich nicht entfernen — es gehört zu „${kn.find(k => k.id === gesperrt[0]!.schloss!.fuer)?.titel ?? ''}“ und wirkt nach außen.` : 'Nichts zu löschen.');
  // Kinder (Gruppen) gehen mit.
  let n = -1;
  while (n !== weg.size) { n = weg.size; for (const k of kn) if (k.elternId && weg.has(k.elternId)) weg.add(k.id); }
  const rest = kn.filter(k => !weg.has(k.id)).map(k => {
    let x = k;
    for (const z of ZWEIGE) if (x.zweige?.[z] && weg.has(x.zweige[z]!)) x = mitZweig(x, z, null);
    return x;
  });
  const zahl = [...weg].filter(id => schritte.has(id)).length;
  // Nur Ausgänge, die auf Gelöschtes zeigten, ändern sich (sie lösen sich bzw. gehen im Strang weiter) — alle anderen bleiben (Werkstatt-Fäden, 24.10.).
  return abschliessen(f, rest, new Set(), `${zahl === 1 ? `${titel(kn.find(k => weg.has(k.id) && schritte.has(k.id)))} gelöscht` : `${zahl} Schritte gelöscht`}${gesperrt.length ? ' — das Freigabe-Schloss bleibt' : ''}.`, { pruefen: false });
}

/** Einen Knoten ersetzen (Panel, Maske, Titel) — Kennung, Eltern und Rang bleiben. */
export function ersetzen(f: Fassung, k: K): Ergebnis {
  const alt = f.knoten.find(x => x.id === k.id);
  if (!alt) return nein('Diesen Knoten gibt es nicht (mehr).');
  return ok(f.knoten.map(x => (x.id === k.id ? { ...k, elternId: alt.elternId, rang: alt.rang } : x)), f, `${titel(k)} geändert.`);
}
export function umbenennen(f: Fassung, id: string, neuTitel: string): Ergebnis {
  const t = neuTitel.trim();
  const k = f.knoten.find(x => x.id === id);
  if (!k) return nein('Diesen Knoten gibt es nicht (mehr).');
  if (!t) return nein('Der Name darf nicht leer sein.');
  return ok(f.knoten.map(x => (x.id === id ? { ...x, titel: t } : x)), f, `Umbenannt in „${t}“.`);
}
/** Gespeicherte Lagen setzen (null = wieder automatisch). */
export function lageSetzen(f: Fassung, eintraege: readonly { id: string; pos: KnotenLage | null }[]): Ergebnis {
  const m = new Map(eintraege.map(e => [e.id, e.pos]));
  return ok(f.knoten.map(k => {
    if (!m.has(k.id)) return k;
    const p = m.get(k.id);
    if (!p) { const { pos: _p, ...rest } = k; return rest as K; }
    return { ...k, pos: { x: Math.round(p.x), y: Math.round(p.y), ...(p.b ? { b: p.b } : {}), ...(p.h ? { h: p.h } : {}) } };
  }), f, eintraege.length === 1 ? 'Verschoben.' : `${eintraege.length} verschoben.`);
}
/** Einen Schritt in eine andere Phase legen (Ziehen in einen anderen Rahmen): ans Ende (bzw. hinter `nach`). Seine Zweige muss die Prüfung danach bestätigen. */
export function inPhase(f: Fassung, id: string, phaseId: string, nach?: string | null): Ergebnis {
  const k = f.knoten.find(x => x.id === id);
  if (!k) return nein('Diesen Knoten gibt es nicht (mehr).');
  if (k.form === 'ausloeser') return nein('Ein Auslöser bleibt am Anfang der ersten Phase.');
  if (!phasen(f).some(p => p.id === phaseId)) return nein('Diese Phase gibt es nicht (mehr).');
  if (phaseVon(f, id) === phaseId) return nein('Er steht schon in dieser Phase.');
  const reihe = reiheVon(f.knoten, phaseId).filter(x => x !== id);
  const i = nach ? reihe.indexOf(nach) : -1;
  const neu = i >= 0 ? [...reihe.slice(0, i + 1), id, ...reihe.slice(i + 1)] : [...reihe, id];
  // Der Weg bleibt derselbe (Werkstatt-Fäden, 24.10.): nur die Phase wechselt — wohin seine und die anderen Ausgänge führen, ändert sich nicht.
  return abschliessen(f, rangSetzen(f.knoten.map(x => (x.id === id ? { ...x, elternId: phaseId } : x)), neu), new Set(), `${titel(k)} liegt jetzt in „${f.knoten.find(x => x.id === phaseId)?.titel ?? ''}“.`, { pruefen: false });
}
/** Die Beschriftung eines Fadens (Punkt 23) — leer = die Vorgabe („ja“, „nein“ …). */
export function pfeilText(f: Fassung, id: string, art: 'weiter' | (typeof ZWEIGE)[number], text: string | null): Ergebnis {
  const k = f.knoten.find(x => x.id === id);
  if (!k) return nein('Diesen Knoten gibt es nicht (mehr).');
  const t = { ...(k.pfeilText ?? {}) };
  if (text && text.trim()) t[art] = text.trim(); else delete t[art];
  return ok(f.knoten.map(x => { if (x.id !== id) return x; const n = { ...x }; if (Object.keys(t).length) n.pfeilText = t; else delete n.pfeilText; return n; }), f, 'Beschriftung geändert.');
}

// ── Phasen, Teilprozess bilden (Punkt 8) ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function phaseNeu(f: Fassung, o: { id: string; titel: string; nach?: string }): Ergebnis {
  const w = wurzel(f.knoten);
  if (!w) return nein('Der Prozess hat keinen obersten Knoten.');
  const reihe = reiheVon(f.knoten, w.id);
  const i = o.nach ? reihe.indexOf(o.nach) : reihe.length - 1;
  const neu = [...reihe.slice(0, i + 1), o.id, ...reihe.slice(i + 1)];
  return ok(rangSetzen([...f.knoten, { id: o.id, elternId: w.id, titel: o.titel.trim() || 'Neue Phase', rang: 0 }], neu), f, `Phase „${o.titel.trim() || 'Neue Phase'}“ angelegt.`, [o.id]);
}
export function phaseLoeschen(f: Fassung, id: string): Ergebnis {
  const ps = phasen(f);
  if (!ps.some(p => p.id === id)) return nein('Diese Phase gibt es nicht (mehr).');
  if (ps.length === 1) return nein('Ein Prozess hat mindestens eine Phase.');
  if (f.knoten.some(k => k.elternId === id)) return nein('Die Phase hat noch Schritte — erst verschieben oder löschen.');
  return ok(f.knoten.filter(k => k.id !== id), f, 'Phase gelöscht.');
}

/** Die Einheiten einer Phase (Schritte bzw. Gruppen auf oberster Ebene) und welche Schritte zu welcher Einheit gehören. */
function einheiten(f: Pick<Fassung, 'knoten'>, phaseId: string): { id: string; schritte: string[] }[] {
  return kinder(phaseId, f.knoten).filter(k => !k.bausteinId).map(k => {
    const c = kinder(k.id, f.knoten).filter(x => !x.bausteinId);
    return { id: k.id, schritte: c.length ? c.map(x => x.id) : [k.id] };
  });
}
/** Darf die Phase vor der Einheit `c` geteilt werden? Kein Zweig und kein Schloss liegt quer, kein Auslöser wandert. */
function schnittMoeglich(f: Pick<Fassung, 'knoten'>, e: { id: string; schritte: string[] }[], c: number): boolean {
  const vorn = new Set(e.slice(0, c).flatMap(x => x.schritte)), hinten = new Set(e.slice(c).flatMap(x => x.schritte));
  for (const k of f.knoten) {
    if (!vorn.has(k.id) && !hinten.has(k.id)) continue;
    const seite = vorn.has(k.id) ? vorn : hinten;
    for (const z of ZWEIGE) { const t = k.zweige?.[z]; if (t && (vorn.has(t) || hinten.has(t)) && !seite.has(t)) return false; }
    if (k.schloss && (vorn.has(k.schloss.fuer) || hinten.has(k.schloss.fuer)) && !seite.has(k.schloss.fuer)) return false;
    if (hinten.has(k.id) && k.form === 'ausloeser') return false;
  }
  return true;
}
/** Wo die Phase geteilt werden kann (Index der ersten Einheit der neuen Phase) — der Schnitt, der der Mitte am nächsten liegt bzw. vor `ab`; null = nirgends. */
export function teilStelle(f: Pick<Fassung, 'knoten'>, phaseId: string, ab?: string): number | null {
  const e = einheiten(f, phaseId);
  if (e.length < 2) return null;
  if (ab) {
    const c = e.findIndex(x => x.id === ab || x.schritte.includes(ab));
    return c > 0 && schnittMoeglich(f, e, c) ? c : null;
  }
  const mitte = e.length / 2;
  const kandidaten = Array.from({ length: e.length - 1 }, (_, i) => i + 1).filter(c => schnittMoeglich(f, e, c)).sort((a, b) => Math.abs(a - mitte) - Math.abs(b - mitte) || a - b);
  return kandidaten[0] ?? null;
}

/**
 * „Teilprozess bilden“ (Punkt 8): eine lange Phase an einer Stelle, an der kein Zweig quer liegt, in zwei Phasen teilen — die neue folgt direkt (auf der Fläche
 * lässt sie sich zuklappen, als Kachel). `ab` = ab diesem Schritt (sonst nahe der Mitte). Nie hart: ohne passende Stelle ein Grund, nichts geändert.
 */
export function teilprozessBilden(f: Fassung, phaseId: string, o: { id: string; titel?: string; ab?: string }): Ergebnis {
  const ps = phasen(f);
  const p = ps.find(x => x.id === phaseId);
  if (!p) return nein('Diese Phase gibt es nicht (mehr).');
  const c = teilStelle(f, phaseId, o.ab);
  if (c === null) return nein(o.ab ? 'An dieser Stelle liegt ein Zweig quer (Ja/Nein, Fehler, Schloss) — eine andere Stelle wählen.' : 'In dieser Phase liegt überall ein Zweig quer — sie lässt sich so nicht teilen.');
  const e = einheiten(f, phaseId);
  const wandern = new Set(e.slice(c).map(x => x.id));
  const schritte = new Set(e.slice(c).flatMap(x => x.schritte));
  const minX = Math.min(...f.knoten.filter(k => schritte.has(k.id) && k.pos).map(k => k.pos!.x));
  const titelNeu = o.titel?.trim() || `${p.titel} (Teil 2)`;
  const w = wurzel(f.knoten)!;
  let kn = f.knoten.map(k => {
    let x = wandern.has(k.id) ? { ...k, elternId: o.id } : k;
    if (schritte.has(k.id) && x.pos && Number.isFinite(minX)) x = { ...x, pos: { ...x.pos, x: x.pos.x - minX + 36 } };
    return x;
  });
  kn.push({ id: o.id, elternId: w.id, titel: titelNeu, rang: 0 });
  const phasenReihe = reiheVon(f.knoten, w.id);
  const i = phasenReihe.indexOf(phaseId);
  kn = rangSetzen(kn, [...phasenReihe.slice(0, i + 1), o.id, ...phasenReihe.slice(i + 1)]);
  return ok(kn, f, `Teilprozess „${titelNeu}“ gebildet: ${schritte.size} Schritte wandern in die neue Phase.`, [o.id]);
}

// ── Notiz-Zettel ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function zettelNeu(f: Fassung, z: NotizZettel): Ergebnis {
  return { ok: true, fassung: { ...f, zettel: [...(f.zettel ?? []), z] }, ansage: 'Notiz-Zettel angelegt.', waehle: [z.id] };
}
export function zettelAendern(f: Fassung, id: string, teil: Partial<Pick<NotizZettel, 'text' | 'pos' | 'farbe'>>): Ergebnis {
  if (!(f.zettel ?? []).some(z => z.id === id)) return nein('Diesen Zettel gibt es nicht (mehr).');
  return { ok: true, fassung: { ...f, zettel: (f.zettel ?? []).map(z => (z.id === id ? { ...z, ...teil } : z)) }, ansage: 'Zettel geändert.' };
}
export function zettelWeg(f: Fassung, ids: readonly string[]): Ergebnis {
  const l = (f.zettel ?? []).filter(z => !ids.includes(z.id));
  if (l.length === (f.zettel ?? []).length) return nein('Nichts zu löschen.');
  return { ok: true, fassung: { ...f, zettel: l.length ? l : undefined }, ansage: 'Zettel gelöscht.' };
}

// ── Rückgängig, Wiederholen (Punkt 16) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Geschichte { zurueck: Fassung[]; vor: Fassung[] }
export const GESCHICHTE_MAX = 100;
export const LEERE_GESCHICHTE: Geschichte = { zurueck: [], vor: [] };
const gleich = (a: Fassung, b: Fassung) => JSON.stringify(a) === JSON.stringify(b);
/** Vor einer Änderung die bisherige Fassung merken (Wiederholen verfällt). Höchstens `GESCHICHTE_MAX` Schritte zurück (die ältesten fallen — Sitzung, nicht Bestand). */
export function merke(g: Geschichte, vorher: Fassung): Geschichte {
  const l = g.zurueck.at(-1);
  if (l && gleich(l, vorher)) return { zurueck: g.zurueck, vor: [] };
  return { zurueck: [...g.zurueck, vorher].slice(-GESCHICHTE_MAX), vor: [] };
}
export function rueckgaengig(g: Geschichte, jetzt: Fassung): { geschichte: Geschichte; fassung: Fassung } | null {
  const f = g.zurueck.at(-1);
  return f ? { geschichte: { zurueck: g.zurueck.slice(0, -1), vor: [...g.vor, jetzt] }, fassung: f } : null;
}
export function wiederholen(g: Geschichte, jetzt: Fassung): { geschichte: Geschichte; fassung: Fassung } | null {
  const f = g.vor.at(-1);
  return f ? { geschichte: { zurueck: [...g.zurueck, jetzt], vor: g.vor.slice(0, -1) }, fassung: f } : null;
}

// ── Kopieren und Einfügen mit Kanten (Punkt 16) ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Ablage { knoten: K[]; zettel: NotizZettel[] }
/**
 * Kopieren (rein): die gewählten Schritte (Gruppen mit ihren Schritten) in Lese-Reihenfolge — Zweige nur zwischen ihnen; Schlösser und Auslöser bleiben
 * (das Schloss setzt die Regel neu, ein Auslöser gehört an den Anfang). Dazu gewählte Zettel. null = nichts Kopierbares.
 */
export function kopieren(f: Fassung, ids: readonly string[]): Ablage | null {
  const reihe = alleSchritte(f).map(x => x.schritt);
  const gewaehlt = new Set(ids);
  const knoten = reihe.filter(k => gewaehlt.has(k.id) && !istSchloss(k) && k.form !== 'ausloeser');
  const drin = new Set(knoten.map(k => k.id));
  const sauber = knoten.map(k => {
    let x: K = { ...k };
    delete x.schloss;
    for (const z of ZWEIGE) if (x.zweige?.[z] && !drin.has(x.zweige[z]!)) x = mitZweig(x, z, null);
    if (x.danach && 'ziel' in x.danach && !drin.has(x.danach.ziel)) delete x.danach;
    return x;
  });
  const zettel = (f.zettel ?? []).filter(z => gewaehlt.has(z.id));
  return sauber.length || zettel.length ? { knoten: sauber, zettel } : null;
}
/**
 * Einfügen (rein): neue Kennungen, Zweige und festgelegte Ausgänge auf die neuen Kennungen umgeschrieben (Kanten zwischen den Kopien kommen mit). Werkstatt-Fäden
 * (24.10., Bau-Test): ⌘V verdrahtet NIE um — die Kopien stehen lose in der Phase (was aus ihnen hinausführte, endet), kein bestehender Ausgang ändert sich. Nur wenn
 * `nach` (der eine gewählte Knoten) einen FREIEN Hauptausgang hat (dort endet der Lauf), hängen sie dort an. `lagen` = Lage je kopiertem Knoten (alte Kennung → Lage,
 * z. B. an der Mausposition); sonst werden gespeicherte Lagen um `versatz` verschoben. Verweise auf Schritte außerhalb (erneut ab, Liste einer Abfrage) bleiben — die
 * Prüfung meldet, was fehlt. Die Ansage sagt, ob verbunden oder lose.
 */
export function einfuegen(f: Fassung, a: Ablage, o: { phaseId: string; nach?: string | null; kennung: Kennung; versatz?: [number, number]; lagen?: ReadonlyMap<string, KnotenLage> }): Ergebnis {
  if (!phasen(f).some(p => p.id === o.phaseId)) return nein('Diese Phase gibt es nicht (mehr).');
  const [dx, dy] = o.versatz ?? [40, 40];
  const neuId = new Map(a.knoten.map(k => [k.id, o.kennung()]));
  const um = (id: string | undefined) => (id && neuId.has(id) ? neuId.get(id)! : id);
  // Verbunden nur an einem freien Hauptausgang des einen gewählten Knotens.
  const q0 = o.nach ? f.knoten.find(k => k.id === o.nach) : undefined;
  const q = q0 && istSchloss(q0) ? f.knoten.find(k => k.id === q0.schloss!.fuer) : q0;
  const frei = !!q && q.form !== 'ende' && !!phaseVon(f, q.id) && hauptZiel(f.knoten, q.id) === null;
  const elternId = frei ? q!.elternId ?? o.phaseId : o.phaseId;
  const neu = a.knoten.map(k => {
    const x: K = { ...k, id: neuId.get(k.id)!, elternId };
    if (k.zweige) { const z: Zweige = {}; for (const art of ZWEIGE) if (k.zweige[art]) z[art] = um(k.zweige[art]); x.zweige = z; }
    if (k.danach) { if ('ende' in k.danach) x.danach = { ende: true }; else if (neuId.has(k.danach.ziel)) x.danach = { ziel: neuId.get(k.danach.ziel)! }; else delete x.danach; }
    if (k.erneut) x.erneut = { ...k.erneut, ab: um(k.erneut.ab)! };
    if (k.schleife?.liste.startsWith('abfrage:')) x.schleife = { ...k.schleife, liste: `abfrage:${um(k.schleife.liste.slice(8))}` };
    const lage = o.lagen?.get(k.id);
    if (lage) x.pos = { x: Math.round(lage.x), y: Math.round(lage.y) };
    else if (k.pos) x.pos = { ...k.pos, x: k.pos.x + dx, y: k.pos.y + dy };
    return x;
  });
  const kopien = new Set(neu.map(k => k.id));
  const reihe = reiheVon(f.knoten, elternId);
  const sl = frei ? f.knoten.find(k => k.schloss?.fuer === q!.id && k.elternId === q!.elternId) : undefined;
  const anker = frei ? (q!.form === 'ausloeser' ? letzterAusloeser(f.knoten, elternId) ?? q!.id : sl ? sl.id : q!.id) : reihe.at(-1) ?? null;
  let kn = einreihen([...f.knoten, ...neu], elternId, neu.map(k => k.id), anker);
  // Der Eingang der Kopien: die erste, die kein Abzweig einer anderen Kopie ist.
  const seiteNeu = seitenZiele(neu);
  const eingang = neu.find(k => !seiteNeu.has(k.id));
  if (frei && eingang) kn = hauptSetzen(kn, q!.id, eingang.id);
  // Was aus den Kopien hinausführt, endet (lose bzw. dort, wo der freie Ausgang endete) — nie in einen bestehenden Schritt.
  const z = ausgangsZiele({ knoten: kn });
  for (const c of neu) {
    const ziel = z.get(hauptAusgang(kn, c.id).haupt);
    if (ziel !== undefined && ziel !== null && !kopien.has(ziel)) kn = hauptSetzen(kn, c.id, null);
  }
  const r = festschreiben(f, kn, frei ? new Set(hauptAusgang(f.knoten, q!.id).alle) : new Set());
  if (!r.ok) return nein(r.grund);
  const zettel = a.zettel.map(z => ({ ...z, id: o.kennung(), pos: { ...z.pos, x: z.pos.x + dx, y: z.pos.y + dy } }));
  const fassung: Fassung = { ...f, knoten: r.knoten, ...(zettel.length ? { zettel: [...(f.zettel ?? []), ...zettel] } : {}) };
  const n = neu.length + zettel.length;
  const was = n === 1 ? 'Ein Teil' : `${n} Teile`;
  const mit = neu.some(k => k.zweige) ? ' (mit ihren Verbindungen untereinander)' : '';
  const ansage = !neu.length ? `${was} eingefügt.` : frei && eingang ? `${was} eingefügt${mit} und an ${titel(q)} angehängt.` : `${was} lose eingefügt${mit} — noch ohne Eingang; einen Faden ziehen, um ${n === 1 ? 'ihn' : 'sie'} anzuhängen.`;
  return { ok: true, fassung, ansage, waehle: [...neu.map(k => k.id), ...zettel.map(z => z.id)] };
}
