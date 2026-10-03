'use client';

// ─── Dubletten zusammenführen — mitten in der Runde (03.10.) ──────────────────────────────────
// Kevin: „Dubletten Person/Firma in der Runde erkennen, mit Vorschau zusammenführen.“
//   Personen  die vorhandene Logik (/api/crm/dubletten: Vorschau mit Zahlen, Zusammenführen mit Umbiegen aller Verweise,
//             „Rückgängig“ 30 Tage unter Stammdaten) — die Runde zeigt nur die Paare, an denen dieser Lead beteiligt ist,
//             und lässt jede andere Person suchen.
//   Firmen    lib/crm/firma-umhaengen(-server).ts: Personen, Deals, Mandate, Angebote, Events, Follow-ups wandern zur behaltenen
//             Firma, ihr Vermerk nennt die andere. Vorher legt der Server eine Sicherung an (30 Tage, /api/crm/firma-archiv). Hängt an der anderen noch etwas außerhalb von Kartei und CRM (Aufgaben,
//             Zeit …), lehnt der Server mit Namen ab — dann dort erst umhängen.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../../ui';
import { Fenster } from '../../Fenster';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { dubletten, wanderungText, type Wanderung } from '@/lib/crm/dubletten';
import { firmenDubletten } from '@/lib/crm/firmen';
import type { ZusammenVorschau } from '@/lib/crm/firma-umhaengen';
import type { LeadZeile } from '@/lib/crm/leads';
import type { Firma } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import { leadPost } from './hilfen';
import type { FertigInfo } from './FirmaWechseln';

type Modus = 'personen' | 'firmen';
const FELD_LABEL: Record<string, string> = { domain: 'Domain', webseite: 'Webseite', stadt: 'Ort', branche: 'Branche', branchen: 'Branchen', mitarbeiter: 'Mitarbeitende', umsatz: 'Umsatz', telefon: 'Telefon', email: 'E-Mail', linkedin: 'LinkedIn', rolle: 'Rolle', lead: 'Lead', notiz: 'Notiz', mutterId: 'Mutterfirma', zahlung: 'Zahlungsdaten', marktinfo: 'Marktinfo', rechtsform: 'Rechtsform', gegruendet: 'Gegründet', bean: 'BEAN' };

