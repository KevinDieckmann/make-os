'use client';

// ─── Konten, Kategorien, Regeln — anlegen, ändern, löschen ──────────────────
// Kevin, 24.09.: „dass wir privat die ganzen Daten drin haben, aber auch
// Sachen ändern können, die sinnig sind … anlegen, hinzufügen.“ Bis hierher
// kamen Konten und Kategorien nur aus dem Umzug, Regeln nur aus dem Zuordnen.
// Löschen geht nur, wo nichts mehr dranhängt (prüft auch der Server) — eine
// volle Kategorie wird zusammengelegt, ein Konto mit Buchungen stillgelegt.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { Kategorie, KategorieTyp, Konto, Regel } from '@/lib/finanzen/haushalt/typen';
import { eur, zuCent } from '@/lib/finanzen/haushalt/typen';
import type { KatName } from '@/lib/finanzen/haushalt/einordnung';
import { Knopf, Segmente, feld, LEUCHT } from '../schlank';
import { Dialog, Feld, Hinweis, KategorieOptionen, auswahl, type HaushaltDaten, type Op } from './gemeinsam';

type Reiter = 'kategorien' | 'konten' | 'regeln';
const TYPEN: { id: KategorieTyp; label: string }[] = [{ id: 'ausgabe', label: 'Ausgabe' }, { id: 'einnahme', label: 'Einnahme' }, { id: 'umbuchung', label: 'Umbuchung' }];
const zeile: React.CSSProperties = { display: 'grid', gap: 8, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)' };
const klein: React.CSSProperties = { ...feld, padding: '8px 10px', fontSize: TYP.bedien };

export function StammdatenDialog({ h, katName, patch, onZusammenlegen, onZu }: {
  h: HaushaltDaten; katName: KatName; patch: (teil: string, ops: Op[]) => Promise<boolean>; onZusammenlegen: () => void; onZu: () => void;
}) {
  const [reiter, setReiter] = useState<Reiter>('kategorien');
  const nutzung = useMemo(() => {
    const kat = new Map<string, number>(), konto = new Map<string, number>(), regel = new Map<string, number>();
    for (const b of h.buchungen) {
      if (b.kategorie_id) kat.set(b.kategorie_id, (kat.get(b.kategorie_id) ?? 0) + 1);
      konto.set(b.konto_id, (konto.get(b.konto_id) ?? 0) + 1);
    }
    for (const r of h.stamm.regeln) if (r.kategorie_id) regel.set(r.kategorie_id, (regel.get(r.kategorie_id) ?? 0) + 1);
    return { kat, konto, regel };
  }, [h]);

  return (
    <Dialog titel="Konten & Kategorien" onZu={onZu}>
      <div style={{ overflowX: 'auto' }}><Segmente liste={[{ id: 'kategorien' as Reiter, label: `Kategorien (${h.stamm.kategorien.length})` }, { id: 'konten' as Reiter, label: `Konten (${h.stamm.konten.length})` }, { id: 'regeln' as Reiter, label: `Regeln (${h.stamm.regeln.length})` }]} aktiv={reiter} onWahl={setReiter} /></div>
      {reiter === 'kategorien' && <Kategorien h={h} patch={patch} nutzung={nutzung} onZusammenlegen={onZusammenlegen} />}
      {reiter === 'konten' && <Konten h={h} patch={patch} nutzung={nutzung.konto} />}
      {reiter === 'regeln' && <Regeln h={h} katName={katName} patch={patch} />}
    </Dialog>
  );
}

