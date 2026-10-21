'use client';

// ─── Prozesse · Werkstatt — Reiter „Läufe“ (22.10.; ANALYSE_100.md Punkt 29; Kevins Bild n8n „Executions“) ────────────────────────────────────────────────
// Ohne geöffneten Lauf: die Liste aller Läufe des Prozesses (Status, Startzeit, Dauer, Version, Kosten, Fall — Filter offen · wartet · Fehler · beendet) und die
// zurückgehaltenen Starts (Flutschutz). Ein Lauf öffnet DENSELBEN Plan in seiner Version (WerkstattFlaeche, nur lesen): je Knoten der Stand (grün gelaufen, gelb
// wartet — „wartet auf dich“ pulsiert mit Frist —, rot Fehler, grau nicht erreicht), der Lichtfaden leuchtet den echten Weg (lib/prozesse/laeufe-ansicht.ts). Rechts
// je Knoten Eingabe und Ausgabe: gespeichert sind nur Kennungen — die Inhalte holt die Ansicht beim Öffnen LIVE mit den Rechten der Person (GET …&inhalte=1:
// Aufgaben in ihrer Sicht, nur eigene Vorschläge, Fall ohne Art. 18). Agenten-Texte stehen im Stapel — hier der Link dorthin. Darunter der Log-Baum. Knöpfe:
// „Abbrechen (mit Grund)“, „Erneut ab hier“, „Als Testfall übernehmen“ (n8n „Copy to editor“).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Ban, RotateCcw, ClipboardCheck, ListTree, ExternalLink } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf, Hinweis, Chip, Pillen, Zeile, Leer, Ueberschrift, Erklaert, Kennzahl, Raster, feld } from '../ui';
import type { ProzessDefinition, ProzessForm, ProzessKnoten } from '@/lib/prozesse/definition';
import { werkstattLage, type TeamName } from '@/lib/prozesse/werkstatt-lage';
import { knotenUnterzeile, formWort } from '@/lib/prozesse/werkstatt-maske';
import type { LaufKurz } from '@/lib/prozesse/lauf-regeln';
import { GRUND_TEXT, type LaufGrund } from '@/lib/prozesse/lauf-typen';
import type { InhaltZeile } from '@/lib/prozesse/lauf-server';
import {
  LAUF_FILTER, LAUF_STATUS_NAME, LAUF_STATUS_BEDEUTUNG, MARKEN_BEDEUTUNG, SCHRITT_NAME, laufFiltern, laufMarken, laufWeg, laufLog, centWort, dauerMinText, dauerText, zeitText,
  fallName, type LaufFilter, type LogGruppe,
} from '@/lib/prozesse/laeufe-ansicht';
import type { ProzessRechte } from '@/lib/prozesse/rollen';
import { WerkstattFlaeche, type FlaecheSteuerung } from './WerkstattFlaeche';
import { versionHolen } from './werkstatt-daten';
import { laufHolen, inhalteHolen, laeufeSenden, useVerweise, type LaeufeAntwort, type LaufAntwort, type InhalteAntwort } from './laeufe-daten';

type K = ProzessKnoten<ProzessForm>;
const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const leise = { fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.45 } as const;
const STATUS_FARBE = (s: LaufKurz['status']) => BEDEUTUNG_FARBE[LAUF_STATUS_BEDEUTUNG[s]];

export interface LaeufeProps {
  prozessId: string;
  /** Der geöffnete Lauf (Adresse `lauf=`) — ohne: die Liste. */
  laufId: string | null;
  daten: LaeufeAntwort | null;
  fehler: string | null;
  rechte: ProzessRechte | undefined;
  team: TeamName[];
  /** Namen der Konten (Speichername → Name) — für „liegt bei …“. */
  konten: ReadonlyMap<string, string>;
  agentName: (wer: NonNullable<K['agent']>['wer']) => string;
  onLauf: (id: string | null) => void;
  /** Ein Testfall ist angelegt — in den Reiter Tests wechseln. */
  onTestfall: () => void;
  onNeu: () => Promise<unknown>;
}

