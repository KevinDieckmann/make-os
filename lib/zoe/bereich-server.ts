// ─── ZOE: Bereich erkennen — was der Server dazu liest (09.10. spät) ───────────────────────────────────────────────────
// Die Regel steht rein in ./bereich.ts (`bereichFuerVorschlag`). Hier wird nur gesammelt, was sie braucht:
//   • der fachliche Bezug: Aufgabe (`spaceVonAufgabe`), Kalender (`spaceVonKalender`), CRM-Eintrag (Business, außer alle Deals/Mandate der
//     Firma liegen bei einer Privat-Einheit — `bereichVonGesellschaft`), Vorschlag eines Heads (Bereich des Heads aus dem Katalog);
//   • die bekannten Namen: CRM-Firmen und -Kontakte über die Sicht der Markttraktion (`crmBekannteNamen`, lib/zoe/crm-sicht.ts — Art. 18 fehlt)
//     und die eigenen Gesellschaften aus dem Register. Nur zum ERKENNEN — kein Name verlässt diese Stelle, gespeichert werden nur Kennungen.
// Wirft nie: scheitert das Lesen, bleibt (c) das Gespräch bzw. (d) „unklar“.

import { bereichFuerVorschlag, bereichAus, namensSchluessel, textSchluessel, genannteNamen, type Bereich, type BereichErgebnis, type BekannterName, type BereichKontext, type BereichOrt } from './bereich';
import type { Vorschlag } from './stapel';

type VorschlagRoh = Pick<Vorschlag, 'werkzeug' | 'gruppe' | 'titel' | 'nachher' | 'eingabe'> & Partial<Pick<Vorschlag, 'vorher' | 'anlass' | 'bezug'>>;

const sicher = async <T>(p: () => Promise<T>, sonst: T): Promise<T> => { try { return await p(); } catch { return sonst; } };

/** Die bekannten Namen der Instanz (CRM-Firmen, -Kontakte, eigene Gesellschaften) — 60 s gemerkt, jede Schreibung leert den Speicher. */
export async function bekannteNamen(): Promise<BekannterName[]> {
  const { merken } = await import('@/lib/store/memo');
  const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
  const h = await sicher(() => karteiHaushalt(), 'haupt');
  return merken(`zoe-bereich-namen:${h}`, 60_000, async () => {
    const [crm, register] = await Promise.all([
      sicher(async () => (await import('./crm-sicht')).crmBekannteNamen(), { firmen: [], kontakte: [] }),
      sicher(async () => gesellschaftsNamen(h), [] as BekannterName[]),
    ]);
    const namen: BekannterName[] = [];
    for (const f of crm.firmen) {
      const schluessel = namensSchluessel(f.name, 'firma');
      if (schluessel) namen.push({ art: 'firma', id: f.id, schluessel, bereich: f.bereich, ...(f.ort ? { ort: f.ort } : {}) });
    }
    for (const k of crm.kontakte) {
      const schluessel = namensSchluessel(k.name, 'kontakt');
      if (schluessel) namen.push({ art: 'kontakt', id: k.id, schluessel, bereich: k.bereich, ...(k.ort ? { ort: k.ort } : {}) });
    }
    return [...register, ...namen];
  });
}

/** Die eigenen Gesellschaften (feste + Register) mit Anzeigename und Firmierung — feste nach ihrem Bereich, Register-Gesellschaften Business. */
async function gesellschaftsNamen(haushalt: string): Promise<BekannterName[]> {
  const [{ ladeRegister }, { alleGesellschaften, anzeigeName }, { bereichVon, istGesellschaft }] = await Promise.all([
    import('@/lib/gesellschaften/server'), import('@/lib/gesellschaften/modell'), import('@/lib/einheiten'),
  ]);
  const raus: BekannterName[] = [];
  for (const g of alleGesellschaften(await ladeRegister(haushalt).catch(() => null))) {
    const name = anzeigeName(g);
    const bereich: Bereich = istGesellschaft(g.id) ? bereichVon(g.id) : 'business';
    for (const n of new Set([name, g.firmierung, g.name].filter((x): x is string => !!x))) {
      const schluessel = namensSchluessel(n, 'gesellschaft');
      if (schluessel) raus.push({ art: 'gesellschaft', id: g.id, schluessel, bereich, ort: { id: g.id, name } });
    }
  }
  return raus;
}

