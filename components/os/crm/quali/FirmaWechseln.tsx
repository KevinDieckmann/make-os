'use client';

// ─── Firma wechseln oder neu — mit allem, was daran hängt (03.10.) ───────────────────────────
// Kevin: „Jobwechsel, falsche Firma — Lead, Deals, Verlauf ziehen sauber mit.“ Der Dialog sagt VOR dem Klick, was passiert:
//   · die Person: Jobwechsel (Station endet, Verlauf bleibt) · zusätzliche Firma · Korrektur (falsche Firma ersetzt)
//   · der Lead (Qualifizierung): zieht um, oder die alte Firma behält ihn, weil dort noch jemand aktiv ist
//   · offene Deals: ziehen mit, wenn NUR diese Person daran hängt — Deals mit weiteren Personen bleiben (und werden genannt)
// Die Station ändert der bestehende Weg (`api.kontaktTeil` mit `firmaWechsel`, Stand/409); Lead und Deals zieht danach
// /api/crm/lead (`firma-folgen`, mit Absichtsprotokoll). Schlägt der zweite Schritt fehl, ist die Person schon umgezogen —
// der Dialog sagt es und bietet „Noch einmal versuchen“ (idempotent).

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../schlank';
import { Fenster } from '../../Fenster';
import { localDay } from '@/lib/zeit';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { bestehendeFirma } from '@/lib/crm/firmen';
import { FIRMA_WECHSEL_WAHL, firmaWechselAnwenden, stationenFelder, stationenVon, hauptStation, type FirmaWechsel } from '@/lib/crm/stationen';
import { firmaFolgenPlan, type FolgenPlan } from '@/lib/crm/firma-umhaengen';
import type { LeadZeile } from '@/lib/crm/leads';
import type { Firma } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import { neueFirma } from '../Firmen';
import { leadPost } from './hilfen';

export interface NachziehenVorgabe { von?: string; nach: string; personId: string }
/** Was ein Werkzeug der Runde zurückmeldet: ein Satz für die Karte und — wenn der Lead jetzt anders heißt — seine neue Kennung. */
export interface FertigInfo { text: string; neuerLeadId?: string }

