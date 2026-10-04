'use client';

// ─── Wissen › Regeln: Konstitution + Regelregister (27.09.) ─────────────────
// Kevin: „alle wichtigen Regeln fürs Brain festlegen … dort angelegt werden können.“
// Oben die Konstitution (kurz, immer geladen), darunter die Regeln mit Priorität,
// Geltung und Status. Aktiv = freigegeben durch die Person, die den Schalter drückt.
// Alles landet als Markdown im Vault (00. Fundament/Regeln) — Obsidian bleibt Editor.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Segmente, Hinweis, feld, LEUCHT, useRueckfrage, ZeileAktionen } from '../ui';

type Prio = 0 | 1 | 2 | 3;
type Gilt = 'kevin' | 'malin' | 'beide' | 'zoe';
type Status = 'entwurf' | 'aktiv' | 'abgeloest';
interface Regel { id: string; titel: string; text: string; prioritaet: Prio; giltFuer: Gilt; status: Status; quelle?: string; scope: string; owner: string; erstelltVon: string; erstelltAm: string; geaendertVon: string; geaendertAm: string; freigegebenVon?: string; freigegebenAm?: string }
interface Konstitution { text: string; stand?: string; geaendertVon?: string; geaendertAm?: string; zeilen: number }

const PRIO: { id: Prio; label: string; farbe: string }[] = [{ id: 0, label: 'hart', farbe: LEUCHT.kritisch }, { id: 1, label: 'Sicherheit', farbe: LEUCHT.achtung }, { id: 2, label: 'Haus-Regel', farbe: LEUCHT.agenten }, { id: 3, label: 'Vorliebe', farbe: C.inkLeise }];
const GILT: { id: Gilt; label: string }[] = [{ id: 'beide', label: 'beide' }, { id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'zoe', label: 'ZOE' }];
const STATUS_FARBE: Record<Status, string> = { entwurf: LEUCHT.achtung, aktiv: LEUCHT.gut, abgeloest: C.inkLeise };
const prioFarbe = (p: Prio) => PRIO.find(x => x.id === p)?.farbe ?? C.inkLeise;

