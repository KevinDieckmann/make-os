'use client';

// ─── MAKE OS — Kapazität: die ruhige Ansicht je Person und Woche (04.10.) ───
// Kevin: „Zeit und Machbarkeit über die Personen und Kapas … realistisch planbar.“ Oben die vier Zahlen und das Last-Band
// des Teams, dann die Machbarkeit je Meilenstein/Ziel (das Ehrliche zuerst: nicht machbar, überfällig, eng), dann je Person
// zwölf Wochen als Last-Balken mit Grundwert, Urlaub/Blöcken und Zuweisungen (Mandat/Kunde). Gerechnet wird NUR auf dem
// Server (lib/kapazitaet), gefiltert auch dort — hier wird gezeichnet und über PATCH /api/kapazitaet geändert.

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import type { KapaStand, PersonStand, Machbarkeit, Ausnahme } from '@/lib/kapazitaet/typen';
import { stufeVon } from '@/lib/kapazitaet/modell';
import type { KapaOp } from '@/lib/kapazitaet/aendern';
import { Seite, Karte, Ueberschrift, Zahl, Liste, Zeile, Leer, Knopf, Chip, Hinweis, feld, auswahl, useHandy, LEUCHT } from '../ui';
import { PlanerLeiste } from '../PlanerLeiste';
import { useKapazitaet, type Bezug } from './useKapazitaet';
import { MachbarMarke, LastBand, STUFE_FARBE, STUFE_TEXT } from './teile';

const z = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const QUELLE_TEXT: Record<PersonStand['grundwertQuelle'], string> = { einstellung: 'eingetragen', vorlage: 'aus der Wochenvorlage', annahme: 'Annahme — bitte eintragen' };
const RANG: Record<string, number> = { 'nicht-machbar': 0, ueberfaellig: 1, eng: 2, machbar: 3, 'aufwand-fehlt': 4, 'termin-fehlt': 5, erledigt: 6 };
const WOCHEN = 12;

export function KapazitaetAnsicht() {
  const k = useKapazitaet();
  const heute = localDay();
  const s = k.stand;
  return (
    <Seite titel="Kapazität" unter="Zeit und Machbarkeit über die Personen — was wir uns vornehmen, gegen die Stunden, die wirklich da sind.">
      <PlanerLeiste aktiv="kapazitaet" />
      {!k.zugang && <Hinweis art="info" titel="Kein Zugang">Die Kapazität gehört zum Haushalt des Inhabers.</Hinweis>}
      {k.fehler && <Hinweis art="kritisch">{k.fehler}</Hinweis>}
      {k.zugang && !s && !k.fehler && <Karte><Leer>Rechnet die Kapazität …</Leer></Karte>}
      {s && <>
        <Ueberblick s={s} heute={heute} />
        <MachbarKarte posten={s.posten} />
        {s.personen.map((p, i) => (
          <PersonKarte key={p.id} p={p} i={i + 2} ich={k.ich} inhaber={k.inhaber} personen={s.personen} bezuege={k.bezuege}
            zuweisungen={s.zuweisungen.filter(x => x.person === p.id)} aendern={k.aendern} />
        ))}
        {!s.personen.length && <Karte><Leer>Noch keine Personen im Team — Konten und Team pflegst du unter System › Team.</Leer></Karte>}
        <KopfKarte s={s} />
      </>}
    </Seite>
  );
}

