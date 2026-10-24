// ─── Prozesse — der Fluss: Schritte, Kanten, Prüfung (Etappe B1, 21.10.; ANALYSE_100.md Punkte 45, 62) ───────────────────────────────────────────
// EINE Stelle, die sagt, was nach einem Schritt kommt — Werkstatt (B2) zeichnet die Kanten, der Motor (C1) geht sie. Gespeichert wird wie im Fulfillment:
// die Reihenfolge im Strang einer Phase (`rang`) und die Zweige (`zweige`). Daraus `kantenVon`:
//   weiter       zum nächsten Schritt im Strang (bzw. zum ersten der nächsten Phase); `zweige.ja` an einem Schritt = „weiter bei …“ (ein Sprung)
//   ja / nein    an einer Entscheidung (ja = weiter); an einer Freigabe: ja = freigegeben, nein = abgelehnt
//   fehler       Fehlerkante (Aktion, Agent, Teilprozess, Schleife)
//   abgelaufen   Warten bzw. Freigabe nach der Obergrenze
// Ziele von nein/fehler/abgelaufen stehen NEBEN dem Strang (wie der Nein-Zweig im Fulfillment): danach geht es bei ihrem `zweige.ja` weiter, sonst zurück
// in den Strang hinter dem Knoten, von dem sie abzweigen; ein Ende-Knoten beendet den Weg. Ein Freigabe-Schloss (lib/prozesse/schloss.ts) steht immer
// DIREKT hinter seinem Knoten — egal, wo es gespeichert ist. Kreise nur über eine Erinnerung zurück zur Entscheidung (die Schleife des Fulfillments);
// eine Schleife „je Eintrag“ ruft einen Teilprozess (kein Kreis im Fluss). Mehrere Auslöser stehen am Anfang nebeneinander und führen JEDER in den ersten
// Schritt dahinter (22.10., Befund 2). Werkstatt-Fäden (24.10.): `danach` legt den Hauptausgang ausdrücklich fest (ein Schritt — auch in einer anderen Phase —
// bzw. „Lauf endet“); ein Sprung `zweige.ja` gewinnt davor, der Strang kommt danach. Ohne das Feld bit-gleich. `ausgangsZiele` = die aufgelösten Ziele aller
// Ausgänge (Schlüssel `<Knoten>|<Ausgang>`) — die Werkstatt hält damit die Regel „eine Bau-Aktion ändert nie, wohin ein ANDERER Ausgang führt“.
// Rein und client-sicher; Tests: tests/prozesse-modell.test.ts, tests/prozesse-vorlagen-gliederung.test.ts, tests/prozesse-werkstatt-faeden.test.ts.

import type { Befund, ProzessDefinition, ProzessForm, ProzessKnoten } from './definition';

type K = ProzessKnoten<ProzessForm>;
export type Ausgang = 'weiter' | 'ja' | 'nein' | 'fehler' | 'abgelaufen';
/** Eine Kante: von → nach (`null` = der Lauf endet hier). */
export interface Kante { von: string; nach: string | null; ausgang: Ausgang }