export function Regeln({ ich }: { ich: string }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [konst, setKonst] = useState<Konstitution | null>(null);
  const [maxZeilen, setMaxZeilen] = useState(250);
  const [regeln, setRegeln] = useState<Regel[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [konstText, setKonstText] = useState('');
  const [konstOffen, setKonstOffen] = useState(false);
  const [neu, setNeu] = useState<{ titel: string; text: string; prioritaet: Prio; giltFuer: Gilt; quelle: string; privat: boolean } | null>(null);
  const [filter, setFilter] = useState<'aktiv' | 'entwurf' | 'alle'>('alle');
  const [offen, setOffen] = useState<string | null>(null);

  const laden = useCallback(async () => {
    try {
      const d = await fetch('/api/brain/regeln', { cache: 'no-store' }).then(r => r.json());
      if (!d.ok) { setFehler(d.fehler ?? 'Nicht lesbar.'); return; }
      setKonst(d.konstitution ?? null); setKonstText(d.konstitution?.text ?? ''); setMaxZeilen(d.maxZeilen ?? 250); setRegeln(d.regeln ?? []); setFehler(null);
    } catch { setFehler('Nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const post = async (body: Record<string, unknown>) => {
    const d = await fetch('/api/brain/regeln', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Nicht erreichbar.' }));
    if (!d.ok) setMeldung(d.fehler ?? 'Nicht gespeichert.'); else setMeldung('');
    await laden();
    return d;
  };
  /** Ablösen = das Archiv der Regeln (bleibt als Geschichte in _abgeloest). */
  const abloesen = async (id: string, titel: string) => { if (await bestaetigen({ titel: `„${titel}“ ablösen?`, text: 'Sie bleibt als Geschichte im Ordner _abgeloest.', ja: 'Ablösen' })) void post({ aktion: 'archivieren', id }); };

  const sichtbar = (regeln ?? []).filter(r => filter === 'alle' || r.status === filter);
  const zeilen = konstText.trim() ? konstText.trim().split('\n').length : 0;

  return (
    <>
      <Karte i={1} ton={LEUCHT.agenten}>
        <Ueberschrift rechts={konst ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Stand {konst.stand ?? '—'}{konst.geaendertVon ? ` · ${konst.geaendertVon}` : ''} · {konst.zeilen} Zeilen</span> : undefined}>Konstitution</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>Werte, Rangfolge, harte Grenzen — höchstens {maxZeilen} Zeilen, denn sie ist in JEDEM ZOE-Gespräch geladen. Details gehören in Regeln.</div>
        {fehler && <div style={{ marginBottom: 10 }}><Hinweis art="kritisch" titel="Die Regeln konnten nicht gelesen werden">{fehler}</Hinweis></div>}
        {!konstOffen && (konst?.text ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: TYP.bedien, lineHeight: 1.55, color: C.ink }}>{konst.text}</pre> : <Leer>Noch keine Konstitution. Schreib in wenigen Sätzen, was für ZOE immer gilt.</Leer>)}
        {konstOffen && (
          <div style={{ display: 'grid', gap: 8 }}>
            <textarea value={konstText} onChange={e => setKonstText(e.target.value)} rows={12} aria-label="Konstitution" style={{ ...feld, resize: 'vertical', lineHeight: 1.5, fontSize: TYP.bedien }} />
            <div style={{ fontSize: TYP.bedien, color: zeilen > maxZeilen ? LEUCHT.kritisch : C.inkLeise }}>{zeilen} / {maxZeilen} Zeilen</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!konstOffen ? <Knopf leise onClick={() => setKonstOffen(true)}>{konst?.text ? 'Bearbeiten' : 'Konstitution schreiben'}</Knopf>
            : <><Knopf farbe={LEUCHT.agenten} aus={!konstText.trim() || zeilen > maxZeilen} onClick={async () => { const d = await post({ aktion: 'konstitution', text: konstText }); if (d.ok) setKonstOffen(false); }}>Speichern als {ich}</Knopf><Knopf leise onClick={() => { setKonstOffen(false); setKonstText(konst?.text ?? ''); }}>Abbrechen</Knopf></>}
        </div>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<Knopf leise onClick={() => setNeu(neu ? null : { titel: '', text: '', prioritaet: 2, giltFuer: 'beide', quelle: '', privat: false })}>{neu ? 'Abbrechen' : '+ Regel'}</Knopf>}>Regelregister</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>Priorität: hart › Sicherheit & Privatsphäre › Haus-Regel › Vorliebe. Nur <b style={{ color: C.ink }}>aktive</b> Regeln liest ZOE — aktiv schalten heißt freigeben, mit deinem Namen dran.</div>
        {meldung && <div style={{ marginBottom: 10 }}><Hinweis art="achtung">{meldung}</Hinweis></div>}
        {neu && (
          <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
            <input value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })} placeholder="Titel — kurz, wie eine Überschrift" aria-label="Titel der Regel" style={{ ...feld }} />
            <textarea value={neu.text} onChange={e => setNeu({ ...neu, text: e.target.value })} rows={4} placeholder="Die Regel selbst — konkret genug, dass ZOE danach handeln kann." aria-label="Text der Regel" style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Priorität</span><Segmente liste={PRIO.map(p => ({ id: String(p.id), label: p.label }))} aktiv={String(neu.prioritaet)} onWahl={id => setNeu({ ...neu, prioritaet: Number(id) as Prio })} />
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gilt für</span><Segmente liste={GILT} aktiv={neu.giltFuer} onWahl={id => setNeu({ ...neu, giltFuer: id as Gilt })} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={neu.quelle} onChange={e => setNeu({ ...neu, quelle: e.target.value })} placeholder="Quelle (optional): Gespräch, Datum, Entscheidung" aria-label="Quelle" style={{ ...feld, flex: 1, minWidth: 200 }} />
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}><input type="checkbox" checked={neu.privat} onChange={e => setNeu({ ...neu, privat: e.target.checked })} /> nur ich sehe sie</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Knopf farbe={LEUCHT.gut} aus={!neu.titel.trim() || !neu.text.trim()} onClick={async () => { const d = await post({ aktion: 'anlegen', titel: neu.titel, text: neu.text, prioritaet: neu.prioritaet, giltFuer: neu.giltFuer, quelle: neu.quelle, status: 'aktiv', scope: neu.privat ? 'privat' : 'intern' }); if (d.ok) setNeu(null); }}>Anlegen und freigeben</Knopf>
              <Knopf leise aus={!neu.titel.trim() || !neu.text.trim()} onClick={async () => { const d = await post({ aktion: 'anlegen', titel: neu.titel, text: neu.text, prioritaet: neu.prioritaet, giltFuer: neu.giltFuer, quelle: neu.quelle, status: 'entwurf', scope: neu.privat ? 'privat' : 'intern' }); if (d.ok) setNeu(null); }}>Als Entwurf</Knopf>
            </div>
          </div>
        )}
        <div style={{ marginBottom: 10 }}><Segmente liste={[{ id: 'alle', label: `Alle ${regeln?.length ?? 0}` }, { id: 'aktiv', label: `Aktiv ${(regeln ?? []).filter(r => r.status === 'aktiv').length}` }, { id: 'entwurf', label: `Entwürfe ${(regeln ?? []).filter(r => r.status === 'entwurf').length}` }]} aktiv={filter} onWahl={f => setFilter(f as typeof filter)} /></div>
        {regeln === null && <Leer>Lese Regeln …</Leer>}
        {regeln && !sichtbar.length && <Leer>{regeln.length ? 'Nichts in dieser Auswahl.' : 'Noch keine Regel. Die erste: was ZOE nie tun darf.'}</Leer>}
        <Liste>
          {sichtbar.map(r => (
            <div key={r.id}>
              {/* 04.10. (ZeileAktionen): Archivieren = ablösen (bleibt als Geschichte in _abgeloest) — gelöscht wird eine Regel nie. */}
              <ZeileAktionen titel={r.titel} onArchivieren={() => void abloesen(r.id, r.titel)}>
              <Zeile onClick={() => setOffen(o => (o === r.id ? null : r.id))} aktiv={offen === r.id} links={<Punkt farbe={prioFarbe(r.prioritaet)} />}
                titel={<span>{r.titel} {r.scope === 'privat' && <span aria-label="privat">🔒</span>}</span>}
                unter={`${PRIO.find(p => p.id === r.prioritaet)?.label} · gilt für ${GILT.find(g => g.id === r.giltFuer)?.label} · ${r.status === 'aktiv' ? `freigegeben von ${r.freigegebenVon ?? '—'} am ${r.freigegebenAm ?? '—'}` : r.status} · von ${r.erstelltVon}`}
                rechts={<Chip farbe={STATUS_FARBE[r.status]}>{r.status}</Chip>} />
              </ZeileAktionen>
              {offen === r.id && (
                <div style={{ padding: '6px 2px 14px 26px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: TYP.bedien, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.text}</div>
                  {r.quelle && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Quelle: {r.quelle}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {r.status !== 'aktiv' && <Knopf farbe={LEUCHT.gut} onClick={() => void post({ aktion: 'aendern', id: r.id, felder: { status: 'aktiv' } })}>Freigeben als {ich}</Knopf>}
                    {r.status === 'aktiv' && <Knopf leise onClick={() => void post({ aktion: 'aendern', id: r.id, felder: { status: 'entwurf' } })}>Zurück auf Entwurf</Knopf>}
                    <Knopf leise onClick={() => abloesen(r.id, r.titel)}>Ablösen</Knopf>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Liste>
      </Karte>
      {dialog}
    </>
  );
}