function Ueberblick({ s, heute }: { s: KapaStand; heute: string }) {
  const kz = s.kennzahlen;
  const lastFarbe = kz.last4 == null ? C.inkLeise : kz.last4 > 100 ? LEUCHT.kritisch : kz.last4 > 85 ? LEUCHT.achtung : LEUCHT.gut;
  return (
    <Karte i={0}>
      <Ueberschrift rechts={kz.engpassWochen.length ? <span style={{ color: LEUCHT.achtung }}>{kz.engpassWochen.length} Engpass-Woche{kz.engpassWochen.length === 1 ? '' : 'n'} in 12 Wochen</span> : 'keine Engpässe in 12 Wochen'}>Team · nächste Wochen</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 16, marginBottom: 18 }}>
        <Zahl wert={kz.last4 == null ? '—' : `${z(kz.last4)} %`} label={kz.last4 == null ? 'Last 4 Wochen · noch nichts verplant' : `Last 4 Wochen · ${z(kz.bedarf4)} von ${z(kz.belastbar4)} h`} farbe={lastFarbe} />
        <Zahl wert={kz.machbar.bewertet ? `${kz.machbar.machbar} / ${kz.machbar.bewertet}` : '—'} label={kz.machbar.bewertet ? `machbar${kz.machbar.eng ? ` · ${kz.machbar.eng} eng` : ''}${kz.machbar.nicht ? ` · ${kz.machbar.nicht} nicht` : ''}` : 'Meilensteine mit Aufwand'} farbe={kz.machbar.nicht || kz.machbar.ueberfaellig ? LEUCHT.kritisch : kz.machbar.eng ? LEUCHT.achtung : undefined} />
        <Zahl wert={kz.pufferStdWoche == null ? '—' : `${z(kz.pufferStdWoche)} h`} label="Puffer je Woche (Ø 4 Wochen)" farbe={kz.pufferStdWoche != null && kz.pufferStdWoche < 0 ? LEUCHT.kritisch : undefined} />
        <Zahl wert={`${Math.round(s.team.kopf.faktor * 100)} %`} label={s.team.kopf.personen ? 'Kopf & Energie (Team, 14 Tage)' : 'Kopf & Energie · ohne geteilte Messung'} />
      </div>
      <LastBand stand={s} von={heute} bis={tagPlus(heute, WOCHEN * 7 - 1)} hoehe={34} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>
        <span>{kurz(heute)}</span><span>{kurz(tagPlus(heute, WOCHEN * 7 - 1))}</span>
      </div>
    </Karte>
  );
}

