'use client';

// ─── MAKE OS — Ernährung & Einkauf zu zweit ─────────────────────────────────
// Kevin (26.09.): Lebensmittel bevorzugt nehmen, Bedürfnisse je Person (Malin
// pflegt ihre selbst), was zuhause ist wird benutzt, an jedem Gericht das
// Rezept. Entscheidungen: ihr zwei + Gäste, Lieferdienst (Warenkorb-Text),
// Vorlieben als Lebensmittel + Qualitätshinweis.
//
//   Essens-Woche  → Klick auf ein Feld öffnet das Rezept (oder lässt es schreiben)
//   Einkaufsliste → nach Kategorie, Menge, für wen; Warenkorb kopieren; Eingekauft → Vorrat
//   Vorrat        → was da ist (Jarvis verbraucht es, die Liste lässt es weg)
//   Stammliste    → bevorzugte Lebensmittel mit Hinweis, ein Tipp → Liste
//   Profile       → je Person; Gäste für den Haushalt
//   Unsere Gerichte → die Bibliothek: suchen, Lieblinge, einplanen, Zutaten → Liste, von Hand /
//                   von Jarvis / aus eingefügtem Text anlegen, bearbeiten, Notiz (Kevin 26.09.)
// Jede Änderung ist ein kleiner Schritt (PATCH) — zu zweit am Handy überschreibt niemand den anderen.

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import {
  TAGE, TAG_LABEL, MAHLZEITEN, KATEGORIEN, KATEGORIE_LABEL, sauberDatei, wendeAn, postenParsen, postenAus, fehlendeZutaten, warenkorbText, gruppiert, imVorrat, aufDerListe, gefuellt, kategorieRaten, neueId,
  gerichteFiltern, tagsHaeufig, imPlan, gerichtZuName, zutatenAusText, schritteAusText,
  type ErnaehrungFile, type Mahlzeiten, type Tag, type Mahlzeit, type Op, type Gericht, type EinkaufPosten, type Profil, type Kategorie, type PlanGerichte,
} from '@/lib/ernaehrung/modell';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Haken, feld, LEUCHT, Spalten, Spalte, useBreit } from './schlank';

interface Daten extends ErnaehrungFile { ich: string; personen: { id: string; name: string }[]; budget: { monat: string; ausgegeben: number; budget: number | null } | null }
interface Vorschlag { begruendung: string; plan: Record<Tag, Mahlzeiten>; planGerichte: PlanGerichte; gerichte: Gericht[]; einkauf: EinkaufPosten[]; hinweis: string }

const klein: CSSProperties = { ...feld, padding: '8px 11px', fontSize: TYP.bedien };
const nackt: CSSProperties = { background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.inkLeise, fontSize: TYP.bedien };
const mikro: CSSProperties = { fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 };
const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
const euro = (cent: number) => `${Math.round(cent / 100).toLocaleString('de-DE')} €`;
const kuerzel = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const listeText = (l: string[]) => l.join(', ');
const textListe = (t: string) => t.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

