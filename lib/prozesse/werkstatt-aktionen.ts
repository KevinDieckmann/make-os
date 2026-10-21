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
// Tests: tests/prozesse-werkstatt-aktionen.test.ts.

import type { KnotenLage, NotizZettel, ProzessForm, ProzessKnoten, Zweige } from './definition';
import { alleSchritte, kinder, phasen, schritteDer, seitenZiele, wurzel, type Ausgang } from './fluss';

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

// ── Anlegen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einen neuen Knoten anlegen (rein). `nach` = der Knoten, an dessen Ausgang `ausgang` er hängt (null: ans Ende der Phase `phaseId`, ein Auslöser an den Anfang):
 *   weiter → direkt dahinter im Strang (ein „weiter bei …“-Sprung des Vorgängers wandert an den neuen Knoten — so bleibt die Kette ganz);
 *   ja an einer Entscheidung → direkt dahinter (er ist dann der Ja-Weg); nein · Fehler · abgelaufen → ein Abzweig (Zweig gesetzt, neben dem Strang).
 * `vor` = vor diesem Knoten einfügen (Alt+←). `platz` = gespeicherte Lage; mit `platzSchaffen` rücken die Schritte rechts davon eine Spalte weiter.
 */
export function anlegen(f: Fassung, neu: K, o: { nach?: string | null; vor?: string; phaseId?: string; ausgang?: Ausgang; platz?: KnotenLage; platzSchaffen?: number }): Ergebnis {
  let kn = [...f.knoten];
  if (kn.some(k => k.id === neu.id)) return nein('Diese Kennung gibt es schon.');
  const ps = phasen(f);
  const quelle = o.nach ? kn.find(k => k.id === o.nach) : undefined;
  if (o.nach && !quelle) return nein('Den Knoten, an den angehängt werden soll, gibt es nicht (mehr).');
  const vor = o.vor ? kn.find(k => k.id === o.vor) : undefined;
  const phaseId = (quelle && phaseVon(f, quelle.id)) ?? (vor && phaseVon(f, vor.id)) ?? o.phaseId ?? ps[0]?.id;
  if (!phaseId) return nein('Erst eine Phase anlegen.');
  const ausgang: Ausgang = o.ausgang ?? 'weiter';
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
  const reihe = reiheVon(kn, elternId);
  let neueReihe: string[];
  if (n.form === 'ausloeser') {
    // Ein Auslöser steht immer am Anfang der ersten Phase.
    const erste = ps[0]?.id ?? phaseId;
    n = { ...n, elternId: erste };
    const r = reiheVon(kn, erste);
    const nachAusl = r.filter(id => kn.find(k => k.id === id)?.form === 'ausloeser').length;
    neueReihe = [...r.slice(0, nachAusl), n.id, ...r.slice(nachAusl)];
    kn = rangSetzen([...kn, n], neueReihe);
    return ok(kn, f, `Auslöser ${titel(n)} angelegt — am Anfang des Prozesses.`, [n.id]);
  }
  if (vor) {
    const i = reihe.indexOf(vor.id);
    neueReihe = [...reihe.slice(0, i), n.id, ...reihe.slice(i)];
    kn = rangSetzen([...kn, n], neueReihe);
    return ok(kn, f, `${titel(n)} angelegt, vor ${titel(vor)}.`, [n.id]);
  }
  if (!quelle) {
    neueReihe = [...reihe, n.id];
    kn = rangSetzen([...kn, n], neueReihe);
    return ok(kn, f, `${titel(n)} angelegt, am Ende der Phase.`, [n.id]);
  }
  // Steht hinter der Quelle ein Freigabe-Schloss, kommt der Neue dahinter (das Schloss steht immer direkt hinter seinem Knoten).
  const sl = kn.find(k => k.schloss?.fuer === quelle.id && k.elternId === quelle.elternId);
  const i = reihe.indexOf(sl ? sl.id : quelle.id);
  neueReihe = [...reihe.slice(0, i + 1), n.id, ...reihe.slice(i + 1)];
  const istZweig = ausgang === 'nein' || ausgang === 'fehler' || ausgang === 'abgelaufen';
  if (istZweig) {
    if (quelle.zweige?.[ausgang]) return nein(`${titel(quelle)} hat am Ausgang „${ausgang}“ schon einen Schritt — erst lösen.`);
    kn = kn.map(k => (k.id === quelle.id ? mitZweig(k, ausgang, n.id) : k));
    kn = rangSetzen([...kn, n], neueReihe);
    return ok(kn, f, `${titel(n)} angelegt am Ausgang „${ausgang}“ von ${titel(quelle)}.`, [n.id]);
  }
  // weiter / ja: direkt dahinter. Ein Sprung „weiter bei …“ des Vorgängers wandert an den neuen Knoten (Kette bleibt ganz).
  if (quelle.form !== 'entscheidung' && quelle.form !== 'freigabe' && quelle.zweige?.ja) {
    n = mitZweig(n, 'ja', quelle.zweige.ja);
    kn = kn.map(k => (k.id === quelle.id ? mitZweig(k, 'ja', null) : k));
  }
  if (quelle.form === 'entscheidung' && quelle.zweige?.ja) kn = kn.map(k => (k.id === quelle.id ? mitZweig(k, 'ja', n.id) : k));
  kn = rangSetzen([...kn, n], neueReihe);
  return ok(kn, f, `${titel(n)} angelegt und verbunden mit ${titel(quelle)}.`, [n.id]);
}