const nachRang = (a: K, b: K) => a.rang - b.rang || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
/** Der ausdrücklich festgelegte Hauptausgang (`danach`): Kennung, `null` = „Lauf endet“, `undefined` = nicht festgelegt. */
export const danachZiel = (k: Pick<K, 'danach'>): string | null | undefined => (k.danach ? ('ende' in k.danach ? null : k.danach.ziel) : undefined);
/** Direkte Kinder (Rang-Reihenfolge); `undefined` = die Wurzeln. */
export function kinder(id: string | undefined, kn: readonly K[]): K[] {
  const ids = new Set(kn.map(k => k.id));
  return kn.filter(k => (id === undefined ? !k.elternId || !ids.has(k.elternId) : k.elternId === id && k.id !== id)).sort(nachRang);
}
export const wurzel = (kn: readonly K[]): K | null => kinder(undefined, kn)[0] ?? null;
/** Die Phasen (Ebene 2) in Rang-Reihenfolge. */
export const phasen = (d: Pick<ProzessDefinition, 'knoten'>): K[] => { const w = wurzel(d.knoten); return w ? kinder(w.id, d.knoten) : []; };
/** Die Schritte einer Phase in Lese-Reihenfolge: ein Kind ohne Kinder ist ein Schritt, ein Kind mit Kindern eine Gruppe (ihre Kinder sind Schritte). Bausteine (Ebene 5, `bausteinId`) sind keine Schritte. */
export function schritteDer(d: Pick<ProzessDefinition, 'knoten'>, phaseId: string): K[] {
  const raus: K[] = [];
  for (const t of kinder(phaseId, d.knoten)) {
    if (t.bausteinId) continue;
    const ks = kinder(t.id, d.knoten).filter(c => !c.bausteinId);
    if (!kinder(t.id, d.knoten).length) raus.push(t);
    else raus.push(...ks);
  }
  return raus;
}
/** Alle Schritte aller Phasen (Lese-Reihenfolge) mit ihrer Phase. */
export function alleSchritte(d: Pick<ProzessDefinition, 'knoten'>): { schritt: K; phase: K }[] {
  return phasen(d).flatMap(p => schritteDer(d, p.id).map(s => ({ schritt: s, phase: p })));
}

/** Knoten, die neben dem Strang stehen: Ziele von nein/fehler/abgelaufen, mit der Kennung des Knotens, von dem sie abzweigen. */
export function seitenZiele(kn: readonly K[]): Map<string, string> {
  const raus = new Map<string, string>();
  for (const k of kn) for (const z of [k.zweige?.nein, k.zweige?.fehler, k.zweige?.abgelaufen]) if (z && z !== k.id && !raus.has(z)) raus.set(z, k.id);
  return raus;
}
/** Schloss → sein Knoten (`schloss.fuer`). */
export const schloesser = (kn: readonly K[]): Map<string, string> => new Map(kn.filter(k => k.form === 'freigabe' && k.schloss?.fuer).map(k => [k.schloss!.fuer, k.id]));

/**
 * Die Kanten des Flusses (rein, deterministisch). Der Strang einer Phase = ihre Schritte ohne Seitenziele und ohne Schlösser; nach dem letzten Schritt
 * einer Phase geht es zum ersten der nächsten. Ein Schloss steht direkt hinter seinem Knoten: der Knoten geht „weiter“ ins Schloss, das Schloss mit
 * „ja“ (freigegeben) dorthin, wohin der Knoten sonst ginge.
 */