function MachbarKarte({ posten }: { posten: Machbarkeit[] }) {
  const offen = posten.filter(p => p.status !== 'erledigt').sort((a, b) => RANG[a.status] - RANG[b.status] || (a.termin ?? '9').localeCompare(b.termin ?? '9'));
  const bewertet = offen.filter(p => RANG[p.status] <= 3);
  const ohne = offen.filter(p => RANG[p.status] > 3);
  const [alle, setAlle] = useState(false);
  return (
    <Karte i={1}>
      <Ueberschrift rechts={ohne.length ? `${ohne.length} ohne Aufwand oder Termin` : undefined}>Machbarkeit · Meilensteine & Ziele</Ueberschrift>
      {!bewertet.length && <Leer>Noch kein offener Business-Meilenstein mit Aufwand und Termin. Trag am Meilenstein „Aufwand (h)“ ein — dann steht hier, ob es reicht.</Leer>}
      <Liste>
        {bewertet.map(p => (
          <Link key={`${p.art}:${p.id}`} href={p.art === 'ziel' ? WEG.ziel(p.id) : WEG.meilenstein(p.id)} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <Zeile umbrechen titel={p.titel}
              links={<span style={{ fontSize: TYP.bedien, fontFamily: SCHRIFT.display, fontWeight: 600, color: C.inkLeise, width: 52, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{p.termin ? kurz(p.termin) : '—'}</span>}
              unter={<span>{p.art === 'ziel' ? 'Ziel · ' : ''}{p.rest != null ? `Rest ${z(p.rest)} h von ${z(p.aufwand ?? 0)} h` : ''}{p.istStunden ? ` · ${z(p.istStunden)} h gemessen` : ''} — {p.text.replace(/^(machbar|eng|nicht machbar) — /, '')}</span>}
              rechts={<MachbarMarke m={p} />} />
          </Link>
        ))}
      </Liste>
      {ohne.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Knopf leise onClick={() => setAlle(a => !a)}>{alle ? 'Ohne Aufwand ausblenden' : `${ohne.length} ohne Aufwand oder Termin zeigen`}</Knopf>
          {alle && <Liste>{ohne.map(p => (
            <Link key={`${p.art}:${p.id}`} href={p.art === 'ziel' ? WEG.ziel(p.id) : WEG.meilenstein(p.id)} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <Zeile titel={p.titel} unter={p.text} rechts={<MachbarMarke m={p} />} />
            </Link>
          ))}</Liste>}
        </div>
      )}
    </Karte>
  );
}

function PersonKarte({ p, i, ich, inhaber, personen, bezuege, zuweisungen, aendern }: {
  p: PersonStand; i: number; ich: string | null; inhaber: boolean; personen: PersonStand[]; bezuege: Bezug[];
  zuweisungen: KapaStand['zuweisungen']; aendern: (ops: KapaOp[]) => Promise<string | null>;
}) {
  const darf = inhaber || ich === p.id;
  const [meldung, setMeldung] = useState<string | null>(null);
  const los = async (ops: KapaOp[]) => { setMeldung(await aendern(ops)); };
  // Am Handy 6 Wochen (lesbare Beschriftung), am Rechner 12.
  const handy = useHandy();
  const wochen = p.wochen.slice(0, handy ? 6 : WOCHEN);
  const max = Math.max(1, ...wochen.map(w => Math.max(w.belastbar, w.bedarf)));
  const eigen = ich === p.id;
  return (
    <Karte i={i} id={`person-${p.id}`}>
      <Ueberschrift rechts={p.ohneKapa ? <span style={{ color: LEUCHT.achtung }}>ohne Grundwert — zählt nicht</span> : `${z(p.grundwert)} h/Woche · ${QUELLE_TEXT[p.grundwertQuelle]}`}>{p.name}{eigen ? ' · du' : ''}</Ueberschrift>
      {/* Zwölf Wochen: Balken = belastbare Zeit, Füllung = verplant (Farbe = Stufe) */}
      <div role="list" aria-label={`Last je Woche für ${p.name}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${wochen.length}, minmax(0, 1fr))`, gap: 4, alignItems: 'end', height: 92 }}>
        {wochen.map(w => {
          const stufe = stufeVon(w.belastbar, w.bedarf);
          const hKapa = Math.round((w.belastbar / max) * 72), hBedarf = Math.round((Math.min(w.bedarf, max) / max) * 72);
          return (
            <div role="listitem" key={w.woche} title={`Woche ab ${kurz(w.woche)}: ${z(w.bedarf)} h verplant von ${z(w.belastbar)} h belastbar${w.abwesend ? ` · ${z(w.abwesend)} h abwesend` : ''}${w.termine ? ` · ${z(w.termine)} h Termine` : ''}${w.ist ? ` · ${z(w.ist)} h gemessen` : ''} — ${STUFE_TEXT[stufe]}`}
              style={{ display: 'grid', gap: 4, alignItems: 'end', justifyItems: 'stretch', minWidth: 0 }}>
              <div style={{ position: 'relative', height: 72 }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: Math.max(2, hKapa), borderRadius: 4, background: 'rgba(255,255,255,.07)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hBedarf, borderRadius: 4, background: stufe === 'gut' ? 'rgba(255,255,255,.28)' : `${STUFE_FARBE[stufe]}c0` }} />
              </div>
              <span style={{ fontSize: 10.5, color: stufe === 'ueber' ? LEUCHT.kritisch : stufe === 'eng' ? LEUCHT.achtung : C.inkLeise, textAlign: 'center', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', whiteSpace: 'nowrap' }}>{kurz(w.woche).slice(0, 5)}</span>
            </div>
          );
        })}
      </div>
      {p.erholung && eigen && (
        <div style={{ marginTop: 10, fontSize: TYP.bedien, color: C.inkDim }}>Deine Erholung: Ø {p.erholung.wert} % → Faktor {z(p.erholung.faktor)} <span style={{ color: C.inkLeise }}>(nur du siehst den Wert — das Team sieht nur den gemeinsamen Faktor)</span></div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, marginTop: 16 }}>
        {darf && <Grundwert p={p} los={los} />}
        <Ausnahmen p={p} darf={darf} los={los} />
        <Zuweisungen p={p} darf={darf} zuweisungen={zuweisungen} bezuege={bezuege} personen={personen} los={los} />
        {meldung && <span role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</span>}
      </div>
    </Karte>
  );
}

const zeileStil = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center', minWidth: 0 };
const klein = { ...feld, width: 'auto', minWidth: 0, maxWidth: '100%', colorScheme: 'dark' as const };

function Grundwert({ p, los }: { p: PersonStand; los: (ops: KapaOp[]) => Promise<void> }) {
  const [wert, setWert] = useState<string>(p.grundwertQuelle === 'einstellung' ? String(p.grundwert) : '');
  return (
    <div style={zeileStil}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, flex: '1 0 100%' }}>Grundwert</span>
      <input type="number" inputMode="decimal" min={0} max={80} step={1} value={wert} placeholder={`${z(p.grundwert)}`} aria-label={`Grundwert ${p.name} in Stunden je Woche`}
        onChange={e => setWert(e.target.value)} style={{ ...klein, width: 96 }} />
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>h je Woche</span>
      <Knopf leise onClick={() => los([{ op: 'grundwert', person: p.id, stundenWoche: wert.trim() === '' ? null : Number(wert) }])}>Speichern</Knopf>
      {p.grundwertQuelle === 'einstellung' && <Knopf leise onClick={async () => { setWert(''); await los([{ op: 'grundwert', person: p.id, stundenWoche: null }]); }}>Aus Wochenvorlage</Knopf>}
    </div>
  );
}

function Ausnahmen({ p, darf, los }: { p: PersonStand; darf: boolean; los: (ops: KapaOp[]) => Promise<void> }) {
  const [art, setArt] = useState<'urlaub' | 'block'>('urlaub');
  const [von, setVon] = useState(''); const [bis, setBis] = useState(''); const [sw, setSw] = useState(''); const [titel, setTitel] = useState('');
  const text = (a: Ausnahme) => a.art === 'urlaub' ? `Urlaub ${kurz(a.von)}–${kurz(a.bis ?? a.von)}` : `Block ${z(a.stundenWoche ?? 0)} h/Woche ab ${kurz(a.von)}${a.bis ? ` bis ${kurz(a.bis)}` : ''}`;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Urlaub & feste Blöcke</span>
      {!p.ausnahmen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine — Abwesenheiten und Feiertage aus dem Kalender zählen von selbst.</span>}
      <div style={zeileStil}>
        {p.ausnahmen.map(a => (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
            <Chip umbrechen farbe={a.art === 'urlaub' ? LEUCHT.planung : LEUCHT.agenten}>{text(a)}{a.titel ? ` · ${a.titel}` : ''}</Chip>
            {darf && <button type="button" aria-label={`${text(a)} entfernen`} onClick={() => void los([{ op: 'ausnahme-weg', person: p.id, id: a.id }])} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 32, minHeight: 32, fontSize: 15 }}>×</button>}
          </span>
        ))}
      </div>
      {darf && (
        <div style={zeileStil}>
          <select value={art} onChange={e => setArt(e.target.value === 'block' ? 'block' : 'urlaub')} aria-label="Art der Ausnahme" style={auswahl}>
            <option value="urlaub">Urlaub</option><option value="block">fester Block</option>
          </select>
          <input type="date" value={von} onChange={e => setVon(e.target.value)} aria-label="von" style={{ ...klein, flex: '1 1 140px' }} />
          <input type="date" value={bis} onChange={e => setBis(e.target.value)} aria-label={art === 'block' ? 'bis (optional)' : 'bis'} style={{ ...klein, flex: '1 1 140px' }} />
          {art === 'block' && <input type="number" min={1} max={80} value={sw} onChange={e => setSw(e.target.value)} placeholder="h/Woche" aria-label="Stunden je Woche" style={{ ...klein, width: 100 }} />}
          <input value={titel} onChange={e => setTitel(e.target.value)} maxLength={80} placeholder="Notiz (nur du siehst sie)" aria-label="Notiz" style={{ ...klein, flex: '1 1 160px', width: 0 }} />
          <Knopf leise aus={!von || (art === 'urlaub' && !bis) || (art === 'block' && !sw)} onClick={async () => {
            await los([{ op: 'ausnahme', person: p.id, ausnahme: { art, von, ...(bis ? { bis } : {}), ...(art === 'block' ? { stundenWoche: Number(sw) } : {}), ...(titel.trim() ? { titel: titel.trim() } : {}) } }]);
            setVon(''); setBis(''); setSw(''); setTitel('');
          }}>+ hinzufügen</Knopf>
        </div>
      )}
    </div>
  );
}