// ── Verbinden, lösen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einen Faden ziehen (rein): „weiter“ hängt das Ziel direkt hinter die Quelle in den Strang (die Reihenfolge ergibt sich aus den Fäden — wie die Fläche des
 * Fulfillment-Editors); ja/nein/Fehler/abgelaufen setzen den Zweig. Fäden bleiben in ihrer Phase; ein Abzweig gehört genau einem Schritt.
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
  if (ausgang !== 'weiter' && !(ausgang === 'ja' && a.form !== 'entscheidung' && a.form !== 'freigabe')) {
    if (ausgang !== 'ja') {
      const ursprung = seitenZiele(kn).get(nach);
      if (ursprung && ursprung !== von) return nein(`${titel(b)} ist schon der Abzweig von ${titel(kn.find(k => k.id === ursprung))}.`);
    }
    return ok(kn.map(k => (k.id === von ? mitZweig(k, ausgang, nach) : k)), f, `${titel(a)} → ${titel(b)} (${ausgang}).`);
  }
  // weiter: B direkt hinter A (gleicher Eltern-Knoten wie A) — bzw. hinter A's Freigabe-Schloss.
  const reihe = reiheVon(kn, a.elternId ?? pa).filter(id => id !== nach);
  const sl = kn.find(k => k.schloss?.fuer === von && k.elternId === a.elternId);
  const i = reihe.indexOf(sl ? sl.id : von);
  if (i < 0) return nein('Die Reihenfolge ließ sich nicht bestimmen.');
  const neuReihe = [...reihe.slice(0, i + 1), nach, ...reihe.slice(i + 1)];
  let neu = kn.map(k => (k.id === nach ? { ...k, elternId: a.elternId } : k));
  // Ein Sprung „weiter bei“ am Vorgänger würde die neue Verbindung überspringen — er fällt weg.
  if (a.zweige?.ja && a.form !== 'entscheidung' && a.form !== 'freigabe') neu = neu.map(k => (k.id === von ? mitZweig(k, 'ja', null) : k));
  // War B bisher ein Abzweig (nein/Fehler/abgelaufen) eines anderen? Dann wird er jetzt Teil des Strangs — der alte Zweig löst sich.
  const ursprung = seitenZiele(kn).get(nach);
  if (ursprung) neu = neu.map(k => { if (k.id !== ursprung) return k; let x = k; for (const z of ZWEIGE) if (x.zweige?.[z] === nach && z !== 'ja') x = mitZweig(x, z, null); return x; });
  return ok(rangSetzen(neu, neuReihe), f, `${titel(b)} folgt jetzt auf ${titel(a)}.`);
}