export function kantenVon(d: Pick<ProzessDefinition, 'knoten'>): Kante[] {
  const kn = d.knoten;
  const seite = seitenZiele(kn);
  const schloss = schloesser(kn);
  const istSchloss = new Set(schloss.values());
  const ps = phasen(d);
  const haupt = ps.map(p => schritteDer(d, p.id).filter(s => !seite.has(s.id) && !istSchloss.has(s.id)));
  const flach = haupt.flat();
  const naechsterIm = new Map<string, string | null>();
  flach.forEach((s, i) => naechsterIm.set(s.id, flach[i + 1]?.id ?? null));
  const nach = new Map(kn.map(k => [k.id, k]));
  const raus: Kante[] = [];
  const kante = (von: string, ziel: string | null, ausgang: Ausgang) => raus.push({ von, nach: ziel, ausgang });

  /** Wohin es nach einem Knoten „positiv“ weitergeht (ohne Schloss): eigener Sprung, sonst der Strang bzw. hinter dem Ursprung des Seitenziels. */
  const weiterVon = (k: K, gesehen = new Set<string>()): string | null => {
    if (k.form === 'ende') return null;
    if (k.zweige?.ja && k.form !== 'entscheidung' && k.form !== 'freigabe') return k.zweige.ja;
    const fest = danachZiel(k);
    if (fest !== undefined) return fest;
    if (naechsterIm.has(k.id)) return naechsterIm.get(k.id)!;
    // Zurück in den Strang HINTER dem Ursprung — sein Sprung bzw. sein festgelegter Ausgang gilt dafür nicht (der Abzweig kehrt in den Strang zurück).
    const u = seite.get(k.id);
    if (u && !gesehen.has(u)) { gesehen.add(u); const o = nach.get(u); if (o) return weiterVon({ ...o, zweige: { ...o.zweige, ja: undefined }, danach: undefined } as K, gesehen); }
    return null;
  };

  /**
   * Mehrere Auslöser (Feinschliff 22.10., Befund 2): sie stehen nebeneinander am Anfang, und JEDER führt in den ersten Schritt dahinter — nie in den
   * nächsten Auslöser (der hätte keinen Eingang, die Werkstatt zeigte den Faden nicht). Der Motor startet ohnehin beim Auslöser, der feuerte.
   */
  const nachAusloesern = (id: string): string | null => {
    let n = naechsterIm.get(id) ?? null;
    const gesehen = new Set<string>();
    while (n && nach.get(n)?.form === 'ausloeser' && !gesehen.has(n)) { gesehen.add(n); n = naechsterIm.get(n) ?? null; }
    return n;
  };

  const schritte = new Set(alleSchritte(d).map(x => x.schritt.id));
  for (const k of kn) {
    if (!schritte.has(k.id) || istSchloss.has(k.id)) continue; // Wurzel, Phasen, Gruppen, Bausteine; Schlösser unten bei ihrem Knoten
    if (k.form === 'ende') continue;
    const positiv = k.form === 'entscheidung' ? (k.zweige?.ja ?? weiterVon({ ...k, zweige: { ...k.zweige, ja: undefined } } as K))
      : k.form === 'ausloeser' && naechsterIm.has(k.id) && !k.danach ? nachAusloesern(k.id) : weiterVon(k);
    const l = schloss.get(k.id);
    const ausgangPositiv: Ausgang = k.form === 'entscheidung' ? 'ja' : k.form === 'freigabe' ? 'ja' : 'weiter';
    if (l) {
      // Das Schloss steht direkt dahinter: freigegeben → wohin der Knoten sonst ginge; abgelehnt/abgelaufen → eigener Zweig, sonst endet der Lauf.
      const s = nach.get(l)!;
      kante(k.id, l, ausgangPositiv);
      kante(l, positiv, 'ja');
      kante(l, s.zweige?.nein ?? null, 'nein');
      kante(l, s.zweige?.abgelaufen ?? null, 'abgelaufen');
    } else kante(k.id, positiv, ausgangPositiv);
    if (k.form === 'entscheidung' && k.zweige?.nein) kante(k.id, k.zweige.nein, 'nein');
    if (k.form === 'freigabe') { kante(k.id, k.zweige?.nein ?? null, 'nein'); kante(k.id, k.zweige?.abgelaufen ?? null, 'abgelaufen'); }
    if (k.form === 'warten') kante(k.id, k.zweige?.abgelaufen ?? positiv, 'abgelaufen');
    if (k.zweige?.fehler) kante(k.id, k.zweige.fehler, 'fehler');
  }
  return raus;
}

/**
 * Die aufgelösten Ziele aller Ausgänge (rein) — dieselbe Auflösung wie Lauf-Motor und Probelauf (`kantenVon`): Schlüssel `<Knoten>|<Ausgang>`, Wert = Ziel bzw.
 * `null` (der Lauf endet). Ein „abgelaufen“ am Warten ohne eigenes Ziel geht denselben Weg wie „weiter“ — kein eigener Ausgang. Dazu der Ausstieg einer Erinnerung
 * mit „danach zurück zu …“ (`<Knoten>|ausstieg`: wohin der Motor nach der letzten Runde geht — lib/prozesse/lauf-regeln.ts `ausstiegZiel`).
 */
export function ausgangsZiele(d: Pick<ProzessDefinition, 'knoten'>): Map<string, string | null> {
  const raus = new Map<string, string | null>();
  const nach = new Map(d.knoten.map(k => [k.id, k]));
  for (const k of kantenVon(d)) {
    const v = nach.get(k.von);
    if (k.ausgang === 'abgelaufen' && v?.form === 'warten' && !v.zweige?.abgelaufen) continue;
    const s = `${k.von}|${k.ausgang}`;
    if (!raus.has(s)) raus.set(s, k.nach);
  }
  const mitJa = new Set(d.knoten.filter(k => k.form === 'erinnerung' && k.zweige?.ja).map(k => k.id));
  if (mitJa.size) {
    const ohne = { knoten: d.knoten.map(k => (mitJa.has(k.id) ? { ...k, zweige: { ...k.zweige, ja: undefined } } : k)) };
    for (const k of kantenVon(ohne)) if (k.ausgang === 'weiter' && mitJa.has(k.von)) raus.set(`${k.von}|ausstieg`, k.nach);
  }
  return raus;
}