function Zuweisungen({ p, darf, zuweisungen, bezuege, los }: { p: PersonStand; darf: boolean; zuweisungen: KapaStand['zuweisungen']; bezuege: Bezug[]; personen: PersonStand[]; los: (ops: KapaOp[]) => Promise<void> }) {
  const [bezug, setBezug] = useState(''); const [sw, setSw] = useState('');
  const b = bezuege.find(x => `${x.art}:${x.id}` === bezug);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Zuweisungen · Mandate & Kunden</span>
      {!zuweisungen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine wiederkehrend gebundene Zeit.</span>}
      <div style={zeileStil}>
        {zuweisungen.map(x => (
          <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
            <Chip umbrechen farbe={LEUCHT.business}>{x.label} · {z(x.stundenWoche)} h/Woche</Chip>
            {darf && <button type="button" aria-label={`Zuweisung ${x.label} entfernen`} onClick={() => void los([{ op: 'zuweisung-weg', id: x.id }])} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 32, minHeight: 32, fontSize: 15 }}>×</button>}
          </span>
        ))}
      </div>
      {darf && bezuege.length > 0 && (
        <div style={zeileStil}>
          <select value={bezug} onChange={e => setBezug(e.target.value)} aria-label="Mandat oder Kunde" style={{ ...auswahl, flex: '1 1 200px' }}>
            <option value="">Mandat oder Kunde wählen …</option>
            <optgroup label="Mandate">{bezuege.filter(x => x.art === 'mandat').map(x => <option key={x.id} value={`mandat:${x.id}`}>{x.label}</option>)}</optgroup>
            <optgroup label="Kunden">{bezuege.filter(x => x.art === 'kunde').map(x => <option key={x.id} value={`kunde:${x.id}`}>{x.label}</option>)}</optgroup>
          </select>
          <input type="number" min={1} max={80} value={sw} onChange={e => setSw(e.target.value)} placeholder="h/Woche" aria-label="Stunden je Woche" style={{ ...klein, width: 100 }} />
          <Knopf leise aus={!b || !sw} onClick={async () => { if (!b) return; await los([{ op: 'zuweisung', zuweisung: { person: p.id, art: b.art, bezugId: b.id, stundenWoche: Number(sw) } }]); setBezug(''); setSw(''); }}>+ zuweisen</Knopf>
        </div>
      )}
    </div>
  );
}