function Kategorien({ h, patch, nutzung, onZusammenlegen }: { h: HaushaltDaten; patch: (t: string, o: Op[]) => Promise<boolean>; nutzung: { kat: Map<string, number>; regel: Map<string, number> }; onZusammenlegen: () => void }) {
  const [neu, setNeu] = useState({ name: '', typ: 'ausgabe' as KategorieTyp, budget: '' });
  const [offen, setOffen] = useState<string | null>(null);
  const sortiert = h.stamm.kategorien.slice().sort((a, b) => a.typ.localeCompare(b.typ) || a.sortierung - b.sortierung || a.name.localeCompare(b.name));
  async function anlegen() {
    const name = neu.name.trim();
    if (!name) return;
    const budget = neu.budget.trim() ? zuCent(neu.budget) : null;
    const sortierung = Math.max(0, ...h.stamm.kategorien.map(k => k.sortierung)) + 1;
    if (await patch('kategorien', [{ op: 'upsert', eintrag: { name, typ: neu.typ, sortierung, monatsbudget: budget !== null ? Math.abs(budget) : null } }])) setNeu({ name: '', typ: 'ausgabe', budget: '' });
  }
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
        <Feld label="Neue Kategorie"><input value={neu.name} onChange={e => setNeu({ ...neu, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') void anlegen(); }} placeholder="z. B. Kinder, Urlaub" style={klein} /></Feld>
        <Feld label="Art"><select value={neu.typ} onChange={e => setNeu({ ...neu, typ: e.target.value as KategorieTyp })} style={auswahl}>{TYPEN.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Feld>
        <Feld label="Budget/Monat"><input inputMode="decimal" value={neu.budget} onChange={e => setNeu({ ...neu, budget: e.target.value })} placeholder="optional" style={klein} /></Feld>
        <Knopf farbe={LEUCHT.geld} aus={!neu.name.trim()} onClick={anlegen}>Anlegen</Knopf>
      </div>
      <div style={{ fontSize: 12.5, color: C.inkLeise, margin: '6px 0' }}>Doppelte zusammenlegen? <button onClick={onZusammenlegen} style={{ background: 'none', border: 'none', color: LEUCHT.geld, cursor: 'pointer', font: 'inherit', padding: 0 }}>Aufräumen öffnen</button> — Buchungen und Regeln wandern mit.</div>
      {sortiert.map(k => <KategorieZeile key={k.id} k={k} buchungen={nutzung.kat.get(k.id) ?? 0} regeln={nutzung.regel.get(k.id) ?? 0} offen={offen === k.id} onOffen={() => setOffen(offen === k.id ? null : k.id)} patch={patch} />)}
    </div>
  );
}

function KategorieZeile({ k, buchungen, regeln, offen, onOffen, patch }: { k: Kategorie; buchungen: number; regeln: number; offen: boolean; onOffen: () => void; patch: (t: string, o: Op[]) => Promise<boolean> }) {
  const [e, setE] = useState({ name: k.name, typ: k.typ, budget: k.monatsbudget != null ? (k.monatsbudget / 100).toFixed(2).replace('.', ',') : '' });
  const belegt = buchungen + regeln > 0;
  return (
    <div style={zeile}>
      <button onClick={onOffen} style={{ display: 'flex', gap: 10, alignItems: 'baseline', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', font: 'inherit', padding: 0, textAlign: 'left', minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</span>
        <span style={{ fontSize: 12.5, color: C.inkLeise, whiteSpace: 'nowrap' }}>{TYPEN.find(t => t.id === k.typ)?.label} · {buchungen === 1 ? '1 Buchung' : `${buchungen} Buchungen`}{k.monatsbudget != null ? ` · Budget ${eur(k.monatsbudget)}` : ''}</span>
      </button>
      {offen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <input aria-label="Name" value={e.name} onChange={x => setE({ ...e, name: x.target.value })} style={klein} />
          <select aria-label="Art" value={e.typ} onChange={x => setE({ ...e, typ: x.target.value as KategorieTyp })} style={auswahl}>{TYPEN.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
          <input aria-label="Budget pro Monat" inputMode="decimal" placeholder="Budget" value={e.budget} onChange={x => setE({ ...e, budget: x.target.value })} style={klein} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf farbe={LEUCHT.geld} aus={!e.name.trim()} onClick={() => { const b = e.budget.trim() ? zuCent(e.budget) : null; void patch('kategorien', [{ op: 'upsert', stand: k.stand, eintrag: { ...k, name: e.name.trim(), typ: e.typ, monatsbudget: b !== null ? Math.abs(b) : null } }]); }}>Speichern</Knopf>
            <Knopf leise aus={belegt} onClick={() => { void patch('kategorien', [{ op: 'delete', id: k.id, stand: k.stand }]); }}>Löschen</Knopf>
            {belegt && <span style={{ fontSize: 12.5, color: C.inkLeise, alignSelf: 'center' }}>{buchungen} Buchungen, {regeln} Regeln — erst zusammenlegen</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Konten({ h, patch, nutzung }: { h: HaushaltDaten; patch: (t: string, o: Op[]) => Promise<boolean>; nutzung: Map<string, number> }) {
  const leer = { name: '', inhaber: 'gemeinsam', bank: '', iban_suffix: '' };
  const [neu, setNeu] = useState(leer);
  const [offen, setOffen] = useState<string | null>(null);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end' }}>
        <Feld label="Neues Konto"><input value={neu.name} onChange={e => setNeu({ ...neu, name: e.target.value })} placeholder="z. B. Tagesgeld" style={klein} /></Feld>
        <Feld label="Inhaber"><select value={neu.inhaber} onChange={e => setNeu({ ...neu, inhaber: e.target.value })} style={auswahl}><option>Kevin</option><option>Malin</option><option value="gemeinsam">gemeinsam</option></select></Feld>
        <Feld label="Bank"><input value={neu.bank} onChange={e => setNeu({ ...neu, bank: e.target.value })} placeholder="z. B. N26" style={klein} /></Feld>
        <Feld label="IBAN-Ende"><input inputMode="numeric" maxLength={4} value={neu.iban_suffix} onChange={e => setNeu({ ...neu, iban_suffix: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="4 Ziffern" style={klein} /></Feld>
        <Knopf farbe={LEUCHT.geld} aus={!neu.name.trim()} onClick={async () => { if (await patch('konten', [{ op: 'upsert', eintrag: { ...neu, name: neu.name.trim(), einheit: 'privat', waehrung: 'EUR', aktiv: true } }])) setNeu(leer); }}>Anlegen</Knopf>
      </div>
      <Hinweis>Nur die letzten vier Ziffern der IBAN — die ganze Nummer gehört nicht in die Software.</Hinweis>
      {h.stamm.konten.map(k => <KontoZeile key={k.id} k={k} buchungen={nutzung.get(k.id) ?? 0} offen={offen === k.id} onOffen={() => setOffen(offen === k.id ? null : k.id)} patch={patch} />)}
    </div>
  );
}

function KontoZeile({ k, buchungen, offen, onOffen, patch }: { k: Konto; buchungen: number; offen: boolean; onOffen: () => void; patch: (t: string, o: Op[]) => Promise<boolean> }) {
  const [e, setE] = useState({ name: k.name, inhaber: k.inhaber ?? 'gemeinsam', bank: k.bank ?? '', iban_suffix: k.iban_suffix ?? '', aktiv: k.aktiv });
  return (
    <div style={zeile}>
      <button onClick={onOffen} style={{ display: 'flex', gap: 10, alignItems: 'baseline', background: 'none', border: 'none', color: k.aktiv ? C.ink : C.inkLeise, cursor: 'pointer', font: 'inherit', padding: 0, textAlign: 'left', minWidth: 0 }}>
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}{k.aktiv ? '' : ' (inaktiv)'}</span>
        <span style={{ fontSize: 12.5, color: C.inkLeise, whiteSpace: 'nowrap' }}>{k.inhaber ?? '–'}{k.bank ? ` · ${k.bank}` : ''}{k.iban_suffix ? ` · …${k.iban_suffix}` : ''} · {buchungen === 1 ? '1 Buchung' : `${buchungen} Buchungen`}</span>
      </button>
      {offen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          <input aria-label="Name" value={e.name} onChange={x => setE({ ...e, name: x.target.value })} style={klein} />
          <select aria-label="Inhaber" value={e.inhaber} onChange={x => setE({ ...e, inhaber: x.target.value })} style={auswahl}><option>Kevin</option><option>Malin</option><option value="gemeinsam">gemeinsam</option></select>
          <input aria-label="Bank" value={e.bank} onChange={x => setE({ ...e, bank: x.target.value })} style={klein} />
          <input aria-label="IBAN-Ende" inputMode="numeric" maxLength={4} value={e.iban_suffix} onChange={x => setE({ ...e, iban_suffix: x.target.value.replace(/\D/g, '').slice(0, 4) })} style={klein} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf farbe={LEUCHT.geld} aus={!e.name.trim()} onClick={() => { void patch('konten', [{ op: 'upsert', stand: k.stand, eintrag: { ...k, ...e, name: e.name.trim() } }]); }}>Speichern</Knopf>
            <Knopf leise onClick={() => { void patch('konten', [{ op: 'upsert', stand: k.stand, eintrag: { ...k, aktiv: !k.aktiv } }]); }}>{k.aktiv ? 'Stilllegen' : 'Wieder aktiv'}</Knopf>
            <Knopf leise aus={buchungen > 0} onClick={() => { void patch('konten', [{ op: 'delete', id: k.id, stand: k.stand }]); }}>Löschen</Knopf>
            {buchungen > 0 && <span style={{ fontSize: 12.5, color: C.inkLeise }}>hat Buchungen — stilllegen statt löschen</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Regeln({ h, katName, patch }: { h: HaushaltDaten; katName: KatName; patch: (t: string, o: Op[]) => Promise<boolean> }) {
  const [suche, setSuche] = useState('');
  const liste = h.stamm.regeln.filter(r => !suche || `${r.muster} ${r.empfaenger} ${katName(r.kategorie_id)}`.toLowerCase().includes(suche.toLowerCase()))
    .sort((a, b) => b.treffer_zaehler - a.treffer_zaehler || a.muster.localeCompare(b.muster));
  const setze = (r: Regel, teil: Partial<Regel>) => patch('regeln', [{ op: 'upsert', stand: r.stand, eintrag: { ...r, ...teil } }]);
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <Hinweis>Regeln entstehen beim Zuordnen („Zuordnung merken“) und ordnen jeden neuen Import automatisch ein. Hier lassen sie sich umhängen oder löschen.</Hinweis>
      <input aria-label="Regeln durchsuchen" placeholder="Suchen: Empfänger, Muster, Kategorie" value={suche} onChange={e => setSuche(e.target.value)} style={klein} />
      {!liste.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '8px 0' }}>{h.stamm.regeln.length ? 'Keine Regel passt zur Suche.' : 'Noch keine Regeln.'}</div>}
      {liste.slice(0, 120).map(r => (
        <div key={r.id} style={{ ...zeile, gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) auto', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.empfaenger || r.muster}</div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>„{r.muster}“ · {r.treffer_zaehler}× getroffen{r.ist_fixkosten ? ' · Fixkosten' : ''}{r.ist_umbuchung ? ' · Umbuchung' : ''}</div>
          </div>
          <select aria-label="Kategorie" value={r.kategorie_id ?? ''} onChange={e => { void setze(r, { kategorie_id: e.target.value || null }); }} style={auswahl}>
            <option value="">— keine —</option><KategorieOptionen kategorien={h.stamm.kategorien} />
          </select>
          <Knopf leise onClick={() => { void patch('regeln', [{ op: 'delete', id: r.id, stand: r.stand }]); }}>Löschen</Knopf>
        </div>
      ))}
    </div>
  );
}