/** Die Startknoten (Auslöser) in Lese-Reihenfolge. */
export const startKnoten = (d: Pick<ProzessDefinition, 'knoten'>): K[] => alleSchritte(d).map(x => x.schritt).filter(s => s.form === 'ausloeser');

/** Welche Zweige eine Form tragen darf. */
const ERLAUBT: Readonly<Record<ProzessForm, readonly ('ja' | 'nein' | 'fehler' | 'abgelaufen')[]>> = {
  schritt: ['ja', 'fehler'], nachricht: ['ja', 'fehler'], termin: ['ja', 'fehler'], abstimmung: ['ja'],
  entscheidung: ['ja', 'nein', 'fehler'], erinnerung: ['ja'],
  ausloeser: [], agent: ['ja', 'fehler'], warten: ['ja', 'abgelaufen'], schleife: ['ja', 'fehler'], teilprozess: ['ja', 'fehler'],
  freigabe: ['nein', 'abgelaufen'], ende: [],
};

/**
 * Den Fluss prüfen (rein) — Befunde statt Abbruch (die Werkstatt zeigt alle): Zweige nur, wo die Form sie trägt, Ziele sind Schritte derselben Phase (nie
 * ein Auslöser, nie der Knoten selbst), ein Seitenziel gehört genau einem Ursprung, Auslöser stehen am Anfang der ersten Phase, Kreise nur über
 * Erinnerung → Entscheidung. Hinweis ab `schritteHinweis` Schritten je Phase.
 */