/** Bereich eines Heads aus dem Katalog — null, wenn unbekannt. */
async function headBereich(id: unknown): Promise<Bereich | null> {
  if (typeof id !== 'string' || !id) return null;
  const { headDef } = await import('@/lib/agenten/katalog');
  return bereichAus(headDef(id)?.bereich);
}

/** Der aufgelöste fachliche Bezug (a) — null, wenn der Vorschlag keinen hat oder er sich nicht lesen lässt. */
async function bezugAufloesen(v: VorschlagRoh): Promise<BereichKontext['bezug']> {
  const b = v.bezug;
  const e = v.eingabe ?? {};
  if (b?.art === 'aufgabe') {
    const [{ ladeAufgaben }, { spaceVonAufgabe }, { finanzOrtName, istGesellschaft }] = await Promise.all([
      import('@/lib/aufgaben/sicht'), import('@/lib/make-one/space-regeln'), import('@/lib/einheiten'),
    ]);
    const t = (await ladeAufgaben()).tasks.find(x => x.id === b.id);
    if (!t) return null;
    const ort: BereichOrt | undefined = t.spaceId && istGesellschaft(t.spaceId) ? { id: t.spaceId, name: finanzOrtName(t.spaceId) } : t.spaceId?.startsWith('m-') ? { id: t.spaceId, name: 'Mandant' } : undefined;
    return { bereich: spaceVonAufgabe(t), ...(ort ? { ort } : {}) };
  }
  if (b?.art === 'kalender' && typeof e.kalender === 'string' && e.kalender) {
    const [{ ladeEinstellungen }, { spaceVonKalender }] = await Promise.all([import('@/lib/kalender/einstellungen'), import('@/lib/kalender/space')]);
    return { bereich: spaceVonKalender(await ladeEinstellungen(), e.kalender) };
  }
  if (b?.art === 'crm') return (await import('./crm-sicht')).crmBezugBereich(b.id);
  if (b && ['skill', 'mitarbeiter', 'merksatz'].includes(b.art)) { const h = await headBereich(b.id); return h ? { bereich: h } : null; }
  if (b?.art === 'medien') { const h = await headBereich(e.head); return h ? { bereich: h } : null; }
  return null;
}

/** Bereich des Heads hinter dem Anlass („<Head>: …“) — für Vorschläge ohne eigenen Bezug (Pläne, Werkzeuge eines Heads). */
async function headVonAnlass(v: VorschlagRoh): Promise<Bereich | null> {
  if (!v.anlass) return null;
  const { headVonVorschlag } = await import('@/lib/agenten/katalog');
  return headBereich(headVonVorschlag({ anlass: v.anlass, ...(v.bezug ? { bezug: v.bezug } : {}) }));
}

/**
 * Bereich eines Vorschlags ermitteln (die EINE Regel mit den Daten des Bestands). `gespraech` = der geprüfte Bereich des Gesprächs (c).
 * Wirft nie — ohne lesbaren Bestand gelten (c) bzw. (d).
 */
export async function bereichErmitteln(v: VorschlagRoh, opt: { gespraech?: Bereich | null } = {}): Promise<BereichErgebnis> {
  const gespraech = bereichAus(opt.gespraech);
  try {
    const [bezug, head, namen] = await Promise.all([
      sicher(() => bezugAufloesen(v), null),
      sicher(() => headVonAnlass(v), null),
      sicher(() => bekannteNamen(), [] as BekannterName[]),
    ]);
    return bereichFuerVorschlag(v, { bezug, head, namen, gespraech });
  } catch {
    return gespraech ? { bereich: gespraech, quelle: 'gespraech' } : { bereich: 'unklar' };
  }
}

/** Nennt der Text (Frage, frühere Fragen) eine Firma oder Person aus der Markttraktion? — für die Werkzeug-Wahl (crm_vorschlag anbieten). */
export async function textNenntCrm(texte: readonly string[]): Promise<boolean> {
  const namen = await sicher(() => bekannteNamen(), [] as BekannterName[]);
  const crm = namen.filter(n => n.art === 'firma' || n.art === 'kontakt');
  return crm.length > 0 && genannteNamen(textSchluessel(texte), crm, 1).length > 0;
}