export function FirmaWechselnDialog({ api, z, nachziehen, onZu, onFertig }: { api: CrmApi; z: LeadZeile; nachziehen?: NachziehenVorgabe; onZu: () => void; onFertig: (i: FertigInfo) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const firmen = useMemo(() => api.crm?.stand.firmen ?? [], [api.crm]);
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const [personId, setPersonId] = useState(nachziehen?.personId ?? z.hauptKontaktId ?? z.personen[0]?.id ?? '');
  const person = kontakte.find(k => k.id === personId);
  const alt = nachziehen ? firmen.find(f => f.id === nachziehen.von) : person?.firmaId ? firmen.find(f => f.id === person.firmaId) : undefined;
  const hatteFirma = !!(person && stationenVon(person).length);
  const [suche, setSuche] = useState('');
  const [wahl, setWahl] = useState<{ id?: string; name: string } | null>(nachziehen ? { id: nachziehen.nach, name: firmen.find(f => f.id === nachziehen.nach)?.name ?? '' } : null);
  const [absicht, setAbsicht] = useState<FirmaWechsel>('korrektur');
  const [leadMit, setLeadMit] = useState(true);
  const [dealsMit, setDealsMit] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [hakt, setHakt] = useState<string | null>(null);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q.length >= 2 ? firmen.filter(f => f.name.toLowerCase().includes(q) && f.id !== alt?.id).slice(0, 6) : [];
  }, [suche, firmen, alt]);
  const exakt = suche.trim() ? bestehendeFirma(firmen, suche) : undefined;
  const zielFirma: Firma | undefined = wahl ? (wahl.id ? firmen.find(f => f.id === wahl.id) : undefined) ?? (wahl.name ? neueFirma(wahl.name) : undefined) : undefined;

  // Die Vorschau rechnet dieselbe Funktion wie der Server — mit einer simulierten Kartei, in der die Person schon gewechselt hat.
  const plan: FolgenPlan | null = useMemo(() => {
    if (!zielFirma || !person || !api.crm) return null;
    const namen = (id: string) => (id === zielFirma.id ? zielFirma.name : firmen.find(f => f.id === id)?.name);
    const simuliert: Kontakt[] = nachziehen ? kontakte : kontakte.map(k => (k.id === person.id ? { ...k, ...stationenFelder(k, firmaWechselAnwenden(k, zielFirma.id, hatteFirma ? absicht : 'korrektur', heute), heute, namen) } as Kontakt : k));
    const crm = { ...api.crm.stand, firmen: firmen.some(f => f.id === zielFirma.id) ? firmen : [...firmen, zielFirma] };
    return firmaFolgenPlan(crm, simuliert, { personIds: [person.id], ...(alt ? { von: alt.id } : {}), nach: zielFirma.id, leadMit, dealsMit });
  }, [zielFirma, person, api.crm, kontakte, firmen, absicht, hatteFirma, alt, leadMit, dealsMit, nachziehen, heute]);
  const nameAlt = alt?.name ?? person?.firma ?? 'der bisherigen Firma';

  const standardFuer = (a: FirmaWechsel) => { setAbsicht(a); setLeadMit(a === 'korrektur'); setDealsMit(a === 'korrektur'); };

  const folgen = async (nach: string, von?: string) => {
    if (!leadMit && !dealsMit) return { ok: true, text: '' };
    const r = await leadPost({ aktion: 'firma-folgen', personIds: [personId], ...(von ? { von } : {}), nach, leadMit, dealsMit });
    return { ok: r.ok, text: r.ok ? zusammenfassung(r.plan as FolgenPlan, zielFirma?.name ?? '') : r.fehler ?? 'Nicht nachgezogen.' };
  };
  const los = async () => {
    if (!zielFirma || !person || laeuft) return;
    setLaeuft(true); setMeldung(''); setHakt(null);
    try {
      let nach = zielFirma.id;
      if (!nachziehen) {
        if (!firmen.some(f => f.id === zielFirma.id)) await api.setze('firmen', zielFirma as unknown as { id: string } & Record<string, unknown>);
        const ok = await api.kontaktTeil(person.id, { firma: zielFirma.name, firmaId: zielFirma.id, ...(hatteFirma ? { firmaWechsel: absicht } : {}) });
        if (!ok) { setMeldung('Nicht gespeichert — die Person ist unverändert (jemand war schneller oder die Verbindung fehlt). Bitte noch einmal.'); return; }
      } else nach = nachziehen.nach;
      const f = await folgen(nach, alt?.id);
      if (!f.ok) { setHakt(f.text); return; }
      await api.laden(true);
      onFertig({ text: `${anzeigename(person)} ist jetzt bei ${zielFirma.name}${f.text ? ` · ${f.text}` : ''}`, neuerLeadId: nach });
    } finally { setLaeuft(false); }
  };

  const titel = nachziehen ? 'Lead und Deals zur neuen Firma' : 'Firma wechseln oder neu';
  return (
    <Fenster titel={titel} onZu={onZu} breit={640}>
      {!nachziehen && z.personen.length > 1 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12.5, color: C.inkLeise }}>Wessen Firma ändert sich?</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {z.personen.map(p => <button key={p.id} type="button" aria-pressed={personId === p.id} onClick={() => setPersonId(p.id)} className="fassbar" style={chipStil(personId === p.id)}>{p.name}</button>)}
          </div>
        </div>
      )}
      {person && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{anzeigename(person)}{person.position ? ` · ${person.position}` : ''} — bisher: <b style={{ color: C.ink }}>{hauptStation(stationenVon(person)) ? nameAlt : 'keine Firma'}</b></div>}

      {!nachziehen && (
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ fontSize: 12.5, color: C.inkLeise }} htmlFor="fw-suche">Neue Firma</label>
          {wahl ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ ...chipStil(true), cursor: 'default' }}>{wahl.name}{wahl.id ? '' : ' (neu angelegt)'}</span>
              <button type="button" onClick={() => { setWahl(null); setSuche(''); }} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5, minHeight: 44 }}>andere wählen</button>
            </div>
          ) : (
            <>
              <input id="fw-suche" value={suche} onChange={e => setSuche(e.target.value)} placeholder="Firma suchen oder neu eingeben …" autoComplete="off" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
              <div style={{ display: 'grid', gap: 4 }}>
                {treffer.map(f => <button key={f.id} type="button" onClick={() => setWahl({ id: f.id, name: f.name })} className="fassbar" style={zeileStil}>{f.name}<span style={{ color: C.inkLeise }}>{[f.branche, f.stadt].filter(Boolean).join(' · ')}</span></button>)}
                {suche.trim().length >= 2 && !exakt && <button type="button" onClick={() => setWahl({ name: suche.trim() })} className="fassbar" style={{ ...zeileStil, borderColor: `${LEUCHT.gut}55` }}>„{suche.trim()}“ als neue Firma anlegen</button>}
                {exakt && !treffer.some(t => t.id === exakt.id) && exakt.id !== alt?.id && <button type="button" onClick={() => setWahl({ id: exakt.id, name: exakt.name })} className="fassbar" style={zeileStil}>{exakt.name}</button>}
              </div>
            </>
          )}
        </div>
      )}

      {!nachziehen && wahl && hatteFirma && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12.5, color: C.inkLeise }}>Was ist passiert?</span>
          {FIRMA_WECHSEL_WAHL.map(w => (
            <button key={w.id} type="button" role="radio" aria-checked={absicht === w.id} onClick={() => standardFuer(w.id)} className="fassbar"
              style={{ display: 'grid', gap: 2, textAlign: 'left', minHeight: 48, padding: '9px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink, border: `1px solid ${absicht === w.id ? LEUCHT.business : 'rgba(255,255,255,.1)'}`, background: absicht === w.id ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.03)' }}>
              <b style={{ fontSize: TYP.bedien }}>{w.label}</b><span style={{ fontSize: 12, color: C.inkDim }}>{w.hinweis}</span>
            </button>
          ))}
        </div>
      )}

      {zielFirma && plan && (
        <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Was dabei mitzieht</div>
          <Haken an={leadMit} onChange={setLeadMit} label="Qualifizierung (Lead) mitnehmen" unter={leadText(plan, nameAlt, zielFirma.name)} />
          <Haken an={dealsMit} onChange={setDealsMit} label={`Offene Deals mitnehmen${plan.dealsMit.length ? ` (${plan.dealsMit.length})` : ''}`}
            unter={plan.dealsMit.length || plan.dealsBleiben.length ? [plan.dealsMit.length ? `Ziehen mit: ${plan.dealsMit.map(d => `„${d.titel}“`).join(', ')}.` : '', plan.dealsBleiben.length ? `Bleiben bei ${nameAlt}, weil weitere Personen daran hängen: ${plan.dealsBleiben.map(d => `„${d.titel}“`).join(', ')}.` : ''].filter(Boolean).join(' ') : 'Kein offener Deal betroffen.'} />
          <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>Der Verlauf (Gespräche, Notizen) bleibt an der Person{hatteFirma && absicht !== 'korrektur' ? ` — ${nameAlt} zeigt sie unter „ehemalig“` : ''}. Gespeicherte Deals und Mandate der alten Firma bleiben dort.</div>
        </div>
      )}

      {meldung && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
      {hakt && (
        <div role="alert" style={{ padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.achtung}14`, border: `1px solid ${LEUCHT.achtung}44`, fontSize: TYP.bedien, display: 'grid', gap: 8 }}>
          <span><b>{person ? anzeigename(person) : 'Die Person'} ist schon umgezogen</b> — Lead und Deals konnten aber nicht nachgezogen werden: {hakt}</span>
          <span><Knopf onClick={() => los()}>Noch einmal versuchen</Knopf></span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        <Knopf aus={!zielFirma || laeuft || !person || (!nachziehen && zielFirma?.id === alt?.id)} onClick={() => los()}>{nachziehen ? 'Nachziehen' : 'Firma ändern'}</Knopf>
      </div>
    </Fenster>
  );
}

const chipStil = (an: boolean) => ({ minHeight: 44, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, color: C.ink, border: `1px solid ${an ? LEUCHT.business : 'rgba(255,255,255,.12)'}`, background: an ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.04)' }) as const;
const zeileStil = { display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', minHeight: 44, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, textAlign: 'left', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' } as const;

function Haken({ an, onChange, label, unter }: { an: boolean; onChange: (v: boolean) => void; label: string; unter?: string }) {
  return (
    <label style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'start', cursor: 'pointer', minHeight: 44 }}>
      <input type="checkbox" checked={an} onChange={e => onChange(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2 }} />
      <span style={{ display: 'grid', gap: 2 }}><b style={{ fontSize: TYP.bedien }}>{label}</b>{unter && <span style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{unter}</span>}</span>
    </label>
  );
}

function leadText(p: FolgenPlan, alt: string, neu: string): string {
  if (p.lead === 'keiner') return 'Es gibt keinen Lead zum Mitnehmen — die Qualifizierung beginnt bei der neuen Firma von vorn.';
  const quelle = p.leadVon === 'person' ? 'Der Lead der Person' : `Der Lead von ${alt}`;
  const ziel = p.zielHatteLead ? ` ${neu} hat schon einen Lead: der bleibt führend, Lücken füllt der mitgebrachte.` : '';
  return p.lead === 'kopiert' ? `${quelle} wird kopiert — ${alt} behält ihn, weil dort noch ${p.alteFirmaPersonen} ${p.alteFirmaPersonen === 1 ? 'Person aktiv ist' : 'Personen aktiv sind'}.${ziel}` : `${quelle} zieht zu ${neu} um (Kernfragen, Antworten, Status).${ziel}`;
}
function zusammenfassung(p: FolgenPlan, neu: string): string {
  const t: string[] = [];
  if (p.lead !== 'keiner') t.push(p.lead === 'kopiert' ? `Lead kopiert nach ${neu}` : `Lead zieht nach ${neu}`);
  if (p.dealsMit.length) t.push(`${p.dealsMit.length} ${p.dealsMit.length === 1 ? 'Deal' : 'Deals'} mitgenommen`);
  if (p.dealsBleiben.length) t.push(`${p.dealsBleiben.length} ${p.dealsBleiben.length === 1 ? 'Deal bleibt' : 'Deals bleiben'} bei der alten Firma`);
  return t.join(' · ');
}
