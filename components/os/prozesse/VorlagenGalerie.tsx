'use client';

// ─── Prozesse · Werkstatt — „Aus Vorlage anlegen“ (22.10.; Kundengewinnung, ANALYSE_100.md Punkt 72) ────────────────────────────────────────────────────
// Die Galerie der 18 Vorlagen: Name, Zweck, Auslöser, Zahl der Schritte, Freigaben, Agenten, „braucht …“ und „schon übernommen“. Ein Klick zeigt die Vorschau
// als Bild (je Phase der Fluss von oben nach unten, Formen im Miro-Stil: Schritt grün, Nachricht gelb, Raute, Erinnerung orange; Schloss = Freigabe), dazu
// Recht, Kennzahlen, Einstellbares und die ehrlich offenen Punkte. „Übernehmen“ legt die Prozesse über den EINEN Schreibweg an (POST /api/prozesse/werkstatt
// `aus-vorlage`, einmalig über `anfrageId`) — mit Eigner aus dem Team, im Probelauf, wenn nichts offen ist. Daten nur über die Route (kleines Bündel), keine
// Personen im Code. Rein darstellend — die Regeln stehen in lib/prozesse/kundengewinnung/*.

import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Lock, Check, ArrowLeft, Trash2 } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, LEUCHT } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, auswahl as auswahlStil, Chip, Pillen } from '../ui';
import { Fenster } from '../Fenster';
import { neueKennung } from '@/lib/kennung';
import { WERKSTATT_FORM_FARBE } from '@/lib/prozesse/farben';
import { PROZESS_BEREICHE } from '@/lib/prozesse/definition';
import type { VorlageKurz, VorschauPhase } from '@/lib/prozesse/kundengewinnung/bibliothek';
import type { EigeneVorlageKurz } from '@/lib/prozesse/kopie';
import { galerieBereiche, vorlagenFiltern, VORLAGEN_ARTEN, VORLAGEN_GRUPPEN, type VorlagenArt } from '@/lib/prozesse/kundengewinnung/galerie';
import { WERKSTATT_QUELLE, useKatalog, werkstattSenden } from './werkstatt-daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
type Detail = VorlageKurz & { recht: string[]; kennzahlen: string[]; einstellbar: { id: string; label: string; vorgabe: string | number | boolean }[]; demo: string; vorschau: VorschauPhase[]; teileVorschau: { titel: string; vorschau: VorschauPhase[] }[] };
/** Eine eigene Vorlage des Haushalts (22.10., „Als Vorlage speichern“ in der Werkstatt) — Struktur und Texte, ohne Personen. */
type EigenDetail = EigeneVorlageKurz & { eigen: true; vorschau: VorschauPhase[] };
type Liste = { vorlagen: VorlageKurz[]; eigene?: EigeneVorlageKurz[]; uebernommen: Record<string, string>; rechte: { entwurf: boolean; veroeffentlichen: boolean } };
const istEigen = (d: Detail | EigenDetail | null): d is EigenDetail => !!d && 'eigen' in d;
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

/**
 * Das Fenster „Aus Vorlage anlegen“. `onAngelegt(id)` führt in die Werkstatt des neuen Prozesses. Zwei Sammlungen (22.10., B2): Kundengewinnung und
 * „Fulfillment · Kunden-Begleitung“ — `gruppe` wählt die Sammlung vor (z. B. „+ Begleit-Prozess“ am Paket).
 */