export function WerkstattLaeufe(p: LaeufeProps) {
  return p.laufId ? <LaufAnsicht key={p.laufId} {...p} laufId={p.laufId} /> : <LaufListe {...p} />;
}

// ══ Die Liste ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function LaufListe(p: LaeufeProps) {
  const [filter, setFilter] = useState<LaufFilter>('alle');
  const verweise = useVerweise();
  const [meldung, setMeldung] = useState<string | null>(null);
  const d = p.daten;
  if (!d) return p.fehler ? <Hinweis art="kritisch">{p.fehler}</Hinweis> : <p style={klein}>Die Läufe laden …</p>;
  const liste = laufFiltern(d.laeufe, filter);
  const zahl = (n: number | null, einheit: string) => (n === null ? '—' : `${n}${einheit}`);
  const zurueck = async (wie: 'starten' | 'verwerfen') => {
    const r = await laeufeSenden({ aktion: 'zurueckgehalten', prozess: p.prozessId, wie });
    setMeldung(r.status === 200 ? `${r.j?.n ?? 0} ${wie === 'starten' ? 'gestartet' : 'verworfen'}.` : String(r.j?.fehler ?? 'Das ging nicht.'));
    await p.onNeu();
  };
  return (
    <section style={{ display: 'grid', gap: 12 }} aria-label="Läufe">
      <Erklaert erklaerung="prozesse.lauf-ansicht" name="Läufe" breit><Ueberschrift>{`Läufe · ${d.laeufe.length}`}</Ueberschrift></Erklaert>
      {d.kennzahlen.laeufe > 0 && (
        <Raster min={160}>
          <Kennzahl label="Scharfe Läufe" wert={String(d.kennzahlen.laeufe)} />
          <Kennzahl label="Mit Ziel beendet" wert={zahl(d.kennzahlen.ziel, ' %')} />
          <Kennzahl label="Reaktion (Median)" wert={d.kennzahlen.reaktionMedianMin === null ? '—' : dauerMinText(d.kennzahlen.reaktionMedianMin)} />
          <Kennzahl label="In der Uhr" wert={zahl(d.kennzahlen.inDerUhr, ' %')} />
        </Raster>
      )}
      {d.zurueck.length > 0 && (
        <Hinweis art="achtung" titel={`${d.zurueck.length} ${d.zurueck.length === 1 ? 'Start' : 'Starts'} zurückgehalten (Flutschutz)`}
          aktion={p.rechte?.status ? <span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={() => zurueck('starten')}>Starten</Knopf><Knopf leise onClick={() => zurueck('verwerfen')}>Verwerfen</Knopf></span> : undefined}>
          Mehr automatische Starts in einer Stunde, als der Flutschutz erlaubt — sie warten, bis ihr entscheidet.
        </Hinweis>
      )}
      {meldung && <Hinweis art="info">{meldung}</Hinweis>}
      <Pillen einzeilig liste={LAUF_FILTER.map(f => ({ id: f.id, label: f.label }))} aktiv={filter} onWahl={setFilter} />
      {!liste.length && <Leer>{d.laeufe.length ? 'Kein Lauf mit diesem Filter.' : 'Noch keine Läufe — ein Lauf entsteht, sobald der Prozess im Schatten oder scharf läuft und sein Auslöser kommt.'}</Leer>}
      <div role="list" style={{ display: 'grid', gap: 2 }}>
        {liste.map(l => (
          <div role="listitem" key={l.id}>
            <Zeile onClick={() => p.onLauf(l.id)} umbrechen
              links={<Chip farbe={STATUS_FARBE(l.status)}>{LAUF_STATUS_NAME[l.status]}</Chip>}
              titel={`${fallName(verweise, l.fall)} · ${zeitText(l.start)}`}
              unter={`Version ${l.version} · ${dauerMinText(l.dauerMin)} · ${centWort(l.kostenCent)}${l.modus === 'schatten' ? ' · Probelauf (schreibt nichts)' : ''}${l.durchgang > 1 ? ` · ${l.durchgang}. Durchgang` : ''}${l.grund ? ` · ${GRUND_TEXT[l.grund]}` : ''}`} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ══ Ein Lauf ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

function LaufAnsicht(p: LaeufeProps & { laufId: string }) {
  const [lauf, setLauf] = useState<LaufAntwort | null>(null);
  const [inhalte, setInhalte] = useState<InhalteAntwort | null>(null);
  const [def, setDef] = useState<ProzessDefinition | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [wahl, setWahl] = useState<string | null>(null);
  const [abbruch, setAbbruch] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'info' } | null>(null);
  const flaeche = useRef<FlaecheSteuerung>(null);
  const laden = useCallback(async () => {
    const [l, i] = await Promise.all([laufHolen(p.laufId), inhalteHolen(p.laufId)]);
    if (!l.daten) { setFehler(l.fehler ?? 'Diesen Lauf gibt es nicht.'); return; }
    setLauf(l.daten);
    setInhalte(i.daten);
    const v = await versionHolen(p.prozessId, l.daten.lauf.version);
    if (v.daten) setDef(v.daten.version.definition); else setFehler(`Version ${l.daten.lauf.version} ließ sich nicht laden.`);
  }, [p.laufId, p.prozessId]);
  useEffect(() => { void laden(); }, [laden]);
  const lage = useMemo(() => (def ? werkstattLage(def, { team: p.team }) : null), [def, p.team]);
  const lk = lauf?.lauf;
  const marken = useMemo(() => (lauf && lk ? laufMarken({ schritte: lauf.schritte, status: lk.status, ...(lk.wartet ? { wartet: lk.wartet } : {}) }, w => !!inhalte?.wirkungen[w]?.mir) : new Map()), [lauf, lk, inhalte]);
  const weg = useMemo(() => (lauf ? laufWeg(lauf.schritte) : new Set<string>()), [lauf]);
  const log = useMemo(() => (lauf && def ? laufLog(lauf.schritte, def, new Date().toISOString()) : []), [lauf, def]);
  const mitSchloss = useMemo(() => new Set((def?.knoten ?? []).flatMap(k => (k.schloss ? [k.schloss.fuer] : []))), [def]);
  if (fehler) return <div style={{ display: 'grid', gap: 10 }}><ZurueckKnopf onClick={() => p.onLauf(null)} /><Hinweis art="kritisch">{fehler}</Hinweis></div>;
  if (!lauf || !lk || !def || !lage) return <p style={klein}>Der Lauf lädt …</p>;
  const steuern = !!p.rechte?.status;
  const offen = lk.status === 'laeuft' || lk.status === 'wartet' || lk.status === 'angehalten' || lk.status === 'fehler';
  const senden = async (k: Record<string, unknown>, gut: string) => {
    setMeldung(null);
    const r = await laeufeSenden(k);
    if (r.status === 200 && r.j?.ok) { setMeldung({ text: gut, art: 'gut' }); await laden(); await p.onNeu(); return true; }
    setMeldung({ text: String(r.j?.fehler ?? 'Das ging nicht.'), art: 'kritisch' });
    return false;
  };
  const testfall = async () => { if (await senden({ aktion: 'testfall', prozess: p.prozessId, wie: 'anlegen', aus: lk.id }, 'Als Testfall übernommen.')) p.onTestfall(); };
  const k = wahl ? def.knoten.find(x => x.id === wahl) ?? null : null;
  const fall = inhalte?.fall;
  const fallText = !fall ? (lk.fall.art === 'keiner' ? 'ohne Fall' : fallName(null, lk.fall)) : fall.sichtbar ? fall.titel ?? '' : fall.grund === 'eingeschraenkt' ? 'eingeschränkter Kontakt (Art. 18)' : fall.grund === 'weg' ? 'den Fall gibt es nicht mehr' : 'nicht für dich sichtbar';
  return (
    <section style={{ display: 'grid', gap: 10 }} aria-label="Ein Lauf">
      <div className="pw-kopf">
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <ZurueckKnopf onClick={() => p.onLauf(null)} />
          <Chip farbe={STATUS_FARBE(lk.status)}>{LAUF_STATUS_NAME[lk.status]}</Chip>
          <span style={klein}>{`${fallText} · Version ${lk.version} · ${zeitText(lk.start)} · ${dauerMinText(lk.dauerMin)} · ${centWort(lk.kostenCent)}${lk.modus === 'schatten' ? ' · Probelauf' : ''}`}</span>
        </span>
        <span className="pw-werkzeuge">
          {steuern && offen && <Knopf leise onClick={() => setAbbruch('')} titel="Den Lauf beenden — der Grund steht im Verlauf des Prozesses"><span className="pz-knopf-inhalt"><Ban size={14} aria-hidden />Abbrechen</span></Knopf>}
          {steuern && lk.status === 'fehler' && <Knopf onClick={() => senden({ aktion: 'erneut', lauf: lk.id }, 'Erneut ab der Fehlerstelle gestartet.')} titel="An der Fehlerstelle neu ansetzen — Erledigtes wird nie wiederholt"><span className="pz-knopf-inhalt"><RotateCcw size={14} aria-hidden />Erneut ab hier</span></Knopf>}
          {p.rechte?.entwurf && <Knopf leise onClick={testfall} titel="Diesen Fall und seinen Weg als Testfall festhalten (wie „Copy to editor“)"><span className="pz-knopf-inhalt"><ClipboardCheck size={14} aria-hidden />Als Testfall übernehmen</span></Knopf>}
        </span>
      </div>
      {lk.grund && <Hinweis art={lk.status === 'fehler' ? 'kritisch' : 'info'}>{GRUND_TEXT[lk.grund]}</Hinweis>}
      {abbruch !== null && (
        <Hinweis art="achtung" titel="Lauf abbrechen — mit Grund"
          aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf aus={!abbruch.trim()} onClick={async () => { if (await senden({ aktion: 'abbrechen', lauf: lk.id, grund: abbruch.trim() }, 'Abgebrochen.')) setAbbruch(null); }}>Abbrechen</Knopf><Knopf leise onClick={() => setAbbruch(null)}>Zurück</Knopf></span>}>
          <input aria-label="Grund des Abbruchs" value={abbruch} maxLength={300} placeholder="z. B. Kunde hat sich anders entschieden" onChange={e => setAbbruch(e.target.value)} style={{ ...feld, width: '100%' }} />
        </Hinweis>
      )}
      {meldung && <Hinweis art={meldung.art}>{meldung.text}</Hinweis>}
      <div className="pw-raster">
        <div className="pw-flaeche-rahmen">
          <WerkstattFlaeche ref={flaeche} d={def} lage={lage} szene={`${p.prozessId}:lauf:${lk.id}`} auswahl={wahl ? [wahl] : []} kanteWahl={null} rahmenWahl={null} andockWahl={null}
            probe={null} lauf={{ marken, weg }} befundJe={new Map()} unterzeile={x => knotenUnterzeile(x, { mitSchloss: mitSchloss.has(x.id), ...(x.agent ? { agentName: p.agentName(x.agent.wer) } : {}) })}
            mitSchloss={mitSchloss} nurLesen raster label={`Lauf auf „${def.titel}“: ${lauf.schritte.length} besuchte Schritte, Status ${LAUF_STATUS_NAME[lk.status]}. Pfeile wählen einen Schritt.`}
            onAuswahl={ids => setWahl(ids[0] ?? null)} onKante={() => undefined} onRahmen={() => undefined} onUnter={id => setWahl(id)} onZiehen={() => undefined}
            onVerbinden={() => undefined} onAnhaengen={() => undefined} onZuklappen={() => undefined} onTaste={() => false} />
        </div>
        <aside className="pw-panel" aria-label="Schritt im Lauf">
          {k ? <KnotenImLauf k={k} lauf={lauf} inhalte={inhalte} konten={p.konten} agentName={p.agentName} /> : (
            <div style={{ display: 'grid', gap: 10 }}>
              <Ueberschrift>Lauf</Ueberschrift>
              <p style={klein}>{`Fall: ${fallText}`}</p>
              {fall?.sichtbar && fall.link && <Link href={fall.link} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Zum Fall ›</Link>}
              {Object.keys(lauf.daten).length > 0 && <DatenListe daten={lauf.daten} />}
              <p style={leise}>Einen Schritt auf dem Plan bzw. im Log anklicken zeigt seine Eingabe und Ausgabe.</p>
            </div>
          )}
        </aside>
      </div>
      <LogBaum gruppen={log} wahl={wahl} onWahl={id => { setWahl(id); flaeche.current?.insBild(id); }} />
    </section>
  );
}

function ZurueckKnopf({ onClick }: { onClick: () => void }) {
  return <Knopf leise onClick={onClick} titel="Zur Liste der Läufe"><span className="pz-knopf-inhalt"><ArrowLeft size={14} aria-hidden />Alle Läufe</span></Knopf>;
}

/** Kennungen aus dem auslösenden Ereignis (nur Arten und Kennungen — nie Text). */
function DatenListe({ daten }: { daten: Record<string, string> }) {
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      <div style={{ ...MIKRO }}>Eingabe des Laufs</div>
      {Object.entries(daten).map(([a, b]) => <p key={a} style={leise}>{`${a}: ${b}`}</p>)}
    </div>
  );
}

const WIRKUNG_WORT: Readonly<Record<InhaltZeile['art'], string>> = { aufgabe: 'Aufgabe', vorschlag: 'Vorschlag im Stapel', lauf: 'Teil-Lauf', meldung: 'Glocke', gesendet: 'gesendet', fall: 'Fall' };

/** Ein Knoten im Lauf: Stand, Zeiten, Grund, Eingabe (Fall) und Ausgabe (Wirkungen, live mit den Rechten der Person). */
function KnotenImLauf({ k, lauf, inhalte, konten, agentName }: { k: K; lauf: LaufAntwort; inhalte: InhalteAntwort | null; konten: ReadonlyMap<string, string>; agentName: LaeufeProps['agentName'] }) {
  const besuche = lauf.schritte.filter(s => s.knoten === k.id);
  const s = besuche.at(-1);
  if (!s) return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Ueberschrift>{k.titel}</Ueberschrift>
      <p style={klein}>Nicht erreicht — der Lauf kam hier nicht vorbei.</p>
    </div>
  );
  const farbe = BEDEUTUNG_FARBE[MARKEN_BEDEUTUNG[SCHRITT_STUFE[s.status]]];
  const wirkung = besuche.flatMap(b => b.wirkung ?? []);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Ueberschrift rechts={<Chip farbe={farbe}>{SCHRITT_NAME[s.status]}</Chip>}>{k.titel}</Ueberschrift>
      <p style={leise}>{`${formWort(k.form)} · ab ${zeitText(s.ab)}${s.bis ? ` · bis ${zeitText(s.bis)}` : ''} · ${dauerText(Date.parse(s.bis ?? new Date().toISOString()) - Date.parse(s.ab))}${besuche.length > 1 ? ` · ${besuche.length} Besuche` : ''}${s.versuch ? ` · ${s.versuch}. Versuch` : ''}`}</p>
      {s.grund && <Hinweis art={s.status === 'fehler' ? 'kritisch' : 'info'}>{GRUND_TEXT[s.grund as LaufGrund] ?? s.grund}</Hinweis>}
      {k.form === 'agent' && k.agent && (
        <p style={klein}>{`${agentName(k.agent.wer)} · Modell ${s.modell ?? k.agent.modellWahl?.modell ?? k.agent.modell}${s.token ? ` · ${s.token.ein} Tokens rein, ${s.token.aus} raus` : ''} · ${centWort(s.kostenCent)}`}</p>
      )}
      <div style={{ ...MIKRO }}>Eingabe</div>
      <p style={leise}>{inhalte?.fall ? (inhalte.fall.sichtbar ? `Fall: ${inhalte.fall.titel ?? ''}` : inhalte.fall.grund === 'eingeschraenkt' ? 'Fall: eingeschränkter Kontakt (Art. 18) — ausgeblendet' : 'Fall: nicht sichtbar') : lauf.lauf.fall.art === 'keiner' ? 'ohne Fall' : 'Fall wird geladen …'}</p>
      <div style={{ ...MIKRO }}>Ausgabe</div>
      {!wirkung.length && <p style={leise}>Keine Wirkung — der Schritt hat nur entschieden bzw. gewartet.</p>}
      {wirkung.map(w => {
        const z = inhalte?.wirkungen[w.id];
        const titel = z?.sichtbar ? (z.titel ?? WIRKUNG_WORT[w.art]) : z?.grund === 'nicht-fuer-dich' ? `${WIRKUNG_WORT[w.art]} — liegt bei einer anderen Person` : z?.grund === 'weg' ? `${WIRKUNG_WORT[w.art]} — gibt es nicht mehr` : WIRKUNG_WORT[w.art];
        const unter = [WIRKUNG_WORT[w.art], z?.status, z?.an ? `bei ${konten.get(z.an) ?? 'einer Person im Team'}` : undefined, w.art === 'vorschlag' && k.form === 'agent' ? 'das Ergebnis des Agenten steht im Stapel' : undefined].filter(Boolean).join(' · ');
        return <Zeile key={w.id} umbrechen titel={titel} unter={unter} rechts={z?.sichtbar && z.link ? <Link href={z.link} aria-label={`${titel} öffnen`} style={{ color: C.aktiv, display: 'inline-flex', minHeight: 44, alignItems: 'center' }}><ExternalLink size={16} aria-hidden /></Link> : undefined} />;
      })}
    </div>
  );
}
const SCHRITT_STUFE = { erledigt: 'gelaufen', wuerde: 'gelaufen', laeuft: 'laeuft', wartet: 'wartet', freigabe: 'wartet', abgelaufen: 'wartet', fehler: 'fehler', uebersprungen: 'uebersprungen', abgebrochen: 'abgebrochen' } as const;