/** Einen Zweig lösen (rein) — der Strang („weiter“) lässt sich nicht lösen, nur umhängen. */
export function loesen(f: Fassung, von: string, ausgang: Ausgang): Ergebnis {
  const a = f.knoten.find(k => k.id === von);
  if (!a) return nein('Diesen Knoten gibt es nicht (mehr).');
  if (ausgang === 'weiter') return nein('Die Reihenfolge lässt sich nicht lösen — nur umhängen (Faden zu einem anderen Schritt ziehen).');
  if (!a.zweige?.[ausgang]) return nein('Dieser Ausgang ist schon frei.');
  return ok(f.knoten.map(k => (k.id === von ? mitZweig(k, ausgang, null) : k)), f, `Ausgang „${ausgang}“ von ${titel(a)} gelöst.`);
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
  return ok(rest, f, `${zahl === 1 ? `${titel(kn.find(k => weg.has(k.id) && schritte.has(k.id)))} gelöscht` : `${zahl} Schritte gelöscht`}${gesperrt.length ? ' — das Freigabe-Schloss bleibt' : ''}.`);
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
  return ok(rangSetzen(f.knoten.map(x => (x.id === id ? { ...x, elternId: phaseId } : x)), neu), f, `${titel(k)} liegt jetzt in „${f.knoten.find(x => x.id === phaseId)?.titel ?? ''}“.`);
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
    return x;
  });
  const zettel = (f.zettel ?? []).filter(z => gewaehlt.has(z.id));
  return sauber.length || zettel.length ? { knoten: sauber, zettel } : null;
}
/**
 * Einfügen (rein): neue Kennungen, Zweige auf die neuen Kennungen umgeschrieben (Kanten kommen mit), als Folge hinter `nach` (bzw. ans Ende der Phase);
 * gespeicherte Lagen um `versatz` verschoben. Verweise auf Schritte außerhalb (erneut ab, Liste einer Abfrage) bleiben — die Prüfung meldet, was fehlt.
 */
export function einfuegen(f: Fassung, a: Ablage, o: { phaseId: string; nach?: string | null; kennung: Kennung; versatz?: [number, number] }): Ergebnis {
  if (!phasen(f).some(p => p.id === o.phaseId)) return nein('Diese Phase gibt es nicht (mehr).');
  const [dx, dy] = o.versatz ?? [40, 40];
  const neuId = new Map(a.knoten.map(k => [k.id, o.kennung()]));
  const um = (id: string | undefined) => (id && neuId.has(id) ? neuId.get(id)! : id);
  const neu = a.knoten.map(k => {
    const x: K = { ...k, id: neuId.get(k.id)!, elternId: o.phaseId };
    if (k.zweige) { const z: Zweige = {}; for (const art of ZWEIGE) if (k.zweige[art]) z[art] = um(k.zweige[art]); x.zweige = z; }
    if (k.erneut) x.erneut = { ...k.erneut, ab: um(k.erneut.ab)! };
    if (k.schleife?.liste.startsWith('abfrage:')) x.schleife = { ...k.schleife, liste: `abfrage:${um(k.schleife.liste.slice(8))}` };
    if (k.pos) x.pos = { ...k.pos, x: k.pos.x + dx, y: k.pos.y + dy };
    return x;
  });
  const reihe = reiheVon(f.knoten, o.phaseId);
  const i = o.nach ? reihe.indexOf(o.nach) : reihe.length - 1;
  const neueReihe = [...reihe.slice(0, i + 1), ...neu.map(k => k.id), ...reihe.slice(i + 1)];
  const zettel = a.zettel.map(z => ({ ...z, id: o.kennung(), pos: { ...z.pos, x: z.pos.x + dx, y: z.pos.y + dy } }));
  const kn = rangSetzen([...f.knoten, ...neu], neueReihe);
  const fassung: Fassung = { ...f, knoten: kn, ...(zettel.length ? { zettel: [...(f.zettel ?? []), ...zettel] } : {}) };
  const n = neu.length + zettel.length;
  return { ok: true, fassung, ansage: `${n === 1 ? 'Ein Teil' : `${n} Teile`} eingefügt${neu.some(k => k.zweige) ? ' — mit ihren Verbindungen' : ''}.`, waehle: [...neu.map(k => k.id), ...zettel.map(z => z.id)] };
}