function KopfKarte({ s }: { s: KapaStand }) {
  return (
    <Karte flach>
      <Ueberschrift>So rechnet die Kapazität</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, display: 'grid', gap: 6 }}>
        <span>Verfügbar = Grundwert (sonst Wochenvorlage, sonst Annahme 40 h) − Urlaub, Feiertage, ganztägig abwesend − Termine im Arbeitsfenster − 15 min Umschalten je Termin − feste Blöcke.</span>
        <span>Kopf & Energie: {s.team.kopf.personen ? `Team-Faktor ${Math.round(s.team.kopf.faktor * 100)} % aus der geteilten Erholung (${s.team.kopf.personen} Person${s.team.kopf.personen === 1 ? '' : 'en'})` : 'ohne geteilte Erholung neutral (100 %)'} — wirkt auf die nächsten {s.team.kopf.tage} Tage. Einzelwerte sieht nur die Person selbst. Fokus-Blöcke im Kalender sind geplante Arbeit und ziehen nichts ab.</span>
        <span>Machbarkeit: Rest (Aufwand × offener Anteil) gegen die freie Zeit bis zum Termin — der Reihe nach (Überfälliges, dann nach Termin und Rang). Bis 80 % machbar, bis 100 % eng, darüber nicht machbar. Ohne Aufwand oder Termin keine Aussage.</span>
      </div>
    </Karte>
  );
}
