'use client';

// ─── Prozesse · Werkstatt — „Aus Vorlage anlegen“ (22.10.; Kundengewinnung, ANALYSE_100.md Punkt 72) ────────────────────────────────────────────────────
// Die Galerie der 18 Vorlagen: Name, Zweck, Auslöser, Zahl der Schritte, Freigaben, Agenten, „braucht …“ und „schon übernommen“. Ein Klick zeigt die Vorschau
// als Bild (je Phase der Fluss von oben nach unten, Formen im Miro-Stil: Schritt grün, Nachricht gelb, Raute, Erinnerung orange; Schloss = Freigabe), dazu
// Recht, Kennzahlen, Einstellbares und die ehrlich offenen Punkte. „Übernehmen“ legt die Prozesse über den EINEN Schreibweg an (POST /api/prozesse/werkstatt
// `aus-vorlage`, einmalig über `anfrageId`) — mit Eigner aus dem Team, im Probelauf, wenn nichts offen ist. Daten nur über die Route (kleines Bündel), keine
// Personen im Code. Rein darstellend — die Regeln stehen in lib/prozesse/kundengewinnung/*.

import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Lock, Check, ArrowLeft } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, LEUCHT } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, auswahl as auswahlStil, Chip, Pillen } from '../ui';
import { Fenster } from '../Fenster';
import { neueKennung } from '@/lib/kennung';
import { WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { PROZESS_BEREICHE } from '@/lib/prozesse/definition';
import type { VorlageKurz, VorschauPhase } from '@/lib/prozesse/kundengewinnung/bibliothek';
import { WERKSTATT_QUELLE, useKatalog, werkstattSenden } from './werkstatt-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
type Detail = VorlageKurz & { recht: string[]; kennzahlen: string[]; einstellbar: { id: string; label: string; vorgabe: string | number | boolean }[]; demo: string; vorschau: VorschauPhase[]; teileVorschau: { titel: string; vorschau: VorschauPhase[] }[] };
type Liste = { vorlagen: VorlageKurz[]; uebernommen: Record<string, string>; rechte: { entwurf: boolean; veroeffentlichen: boolean } };
const FORM_WORT: Readonly<Record<string, string>> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Raute', erinnerung: 'Erinnerung', termin: 'Termin', ausloeser: 'Start', agent: 'Agent', warten: 'Warten', schleife: 'Schleife', teilprozess: 'Teilprozess', ende: 'Ende', abstimmung: 'Abstimmung', freigabe: 'Freigabe' };
const bereichName = (id: string) => PROZESS_BEREICHE.find(b => b.id === id)?.titel ?? id;

async function holen<T>(suche: string): Promise<T | null> {
  const r = await fetch(`${WERKSTATT_QUELLE}&${suche}`, { cache: 'no-store' }).catch(() => null);
  const j = r ? await r.json().catch(() => null) : null;
  return r?.ok && j?.ok ? j as T : null;
}

/** Die Vorschau als Bild: je Phase eine Spalte, darin der Fluss von oben nach unten. */
export function VorschauBild({ phasen }: { phasen: VorschauPhase[] }) {
  return (
    <div className="pz-vorlage-bild" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }} aria-label="Vorschau des Ablaufs">
      {phasen.map((p, i) => (
        <section key={`${p.titel}-${i}`} style={{ minWidth: 200, flex: '1 0 200px', display: 'grid', gap: 6, alignContent: 'start' }}>
          <div style={{ ...MIKRO }}>{p.titel}</div>
          {p.schritte.map((s, j) => {
            const ton = WERKSTATT_FORM_FARBE[s.form];
            return (
              <div key={s.id} style={{ display: 'grid', justifyItems: 'start', gap: 4 }}>
                {j > 0 && <span aria-hidden style={{ width: 2, height: 10, background: C.linie, marginLeft: 14 }} />}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: s.form === 'entscheidung' ? 4 : 10, border: `1px solid ${ton}66`, background: `${ton}1f`, color: C.ink, fontSize: TYP.bedien, maxWidth: '100%' }}>
                  <span style={{ color: ton, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{FORM_WORT[s.form] ?? s.form}</span>
                  <span style={{ overflowWrap: 'anywhere' }}>{s.titel}</span>
                  {s.schloss && <Lock size={12} aria-label="Freigabe nötig" color={LEUCHT.achtung} />}
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Das Fenster „Aus Vorlage anlegen“. `onAngelegt(id)` führt in die Werkstatt des neuen Prozesses. */
export function VorlagenGalerie({ onZu, onAngelegt }: { onZu: () => void; onAngelegt: (id: string) => Promise<void> | void }) {
  const kat = useKatalog();
  const team = useMemo(() => (kat.daten?.auswahl?.['team-person'] ?? []).filter(t => !t.id.startsWith('rolle:')), [kat.daten]);
  const [liste, setListe] = useState<Liste | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [welle, setWelle] = useState<'alle' | '1' | '2' | '3'>('alle');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [eigner, setEigner] = useState('');
  const [fertig, setFertig] = useState<{ id: string; hinweise: string[]; probelauf: boolean } | null>(null);
  const [anfrageId, setAnfrageId] = useState(() => neueKennung('pza'));

  useEffect(() => { void holen<Liste>('vorlagen=1').then(l => (l ? setListe(l) : setFehler('Die Vorlagen ließen sich nicht laden.'))); }, []);
  useEffect(() => {
    if (!gewaehlt) { setDetail(null); return; }
    setDetail(null); setFertig(null); setAnfrageId(neueKennung('pza'));
    void holen<{ vorlage: Detail }>(`vorlage=${encodeURIComponent(gewaehlt)}`).then(d => setDetail(d?.vorlage ?? null));
  }, [gewaehlt]);

  const uebernehmen = async () => {
    if (!detail) return;
    setFehler(null);
    const r = await werkstattSenden(() => ({ aktion: 'aus-vorlage', anfrageId, vorlageId: detail.id, ...(eigner ? { eigner } : {}) }));
    const id = r.j?.eintrag?.id;
    if (r.status === 200 && r.j?.ok && id) {
      // Was noch offen ist (Eigner, offene Punkte der Vorlage, Übergaben ohne Ziel), steht hier — dann geht es in die Werkstatt.
      setFertig({ id, hinweise: Array.isArray(r.j.hinweise) ? (r.j.hinweise as string[]) : [], probelauf: r.j.probelauf === true });
      setListe(l => (l ? { ...l, uebernommen: { ...l.uebernommen, [detail.id]: id } } : l));
      return;
    }
    setFehler(String(r.j?.fehler ?? 'Die Vorlage ließ sich nicht übernehmen.'));
  };

  const sichtbar = (liste?.vorlagen ?? []).filter(v => welle === 'alle' || String(v.welle) === welle);
  return (
    <Fenster titel={detail ? `${detail.nr} · ${detail.titel}` : 'Aus Vorlage anlegen'} onZu={onZu} breit={980}>
      {!detail && (
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={klein}>18 Vorlagen der Kundengewinnung — jede ist ein vollständiger Prozess mit Schlössern vor jeder Außenwirkung, Rollen statt Personen und ehrlich benannten offenen Punkten. Übernehmen legt eine eigene Kopie an (Probelauf, schreibt nichts).</p>
          <Pillen liste={[{ id: 'alle', label: 'Alle' }, { id: '1', label: 'Welle 1 · Regeln' }, { id: '2', label: 'Welle 2 · mit Agenten' }, { id: '3', label: 'Welle 3 · neue Quellen' }]} aktiv={welle} onWahl={setWelle} />
          {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
          {!liste && !fehler && <p style={klein}>Die Vorlagen laden …</p>}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {sichtbar.map(v => (
              <button key={v.id} type="button" onClick={() => setGewaehlt(v.id)} className="pz-vorlage-karte"
                style={{ textAlign: 'left', display: 'grid', gap: 6, padding: 12, borderRadius: 12, border: `1px solid ${C.linie}`, background: C.flaeche, color: C.ink, cursor: 'pointer', minHeight: 44 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...MIKRO }}>{v.nr} · {bereichName(v.bereich)}</span>
                  {liste?.uebernommen[v.id] && <Chip farbe={LEUCHT.gut}><Check size={11} aria-hidden /> übernommen</Chip>}
                </span>
                <strong style={{ fontSize: TYP.body }}>{v.titel}</strong>
                <span style={klein}>{v.zweck}</span>
                <span style={{ ...klein, color: C.inkLeise }}>{v.ausloeser} · {v.schritte} Schritte · {v.freigaben} Freigaben{v.agenten ? ` · ${v.agenten} Agenten` : ''}{v.teile ? ` · ${v.teile} Teilprozess` : ''}</span>
                {v.braucht.length > 0 && <span style={{ ...klein, color: C.inkLeise }}>braucht: {v.braucht.join(', ')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      {gewaehlt && !detail && <p style={klein}>Die Vorschau lädt …</p>}
      {detail && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div><Knopf leise onClick={() => setGewaehlt(null)}><span className="pz-knopf-inhalt"><ArrowLeft size={14} aria-hidden />Alle Vorlagen</span></Knopf></div>
          <p style={klein}>{detail.zweck}</p>
          <div style={{ ...klein, color: C.inkLeise }}>Eigner: {detail.eigner} · Auslöser: {detail.ausloeser} · {detail.schritte} Schritte · {detail.freigaben} Freigaben</div>
          <VorschauBild phasen={detail.vorschau} />
          {detail.teileVorschau.map(t => (
            <section key={t.titel} style={{ display: 'grid', gap: 6 }}>
              <div style={{ ...MIKRO }}>Teilprozess · {t.titel}</div>
              <VorschauBild phasen={t.vorschau} />
            </section>
          ))}
          <section style={{ display: 'grid', gap: 4 }}><div style={{ ...MIKRO }}>Recht</div>{detail.recht.map(r => <p key={r} style={klein}>{r}</p>)}</section>
          <section style={{ display: 'grid', gap: 4 }}><div style={{ ...MIKRO }}>Kennzahlen</div><p style={klein}>{detail.kennzahlen.join(' · ')}</p></section>
          {detail.einstellbar.length > 0 && <section style={{ display: 'grid', gap: 4 }}><div style={{ ...MIKRO }}>Einstellbar (Vorgabe)</div><p style={klein}>{detail.einstellbar.map(e => `${e.label} (${String(e.vorgabe === true ? 'an' : e.vorgabe === false ? 'aus' : e.vorgabe)})`).join(' · ')}</p></section>}
          {detail.offen.length > 0 && <Hinweis art="info" titel="Noch offen">{detail.offen.map(o => <div key={o}>{o}</div>)}</Hinweis>}
          {detail.braucht.length > 0 && <p style={klein}>Braucht: {detail.braucht.join(', ')}.</p>}
          {liste?.rechte.entwurf ? (
            <>
              <Feldzeile label="Eigner (eine Person aus dem Team — die Vorlage nennt die Rolle)">
                <select aria-label="Eigner" value={eigner} onChange={e => setEigner(e.target.value)} style={{ ...auswahlStil, width: '100%' }}>
                  <option value="">— später wählen —</option>
                  {team.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Feldzeile>
              {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
              {fertig ? (
                <>
                  <Hinweis art="gut" titel={fertig.probelauf ? 'Übernommen — steht im Probelauf' : 'Übernommen — als Entwurf'}>{fertig.hinweise.map(h => <div key={h}>{h}</div>)}</Hinweis>
                  <div><Knopf haupt onClick={async () => { await onAngelegt(fertig.id); }}><span className="pz-knopf-inhalt"><LayoutTemplate size={16} aria-hidden />In der Werkstatt öffnen</span></Knopf></div>
                </>
              ) : <div><Knopf haupt onClick={uebernehmen}><span className="pz-knopf-inhalt"><LayoutTemplate size={16} aria-hidden />{liste.uebernommen[detail.id] ? 'Noch einmal übernehmen' : 'Übernehmen'}</span></Knopf></div>}
              <p style={{ ...klein, color: C.inkLeise }}>{liste.rechte.veroeffentlichen ? 'Ohne offene Punkte steht der Prozess danach im Probelauf (schreibt nichts) — aktiv schaltet ihr in der Werkstatt.' : 'Veröffentlichen und Probelauf gibt es nur für volle Mitglieder — der Prozess steht dann als Entwurf bereit.'}</p>
            </>
          ) : <Hinweis art="info">Prozesse bauen nur Personen im Haushalt.</Hinweis>}
        </div>
      )}
    </Fenster>
  );
}