const pille = (an: boolean) => ({ minHeight: 44, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, color: C.ink, border: `1px solid ${an ? LEUCHT.business : 'rgba(255,255,255,.12)'}`, background: an ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.04)' }) as const;
const zeile = (an: boolean) => ({ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', width: '100%', minHeight: 48, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink, textAlign: 'left', border: `1px solid ${an ? LEUCHT.business : 'rgba(255,255,255,.1)'}`, background: an ? `${LEUCHT.business}1F` : 'rgba(255,255,255,.03)' }) as const;

export function ZusammenfuehrenDialog({ api, z, onZu, onFertig }: { api: CrmApi; z: LeadZeile; onZu: () => void; onFertig: (i: FertigInfo) => void }) {
  const [modus, setModus] = useState<Modus>('personen');
  return (
    <Fenster titel="Zusammenführen" onZu={onZu} breit={680}>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button role="tab" aria-selected={modus === 'personen'} onClick={() => setModus('personen')} className="fassbar" style={pille(modus === 'personen')}>Personen</button>
        <button role="tab" aria-selected={modus === 'firmen'} onClick={() => setModus('firmen')} className="fassbar" style={pille(modus === 'firmen')}>Firmen</button>
      </div>
      {modus === 'personen' ? <Personen api={api} z={z} onZu={onZu} onFertig={onFertig} /> : <Firmen api={api} z={z} onZu={onZu} onFertig={onFertig} />}
    </Fenster>
  );
}

// ── Personen ─────────────────────────────────────────────────────────────────

function Personen({ api, z, onZu, onFertig }: { api: CrmApi; z: LeadZeile; onZu: () => void; onFertig: (i: FertigInfo) => void }) {
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const ids = useMemo(() => new Set(z.personen.map(p => p.id)), [z.personen]);
  const paare = useMemo(() => dubletten(kontakte).filter(([a, b]) => ids.has(a.id) || ids.has(b.id)), [kontakte, ids]);
  const [paar, setPaar] = useState<{ behalten: Kontakt; weg: Kontakt } | null>(null);
  const [suche, setSuche] = useState('');
  const [eigene, setEigene] = useState(z.hauptKontaktId ?? z.personen[0]?.id ?? '');
  const treffer = suche.trim().length >= 2 ? kontakte.filter(k => !ids.has(k.id) && `${anzeigename(k)} ${k.firma ?? ''} ${k.email ?? ''}`.toLowerCase().includes(suche.trim().toLowerCase())).slice(0, 6) : [];
  const waehle = (x: Kontakt, y: Kontakt) => {
    const xIn = ids.has(x.id), yIn = ids.has(y.id);
    const xBehalten = xIn !== yIn ? xIn : (x.aktivitaeten?.length ?? 0) >= (y.aktivitaeten?.length ?? 0);
    setPaar(xBehalten ? { behalten: x, weg: y } : { behalten: y, weg: x });
  };
  const [vorschau, setVorschau] = useState<{ wandert?: Wanderung; grund?: string; fehler?: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  useEffect(() => {
    setVorschau(null); setMeldung('');
    if (!paar) return;
    let lebt = true;
    fetch(`/api/crm/dubletten?behalten=${encodeURIComponent(paar.behalten.id)}&weg=${encodeURIComponent(paar.weg.id)}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (lebt) setVorschau(d.ok ? { wandert: d.wandert, grund: d.grund } : { fehler: d.fehler ?? 'Keine Vorschau.' }); }).catch(() => { if (lebt) setVorschau({ fehler: 'Keine Verbindung.' }); });
    return () => { lebt = false; };
  }, [paar]);
  const los = async () => {
    if (!paar || laeuft) return;
    setLaeuft(true); setMeldung('');
    const r = await fetch('/api/crm/dubletten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ behalten: paar.behalten.id, weg: paar.weg.id }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht zusammengeführt.'); return; }
    await api.laden(true);
    onFertig({ text: `${anzeigename(paar.weg)} ist jetzt in ${anzeigename(paar.behalten)} aufgegangen — Verlauf, Deals, Einwilligungen wanderten mit (Rückgängig: 30 Tage, Stammdaten › Datenqualität).`, ...(z.art === 'person' && z.id === paar.weg.id ? { neuerLeadId: paar.behalten.id } : {}) });
  };
  return (
    <>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Dieselbe Person doppelt? Der behaltene Eintrag bekommt alles, was ihm fehlt: den ganzen Verlauf, alle Einwilligungen, die Deals. Eine Werbesperre gilt weiter.</div>
      {!paar && (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Erkannte Dubletten dieses Leads</span>
            {paare.length ? paare.map(([a, b]) => (
              <button key={`${a.id}|${b.id}`} type="button" onClick={() => waehle(a, b)} className="fassbar" style={zeile(false)}>
                <span>{anzeigename(a)} <span style={{ color: C.inkLeise }}>⇄</span> {anzeigename(b)}</span>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[a.firma, b.firma].filter(Boolean).join(' / ')}</span>
              </button>
            )) : <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine automatisch erkannten Dubletten — unten selbst eine Person suchen.</div>}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Andere Person suchen</span>
            {z.personen.length > 1 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{z.personen.map(p => <button key={p.id} type="button" aria-pressed={eigene === p.id} onClick={() => setEigene(p.id)} className="fassbar" style={pille(eigene === p.id)}>{p.name}</button>)}</div>
            )}
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name, Firma oder Mail …" aria-label="Andere Person suchen" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            {treffer.map(k => { const e = kontakte.find(x => x.id === eigene); return (
              <button key={k.id} type="button" disabled={!e} onClick={() => e && waehle(e, k)} className="fassbar" style={zeile(false)}><span>{anzeigename(k)}</span><span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[k.firma, k.email].filter(Boolean).join(' · ')}</span></button>
            ); })}
          </div>
        </>
      )}
      {paar && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Welcher Eintrag bleibt?</span>
            {[paar.behalten, paar.weg].map((k, i) => (
              <button key={k.id} type="button" role="radio" aria-checked={i === 0} onClick={() => i === 1 && setPaar({ behalten: paar.weg, weg: paar.behalten })} className="fassbar" style={zeile(i === 0)}>
                <span><b>{i === 0 ? 'Bleibt' : 'Geht auf'}:</b> {anzeigename(k)}</span>
                <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[k.firma, k.email, `${(k.aktivitaeten ?? []).filter(a => a.art !== 'system').length} Aktivitäten`].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div>
          {!vorschau && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Vorschau lädt …</div>}
          {vorschau?.wandert && <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.04)', fontSize: TYP.bedien, lineHeight: 1.55 }}>Von „{anzeigename(paar.weg)}“ wandert zu „{anzeigename(paar.behalten)}“: <b>{wanderungText(vorschau.wandert)}</b>.</div>}
          {(vorschau?.grund || vorschau?.fehler) && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien, lineHeight: 1.5 }}>{vorschau.grund ?? vorschau.fehler}</div>}
          {meldung && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{meldung}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {paar && <Knopf leise onClick={() => setPaar(null)}>Anderes Paar</Knopf>}
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        {paar && <Knopf aus={!vorschau?.wandert || !!vorschau.grund || laeuft} onClick={() => los()}>Zusammenführen</Knopf>}
      </div>
    </>
  );
}

// ── Firmen ───────────────────────────────────────────────────────────────────

function Firmen({ api, z, onZu, onFertig }: { api: CrmApi; z: LeadZeile; onZu: () => void; onFertig: (i: FertigInfo) => void }) {
  const firmen = useMemo(() => api.crm?.stand.firmen ?? [], [api.crm]);
  const eigene = z.firmaId ? firmen.find(f => f.id === z.firmaId) : undefined;
  const paare = useMemo(() => (eigene ? firmenDubletten(firmen).filter(([a, b]) => a.id === eigene.id || b.id === eigene.id) : []), [firmen, eigene]);
  const [suche, setSuche] = useState('');
  const [paar, setPaar] = useState<{ behalten: Firma; weg: Firma } | null>(null);
  const treffer = suche.trim().length >= 2 ? firmen.filter(f => f.id !== eigene?.id && f.name.toLowerCase().includes(suche.trim().toLowerCase())).slice(0, 6) : [];
  const [vorschau, setVorschau] = useState<{ v?: ZusammenVorschau; fehler?: string; fremd?: Record<string, number> } | null>(null);
  const [sicher, setSicher] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');
  useEffect(() => {
    setVorschau(null); setSicher(false); setMeldung('');
    if (!paar) return;
    let lebt = true;
    void leadPost({ aktion: 'firmen-zusammen-vorschau', behalten: paar.behalten.id, weg: paar.weg.id }).then(r => { if (lebt) setVorschau(r.ok ? { v: r.vorschau as ZusammenVorschau } : { fehler: r.fehler, fremd: r.fremd }); });
    return () => { lebt = false; };
  }, [paar]);
  const los = async () => {
    if (!paar || laeuft) return;
    setLaeuft(true); setMeldung('');
    const r = await leadPost({ aktion: 'firmen-zusammen', behalten: paar.behalten.id, weg: paar.weg.id });
    setLaeuft(false);
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht zusammengeführt.'); return; }
    await api.laden(true);
    onFertig({ text: `„${paar.weg.name}“ ist jetzt in „${paar.behalten.name}“ aufgegangen — Personen, Deals, Mandate und Verläufe stehen dort. Die Sicherung liegt 30 Tage bereit.`, neuerLeadId: paar.behalten.id });
  };
  if (!eigene && !paar) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Dieser Lead hat noch keine Firma. Erst über „Firma wechseln oder neu“ eine Firma zuordnen — dann lassen sich Firmen-Dubletten zusammenführen.</div>;
  const v = vorschau?.v;
  const gleich = (a: Firma) => a.id === paar?.behalten.id;
  return (
    <>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Dieselbe Firma doppelt? Personen, Deals, Mandate, Angebote, Events und Follow-ups wandern zur behaltenen Firma; ihre leeren Felder füllt die andere. Was dort anders stand, steht im Vermerk der Firma.</div>
      {!paar && (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Erkannte Dubletten von „{eigene?.name}“</span>
            {paare.length ? paare.map(([a, b]) => { const andere = a.id === eigene?.id ? b : a; return (
              <button key={andere.id} type="button" onClick={() => eigene && setPaar({ behalten: eigene, weg: andere })} className="fassbar" style={zeile(false)}><span>{andere.name}</span><span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[andere.domain, andere.stadt].filter(Boolean).join(' · ')}</span></button>
            ); }) : <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine automatisch erkannte Dublette (gleicher Name ohne Rechtsform oder gleiche Domain) — unten selbst suchen.</div>}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise }}>Andere Firma suchen</span>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Firmenname …" aria-label="Andere Firma suchen" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
            {treffer.map(f => <button key={f.id} type="button" onClick={() => eigene && setPaar({ behalten: eigene, weg: f })} className="fassbar" style={zeile(false)}><span>{f.name}</span><span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[f.domain, f.stadt].filter(Boolean).join(' · ')}</span></button>)}
          </div>
        </>
      )}
      {paar && (
        <div style={{ display: 'grid', gap: 12 }}>
          {[paar.behalten, paar.weg].map(f => (
            <button key={f.id} type="button" role="radio" aria-checked={gleich(f)} onClick={() => !gleich(f) && setPaar({ behalten: paar.weg, weg: paar.behalten })} className="fassbar" style={zeile(gleich(f))}>
              <span><b>{gleich(f) ? 'Bleibt' : 'Geht auf'}:</b> {f.name}</span><span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{[f.domain, f.stadt, f.branche].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
          {!vorschau && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Vorschau lädt …</div>}
          {v && (
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.04)', fontSize: TYP.bedien, lineHeight: 1.6, display: 'grid', gap: 4 }}>
              <span>Von „{paar.weg.name}“ wandert: <b>{v.personen} {v.personen === 1 ? 'Person' : 'Personen'}</b>{v.ehemalig ? ` (+ ${v.ehemalig} ehemalige)` : ''} · <b>{v.dealsGesamt} {v.dealsGesamt === 1 ? 'Deal' : 'Deals'}</b>{v.dealsOffen ? ` (${v.dealsOffen} offen)` : ''} · <b>{v.mandate} {v.mandate === 1 ? 'Mandat' : 'Mandate'}</b> · {v.angebote} Angebote · {v.events} Events · {v.followups} Follow-ups.</span>
              <span style={{ color: C.inkDim }}>{v.lead === 'beide' ? 'Beide haben einen Lead: der der behaltenen Firma bleibt führend, Lücken füllt der andere.' : v.lead === 'nur-weg' ? 'Der Lead der anderen Firma zieht mit.' : 'Kein Lead zu übernehmen.'}{v.neueFelder.length ? ` Neu bei „${paar.behalten.name}“: ${v.neueFelder.map(f => FELD_LABEL[f] ?? f).join(', ')}.` : ''}</span>
              <span style={{ color: C.inkDim }}>Vor dem Zusammenführen wird eine Sicherung angelegt (30 Tage). Zurücknehmen kann sie nur der Inhaber, und nur, was seitdem unverändert ist.</span>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, cursor: 'pointer', marginTop: 4 }}><input type="checkbox" checked={sicher} onChange={e => setSicher(e.target.checked)} style={{ width: 22, height: 22 }} /><span>Ich habe geprüft, dass es dieselbe Firma ist.</span></label>
            </div>
          )}
          {vorschau?.fehler && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien, lineHeight: 1.5 }}>{vorschau.fehler}</div>}
          {meldung && <div role="alert" style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{meldung}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {paar && <Knopf leise onClick={() => setPaar(null)}>Andere Firma</Knopf>}
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        {paar && <Knopf aus={!v || !sicher || laeuft} onClick={() => los()}>Zusammenführen</Knopf>}
      </div>
    </>
  );
}