/** Der Log-Baum: Phasen, darin die Schritte in Reihenfolge (Agenten-Schritte mit Modell, Tokens, Kosten). */
export function LogBaum({ gruppen, wahl, onWahl }: { gruppen: readonly LogGruppe[]; wahl: string | null; onWahl: (id: string) => void }) {
  if (!gruppen.length) return null;
  return (
    <section aria-label="Log des Laufs" style={{ display: 'grid', gap: 8 }}>
      <div style={{ ...MIKRO, display: 'inline-flex', alignItems: 'center', gap: 6 }}><ListTree size={13} aria-hidden />Log</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {gruppen.map((g, i) => (
          <li key={`${g.phaseId}-${i}`}>
            <div style={{ fontSize: TYP.bedien, fontWeight: 650, color: C.ink, marginBottom: 4 }}>{g.titel}</div>
            <ol style={{ listStyle: 'none', margin: 0, paddingLeft: 14, borderLeft: `1px solid ${C.linie}`, display: 'grid', gap: 2 }}>
              {g.zeilen.map(z => (
                <li key={z.nr}>
                  <button type="button" className="fassbar pz-feld-zeile" aria-current={wahl === z.knotenId ? 'true' : undefined} onClick={() => onWahl(z.knotenId)}
                    style={{ display: 'grid', gap: 2, textAlign: 'left', color: C.ink, cursor: 'pointer', outline: wahl === z.knotenId ? `1px solid ${C.ink}` : undefined }}>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: TYP.bedien }}>
                      <span style={{ color: C.inkLeise }}>{`${z.nr}.`}</span>
                      <span style={{ fontWeight: 600 }}>{z.titel}</span>
                      <Chip farbe={BEDEUTUNG_FARBE[MARKEN_BEDEUTUNG[z.stufe]]}>{SCHRITT_NAME[z.status]}</Chip>
                      <span style={{ color: C.inkDim }}>{z.dauer}</span>
                    </span>
                    {(z.modell || z.kostenCent || z.grund || z.versuch) && (
                      <span style={{ fontSize: TYP.bedien, color: C.inkLeise, paddingLeft: 22 }}>
                        {[z.modell ? `Modell ${z.modell}` : '', z.token ? `${z.token.ein + z.token.aus} Tokens` : '', z.kostenCent ? centWort(z.kostenCent) : '', z.versuch ? `${z.versuch}. Versuch` : '', z.grund ?? ''].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}
