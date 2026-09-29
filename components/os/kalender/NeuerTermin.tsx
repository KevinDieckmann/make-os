'use client';

// ─── Kalender: Anlegen wie Google (27.09., neu gestaltet 29.09. — K1) ───────
// Kevin schickte Google-Screenshots: Titel oben, Reiter „Termin · Aufgabe · Abwesend ·
// Fokuszeit · Arbeitsort“, Zeit mit Zeitzone („GMT+02“), „Wiederholt sich nicht ▾“,
// Ort, Beschreibung, Kalender + Farbe, „Beschäftigt · Standard-Sichtbarkeit ·
// 10 Minuten vorher“, „Weitere Optionen“ und „Speichern“. Gäste und Videolink kommen
// mit K3/K4 — dafür die Erweiterungsstelle `zusatz` (Gäste, CRM-Bezug), keine Platzhalter.
//
//   Formular → Anfrage rein in lib/kalender/formular.ts (getestet). Art „Aufgabe“ legt
//   DIESELBE Aufgabe im Aufgaben-Modell an (aufgabeAnlegen, TasksContext — ausstehend bis der
//   Server bestätigt), kein iCloud-Termin.
//   Eingaben gehen nie verloren: der Entwurf liegt im Sitzungsspeicher, bis der Server
//   bestätigt (auch nach Schließen, Fehler, 409/„bitte neu laden“) — beim nächsten Öffnen
//   „wiederherstellen“ oder „verwerfen“.
//   Die Schnelleingabe (lib/kalender/schnell.ts) liest den Titel („Mo 10 Uhr Kaffee 45min“)
//   und bietet „übernehmen“ an; Enter übernimmt und speichert.

import { useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, Segmente, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { MandatWahl } from '../zeit/MandatWahl';
import { aufgabenFuerWahl } from '../zeit/Zuordnung';
import { useTasks } from '@/context/TasksContext';
import { aufgabeAnlegen, projekteImSpace, spacesOderFest } from '../aufgaben/hilfe';
import { sonstigeProjektId, istSonstigeProjekt } from '@/lib/aufgaben/struktur';
import { schnellLesen } from '@/lib/kalender/schnell';
import { tagPlus, ausWandzeit } from '@/lib/kalender/zeit';
import { ART_INFO, TERMIN_ARTEN, ARBEITSORTE, SICHTBARKEIT_LABEL, ERINNERUNG_VORLAGEN, ERINNERUNG_MAX, erinnerungText, type Sichtbarkeit } from '@/lib/kalender/arten';
import { ZONEN, gmtText, ausWandzeitIn } from '@/lib/kalender/zeitzone';
import { wiederholungVorlagen, wiederholungBeschreiben, wochentagVon, wochentagNr, WOCHENTAGE, TAG_KURZ, type Wiederholung, type WiederholungFreq } from '@/lib/kalender/wiederholung';
import { formularStart, artWechseln, formularFehler, formularAnfrage, entwurfWertvoll, plusMin, ENTWURF_SCHLUESSEL, type Formular, type Vorgabe } from '@/lib/kalender/formular';
import { FarbPunkte, WER_FARBE, WER_LABEL, type Wer } from './teile';

export type { Vorgabe };

interface Entwurf { f: Formular; am: string }
const lese = (): Entwurf | null => { try { const v = window.sessionStorage.getItem(ENTWURF_SCHLUESSEL); return v ? JSON.parse(v) as Entwurf : null; } catch { return null; } };
const schreibe = (e: Entwurf | null) => { try { if (e) window.sessionStorage.setItem(ENTWURF_SCHLUESSEL, JSON.stringify(e)); else window.sessionStorage.removeItem(ENTWURF_SCHLUESSEL); } catch { /* voll/privat */ } };

export function NeuerTermin({ vorgabe, heute, standardDauer, fokusDauer = 90, kalender, kalenderStandard, onZu, onAngelegt, zusatz }: {
  vorgabe: Vorgabe; heute: string; standardDauer: number; fokusDauer?: number;
  kalender: { name: string; wer: Wer; schreibbar: boolean; farbe?: string }[];
  /** Welcher Kalender gehört wem (Einstellungen) — für die Farbe „Standard“. */
  kalenderStandard?: Partial<Record<Wer, string>>;
  onZu: () => void; onAngelegt: (was: { uid?: string; aufgabeId?: string }) => void;
  /** Erweiterungsstelle für K3: Gäste, CRM-Bezug — erscheinen unter „Weitere Optionen“. */
  zusatz?: { gaeste?: ReactNode; crm?: ReactNode };
}) {
  const { state, dispatch, spaces } = useTasks();
  const [f, setFRoh] = useState<Formular>(() => formularStart(vorgabe, standardDauer, fokusDauer));
  const [alt] = useState<Entwurf | null>(() => { const e = lese(); return e && entwurfWertvoll(e.f) ? e : null; });
  const [altOffen, setAltOffen] = useState(!!alt);
  const [voll, setVoll] = useState(false);
  const [eigenOffen, setEigenOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const setF = (n: Formular) => { setFRoh(n); if (entwurfWertvoll(n)) schreibe({ f: n, am: new Date().toISOString() }); };

  const schnell = useMemo(() => (f.titel.trim() && f.art !== 'arbeitsort' ? schnellLesen(f.titel, heute, f.art === 'fokus' ? fokusDauer : standardDauer) : null), [f.titel, f.art, heute, standardDauer, fokusDauer]);
  const schnellAnwenden = (x: Formular): Formular => {
    if (!schnell?.erkannt.length) return x;
    const tagErkannt = schnell.erkannt.some(e => /^(am |heute|morgen|übermorgen|Mo|Di|Mi|Do|Fr|Sa|So)/.test(e));
    return {
      ...x, titel: schnell.titel || x.titel, ...(tagErkannt ? { tag: schnell.tag, bisTag: schnell.tag } : {}), ganztags: schnell.ganztags,
      ...(schnell.von ? { von: schnell.von } : {}), ...(schnell.bis ? { bis: schnell.bis } : {}), ...(schnell.wer ? { wer: schnell.wer, kalender: '' } : {}),
      ...(schnell.ort ? { ort: schnell.ort } : {}), ...(schnell.wiederholung ? { wiederholung: { freq: schnell.wiederholung } } : {}),
      ...(schnell.von && x.art === 'aufgabe' ? { aufgabe: { ...x.aufgabe, mitZeit: true } } : {}),
    };
  };

  const speichern = async (roh: Formular = f) => {
    const x = schnellAnwenden(roh);
    if (x !== roh) setF(x);
    const fe = formularFehler(x);
    if (fe) { setFehler(fe); return; }
    setLaeuft(true); setFehler(null);
    const a = formularAnfrage(x);
    if (a.art === 'aufgabe') {
      // Dieselbe Aufgabe im Aufgaben-Modell — der TasksContext hält sie als „ausstehend“, bis der Server bestätigt.
      const id = aufgabeAnlegen(dispatch, state, a.ziel, a.neu);
      schreibe(null); setLaeuft(false); onAngelegt({ aufgabeId: id }); onZu();
      return;
    }
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a.koerper) })
      .then(async res => ({ status: res.status, d: await res.json().catch(() => ({})) })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung — dein Entwurf bleibt gemerkt.' } }));
    setLaeuft(false);
    if (r.d.ok) { schreibe(null); onAngelegt({ uid: r.d.uid }); onZu(); return; }
    schreibe({ f: x, am: new Date().toISOString() });
    setFehler(`${r.d.fehler ?? 'Nicht angelegt.'}${r.status === 409 || r.status === 0 || r.status >= 500 ? ' Dein Entwurf bleibt gemerkt.' : ''}`);
  };

  // ── Teile ──
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px', colorScheme: 'dark' as const };
  const beschr = { fontSize: 12.5, color: C.inkLeise };
  const zeile = { display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' };
  const art = f.art;
  const schreibbar = kalender.filter(k => k.schreibbar);
  const kalName = f.kalender || kalenderStandard?.[f.wer] || '';
  const kalFarbe = kalender.find(k => k.name === kalName)?.farbe ?? WER_FARBE[f.wer];
  const gmt = gmtText(f.zone, f.ganztags ? ausWandzeit(`${f.tag}T12:00:00`) : ausWandzeitIn(`${f.tag}T${f.von}:00`, f.zone));
  const vorlagen = wiederholungVorlagen(f.tag);
  const vorlageId = !f.wiederholung ? 'keine' : vorlagen.find(v => v.w && JSON.stringify(v.w) === JSON.stringify(f.wiederholung))?.id ?? 'eigen';
  const wiederText = f.wiederholung ? wiederholungBeschreiben(f.wiederholung, f.tag) : 'Wiederholt sich nicht';
  const beschaeftigt = f.beschaeftigt ?? (art === 'abwesend' || art === 'fokus' ? true : art === 'arbeitsort' ? false : !f.ganztags);

  // Aufgabe: Space › Projekt › Liste (dieselben Helfer wie „Schnell anlegen“ in den Aufgaben).
  const alleSpaces = spacesOderFest(spaces).filter(s => !s.archiv);
  const spaceListe: WahlEintrag<string>[] = alleSpaces.map(s => ({ id: s.id, label: s.label, punkt: s.farbe, hinweis: s.bereich === 'privat' ? 'Privat' : s.art === 'mandant' ? 'Mandant' : 'Firma' }));
  const projektId = f.aufgabe.projectId ?? sonstigeProjektId(f.aufgabe.spaceId);
  const projektListe: WahlEintrag<string>[] = [...projekteImSpace(state, f.aufgabe.spaceId).map(p => ({ id: p.id, label: p.title, punkt: p.color })), { id: sonstigeProjektId(f.aufgabe.spaceId), label: 'Sonstige' }];
  const listenListe: WahlEintrag<string>[] = [...(state.listen ?? []).filter(l => l.projektId === projektId && !l.archiviert).map(l => ({ id: l.id, label: l.titel })), { id: '', label: 'Sonstige' }];
  const aufgabenWahl = useMemo(() => aufgabenFuerWahl(state.tasks, f.fokus.aufgabeId), [state.tasks, f.fokus.aufgabeId]);

  const setzeWiederholung = (id: string) => {
    if (id === 'eigen') { setEigenOffen(true); if (!f.wiederholung) setF({ ...f, wiederholung: { freq: 'WEEKLY', tage: [wochentagVon(f.tag)] } }); return; }
    setEigenOffen(false);
    setF({ ...f, wiederholung: vorlagen.find(v => v.id === id)?.w ?? null });
  };
  const w = f.wiederholung;
  const setW = (teil: Partial<Wiederholung>) => w && setF({ ...f, wiederholung: { ...w, ...teil } });

  return (
    <Fenster breit={voll ? 760 : 620} onZu={onZu} titel={voll ? 'Neuer Eintrag — alle Optionen' : 'Neuer Eintrag'}>
      {altOffen && alt && (
        <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: `${LEUCHT.puls}14`, borderRadius: 10, padding: '8px 12px', fontSize: TYP.bedien }}>
          <span style={{ flex: 1 }}>Ungespeicherter Entwurf: „{alt.f.titel || ART_INFO[alt.f.art].label}“ ({alt.f.tag.split('-').reverse().join('.')})</span>
          <Knopf leise onClick={() => { setFRoh(alt.f); setAltOffen(false); }}>Wiederherstellen</Knopf>
          <Knopf leise onClick={() => { schreibe(null); setAltOffen(false); }}>Verwerfen</Knopf>
        </div>
      )}
      {art !== 'arbeitsort' && (
        <input autoFocus value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void speichern(); } }}
          placeholder={art === 'abwesend' ? 'Abwesend (z. B. Urlaub, Reha)' : art === 'fokus' ? 'Fokuszeit (z. B. Angebot schreiben)' : art === 'aufgabe' ? 'Titel der Aufgabe' : 'Titel hinzufügen · „Mo 10 Uhr Kaffee mit Anna 45min“'}
          aria-label="Titel" style={{ ...eingabe, fontSize: 18, fontFamily: SCHRIFT.display, padding: '12px 14px', background: 'transparent', borderWidth: '0 0 1px', borderRadius: 0 }} />
      )}
      {schnell && schnell.erkannt.length > 0 && (
        <div style={{ ...zeile, fontSize: 12.5, color: LEUCHT.gut }}>
          erkannt: {schnell.erkannt.join(' · ')}
          <button type="button" onClick={() => setF(schnellAnwenden(f))} style={{ background: 'none', border: `1px solid ${LEUCHT.gut}66`, color: LEUCHT.gut, borderRadius: 999, padding: '1px 10px', cursor: 'pointer', fontSize: 12 }}>übernehmen</button>
        </div>
      )}
      <div role="tablist" aria-label="Art" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {TERMIN_ARTEN.map(a => (
          <button key={a} role="tab" type="button" aria-selected={art === a} onClick={() => setF(artWechseln(f, a, standardDauer, fokusDauer))} className="fassbar"
            style={{ padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600,
              border: `1px solid ${art === a ? (ART_INFO[a].farbe ?? LEUCHT.puls) : 'rgba(255,255,255,.1)'}`, background: art === a ? `${ART_INFO[a].farbe ?? LEUCHT.puls}24` : 'transparent', color: art === a ? C.ink : C.inkDim }}>
            {ART_INFO[a].label}
          </button>
        ))}
      </div>

      {art === 'arbeitsort' && (
        <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Wo arbeitest du?</span>
          <Segmente liste={ARBEITSORTE.map(a => ({ id: a.id, label: `${a.zeichen} ${a.label}` }))} aktiv={f.arbeitsort.art} onWahl={a => setF({ ...f, arbeitsort: { art: a, ...(a === 'frei' && f.arbeitsort.text ? { text: f.arbeitsort.text } : {}) } })} />
          {f.arbeitsort.art === 'frei' && <input value={f.arbeitsort.text ?? ''} onChange={e => setF({ ...f, arbeitsort: { art: 'frei', text: e.target.value } })} placeholder="Ort, z. B. Kanzlei Müller" aria-label="Eigener Ort" style={eingabe} />}
        </div>
      )}

      {/* Zeit */}
      <div style={{ ...zeile, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 140px' }}><span style={beschr}>{f.ganztags && art !== 'aufgabe' ? 'Von' : art === 'aufgabe' ? 'Deadline' : 'Tag'}</span>
          <input type="date" value={f.tag} onChange={e => { const t = e.target.value; setF({ ...f, tag: t, bisTag: f.bisTag < t ? t : f.bisTag }); }} style={eingabe} /></label>
        {f.ganztags && art !== 'aufgabe' && <label style={{ display: 'grid', gap: 4, flex: '1 1 140px' }}><span style={beschr}>Bis (einschließlich)</span>
          <input type="date" value={f.bisTag} min={f.tag} onChange={e => setF({ ...f, bisTag: e.target.value })} style={eingabe} /></label>}
        {!f.ganztags && (art !== 'aufgabe' || f.aufgabe.mitZeit) && <>
          <label style={{ display: 'grid', gap: 4, flex: '0 1 104px' }}><span style={beschr}>{art === 'aufgabe' ? 'Uhrzeit' : 'Von'}</span>
            <input type="time" step={300} value={f.von} onChange={e => { const v = e.target.value; setF({ ...f, von: v, bis: f.bis <= v ? plusMin(v, art === 'fokus' ? fokusDauer : standardDauer) : f.bis }); }} style={eingabe} /></label>
          {art !== 'aufgabe' && <label style={{ display: 'grid', gap: 4, flex: '0 1 104px' }}><span style={beschr}>Bis</span>
            <input type="time" step={300} value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} style={eingabe} /></label>}
          {art !== 'aufgabe' && <button type="button" onClick={() => setVoll(true)} title="Zeitzone ändern (Weitere Optionen)" style={{ background: 'none', border: 'none', color: C.inkLeise, fontSize: 12.5, cursor: 'pointer', paddingBottom: 10 }}>{f.zone === 'Europe/Berlin' ? gmt : `${ZONEN.find(z => z.id === f.zone)?.label ?? f.zone} · ${gmt}`}</button>}
        </>}
        {art === 'aufgabe'
          ? <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim, paddingBottom: 10 }}><input type="checkbox" checked={f.aufgabe.mitZeit} onChange={e => setF({ ...f, ganztags: false, aufgabe: { ...f.aufgabe, mitZeit: e.target.checked } })} /> mit Uhrzeit</label>
          : art !== 'arbeitsort' && <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim, paddingBottom: 10 }}><input type="checkbox" checked={f.ganztags} onChange={e => setF({ ...f, ganztags: e.target.checked, bisTag: f.tag, erinnerungen: e.target.checked ? [] : f.erinnerungen })} /> ganztägig</label>}
      </div>

      {/* Wiederholung (nicht für Aufgaben — die haben ihre eigene Serie im Aufgaben-Modell) */}
      {art !== 'aufgabe' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <select value={vorlageId} onChange={e => setzeWiederholung(e.target.value)} aria-label="Wiederholung" style={{ ...eingabe, width: 'auto', maxWidth: '100%' }}>
            {vorlagen.map(v => <option key={v.id} value={v.id}>{v.id === 'eigen' && vorlageId === 'eigen' ? wiederText : v.label}</option>)}
          </select>
          {(eigenOffen || vorlageId === 'eigen') && w && (
            <div style={{ display: 'grid', gap: 8, border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 12px' }}>
              <div style={zeile}><span style={beschr}>Alle</span>
                <input type="number" min={1} max={365} value={w.intervall ?? 1} onChange={e => setW({ intervall: Math.max(1, Number(e.target.value) || 1) })} aria-label="Abstand" style={{ ...eingabe, width: 70 }} />
                <select value={w.freq} onChange={e => { const freq = e.target.value as WiederholungFreq; setF({ ...f, wiederholung: { freq, ...(w.intervall ? { intervall: w.intervall } : {}), ...(w.anzahl ? { anzahl: w.anzahl } : {}), ...(w.bis ? { bis: w.bis } : {}), ...(freq === 'WEEKLY' ? { tage: [wochentagVon(f.tag)] } : {}) } }); }} aria-label="Einheit" style={{ ...eingabe, width: 'auto' }}>
                  <option value="DAILY">Tage</option><option value="WEEKLY">Wochen</option><option value="MONTHLY">Monate</option><option value="YEARLY">Jahre</option>
                </select>
              </div>
              {w.freq === 'WEEKLY' && (
                <div role="group" aria-label="Wochentage" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {WOCHENTAGE.map(t => { const an = (w.tage ?? []).includes(t); return (
                    <button key={t} type="button" aria-pressed={an} onClick={() => { const tage = an ? (w.tage ?? []).filter(x => x !== t) : [...(w.tage ?? []), t]; setW({ tage: tage.length ? tage : [t] }); }}
                      style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: an ? LEUCHT.puls : 'rgba(255,255,255,.06)', color: an ? '#0b0b0c' : C.inkDim }}>{TAG_KURZ[t]}</button>
                  ); })}
                </div>
              )}
              {w.freq === 'MONTHLY' && (() => { const { nr, letzter } = wochentagNr(f.tag); const wt = wochentagVon(f.tag); const modus = w.wochentagImMonat ? (w.wochentagImMonat.nr === -1 ? 'letzterWt' : 'wt') : w.monatstag === -1 ? 'letzter' : 'tag'; return (
                <select value={modus} aria-label="Im Monat" onChange={e => { const m = e.target.value; const { monatstag: _m, wochentagImMonat: _w, ...rest } = w; setF({ ...f, wiederholung: { ...rest, ...(m === 'tag' ? { monatstag: Number(f.tag.slice(8, 10)) } : m === 'letzter' ? { monatstag: -1 } : m === 'wt' ? { wochentagImMonat: { nr: nr === 5 ? -1 : nr, tag: wt } } : { wochentagImMonat: { nr: -1, tag: wt } }) } }); }} style={{ ...eingabe, width: 'auto' }}>
                  <option value="tag">am {Number(f.tag.slice(8, 10))}.</option>
                  <option value="letzter">am letzten Tag des Monats</option>
                  {nr < 5 && <option value="wt">am {nr}. {TAG_KURZ[wt]}</option>}
                  {letzter && <option value="letzterWt">am letzten {TAG_KURZ[wt]}</option>}
                </select>
              ); })()}
              <div style={zeile}><span style={beschr}>Endet</span>
                <Segmente liste={[{ id: 'nie', label: 'nie' }, { id: 'am', label: 'am' }, { id: 'nach', label: 'nach' }]} aktiv={w.anzahl ? 'nach' : w.bis ? 'am' : 'nie'}
                  onWahl={m => { const { anzahl: _a, bis: _b, ...rest } = w; setF({ ...f, wiederholung: { ...rest, ...(m === 'am' ? { bis: tagPlus(f.tag, 90) } : m === 'nach' ? { anzahl: 10 } : {}) } }); }} />
                {w.bis && <input type="date" value={w.bis} min={f.tag} onChange={e => setW({ bis: e.target.value })} aria-label="Endet am" style={{ ...eingabe, width: 'auto' }} />}
                {w.anzahl && <><input type="number" min={1} max={999} value={w.anzahl} onChange={e => setW({ anzahl: Math.max(1, Number(e.target.value) || 1) })} aria-label="Anzahl" style={{ ...eingabe, width: 80 }} /><span style={beschr}>Termine</span></>}
              </div>
              <span style={{ fontSize: 12, color: C.inkLeise }}>{wiederText}</span>
            </div>
          )}
        </div>
      )}

      {/* Aufgabe: wohin */}
      {art === 'aufgabe' && (
        <div style={{ ...zeile, fontSize: 12.5, color: C.inkLeise }}>
          <span>in</span>
          <Wahl klein label="Space" liste={spaceListe} wert={f.aufgabe.spaceId} onWahl={id => setF({ ...f, aufgabe: { spaceId: id, mitZeit: f.aufgabe.mitZeit } })} />
          <span aria-hidden>›</span>
          <Wahl klein label="Projekt" liste={projektListe} wert={projektId} onWahl={id => setF({ ...f, aufgabe: { ...f.aufgabe, projectId: istSonstigeProjekt(id) ? undefined : id, listeId: undefined } })} />
          {!istSonstigeProjekt(projektId) && <><span aria-hidden>›</span>
            <Wahl klein label="Liste" liste={listenListe} wert={f.aufgabe.listeId ?? ''} onWahl={id => setF({ ...f, aufgabe: { ...f.aufgabe, listeId: id || undefined } })} /></>}
          <span style={{ flexBasis: '100%', fontSize: 12 }}>Wird eine Aufgabe (kein Kalendertermin) — der Kalender zeigt sie an ihrer {f.aufgabe.mitZeit ? 'Uhrzeit' : 'Deadline'}.</span>
        </div>
      )}

      {/* Fokuszeit: worauf sie zählt (nur Kennungen → kalender-bezug) */}
      {art === 'fokus' && (
        <div style={{ ...zeile, fontSize: 12.5, color: C.inkLeise }}>
          <span>zählt auf</span>
          <Wahl klein label="Aufgabe" leer="+ Aufgabe" leerenLabel="ohne Aufgabe" liste={aufgabenWahl} wert={f.fokus.aufgabeId} onWahl={id => setF({ ...f, fokus: { ...f.fokus, aufgabeId: id } })} onLeeren={() => setF({ ...f, fokus: { ...f.fokus, aufgabeId: undefined } })} />
          <MandatWahl klein wert={f.fokus.mandatId} setzen={m => setF({ ...f, fokus: { ...f.fokus, mandatId: m?.id } })} />
        </div>
      )}

      {art !== 'arbeitsort' && art !== 'aufgabe' && (
        <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Ort</span><input value={f.ort} onChange={e => setF({ ...f, ort: e.target.value })} placeholder="Ort hinzufügen" style={eingabe} /></label>
      )}
      <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>{art === 'abwesend' ? 'Hinweis (optional)' : 'Beschreibung'}</span>
        <textarea value={f.notiz} rows={voll ? 4 : 2} onChange={e => setF({ ...f, notiz: e.target.value })} placeholder="optional" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} /></label>

      {/* Kalender + Farbe */}
      {art !== 'aufgabe' && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={beschr}>Für wen · Kalender · Farbe</span>
          <div style={zeile}>
            <Segmente liste={(['kevin', 'malin', 'beide'] as Wer[]).map(x => ({ id: x, label: WER_LABEL[x] }))} aktiv={f.wer} onWahl={x => setF({ ...f, wer: x, kalender: '' })} />
            {schreibbar.length > 0 && (
              <select value={f.kalender} onChange={e => setF({ ...f, kalender: e.target.value })} aria-label="Kalender" style={{ ...eingabe, width: 'auto' }}>
                <option value="">{kalenderStandard?.[f.wer] ? `${kalenderStandard[f.wer]} (Standard)` : `Standard für ${WER_LABEL[f.wer]}`}</option>
                {schreibbar.map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
              </select>
            )}
          </div>
          <FarbPunkte wert={f.farbe} onWahl={id => setF({ ...f, farbe: id })} kalenderFarbe={kalFarbe} />
        </div>
      )}

      {/* Beschäftigt · Sichtbarkeit · Erinnerungen — kurz als Zeile, voll mit allen Schaltern */}
      {art !== 'aufgabe' && (!voll ? (
        <div style={{ fontSize: 12.5, color: C.inkDim }}>
          {beschaeftigt ? 'Beschäftigt' : 'Frei'} · {SICHTBARKEIT_LABEL[f.sichtbarkeit]} · {f.erinnerungen.length ? f.erinnerungen.map(erinnerungText).join(', ') : 'keine Erinnerung'}
          {f.zone !== 'Europe/Berlin' && !f.ganztags ? ` · Zeitzone ${ZONEN.find(z => z.id === f.zone)?.label ?? f.zone}` : ''}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {!f.ganztags && <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Zeitzone (die Uhrzeiten oben gelten dort)</span>
            <select value={f.zone} onChange={e => setF({ ...f, zone: e.target.value })} style={{ ...eingabe, width: 'auto' }}>
              {ZONEN.map(z => <option key={z.id} value={z.id}>{z.label} · {gmtText(z.id, ausWandzeitIn(`${f.tag}T${f.von}:00`, z.id))}</option>)}
            </select></label>}
          <div style={zeile}>
            {art !== 'abwesend' && art !== 'fokus'
              ? <Segmente liste={[{ id: 'b', label: 'Beschäftigt' }, { id: 'f', label: 'Frei' }]} aktiv={beschaeftigt ? 'b' : 'f'} onWahl={v => setF({ ...f, beschaeftigt: v === 'b' })} />
              : <span style={beschr}>{ART_INFO[art].label} zählt immer als beschäftigt.</span>}
            <select value={f.sichtbarkeit} onChange={e => setF({ ...f, sichtbarkeit: e.target.value as Sichtbarkeit })} aria-label="Sichtbarkeit" style={{ ...eingabe, width: 'auto' }}>
              {(['standard', 'privat', 'oeffentlich'] as Sichtbarkeit[]).map(s => <option key={s} value={s}>{SICHTBARKEIT_LABEL[s]}</option>)}
            </select>
          </div>
          {f.sichtbarkeit === 'privat' && <span style={{ fontSize: 12, color: C.inkLeise }}>Privat: die andere Person sieht nur „Belegt“.</span>}
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={beschr}>Erinnerungen (auf iPhone und Mac)</span>
            {f.erinnerungen.map((m, i) => (
              <div key={i} style={zeile}>
                <select value={m} onChange={e => setF({ ...f, erinnerungen: f.erinnerungen.map((x, j) => (j === i ? Number(e.target.value) : x)) })} aria-label={`Erinnerung ${i + 1}`} style={{ ...eingabe, width: 'auto' }}>
                  {Array.from(new Set([...ERINNERUNG_VORLAGEN, m])).sort((a, b) => a - b).map(v => <option key={v} value={v}>{erinnerungText(v)}</option>)}
                </select>
                <button type="button" onClick={() => setF({ ...f, erinnerungen: f.erinnerungen.filter((_, j) => j !== i) })} aria-label="Erinnerung entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            {f.erinnerungen.length < ERINNERUNG_MAX && <button type="button" onClick={() => setF({ ...f, erinnerungen: [...f.erinnerungen, f.erinnerungen.length ? 60 : 10] })} style={{ justifySelf: 'start', background: 'none', border: 'none', color: LEUCHT.puls, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>+ Erinnerung hinzufügen</button>}
          </div>
          {zusatz?.gaeste}
          {zusatz?.crm}
        </div>
      ))}

      {fehler && <div role="alert" style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        {art !== 'aufgabe' ? <Knopf leise onClick={() => setVoll(v => !v)}>{voll ? 'Weniger Optionen' : 'Weitere Optionen'}</Knopf> : <span />}
        <div style={{ display: 'flex', gap: 8 }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf farbe={LEUCHT.puls} aus={laeuft} onClick={() => void speichern()}>{laeuft ? 'speichert …' : 'Speichern'}</Knopf>
        </div>
      </div>
      <span style={{ fontSize: 12, color: C.inkLeise }}>{art === 'aufgabe' ? 'Landet in den Aufgaben — dieselbe Aufgabe, keine Kopie.' : 'Landet in iCloud — auf iPhone und Mac sichtbar. Keine Einladungen, kein Versand.'}</span>
    </Fenster>
  );
}