export function VorlagenGalerie({ onZu, onAngelegt, gruppe: gruppeVorgabe, andocken, bereiche: nurBereiche }: {
  onZu: () => void; onAngelegt: (id: string) => Promise<void> | void; gruppe?: 'kundengewinnung' | 'begleitung';
  /** Werkzeug-Muster (22.10., „Automationen & Head“): nur Vorlagen dieser Bereiche (Kennungen der Landkarte) — ohne Angabe alle. */
  bereiche?: readonly string[];
  /** B3 (22.10.): „+ Begleit-Prozess“ am Paket — der übernommene Begleit-Prozess hört nur auf dieses Paket (und ggf. diesen Schritt); `text` = wo, in Worten. */
  andocken?: { paket: string; knoten?: string; text: string };
}) {
  const kat = useKatalog();
  const team = useMemo(() => (kat.daten?.auswahl?.['team-person'] ?? []).filter(t => !t.id.startsWith('rolle:')), [kat.daten]);
  const [liste, setListe] = useState<Liste | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Feinschliff 22.10. (Befund 5): gefiltert wird nach Bereich und Art („mit Agenten“ · „nur Regeln“) — nicht mehr nach der internen Welle.
  const [bereich, setBereich] = useState('alle');
  const [art, setArt] = useState<VorlagenArt>('alle');
  const [gruppe, setGruppe] = useState<'kundengewinnung' | 'begleitung'>(gruppeVorgabe ?? 'kundengewinnung');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | EigenDetail | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);
  const [eigner, setEigner] = useState('');
  const [fertig, setFertig] = useState<{ id: string; hinweise: string[]; probelauf: boolean } | null>(null);
  const [anfrageId, setAnfrageId] = useState(() => neueKennung('pza'));

  useEffect(() => { void holen<Liste>('vorlagen=1&gruppe=alle').then(l => (l ? setListe(l) : setFehler('Die Vorlagen ließen sich nicht laden.'))); }, []);
  useEffect(() => {
    if (!gewaehlt) { setDetail(null); return; }
    setDetail(null); setFertig(null); setLoeschFrage(false); setAnfrageId(neueKennung('pza'));
    void holen<{ vorlage: Detail | EigenDetail }>(`vorlage=${encodeURIComponent(gewaehlt)}`).then(d => setDetail(d?.vorlage ?? null));
  }, [gewaehlt]);

  const uebernehmen = async () => {
    if (!detail) return;
    setFehler(null);
    const ad = andocken && !istEigen(detail) && detail.gruppe === 'begleitung' ? { andocken: { paket: andocken.paket, ...(andocken.knoten ? { knoten: andocken.knoten } : {}) } } : {};
    const r = await werkstattSenden(() => ({ aktion: 'aus-vorlage', anfrageId, vorlageId: detail.id, ...(eigner ? { eigner } : {}), ...ad }));
    const id = r.j?.eintrag?.id;
    if (r.status === 200 && r.j?.ok && id) {
      // Was noch offen ist (Eigner, offene Punkte der Vorlage, Übergaben ohne Ziel), steht hier — dann geht es in die Werkstatt.
      setFertig({ id, hinweise: Array.isArray(r.j.hinweise) ? (r.j.hinweise as string[]) : [], probelauf: r.j.probelauf === true });
      setListe(l => (l ? { ...l, uebernommen: { ...l.uebernommen, [detail.id]: id } } : l));
      return;
    }
    setFehler(String(r.j?.fehler ?? 'Die Vorlage ließ sich nicht übernehmen.'));
  };
  /** Eine eigene Vorlage löschen (nur volle Mitglieder; die Prozesse, die schon daraus entstanden sind, bleiben). */
  const loeschen = async () => {
    if (!istEigen(detail)) return;
    const r = await werkstattSenden(() => ({ aktion: 'vorlage-loeschen', vorlageId: detail.id }));
    if (r.status === 200 && r.j?.ok) { setListe(l => (l ? { ...l, eigene: (l.eigene ?? []).filter(v => v.id !== detail.id) } : l)); setGewaehlt(null); return; }
    setFehler(String(r.j?.fehler ?? 'Die Vorlage ließ sich nicht löschen.'));
  };
  const imBereich = (b: string) => !nurBereiche?.length || nurBereiche.includes(b);
  const eigene = (liste?.eigene ?? []).filter(v => imBereich(v.bereich));

  const derGruppe = vorlagenFiltern(liste?.vorlagen ?? [], { bereich: 'alle', art: 'alle', gruppe }).filter(v => imBereich(v.bereich));
  const sichtbar = vorlagenFiltern(derGruppe, { bereich, art });
  const bereiche = galerieBereiche(derGruppe);
  const sammlung = VORLAGEN_GRUPPEN.find(g => g.id === gruppe) ?? VORLAGEN_GRUPPEN[0];
  return (
    <Fenster titel={detail ? (istEigen(detail) ? `Eigene Vorlage · ${detail.titel}` : `${detail.nr} · ${detail.titel}`) : 'Aus Vorlage anlegen'} onZu={onZu} breit={980}>
      {!detail && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div role="group" aria-label="Sammlung">
            <Pillen liste={VORLAGEN_GRUPPEN.map(g => ({ id: g.id, label: g.label }))} aktiv={gruppe} onWahl={g => { setGruppe(g); setBereich('alle'); }} />
          </div>
          <p style={klein}>{liste ? `${derGruppe.length} ` : ''}{sammlung.satz} Übernehmen legt eine eigene Kopie an (Probelauf, schreibt nichts).</p>
          <div role="group" aria-label="Bereich">
            <Pillen liste={[{ id: 'alle', label: 'Alle Bereiche' }, ...bereiche.map(b => ({ id: b.id, label: `${b.titel} · ${b.anzahl}` }))]} aktiv={bereich} onWahl={setBereich} />
          </div>
          <div role="group" aria-label="Wer arbeitet mit">
            <Pillen liste={[...VORLAGEN_ARTEN]} aktiv={art} onWahl={setArt} />
          </div>
          {eigene.length > 0 && (
            <section aria-label="Eigene Vorlagen" style={{ display: 'grid', gap: 8 }}>
              <div style={{ ...MIKRO }}>{`Eigene Vorlagen · ${eigene.length}`}</div>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {eigene.filter(v => bereich === 'alle' || v.bereich === bereich).map(v => (
                  <button key={v.id} type="button" onClick={() => setGewaehlt(v.id)} className="pz-vorlage-karte"
                    style={{ textAlign: 'left', display: 'grid', gap: 6, padding: 12, borderRadius: 12, border: `1px solid ${C.linie}`, background: C.flaeche, color: C.ink, cursor: 'pointer', minHeight: 44 }}>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ ...MIKRO }}>Eigene · {bereichName(v.bereich)}</span>
                      {liste?.uebernommen[v.id] && <Chip farbe={LEUCHT.gut}><Check size={11} aria-hidden /> übernommen</Chip>}
                    </span>
                    <strong style={{ fontSize: TYP.body }}>{v.titel}</strong>
                    {v.beschreibung && <span style={klein}>{v.beschreibung}</span>}
                    <span style={{ ...klein, color: C.inkLeise }}>{v.schritte} Schritte</span>
                  </button>
                ))}
              </div>
              <div style={{ ...MIKRO }}>Kundengewinnung</div>
            </section>
          )}
          {liste && !sichtbar.length && <p style={klein}>Keine Vorlage passt zu dieser Auswahl.</p>}
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
          {istEigen(detail) ? (
            <>
              {detail.beschreibung && <p style={klein}>{detail.beschreibung}</p>}
              <div style={{ ...klein, color: C.inkLeise }}>Eigene Vorlage · {bereichName(detail.bereich)} · {detail.schritte} Schritte — Personen stehen als Rolle („Zuständig im Fall“), den Eigner wählt ihr beim Übernehmen.</div>
              <VorschauBild phasen={detail.vorschau} />
            </>
          ) : <>
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
          {andocken && detail.gruppe === 'begleitung' && <Hinweis art="info" titel="Dockt an">{`Hört nur auf ${andocken.text} — der Auslöser bekommt die Bedingung beim Übernehmen.`}</Hinweis>}
          </>}
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
              {istEigen(detail) && liste.rechte.veroeffentlichen && (loeschFrage ? (
                <Hinweis art="achtung" titel={`Eigene Vorlage „${detail.titel}“ löschen?`} aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={loeschen}>Löschen</Knopf><Knopf leise onClick={() => setLoeschFrage(false)}>Abbrechen</Knopf></span>}>
                  Prozesse, die schon aus ihr entstanden sind, bleiben.
                </Hinweis>
              ) : <div><Knopf leise onClick={() => setLoeschFrage(true)}><span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Vorlage löschen</span></Knopf></div>)}
            </>
          ) : <Hinweis art="info">Prozesse bauen nur Personen im Haushalt.</Hinweis>}
        </div>
      )}
    </Fenster>
  );
}