export function ErnaehrungView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const [meld, setMeld] = useState('');
  const [vorschlag, setVorschlag] = useState<Vorschlag | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [hinweis, setHinweis] = useState('');
  const [gaeste, setGaeste] = useState<string[]>([]);
  const [offen, setOffen] = useState<{ tag: Tag; k: Mahlzeit } | null>(null);
  const [rezeptLaeuft, setRezeptLaeuft] = useState(false);
  const [neu, setNeu] = useState('');
  const [neuVorrat, setNeuVorrat] = useState('');
  const [neuStamm, setNeuStamm] = useState({ name: '', hinweis: '', menge: '', kategorie: '' as Kategorie | '' });
  const [neuGast, setNeuGast] = useState('');
  // Bibliothek: gewähltes Gericht (aus der Liste oder per Link ?g=…), Suche, Tag-Filter, offenes Formular (neu | Gericht-Id)
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [suche, setSuche] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [nurLieblinge, setNurLieblinge] = useState(false);
  const [formular, setFormular] = useState<'neu' | string | null>(null);
  const rezeptRef = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  // Am Handy steht der Wochentag über seinen drei Feldern, am Rechner davor.
  const breit = useBreit();
  const planTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const laden = useCallback(() => fetch('/api/state/ernaehrung', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.error) setFehler(d.error); else setDaten(d); }).catch(() => setFehler('Nicht erreichbar.')), []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { const g = params.get('g'); if (g && /^[a-z0-9-]{1,40}$/i.test(g)) { setGewaehlt(g); setOffen(null); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Kommt man per Link (?g=…), steht das Rezept nach dem Laden im Bild — am Handy liegt es sonst unter dem Plan.
  useEffect(() => { if (daten && params.get('g')) setTimeout(() => rezeptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); }, [!!daten]); // eslint-disable-line react-hooks/exhaustive-deps
  const melde = (t: string) => { setMeld(t); setTimeout(() => setMeld(''), 3000); };

  /** Kleine Schritte: sofort im Bild, dann zum Server; die Antwort ist der wahre Stand. */
  const patch = useCallback(async (ops: Op[]) => {
    setDaten(d => (d ? { ...d, ...wendeAn(d, ops, d.ich).datei } : d));
    const r = await fetch('/api/state/ernaehrung', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) setDaten(d => (d ? { ...d, ...sauberDatei(r), ich: d.ich } : d));
    else if (r?.error) melde(r.error);
    if (r?.abgelehnt?.length) melde('Nicht übernommen: fremdes Profil.');
  }, []);

  const planSetzen = (tag: Tag, k: Mahlzeit, wert: string) => {
    setDaten(d => (d ? { ...d, plan: { ...d.plan, [tag]: { ...d.plan[tag], [k]: wert } } } : d));
    const key = `${tag}.${k}`;
    clearTimeout(planTimer.current[key]);
    planTimer.current[key] = setTimeout(() => { void patch([{ feld: 'plan', tag, mahlzeit: k, wert, gerichtId: wert.trim() ? gerichtZuName(daten?.gerichte ?? [], wert)?.id ?? daten?.planGerichte[tag]?.[k] ?? null : null }]); }, 600);
  };

  async function jarvisPlant() {
    setDenkt(true); setVorschlag(null);
    try {
      const r = await fetch('/api/ernaehrung/vorschlag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hinweis, gaeste }) });
      const d = await r.json();
      if (d.plan) setVorschlag(d); else melde(d.error ?? 'Kein Vorschlag.');
    } catch { melde('Nicht erreichbar.'); }
    setDenkt(false);
  }
  function uebernehmen() {
    if (!daten || !vorschlag) return;
    const ops: Op[] = [];
    for (const g of vorschlag.gerichte) ops.push({ liste: 'gerichte', op: 'upsert', eintrag: g as unknown as Record<string, unknown> });
    for (const t of TAGE) for (const m of MAHLZEITEN) ops.push({ feld: 'plan', tag: t, mahlzeit: m.k, wert: vorschlag.plan[t][m.k], gerichtId: vorschlag.planGerichte[t]?.[m.k] ?? null });
    // Offene Posten bleiben; nur Neues kommt dazu (nichts doppelt, nichts aus dem Vorrat).
    for (const p of vorschlag.einkauf) if (!aufDerListe(p.text, daten.einkauf) && !imVorrat(p.text, daten.vorrat)) ops.push({ liste: 'einkauf', op: 'upsert', eintrag: { ...postenAus(p.text, daten.lebensmittel, { menge: p.menge, kategorie: p.kategorie, quelle: 'plan' }) } });
    void patch(ops); setVorschlag(null); melde('Woche übernommen — Rezepte und Liste stehen.');
  }
  async function rezeptAnfordern(body: { name: string; tag?: Tag; mahlzeit?: Mahlzeit; beschreibung?: string; text?: string }): Promise<Gericht | null> {
    setRezeptLaeuft(true);
    const r = await fetch('/api/ernaehrung/rezept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ error: 'Nicht erreichbar.' }));
    setRezeptLaeuft(false);
    if (r.error) { melde(r.error); return null; }
    await laden();
    return (r.gericht as Gericht) ?? null;
  }
  async function rezeptSchreiben(tag: Tag, k: Mahlzeit) {
    if (!daten) return;
    const name = daten.plan[tag][k].trim(); if (!name) return;
    await rezeptAnfordern({ name, tag, mahlzeit: k });
  }
  /** Bibliothek: Jarvis schreibt zu Name + Wunsch, oder bringt einen eingefügten Rezept-Text in Form. */
  async function gerichtVonJarvis(name: string, beschreibung: string, text: string) {
    const g = await rezeptAnfordern({ name, beschreibung: beschreibung || undefined, text: text || undefined });
    if (g) { setFormular(null); oeffneGericht(g.id); melde('Rezept gespeichert.'); }
  }
  function oeffneGericht(id: string) { setOffen(null); setGewaehlt(id); setTimeout(() => rezeptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
  function zutatenAufListe(g: Gericht) {
    if (!daten) return;
    const fehlt = fehlendeZutaten(g, daten.vorrat, daten.einkauf);
    if (!fehlt.length) { melde('Alles da oder schon auf der Liste.'); return; }
    void patch(fehlt.map(z => ({ liste: 'einkauf', op: 'upsert', eintrag: { ...postenAus(z.name, daten.lebensmittel, { menge: z.menge || undefined, quelle: 'rezept' }) } })));
    melde(`${fehlt.length} Zutaten auf die Liste gesetzt.`);
  }
  function gerichtSpeichern(eintrag: Record<string, unknown>) {
    void patch([{ liste: 'gerichte', op: 'upsert', eintrag }]);
    setFormular(null);
    if (typeof eintrag.id === 'string') oeffneGericht(eintrag.id);
    melde('Gericht gespeichert.');
  }
  function warenkorb() {
    if (!daten) return;
    try { void navigator.clipboard.writeText(warenkorbText(daten.einkauf)); melde('Warenkorb kopiert — in den Lieferdienst einfügen.'); } catch { melde('Kopieren nicht möglich.'); }
  }
  function postenHinzu(text: string, extra: Partial<EinkaufPosten> = {}) {
    if (!daten || !text.trim()) return;
    const { text: t, menge } = postenParsen(text);
    if (aufDerListe(t, daten.einkauf)) { melde('Steht schon auf der Liste.'); return; }
    void patch([{ liste: 'einkauf', op: 'upsert', eintrag: { ...postenAus(t, daten.lebensmittel, { menge, quelle: 'hand', ...extra }) } }]);
  }

  if (fehler) return <Karte i={0}><Leer>{fehler}</Leer></Karte>;
  if (!daten) return eingebettet ? <Leer>lade …</Leer> : <Seite titel="Ernährung" unter="Die Woche, die ihr durchhaltet."><Karte i={0}><Leer>lade …</Leer></Karte></Seite>;

  const heuteIdx = (new Date().getDay() + 6) % 7;
  const offene = daten.einkauf.filter(p => !p.erledigt);
  const geplantN = gefuellt(daten);
  const nameVon = (id?: string) => (id ? daten.personen.find(p => p.id === id)?.name ?? daten.profile.find(p => p.person === id)?.name ?? id : '');
  const gastProfile = daten.profile.filter(p => !p.konto);
  const gerichtFuer = (tag: Tag, k: Mahlzeit): Gericht | undefined => { const id = daten.planGerichte[tag]?.[k]; return id ? daten.gerichte.find(g => g.id === id) : undefined; };
  const offenesGericht = offen ? gerichtFuer(offen.tag, offen.k) : gewaehlt ? daten.gerichte.find(g => g.id === gewaehlt) : undefined;
  const rezeptOffen = !!offen || (!!gewaehlt && !!offenesGericht);
  const bibliothek = gerichteFiltern(daten.gerichte, suche, tagFilter).filter(g => !nurLieblinge || g.favorit);
  const tagsOben = tagsHaeufig(daten.gerichte);
  const gerichteSortiert = gerichteFiltern(daten.gerichte);
  const stammSchnell = daten.lebensmittel.filter(l => l.bevorzugt && !aufDerListe(l.name, daten.einkauf)).slice(0, 10);
  const b = daten.budget;
  const budgetFarbe = b && b.budget ? (b.ausgegeben > b.budget ? LEUCHT.kritisch : b.ausgegeben > b.budget * 0.85 ? LEUCHT.achtung : LEUCHT.gut) : C.inkLeise;

  const inhalt = (
    <Spalten verhaeltnis="2:1">
      <Spalte>
        {/* ── Essens-Woche ── */}
        <Karte i={0} akzent={LEUCHT.gut}>
          <Ueberschrift farbe={geplantN >= 15 ? LEUCHT.gut : LEUCHT.achtung} rechts={<Chip farbe={geplantN >= 15 ? LEUCHT.gut : C.inkLeise}>{geplantN}/21 geplant</Chip>}>Essens-Woche</Ueberschrift>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <Knopf onClick={jarvisPlant} aus={denkt} farbe={LEUCHT.agenten}>{denkt ? 'Jarvis plant …' : '✨ Jarvis plant die Woche'}</Knopf>
            <input value={hinweis} onChange={e => setHinweis(e.target.value)} placeholder="Hinweis (z. B. Mi auswärts, viel Meal-Prep)" style={{ ...klein, flex: '1 1 220px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: TYP.bedien, color: C.inkDim }}>
            <span>für {daten.personen.map(p => p.name).join(' & ') || 'euch'}</span>
            {gastProfile.map(g => (
              <button key={g.person} type="button" onClick={() => setGaeste(l => (l.includes(g.person) ? l.filter(x => x !== g.person) : [...l, g.person]))}
                style={{ ...nackt, padding: '4px 10px', borderRadius: 999, background: gaeste.includes(g.person) ? `${LEUCHT.gut}22` : 'rgba(255,255,255,.05)', color: gaeste.includes(g.person) ? LEUCHT.gut : C.inkDim }}>+ {g.name}</button>
            ))}
            {daten.vorrat.length > 0 && <span style={{ color: C.inkLeise }}>· nutzt {daten.vorrat.length === 1 ? '1 Ding' : `${daten.vorrat.length} Dinge`} aus dem Vorrat</span>}
          </div>
          {vorschlag && (
            <div style={{ background: `${LEUCHT.agenten}14`, borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: '0 0 10px' }}><b style={{ color: LEUCHT.agenten }}>Jarvis:</b> {vorschlag.begruendung} <span style={{ color: C.inkLeise }}>({vorschlag.gerichte.length} Rezepte · {vorschlag.einkauf.length} Posten, Vorrat abgezogen)</span></p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf onClick={uebernehmen} farbe={LEUCHT.gut}>Übernehmen — Plan, Rezepte, Liste ergänzen</Knopf><Knopf leise onClick={() => setVorschlag(null)}>Verwerfen</Knopf></div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TAGE.map((t, i) => (
              <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '7px 8px', borderRadius: 10, background: i === heuteIdx ? 'rgba(255,255,255,.05)' : 'transparent' }}>
                <span style={{ ...mikro, color: i === heuteIdx ? LEUCHT.gut : C.inkLeise, flex: breit ? '0 0 78px' : '0 0 100%' }}>{TAG_LABEL[t]}</span>
                {MAHLZEITEN.map(m => {
                  const g = gerichtFuer(t, m.k);
                  const aktiv = offen?.tag === t && offen.k === m.k;
                  return (
                    <div key={m.k} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 130px', minWidth: 120 }}>
                      <input value={(vorschlag ? vorschlag.plan[t][m.k] : daten.plan[t][m.k]) ?? ''} readOnly={!!vorschlag}
                        onChange={e => planSetzen(t, m.k, e.target.value)} placeholder={m.label}
                        style={{ ...klein, flex: 1, minWidth: 0, opacity: vorschlag ? 0.75 : 1, borderStyle: vorschlag ? 'dashed' : 'solid', outline: aktiv ? `1px solid ${LEUCHT.gut}` : undefined }} />
                      {!vorschlag && daten.plan[t][m.k].trim() && (
                        <button type="button" onClick={() => setOffen(aktiv ? null : { tag: t, k: m.k })} title={g ? 'Rezept öffnen' : 'Rezept schreiben lassen'}
                          style={{ ...nackt, color: g ? LEUCHT.gut : C.inkLeise, fontSize: 15, lineHeight: 1 }}>{g ? '📖' : '＋'}</button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {vorschlag && <p style={{ fontSize: 12, color: LEUCHT.achtung, margin: '10px 0 0' }}>Vorschau — mit „Übernehmen“ wird sie euer Plan.</p>}
        </Karte>

        {/* ── Rezept (aus dem Plan-Feld oder aus der Bibliothek) ── */}
        {rezeptOffen && (
          <div ref={rezeptRef} style={{ scrollMarginTop: 16 }}>
          <Karte i={1} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut} rechts={<button type="button" onClick={() => { setOffen(null); setGewaehlt(null); setFormular(null); }} style={nackt}>✕</button>}>
              {offen ? (daten.plan[offen.tag][offen.k] || 'Gericht') : offenesGericht?.name}
              <span style={{ color: C.inkLeise, fontWeight: 500 }}> · {offen ? `${TAG_LABEL[offen.tag]}, ${MAHLZEITEN.find(m => m.k === offen.k)?.label}` : 'aus euren Gerichten'}</span>
            </Ueberschrift>
            {!offenesGericht && offen ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <Leer>Noch kein Rezept zu diesem Gericht.</Leer>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Knopf farbe={LEUCHT.agenten} onClick={() => void rezeptSchreiben(offen.tag, offen.k)} aus={rezeptLaeuft}>{rezeptLaeuft ? 'Jarvis schreibt …' : '✨ Rezept schreiben lassen'}</Knopf>
                  {gerichteSortiert.length > 0 && (
                    <select value="" onChange={e => { const g = daten.gerichte.find(x => x.id === e.target.value); if (g) void patch([{ feld: 'plan', tag: offen.tag, mahlzeit: offen.k, wert: g.name, gerichtId: g.id }]); }} aria-label="Aus euren Gerichten wählen" style={{ ...klein, width: 'auto', colorScheme: 'dark' }}>
                      <option value="">… oder aus euren Gerichten wählen</option>
                      {gerichteSortiert.map(g => <option key={g.id} value={g.id}>{g.favorit ? '★ ' : ''}{g.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ) : offenesGericht && formular === offenesGericht.id ? (
              <GerichtForm g={offenesGericht} personen={[...daten.personen, ...gastProfile.map(g => ({ id: g.person, name: g.name }))]} onSpeichern={gerichtSpeichern} onAbbruch={() => setFormular(null)} />
            ) : offenesGericht ? (
              <RezeptKarte g={offenesGericht} daten={daten} nameVon={nameVon} patch={patch}
                aufListe={() => zutatenAufListe(offenesGericht)}
                neuSchreiben={offen ? () => void rezeptSchreiben(offen.tag, offen.k) : undefined} laeuft={rezeptLaeuft}
                bearbeiten={() => setFormular(offenesGericht.id)}
                loeschen={() => { void patch([{ liste: 'gerichte', op: 'delete', id: offenesGericht.id }]); setGewaehlt(null); setOffen(null); melde('Gericht gelöscht.'); }} />
            ) : null}
          </Karte>
          </div>
        )}

        {/* ── Unsere Gerichte (Bibliothek) ── */}
        <Karte i={2} akzent={LEUCHT.gut} id="gerichte">
          <Ueberschrift farbe={LEUCHT.gut} rechts={<Chip farbe={daten.gerichte.length ? LEUCHT.gut : C.inkLeise}>{daten.gerichte.length === 1 ? '1 Gericht' : `${daten.gerichte.length} Gerichte`}</Chip>}>Unsere Gerichte</Ueberschrift>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen — Name, Zutat, Tag" style={{ ...klein, flex: '1 1 180px' }} />
            <Knopf farbe={LEUCHT.gut} onClick={() => { setFormular(f => (f === 'neu' ? null : 'neu')); setOffen(null); setGewaehlt(null); }}>{formular === 'neu' ? 'Schließen' : '+ Gericht'}</Knopf>
          </div>
          {(tagsOben.length > 0 || daten.gerichte.some(g => g.favorit)) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              {daten.gerichte.some(g => g.favorit) && <button type="button" onClick={() => setNurLieblinge(v => !v)} style={{ ...nackt, padding: '4px 10px', borderRadius: 999, background: nurLieblinge ? `${LEUCHT.achtung}22` : 'rgba(255,255,255,.05)', color: nurLieblinge ? LEUCHT.achtung : C.inkDim }}>★ Lieblinge</button>}
              {tagsOben.map(t => <button key={t} type="button" onClick={() => setTagFilter(f => (f === t ? '' : t))} style={{ ...nackt, padding: '4px 10px', borderRadius: 999, background: tagFilter === t ? `${LEUCHT.gut}22` : 'rgba(255,255,255,.05)', color: tagFilter === t ? LEUCHT.gut : C.inkDim }}>{t}</button>)}
            </div>
          )}
          {formular === 'neu' && (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
              <GerichtForm personen={[...daten.personen, ...gastProfile.map(g => ({ id: g.person, name: g.name }))]} onSpeichern={gerichtSpeichern} onAbbruch={() => setFormular(null)} jarvis={gerichtVonJarvis} laeuft={rezeptLaeuft} />
            </div>
          )}
          {meld && !formular && <p style={{ fontSize: 12, color: LEUCHT.gut, margin: '0 0 8px' }}>{meld}</p>}
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            <Liste>
              {bibliothek.map(g => {
                const wo = imPlan(daten.planGerichte, g.id);
                return (
                  <Zeile key={g.id} onClick={() => oeffneGericht(g.id)} aktiv={gewaehlt === g.id && !offen}
                    links={<button type="button" onClick={e => { e.stopPropagation(); void patch([{ liste: 'gerichte', op: 'upsert', eintrag: { id: g.id, favorit: !g.favorit } }]); }} title={g.favorit ? 'Liebling — Klick nimmt den Stern weg' : 'Als Liebling markieren'} style={{ ...nackt, color: g.favorit ? LEUCHT.achtung : C.inkLeise, fontSize: 16 }}>{g.favorit ? '★' : '☆'}</button>}
                    titel={g.name}
                    unter={[g.dauerMin != null ? `${g.dauerMin} Min` : '', `${g.portionen} Port.`, g.tags.slice(0, 3).join(', '), wo.length ? `diese Woche: ${wo.map(w => TAG_LABEL[w.tag].slice(0, 2)).join(', ')}` : ''].filter(Boolean).join(' · ')}
                    rechts={<button type="button" onClick={e => { e.stopPropagation(); zutatenAufListe(g); }} title="Fehlende Zutaten auf die Liste" style={nackt}>🛒</button>} />
                );
              })}
            </Liste>
            {!daten.gerichte.length && <Leer>Noch keine Gerichte. Die Wochenrezepte von Jarvis landen hier von selbst — oder „+ Gericht“: von Hand, von Jarvis oder aus einem eingefügten Rezept.</Leer>}
            {daten.gerichte.length > 0 && !bibliothek.length && <Leer>Nichts passt zu Suche oder Filter.</Leer>}
          </div>
          <p style={{ fontSize: 12, color: C.inkLeise, margin: '10px 0 0', lineHeight: 1.5 }}>Ein Klick öffnet Rezept, Notiz und „in den Plan“. Lieblinge plant Jarvis gern wieder ein; steht ein Plan-Feld genauso wie ein Gericht hier, hängt das Rezept automatisch dran.</p>
        </Karte>

        {/* ── Profile ── */}
        <Karte i={3} akzent={LEUCHT.schlaf}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<span>jeder pflegt sein eigenes</span>}>Bedürfnisse & Vorlieben</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {daten.personen.map(p => <ProfilKarte key={p.id} person={p.id} name={p.name} profil={daten.profile.find(x => x.person === p.id)} darf={p.id === daten.ich} konto patch={patch} />)}
            {gastProfile.map(g => <ProfilKarte key={g.person} person={g.person} name={g.name} profil={g} darf konto={false} patch={patch} weg={() => void patch([{ liste: 'profile', op: 'delete', id: g.person }])} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <input value={neuGast} onChange={e => setNeuGast(e.target.value)} placeholder="Gast oder Kind hinzufügen (Name)" style={{ ...klein, width: 240 }}
              onKeyDown={e => { if (e.key === 'Enter' && neuGast.trim()) { void patch([{ liste: 'profile', op: 'upsert', eintrag: { person: `gast-${neuGast.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || neueId('g')}`, name: neuGast.trim(), konto: false } }]); setNeuGast(''); } }} />
            <span style={{ fontSize: 12, color: C.inkLeise }}>Gäste plant Jarvis mit, wenn ihr sie oben anklickt.</span>
          </div>
        </Karte>
      </Spalte>

      <Spalte>
        {/* ── Einkaufsliste ── */}
        <Karte i={1} akzent={LEUCHT.geld}>
          <Ueberschrift farbe={LEUCHT.geld} rechts={<Chip farbe={offene.length ? LEUCHT.achtung : LEUCHT.gut}>{offene.length} offen</Chip>}>Einkaufsliste</Ueberschrift>
          {b && (
            <div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 10 }}>
              Lebensmittel {b.monat.slice(5, 7)}/{b.monat.slice(0, 4)}: <b style={{ color: budgetFarbe }}>{euro(b.ausgegeben)}</b>{b.budget ? <> von {euro(b.budget)} Budget</> : ' — kein Budget gesetzt'} · <Link href="/os/finanzen?s=privat&t=buchungen" style={link}>Zahlen ›</Link>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Knopf onClick={warenkorb} aus={!offene.length}>Warenkorb kopieren</Knopf>
            {daten.einkauf.some(p => p.erledigt) && <Knopf leise onClick={() => { void patch([{ feld: 'erledigtInVorrat', von: daten.ich }]); melde('Eingekauftes liegt jetzt im Vorrat.'); }}>Eingekauft → Vorrat</Knopf>}
            {daten.einkauf.some(p => p.erledigt) && <Knopf leise onClick={() => void patch([{ feld: 'erledigtWeg' }])}>Abgehakte entfernen</Knopf>}
          </div>
          {meld && <p style={{ fontSize: 12, color: LEUCHT.gut, margin: '0 0 8px' }}>{meld}</p>}
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {gruppiert(daten.einkauf).map(gr => (
              <div key={gr.kategorie} style={{ marginBottom: 8 }}>
                <div style={{ ...mikro, padding: '6px 2px 2px' }}>{gr.label.replace(/ \(.*\)$/, '')}</div>
                <Liste>
                  {gr.posten.map(p => (
                    <Zeile key={p.id}
                      links={<Haken an={p.erledigt} onChange={() => void patch([{ liste: 'einkauf', op: 'upsert', eintrag: { id: p.id, erledigt: !p.erledigt } }])} />}
                      titel={<span style={{ color: p.erledigt ? C.inkLeise : C.ink, textDecoration: p.erledigt ? 'line-through' : 'none' }}>{p.menge ? <b style={{ fontWeight: 600 }}>{p.menge} </b> : ''}{p.text}</span>}
                      unter={[p.fuer?.length ? `für ${p.fuer.map(nameVon).join(' & ')}` : '', p.von ? `von ${nameVon(p.von)}` : '', p.quelle === 'plan' || p.quelle === 'rezept' ? 'aus dem Plan' : ''].filter(Boolean).join(' · ') || undefined}
                      rechts={<button onClick={() => void patch([{ liste: 'einkauf', op: 'delete', id: p.id }])} aria-label="Posten entfernen" title="Posten entfernen" style={nackt}>✕</button>} />
                  ))}
                </Liste>
              </div>
            ))}
            {!daten.einkauf.length && <Leer>Leer — Jarvis füllt sie mit dem Wochenplan, ein Rezept setzt fehlende Zutaten, oder unten selbst ergänzen.</Leer>}
          </div>
          <div style={{ marginTop: 10 }}>
            <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && neu.trim()) { postenHinzu(neu); setNeu(''); } }}
              placeholder="Posten … („2x Tomaten“, „500 g Lachs“) — Enter" style={klein} />
          </div>
          {stammSchnell.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.inkLeise }}>Schnell:</span>
              {stammSchnell.map(l => <button key={l.id} type="button" onClick={() => postenHinzu(l.name, { quelle: 'stamm' })} style={{ ...nackt, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.05)', color: C.inkDim }}>+ {l.name}</button>)}
            </div>
          )}
        </Karte>

        {/* ── Vorrat ── */}
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={<span>{daten.vorrat.length === 1 ? '1 Ding' : `${daten.vorrat.length} Dinge`} zuhause</span>}>Vorrat · was da ist</Ueberschrift>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <Liste>
              {daten.vorrat.slice().sort((a, b2) => a.kategorie.localeCompare(b2.kategorie) || a.name.localeCompare(b2.name)).map(v => (
                <Zeile key={v.id} titel={<span>{v.menge ? <b style={{ fontWeight: 600 }}>{v.menge} </b> : ''}{v.name}</span>} unter={`${KATEGORIE_LABEL[v.kategorie].replace(/ \(.*\)$/, '')} · seit ${v.seit.slice(8, 10)}.${v.seit.slice(5, 7)}.`}
                  rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
                    <button type="button" onClick={() => { postenHinzu(v.name, { quelle: 'stamm' }); }} title="Nachkaufen — auf die Liste" style={nackt}>→ Liste</button>
                    <button type="button" onClick={() => void patch([{ liste: 'vorrat', op: 'delete', id: v.id }])} title="Aufgebraucht" style={nackt}>✕</button>
                  </span>} />
              ))}
            </Liste>
            {!daten.vorrat.length && <Leer>Noch nichts eingetragen. Was zuhause ist, plant Jarvis ein und lässt es auf der Liste weg.</Leer>}
          </div>
          <div style={{ marginTop: 10 }}>
            <input value={neuVorrat} onChange={e => setNeuVorrat(e.target.value)} placeholder="Zuhause: „1 kg Reis“, „Olivenöl“ — Enter" style={klein}
              onKeyDown={e => { if (e.key === 'Enter' && neuVorrat.trim()) { const { text, menge } = postenParsen(neuVorrat); void patch([{ liste: 'vorrat', op: 'upsert', eintrag: { name: text, menge: menge ?? '', kategorie: kategorieRaten(text) } }]); setNeuVorrat(''); } }} />
          </div>
        </Karte>

        {/* ── Stammliste ── */}
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={<span>bevorzugt nehmen</span>}>Stammliste · unsere Lebensmittel</Ueberschrift>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <Liste>
              {daten.lebensmittel.slice().sort((a, b2) => Number(b2.bevorzugt) - Number(a.bevorzugt) || a.name.localeCompare(b2.name)).map(l => (
                <Zeile key={l.id}
                  links={<button type="button" onClick={() => void patch([{ liste: 'lebensmittel', op: 'upsert', eintrag: { id: l.id, bevorzugt: !l.bevorzugt } }])} title={l.bevorzugt ? 'bevorzugt — Klick nimmt es raus' : 'nicht bevorzugt'} style={{ ...nackt, color: l.bevorzugt ? LEUCHT.achtung : C.inkLeise, fontSize: 16 }}>{l.bevorzugt ? '★' : '☆'}</button>}
                  titel={<span>{l.name}{l.hinweis ? <span style={{ color: C.inkDim }}> · {l.hinweis}</span> : ''}</span>}
                  unter={[KATEGORIE_LABEL[l.kategorie].replace(/ \(.*\)$/, ''), l.menge, l.von ? `von ${nameVon(l.von)}` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
                    <button type="button" onClick={() => postenHinzu(l.name, { quelle: 'stamm' })} title="Auf die Liste" style={nackt}>+ Liste</button>
                    <button type="button" onClick={() => void patch([{ liste: 'lebensmittel', op: 'delete', id: l.id }])} title="Aus der Stammliste" style={nackt}>✕</button>
                  </span>} />
              ))}
            </Liste>
            {!daten.lebensmittel.length && <Leer>Eure Lebensmittel mit Hinweis, wie ihr sie nehmt („Haferflocken · Bio, grob“). Jarvis nimmt sie zuerst.</Leer>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.7fr auto', gap: 6, marginTop: 10, alignItems: 'center' }}>
            <input value={neuStamm.name} onChange={e => setNeuStamm(s => ({ ...s, name: e.target.value }))} placeholder="Lebensmittel" style={klein} />
            <input value={neuStamm.hinweis} onChange={e => setNeuStamm(s => ({ ...s, hinweis: e.target.value }))} placeholder="Hinweis (Bio, Sorte …)" style={klein} />
            <input value={neuStamm.menge} onChange={e => setNeuStamm(s => ({ ...s, menge: e.target.value }))} placeholder="Menge" style={klein} />
            <Knopf leise aus={!neuStamm.name.trim()} onClick={() => { void patch([{ liste: 'lebensmittel', op: 'upsert', eintrag: { name: neuStamm.name.trim(), hinweis: neuStamm.hinweis.trim(), menge: neuStamm.menge.trim(), kategorie: neuStamm.kategorie || kategorieRaten(neuStamm.name), bevorzugt: true } }]); setNeuStamm({ name: '', hinweis: '', menge: '', kategorie: '' }); }}>+</Knopf>
          </div>
          <select value={neuStamm.kategorie} onChange={e => setNeuStamm(s => ({ ...s, kategorie: e.target.value as Kategorie | '' }))} aria-label="Kategorie" style={{ ...klein, marginTop: 6, colorScheme: 'dark' }}>
            <option value="">Kategorie: automatisch</option>
            {KATEGORIEN.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Karte>

        {/* ── Grundsätze ── */}
        <Karte i={4}>
          <Ueberschrift farbe={LEUCHT.agenten} rechts="für alle">Grundsätze</Ueberschrift>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Grundsätze anzeigen & bearbeiten</summary>
            <Grundsaetze wert={daten.grundsaetze} onFertig={wert => void patch([{ feld: 'grundsaetze', wert }])} />
          </details>
          <p style={{ fontSize: 12, color: C.inkLeise, margin: '14px 0 0', lineHeight: 1.5 }}>
            Alltagsküche, kein Medizin- oder Ernährungsrat — Unverträglichkeiten und Krankheiten gehören zu Arzt/Ernährungsberatung.
            {!eingebettet && <>{' '}<Link href="/os/gesundheit" style={link}>Gesundheit ›</Link></>}
          </p>
        </Karte>
      </Spalte>
    </Spalten>
  );

  if (eingebettet) return inhalt;
  return <Seite titel="Ernährung" unter="Die Woche, die ihr durchhaltet — mit euren Lebensmitteln, eurem Vorrat und je Person ihren Bedürfnissen.">{inhalt}</Seite>;
}

function RezeptKarte({ g, daten, nameVon, patch, aufListe, neuSchreiben, laeuft, bearbeiten, loeschen }: {
  g: Gericht; daten: Daten; nameVon: (id?: string) => string; patch: (ops: Op[]) => Promise<void>;
  aufListe: () => void; neuSchreiben?: () => void; laeuft: boolean; bearbeiten: () => void; loeschen: () => void;
}) {
  const fehlt = useMemo(() => fehlendeZutaten(g, daten.vorrat, daten.einkauf), [g, daten.vorrat, daten.einkauf]);
  const wo = imPlan(daten.planGerichte, g.id);
  const heute = TAGE[(new Date().getDay() + 6) % 7];
  const [ziel, setZiel] = useState<{ tag: Tag; k: Mahlzeit }>({ tag: heute, k: 'abend' });
  const [notiz, setNotiz] = useState(g.notiz);
  const [sicher, setSicher] = useState(false);
  useEffect(() => { setNotiz(g.notiz); setSicher(false); }, [g.id, g.notiz]);
  const einplanen = () => { void patch([{ feld: 'plan', tag: ziel.tag, mahlzeit: ziel.k, wert: g.name, gerichtId: g.id }]); };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => void patch([{ liste: 'gerichte', op: 'upsert', eintrag: { id: g.id, favorit: !g.favorit } }])} title={g.favorit ? 'Liebling — Klick nimmt den Stern weg' : 'Als Liebling markieren'} style={{ ...nackt, color: g.favorit ? LEUCHT.achtung : C.inkLeise, fontSize: 18, padding: '0 2px' }}>{g.favorit ? '★' : '☆'}</button>
        {g.dauerMin != null && <Chip farbe={C.inkDim}>{g.dauerMin} Min</Chip>}
        <Chip farbe={C.inkDim}>{g.portionen} Portionen</Chip>
        {g.fuer.length > 0 && <Chip farbe={LEUCHT.schlaf}>für {g.fuer.map(nameVon).join(' & ')}</Chip>}
        {g.tags.map(t => <Chip key={t} farbe={C.inkLeise}>{t}</Chip>)}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 10, fontSize: 12 }}>
          <button type="button" onClick={bearbeiten} style={{ ...nackt, padding: 0, textDecoration: 'underline' }}>bearbeiten</button>
          {sicher
            ? <span style={{ color: LEUCHT.kritisch }}>wirklich? <button type="button" onClick={loeschen} style={{ ...nackt, padding: 0, color: LEUCHT.kritisch, textDecoration: 'underline' }}>löschen</button> · <button type="button" onClick={() => setSicher(false)} style={{ ...nackt, padding: 0, textDecoration: 'underline' }}>nein</button></span>
            : <button type="button" onClick={() => setSicher(true)} style={{ ...nackt, padding: 0, textDecoration: 'underline' }}>löschen</button>}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div>
          <div style={{ ...mikro, marginBottom: 6 }}>Zutaten</div>
          <Liste>
            {g.zutaten.map((z, i) => {
              const da = imVorrat(z.name, daten.vorrat), liste = !da && aufDerListe(z.name, daten.einkauf);
              return <Zeile key={i} links={<span style={{ color: da ? LEUCHT.gut : liste ? LEUCHT.achtung : C.inkLeise, fontSize: 13, width: 14, display: 'inline-block' }}>{da ? '✓' : liste ? '🛒' : '·'}</span>} titel={<span>{z.menge ? <b style={{ fontWeight: 600 }}>{z.menge} </b> : ''}{z.name}</span>} unter={da ? 'im Vorrat' : liste ? 'auf der Liste' : undefined} />;
            })}
            {!g.zutaten.length && <Leer>Keine Zutaten eingetragen.</Leer>}
          </Liste>
          <div style={{ marginTop: 8 }}><Knopf leise onClick={aufListe} aus={!fehlt.length}>{fehlt.length ? `${fehlt.length} fehlende auf die Liste` : 'alles da'}</Knopf></div>
        </div>
        <div>
          <div style={{ ...mikro, marginBottom: 6 }}>Zubereitung</div>
          <ol style={{ margin: 0, paddingLeft: 22, listStyle: 'decimal', display: 'grid', gap: 6, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            {g.zubereitung.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          {!g.zubereitung.length && <Leer>Keine Schritte eingetragen.</Leer>}
          <div style={{ marginTop: 10, fontSize: 12, color: C.inkLeise }}>
            {g.quelle === 'jarvis' ? 'von Jarvis' : 'von Hand'}
            {neuSchreiben && <> · <button type="button" onClick={neuSchreiben} disabled={laeuft} style={{ ...nackt, padding: 0, textDecoration: 'underline' }}>{laeuft ? 'schreibt …' : 'neu schreiben lassen'}</button></>}
          </div>
        </div>
      </div>
      {/* Notiz + in den Plan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ ...mikro, marginBottom: 6 }}>Notiz</div>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== g.notiz) void patch([{ liste: 'gerichte', op: 'upsert', eintrag: { id: g.id, notiz } }]); }} rows={2} placeholder="z. B. „Malin ohne Feta“, „Reste am nächsten Tag“" style={{ ...klein, resize: 'vertical', lineHeight: 1.5 }} />
        </div>
        <div>
          <div style={{ ...mikro, marginBottom: 6 }}>In den Plan</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={ziel.tag} onChange={e => setZiel(z => ({ ...z, tag: e.target.value as Tag }))} aria-label="Tag" style={{ ...klein, width: 'auto', colorScheme: 'dark' }}>{TAGE.map(t => <option key={t} value={t}>{TAG_LABEL[t]}</option>)}</select>
            <select value={ziel.k} onChange={e => setZiel(z => ({ ...z, k: e.target.value as Mahlzeit }))} aria-label="Mahlzeit" style={{ ...klein, width: 'auto', colorScheme: 'dark' }}>{MAHLZEITEN.map(m => <option key={m.k} value={m.k}>{m.label}</option>)}</select>
            <Knopf leise onClick={einplanen}>einplanen</Knopf>
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>{wo.length ? `Diese Woche: ${wo.map(w => `${TAG_LABEL[w.tag]} ${MAHLZEITEN.find(m => m.k === w.mahlzeit)?.label}`).join(', ')}` : 'Diese Woche noch nicht eingeplant.'}</div>
        </div>
      </div>
    </div>
  );
}

/** Gericht anlegen oder bearbeiten — von Hand, von Jarvis (Name + Wunsch) oder aus eingefügtem Text. */
function GerichtForm({ g, personen, onSpeichern, onAbbruch, jarvis, laeuft }: {
  g?: Gericht; personen: { id: string; name: string }[]; onSpeichern: (eintrag: Record<string, unknown>) => void; onAbbruch: () => void;
  jarvis?: (name: string, beschreibung: string, text: string) => Promise<void>; laeuft?: boolean;
}) {
  const [art, setArt] = useState<'hand' | 'jarvis' | 'text'>('hand');
  const [f, setF] = useState({
    name: g?.name ?? '', zutaten: (g?.zutaten ?? []).map(z => (z.menge ? `${z.menge} ${z.name}` : z.name)).join('\n'), zubereitung: (g?.zubereitung ?? []).join('\n'),
    dauer: g?.dauerMin != null ? String(g.dauerMin) : '', portionen: String(g?.portionen ?? 2), fuer: g?.fuer ?? [], tags: (g?.tags ?? []).join(', '), wunsch: '', text: '',
  });
  const set = (k: keyof typeof f, v: string | string[]) => setF(x => ({ ...x, [k]: v }));
  const name = f.name.trim();
  const speichern = () => {
    if (!name) return;
    const dauer = parseInt(f.dauer, 10), portionen = parseInt(f.portionen, 10);
    onSpeichern({
      ...(g ? { id: g.id, angelegt: g.angelegt, favorit: g.favorit, notiz: g.notiz } : { id: neueId('g') }),
      name, zutaten: zutatenAusText(f.zutaten), zubereitung: schritteAusText(f.zubereitung),
      dauerMin: isFinite(dauer) && dauer > 0 ? dauer : null, portionen: isFinite(portionen) && portionen > 0 ? portionen : 2,
      fuer: f.fuer, tags: textListe(f.tags), quelle: 'hand',
    });
  };
  const wahl: CSSProperties = { ...nackt, padding: '5px 11px', borderRadius: 999 };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {!g && jarvis && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['hand', 'von Hand'], ['jarvis', '✨ Jarvis schreibt'], ['text', 'Rezept einfügen']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setArt(k)} style={{ ...wahl, background: art === k ? `${LEUCHT.gut}22` : 'rgba(255,255,255,.05)', color: art === k ? LEUCHT.gut : C.inkDim }}>{l}</button>
          ))}
        </div>
      )}
      <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Name des Gerichts" style={klein} autoFocus />
      {art === 'hand' || g ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            <textarea value={f.zutaten} onChange={e => set('zutaten', e.target.value)} rows={6} placeholder={'Zutaten, eine je Zeile\n200 g Lachs\nZitrone\nOlivenöl – 2 EL'} style={{ ...klein, resize: 'vertical', lineHeight: 1.5 }} />
            <textarea value={f.zubereitung} onChange={e => set('zubereitung', e.target.value)} rows={6} placeholder={'Zubereitung, ein Schritt je Zeile\nOfen auf 200 °C\nFisch würzen\n20 Min backen'} style={{ ...klein, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={f.dauer} onChange={e => set('dauer', e.target.value)} inputMode="numeric" placeholder="Minuten" style={{ ...klein, width: 90 }} />
            <input value={f.portionen} onChange={e => set('portionen', e.target.value)} inputMode="numeric" placeholder="Portionen" style={{ ...klein, width: 100 }} />
            <input value={f.tags} onChange={e => set('tags', e.target.value)} placeholder="Tags (schnell, abends, Meal-Prep)" style={{ ...klein, flex: '1 1 180px' }} />
          </div>
          {personen.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: C.inkLeise }}>
              für:
              {personen.map(p => <button key={p.id} type="button" onClick={() => set('fuer', f.fuer.includes(p.id) ? f.fuer.filter(x => x !== p.id) : [...f.fuer, p.id])} style={{ ...wahl, background: f.fuer.includes(p.id) ? `${LEUCHT.schlaf}22` : 'rgba(255,255,255,.05)', color: f.fuer.includes(p.id) ? LEUCHT.schlaf : C.inkDim }}>{p.name}</button>)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf farbe={LEUCHT.gut} onClick={speichern} aus={!name}>{g ? 'Änderungen speichern' : 'Gericht speichern'}</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></div>
        </>
      ) : art === 'jarvis' ? (
        <>
          <input value={f.wunsch} onChange={e => set('wunsch', e.target.value)} placeholder="Wunsch (optional): „schnell, ohne Milch, für 4“" style={klein} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf farbe={LEUCHT.agenten} onClick={() => void jarvis?.(name, f.wunsch.trim(), '')} aus={!name || !!laeuft}>{laeuft ? 'Jarvis schreibt …' : '✨ Rezept schreiben lassen'}</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></div>
          <p style={{ fontSize: 12, color: C.inkLeise, margin: 0 }}>Jarvis schreibt mit euren Profilen, Grundsätzen und bevorzugten Lebensmitteln.</p>
        </>
      ) : (
        <>
          <textarea value={f.text} onChange={e => set('text', e.target.value)} rows={8} placeholder="Rezept-Text hier einfügen (z. B. von einer Webseite kopiert) — Jarvis bringt Zutaten und Schritte in Form, ohne etwas dazuzuerfinden." style={{ ...klein, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf farbe={LEUCHT.agenten} onClick={() => void jarvis?.(name, '', f.text.trim())} aus={!name || f.text.trim().length < 20 || !!laeuft}>{laeuft ? 'Jarvis liest …' : 'Übernehmen'}</Knopf><Knopf leise onClick={onAbbruch}>Abbrechen</Knopf></div>
        </>
      )}
    </div>
  );
}

function ProfilKarte({ person, name, profil, darf, konto, patch, weg }: { person: string; name: string; profil?: Profil; darf: boolean; konto: boolean; patch: (ops: Op[]) => Promise<void>; weg?: () => void }) {
  const [f, setF] = useState({ bedarf: profil?.bedarf ?? '', unvertraeglich: listeText(profil?.unvertraeglich ?? []), nie: listeText(profil?.nie ?? []), gern: listeText(profil?.gern ?? []), ziel: profil?.ziel ?? '' });
  useEffect(() => { setF({ bedarf: profil?.bedarf ?? '', unvertraeglich: listeText(profil?.unvertraeglich ?? []), nie: listeText(profil?.nie ?? []), gern: listeText(profil?.gern ?? []), ziel: profil?.ziel ?? '' }); }, [profil?.stand]); // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const aendern = (k: keyof typeof f, v: string) => {
    const neu = { ...f, [k]: v }; setF(neu);
    if (!darf) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void patch([{ liste: 'profile', op: 'upsert', eintrag: { person, name, konto, bedarf: neu.bedarf, unvertraeglich: textListe(neu.unvertraeglich), nie: textListe(neu.nie), gern: textListe(neu.gern), ziel: neu.ziel } }]), 700);
  };
  const ro = !darf;
  const stil: CSSProperties = { ...klein, opacity: ro ? 0.8 : 1 };
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: 999, background: `${LEUCHT.schlaf}33`, color: LEUCHT.schlaf, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, fontFamily: SCHRIFT.display }}>{kuerzel(name)}</span>
        <b style={{ fontSize: TYP.body }}>{name}</b>
        <span style={{ fontSize: 12, color: C.inkLeise }}>{konto ? (darf ? 'dein Profil' : 'pflegt sie/er selbst') : 'Gast'}</span>
        {weg && <button type="button" onClick={weg} title="Gast entfernen" style={{ ...nackt, marginLeft: 'auto' }}>✕</button>}
      </div>
      <textarea value={f.bedarf} readOnly={ro} onChange={e => aendern('bedarf', e.target.value)} rows={3} placeholder={ro ? 'noch nichts eingetragen' : 'Bedürfnisse & Regeln in deinen Worten — z. B. anti-entzündlich, wenig Zucker, abends leicht, viel Eiweiß'} style={{ ...stil, resize: 'vertical', lineHeight: 1.5 }} />
      <input value={f.unvertraeglich} readOnly={ro} onChange={e => aendern('unvertraeglich', e.target.value)} placeholder="Verträgt nicht (Komma-getrennt)" style={stil} />
      <input value={f.nie} readOnly={ro} onChange={e => aendern('nie', e.target.value)} placeholder="Nie (Komma-getrennt)" style={stil} />
      <input value={f.gern} readOnly={ro} onChange={e => aendern('gern', e.target.value)} placeholder="Gern (Komma-getrennt)" style={stil} />
      <input value={f.ziel} readOnly={ro} onChange={e => aendern('ziel', e.target.value)} placeholder="Ziel (z. B. Haut ruhig, mehr Energie, 3 kg)" style={stil} />
    </div>
  );
}

function Grundsaetze({ wert, onFertig }: { wert: string; onFertig: (w: string) => void }) {
  const [t, setT] = useState(wert);
  useEffect(() => setT(wert), [wert]);
  return <textarea value={t} onChange={e => setT(e.target.value)} onBlur={() => { if (t !== wert) onFertig(t); }} rows={5} style={{ ...feld, marginTop: 10, color: C.inkDim, fontSize: TYP.bedien, lineHeight: 1.55, resize: 'vertical' }} />;
}

export type { ReactNode };