export function flussPruefen(d: Pick<ProzessDefinition, 'knoten'>, schritteHinweis = 10): Befund[] {
  const raus: Befund[] = [];
  const kn = d.knoten;
  const nach = new Map(kn.map(k => [k.id, k]));
  const schrittPhase = new Map<string, string>();
  const ps = phasen(d);
  for (const p of ps) {
    const s = schritteDer(d, p.id);
    for (const x of s) schrittPhase.set(x.id, p.id);
    if (s.length > schritteHinweis) raus.push({ stufe: 'hinweis', text: `„${p.titel}“ hat ${s.length} Schritte — einen Teilprozess bilden?`, knotenId: p.id });
  }
  const ursprung = new Map<string, string>();
  for (const k of kn) {
    const z = k.zweige;
    if (!z) continue;
    const ph = schrittPhase.get(k.id);
    if (!ph) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ ist kein Schritt — Zweige gibt es nur an Schritten.`, knotenId: k.id }); continue; }
    const form: ProzessForm = k.form ?? 'schritt';
    for (const art of ['ja', 'nein', 'fehler', 'abgelaufen'] as const) {
      const ziel = z[art];
      if (!ziel) continue;
      if (!ERLAUBT[form].includes(art) && !(art === 'ja' && k.schloss)) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ hat keinen Ausgang „${art}“.`, knotenId: k.id }); continue; }
      if (ziel === k.id) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ zeigt auf sich selbst.`, knotenId: k.id }); continue; }
      const zk = nach.get(ziel);
      if (!zk || !schrittPhase.has(ziel)) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ (${art}) zeigt auf keinen Schritt.`, knotenId: k.id }); continue; }
      if (schrittPhase.get(ziel) !== ph) raus.push({ stufe: 'fehler', text: `„${k.titel}“ (${art}) zeigt in eine andere Phase — Zweige bleiben in ihrer Phase.`, knotenId: k.id });
      if (zk.form === 'ausloeser') raus.push({ stufe: 'fehler', text: `„${k.titel}“ (${art}) zeigt auf einen Auslöser.`, knotenId: k.id });
      if (art !== 'ja') {
        const alt = ursprung.get(ziel);
        if (alt && alt !== k.id) raus.push({ stufe: 'fehler', text: `„${zk.titel}“ ist schon der Abzweig eines anderen Schritts.`, knotenId: k.id });
        ursprung.set(ziel, k.id);
      }
    }
  }
  // Ein festgelegter Hauptausgang (`danach`, 24.10.): nie an einem Ende oder Schloss; das Ziel ist ein Schritt (jede Phase) — nie ein Auslöser, nie ein Schloss, nie
  // der Knoten selbst.
  const istSchlossK = new Set(kn.filter(k => k.form === 'freigabe' && k.schloss).map(k => k.id));
  for (const k of kn) {
    if (!k.danach) continue;
    if (!schrittPhase.has(k.id)) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ ist kein Schritt — einen Ausgang gibt es nur an Schritten.`, knotenId: k.id }); continue; }
    if (k.form === 'ende' || istSchlossK.has(k.id)) { raus.push({ stufe: 'fehler', text: `„${k.titel}“ hat keinen eigenen Ausgang „weiter“.`, knotenId: k.id }); continue; }
    const ziel = danachZiel(k);
    if (!ziel) continue;
    const zk = nach.get(ziel);
    if (ziel === k.id) raus.push({ stufe: 'fehler', text: `„${k.titel}“ zeigt auf sich selbst.`, knotenId: k.id });
    else if (!zk || !schrittPhase.has(ziel)) raus.push({ stufe: 'fehler', text: `„${k.titel}“ (weiter) zeigt auf keinen Schritt.`, knotenId: k.id });
    else if (zk.form === 'ausloeser') raus.push({ stufe: 'fehler', text: `„${k.titel}“ (weiter) zeigt auf einen Auslöser.`, knotenId: k.id });
    else if (istSchlossK.has(ziel)) raus.push({ stufe: 'fehler', text: `„${k.titel}“ (weiter) zeigt auf ein Freigabe-Schloss — es steht immer direkt hinter seinem Schritt.`, knotenId: k.id });
  }
  // Auslöser: nur am Anfang der ersten Phase.
  const erste = ps[0] ? schritteDer(d, ps[0].id) : [];
  let anfang = true;
  for (const s of erste) { if (s.form === 'ausloeser') { if (!anfang) raus.push({ stufe: 'fehler', text: `Der Auslöser „${s.titel}“ steht nicht am Anfang.`, knotenId: s.id }); } else anfang = false; }
  for (const { schritt, phase } of alleSchritte(d)) if (schritt.form === 'ausloeser' && phase.id !== ps[0]?.id) raus.push({ stufe: 'fehler', text: `Der Auslöser „${schritt.titel}“ steht nicht in der ersten Phase.`, knotenId: schritt.id });
  // Kreise (nur Erinnerung → Entscheidung erlaubt).
  if (!raus.some(b => b.stufe === 'fehler')) {
    const kanten = kantenVon(d);
    const aus = new Map<string, string[]>();
    for (const k of kanten) if (k.nach) aus.set(k.von, [...(aus.get(k.von) ?? []), k.nach]);
    const erlaubt = (a: string, b: string) => nach.get(a)?.form === 'erinnerung' && nach.get(b)?.form === 'entscheidung';
    const zustand = new Map<string, 1 | 2>();
    const geh = (x: string): string | null => {
      zustand.set(x, 1);
      for (const y of aus.get(x) ?? []) {
        if (erlaubt(x, y)) continue;
        const z = zustand.get(y);
        if (z === 1) return y;
        if (!z) { const r = geh(y); if (r) return r; }
      }
      zustand.set(x, 2);
      return null;
    };
    for (const x of aus.keys()) {
      if (zustand.has(x)) continue;
      const kreis = geh(x);
      if (kreis) { raus.push({ stufe: 'fehler', text: `Kreis im Ablauf bei „${nach.get(kreis)?.titel ?? ''}“ — eine Schleife geht nur über eine Erinnerung zurück zur Entscheidung (oder über den Baustein „Schleife“).`, knotenId: kreis }); break; }
    }
  }
  return raus;
}
