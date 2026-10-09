'use client';

// ─── MAKE OS — Prospecting-Agent ────────────────────────────────────────────
// Die Zielliste: Firmen rein, KI qualifiziert gegen das ICP (Score + Fit + Aufhänger), man priorisiert. Ansprache entwerfen — der
// Versand bleibt bei dir.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Zahl aus schlank).
// Woche 2 · 1.14 (09.10.): das ICP kommt aus Markttraktion › Marketing › Positionierung (kein festes Produkt im Code); jede Änderung geht als
// Einzeländerung mit Stand an PATCH /api/state/prospects (vorher: die ganze Liste per PUT, Fehler verschluckt); „In die Kartei übernehmen“
// legt Firma (und Ansprechpartner) über den EINEN Weg an (POST /api/crm/person) — dort wird daraus ein Lead. Auch aus Markttraktion › Firmen erreichbar.

import { neueMailVorbereiten } from '@/lib/inbox/neue-mail';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import {
  PROSPECT_STATUS_ORDER, PROSPECT_STATUS_LABEL, ICP_HINWEIS, prospectKennung,
  type Prospect, type ProspectStatus,
} from '@/lib/make-one/prospecting-data';
import { Building2 } from 'lucide-react';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Leerzustand, Knopf, Chip, Zahl, Hinweis, feld, LEUCHT } from './ui';
import { KiMarke } from './KiMarke';
import { ZoeReiter } from './ZoeReiter';
import { WEG } from '@/lib/wege';

type PZeile = Prospect & { stand?: string };
type Antwort = { ok?: boolean; fehler?: string; zeilen?: { id: string; stand: string }[]; konflikte?: unknown[]; state?: { icp: string; prospects: PZeile[] } | null; icpQuelle?: 'marketing' | 'eigen' | 'leer'; eigenesIcp?: string };

const scoreColor = (s?: number) => (s == null ? C.inkLeise : s >= 80 ? LEUCHT.gut : s >= 50 ? LEUCHT.achtung : LEUCHT.kritisch);
const statusColor = (s: ProspectStatus) => (s === 'kontaktiert' ? LEUCHT.gut : s === 'qualifiziert' ? LEUCHT.business : s === 'verworfen' ? LEUCHT.kritisch : C.inkLeise);
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };
/** Nie eine Null als große Zahl — dann lieber der Strich. */
const z = (n: number) => (n ? String(n) : undefined);

/** Pillen-Schalter — eine Wahl aus mehreren, ohne Rahmen. */
function Wahl({ an, farbe, onClick, children, title, aus }: { an: boolean; farbe?: string; onClick: () => void; children: ReactNode; title?: string; aus?: boolean }) {
  const f = farbe ?? C.aktiv;
  return (
    <button onClick={onClick} title={title} disabled={aus} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: aus ? 'default' : 'pointer', background: an ? `${f}22` : 'rgba(255,255,255,.05)', color: an ? f : C.inkDim, whiteSpace: 'nowrap', transition: 'background .2s ease, color .2s ease' }}>{children}</button>
  );
}

export function ProspectingView() {
  const [icp, setIcp] = useState('');
  const [icpQuelle, setIcpQuelle] = useState<'marketing' | 'eigen' | 'leer'>('leer');
  const [rows, setRows] = useState<PZeile[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [bulk, setBulk] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const icpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Stand je Eintrag aus der letzten Server-Antwort — er geht mit jeder Änderung hinaus (409 statt still überschreiben). */
  const staende = useRef(new Map<string, string>());
  /** Schreiben nacheinander — eine Änderung trägt den Stand, den die vorige Antwort gemeldet hat. */
  const kette = useRef<Promise<unknown>>(Promise.resolve());

  // Ohne geladenen Stand wird nicht gespeichert — sonst ersetzt der erste neue Eintrag die ganze Zielkundenliste.
  const [ladeFehler, setLadeFehler] = useState(false);
  const uebernehmen = useCallback((d: Antwort) => {
    if (d.icpQuelle) setIcpQuelle(d.icpQuelle);
    if (d.state) {
      setIcp(d.icpQuelle === 'marketing' ? d.state.icp : d.state.icp || d.eigenesIcp || '');
      setRows(d.state.prospects ?? []);
      staende.current = new Map((d.state.prospects ?? []).filter(p => p.stand).map(p => [p.id, p.stand!]));
    }
  }, []);
  const laden = useCallback(() => fetch('/api/state/prospects')
    .then(r => { if (!r.ok) throw new Error(`Status ${r.status}`); return r.json() as Promise<Antwort>; })
    .then(d => { uebernehmen(d); setLoaded(true); setLadeFehler(false); })
    .catch(err => {
      console.error('[MAKE OS] Zielkunden konnten nicht geladen werden — Speichern gesperrt.', err);
      setLadeFehler(true);
      setLoaded(true);
    }), [uebernehmen]);
  useEffect(() => { void laden(); }, [laden]);

  /** Eine Änderung an den Server — nacheinander, mit Stand; Fehler bleiben sichtbar, 409 lädt den aktuellen Stand. */
  const schreiben = useCallback((body: { ops?: Record<string, unknown>[]; icp?: string }): Promise<boolean> => {
    if (ladeFehler) { setFehler('Die Zielliste ist nicht geladen — nichts gespeichert. Bitte die Seite neu laden.'); return Promise.resolve(false); }
    const lauf = kette.current.then(async () => {
      const ops = body.ops?.map(o => { const id = String(o.id ?? (o.eintrag as { id?: string } | undefined)?.id ?? ''); const st = staende.current.get(id); return st && o.op !== 'upsert' ? { ...o, stand: st } : o; });
      const d: Antwort = await fetch('/api/state/prospects', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...(ops ? { ops } : {}) }) })
        .then(r => r.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
      if (!d.ok) {
        setFehler(`Nicht gespeichert — ${d.fehler ?? 'unbekannter Fehler'}${d.konflikte?.length ? ' Der aktuelle Stand ist geladen, bitte noch einmal.' : ''}`);
        if (d.konflikte?.length) await laden();
        return false;
      }
      for (const z of d.zeilen ?? []) staende.current.set(z.id, z.stand);
      for (const o of body.ops ?? []) if (o.op === 'delete') staende.current.delete(String(o.id));
      setFehler(null);
      return true;
    });
    kette.current = lauf.catch(() => false);
    return lauf;
  }, [ladeFehler, laden]);

  const aendern = (p: Prospect, felder: Partial<Prospect>) => { setRows(rs => rs.map(x => (x.id === p.id ? { ...x, ...felder } : x))); return schreiben({ ops: [{ op: 'teil', id: p.id, felder }] }); };
  const setIcpP = (v: string) => { setIcp(v); clearTimeout(icpTimer.current); icpTimer.current = setTimeout(() => { void schreiben({ icp: v }); }, 600); };

  /** KI-Bewertung gegen das wirksame Profil — nur die Felder, die sich ändern (Score, Fit, Aufhänger, Status). */
  async function score(p: Prospect): Promise<Partial<Prospect> | null> {
    const r = await fetch('/api/prospecting/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
    const d = await r.json().catch(() => ({ error: 'keine Antwort' }));
    if (d.error && d.score == null) { setFehler(`Bewertung von „${p.company}“ fehlgeschlagen — ${String(d.error)}`); return null; }
    return { score: d.score, fit: d.fit, angle: d.angle, status: p.status === 'neu' ? 'qualifiziert' : p.status };
  }

  async function scoreOne(p: Prospect) {
    setBusy(b => ({ ...b, [p.id]: true }));
    const felder = await score(p);
    if (felder) await aendern(p, felder);
    setBusy(b => ({ ...b, [p.id]: false }));
  }

  async function scoreAll() {
    setBulk(true);
    for (const p of rows.filter(x => x.score == null)) {
      const felder = await score(p);
      if (felder) await aendern(p, felder);
    }
    setBulk(false);
  }

  function cycleStatus(p: Prospect) {
    const i = PROSPECT_STATUS_ORDER.indexOf(p.status);
    void aendern(p, { status: PROSPECT_STATUS_ORDER[(i + 1) % PROSPECT_STATUS_ORDER.length] });
  }

  // ── In die Kartei übernehmen (1.14): Firma und — wenn genannt — Ansprechpartner über den EINEN Weg „Person anlegen“ ──
  const [uebernahme, setUebernahme] = useState<{ id: string; vorname: string; nachname: string; email: string; position: string } | null>(null);
  async function inKartei(p: Prospect) {
    if (!uebernahme) return;
    const mitPerson = !!(uebernahme.vorname.trim() || uebernahme.nachname.trim());
    const body = mitPerson
      ? { aktion: 'anlegen', weg: 'prospecting', person: { vorname: uebernahme.vorname, nachname: uebernahme.nachname, email: uebernahme.email, position: uebernahme.position, firma: p.company, ...(p.domain ? { webseite: p.domain } : {}), firmaZusatz: { ...(p.industry ? { branche: p.industry } : {}), ...(p.size ? { mitarbeiter: p.size } : {}) } } }
      : { aktion: 'firma', firma: { name: p.company, ...(p.domain ? { webseite: p.domain } : {}), ...(p.industry ? { branche: p.industry } : {}), ...(p.size ? { mitarbeiter: p.size } : {}) } };
    const d = await fetch('/api/crm/person', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
    if (!d.ok || !d.firmaId) { setFehler(`Nicht übernommen — ${d.fehler ?? (mitPerson ? 'die Person hat keine Firma' : 'unbekannter Fehler')}`); return; }
    setUebernahme(null);
    await aendern(p, { kartei: { firmaId: d.firmaId, ...(d.kontaktId ? { kontaktId: d.kontaktId } : {}), am: new Date().toISOString() } });
  }

  // ── Outreach-Agent: Erstansprache in Kevins Stimme (Entwurf — Versand bei dir) ──
  const [entwurf, setEntwurf] = useState<{ fuer: string; betreff: string; email: string; linkedin: string; hinweis: string } | null>(null);
  const [entwurfBusy, setEntwurfBusy] = useState<string | null>(null);
  const [mailInfo, setMailInfo] = useState('');

  async function ansprache(p: Prospect) {
    setEntwurfBusy(p.id); setEntwurf(null); setMailInfo('');
    try {
      const r = await fetch('/api/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prospect: p, icp }) });
      const d = await r.json();
      if (d.email) setEntwurf({ fuer: p.id, betreff: d.betreff ?? '', email: d.email, linkedin: d.linkedin ?? '', hinweis: d.hinweis ?? '' });
    } catch { /* still */ }
    setEntwurfBusy(null);
  }

  // Inbox 2 (06.10.): statt Apple Mail (osascript) die neue Mail in der Inbox — Postfach wählen, Empfänger eintragen, prüfen, selbst senden.
  function inMailOeffnen() {
    if (!entwurf) return;
    window.location.href = neueMailVorbereiten({ betreff: entwurf.betreff, text: entwurf.email });
  }

  function addManual() {
    const name = newName.trim();
    if (!name) return;
    const zufall = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const p: Prospect = { id: prospectKennung(name, zufall), company: name, status: 'neu', addedAt: new Date().toISOString(), source: 'manuell' };
    setRows(rs => [p, ...rs]); setNewName('');
    void schreiben({ ops: [{ op: 'upsert', eintrag: p }] });
  }
  const loeschen = (p: Prospect) => { setRows(rs => rs.filter(x => x.id !== p.id)); void schreiben({ ops: [{ op: 'delete', id: p.id }] }); };

  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const counts = PROSPECT_STATUS_ORDER.map(s => ({ s, n: rows.filter(r => r.status === s).length }));
  const unscored = rows.filter(r => r.score == null).length;
  const hot = rows.filter(r => (r.score ?? 0) >= 80).length;

  return (
    <Seite
      titel="Prospecting"
      unter="Deine Zielliste: Firmen rein, KI qualifiziert gegen dein Profil (Score, Fit, Aufhänger), du priorisierst."
      rechts={<Chip farbe={LEUCHT.agenten}>live · autonom</Chip>}
    >
      <ZoeReiter />
      {/* Kennzahlen */}
      <Karte i={0} ton={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business}>Zielliste</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
          <Zahl wert={z(rows.length)} label="In Liste" />
          <Zahl wert={z(hot)} label="Starker Fit (80+)" farbe={LEUCHT.gut} />
          <Zahl wert={z(unscored)} label="Noch offen" farbe={unscored ? LEUCHT.achtung : C.inkLeise} />
          {counts.map(c => <Zahl key={c.s} wert={z(c.n)} label={PROSPECT_STATUS_LABEL[c.s]} farbe={statusColor(c.s)} />)}
        </div>
      </Karte>

      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      {ladeFehler && <Hinweis art="kritisch" rolle="alert">Die Zielliste ließ sich nicht laden — Speichern ist gesperrt, damit nichts überschrieben wird. Bitte die Seite neu laden.</Hinweis>}

      {/* ICP — aus Markttraktion › Marketing › Positionierung (1.14); nur ohne Einstellung das eigene Profil der Zielliste. */}
      <Karte i={1}>
        <details open={icpQuelle === 'leer'}>
          <summary style={{ cursor: 'pointer', ...mikro, color: LEUCHT.business }}>Ideales Kundenprofil (ICP)</summary>
          {icpQuelle === 'marketing' ? (
            <>
              <div style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{icp}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Kommt aus <Link href={WEG.marketing('positionierung')} style={{ color: C.aktiv }}>Markttraktion › Marketing › Positionierung</Link> — dort ändern, dann gilt es für Scoring und Ansprache.</div>
            </>
          ) : (
            <>
              <textarea value={icp} onChange={e => setIcpP(e.target.value)} rows={7} aria-label="Ideales Kundenprofil" placeholder="Wen suchen wir? Branche, Größe, Schmerzpunkte, Entscheider, Auslöser …" style={{ ...feld, marginTop: 12, resize: 'vertical', lineHeight: 1.5, color: C.inkDim }} />
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{icp.trim() ? 'Das Profil steuert das Scoring. Änderungen werden gespeichert.' : ICP_HINWEIS} Besser: <Link href={WEG.marketing('positionierung')} style={{ color: C.aktiv }}>in der Positionierung pflegen</Link> — dann gilt es überall.</div>
            </>
          )}
        </details>
      </Karte>

      {/* Aktionen + Liste */}
      <Karte i={2}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <Knopf haupt onClick={scoreAll} aus={bulk || !unscored || !icp.trim()} farbe={LEUCHT.business}>
            {bulk ? 'qualifiziere …' : unscored ? `Alle ${unscored} qualifizieren` : 'Alle qualifiziert ✓'}
          </Knopf>
          <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 220 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManual(); }} placeholder="Firma manuell hinzufügen …" style={{ ...feld, flex: 1, width: 'auto', padding: '9px 14px' }} />
            <Knopf leise onClick={addManual}>+ Hinzufügen</Knopf>
          </div>
        </div>

        {!loaded ? (
          <Leer>lade Zielliste …</Leer>
        ) : rows.length === 0 ? (
          <Leerzustand symbol={<Building2 size={26} />} ton={LEUCHT.business} titel="Noch keine Firmen in der Zielliste">Oben eine Firma hinzufügen — oder ZOE im Chat sagen „bau die Zielliste aus“, dann zieht sie echte Mittelstands-Firmen (Explorium) rein.</Leerzustand>
        ) : (
          <Liste>
            {sorted.map(p => {
              const isOpen = open === p.id;
              return (
                <div key={p.id}>
                  <Zeile onClick={() => setOpen(isOpen ? null : p.id)} aktiv={isOpen}
                    links={<span style={{ width: 42, textAlign: 'center', flex: '0 0 auto', fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 800, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: scoreColor(p.score) }}>{p.score ?? '–'}</span>}
                    titel={p.company}
                    unter={[p.industry, p.size, p.region].filter(Boolean).join(' · ') || (p.domain ?? '')}
                    rechts={
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button onClick={e => { e.stopPropagation(); cycleStatus(p); }} title="Status wechseln" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}><Chip farbe={statusColor(p.status)}>{PROSPECT_STATUS_LABEL[p.status]}</Chip></button>
                        <span onClick={e => e.stopPropagation()}><Knopf leise onClick={() => scoreOne(p)} aus={busy[p.id]}>{busy[p.id] ? '…' : p.score == null ? 'Qualifizieren' : 'Neu bewerten'}</Knopf></span>
                        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{isOpen ? '▾' : '▸'}</span>
                      </span>
                    }
                  />
                  {isOpen && (
                    <div style={{ padding: '6px 2px 18px 56px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {p.fit && <div><div style={{ ...mikro, marginBottom: 4 }}>Fit</div><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{p.fit}</div></div>}
                      {p.angle && <div><div style={{ ...mikro, marginBottom: 4 }}>Aufhänger</div><div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{p.angle}</div></div>}
                      {!p.fit && !p.angle && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Noch nicht qualifiziert — „Qualifizieren“ klicken.</div>}

                      {/* Outreach: Ansprache entwerfen — Versand bleibt bei Kevin */}
                      {p.score != null && (
                        <div>
                          <Knopf leise onClick={() => ansprache(p)} aus={entwurfBusy === p.id}>
                            {entwurfBusy === p.id ? 'ZOE schreibt …' : entwurf?.fuer === p.id ? '↻ Neu entwerfen' : '✍ Ansprache entwerfen'}
                          </Knopf>
                        </div>
                      )}
                      {entwurf?.fuer === p.id && (
                        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <KiMarke />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ ...mikro, color: LEUCHT.business }}>E-Mail</span>
                            <input value={entwurf.betreff} onChange={e => setEntwurf({ ...entwurf, betreff: e.target.value })} aria-label="Betreff"
                              style={{ ...feld, flex: 1, minWidth: 160, width: 'auto', fontWeight: 600, padding: '8px 12px' }} />
                          </div>
                          <textarea value={entwurf.email} onChange={e => setEntwurf({ ...entwurf, email: e.target.value })} rows={7} aria-label="E-Mail-Text"
                            style={{ ...feld, color: C.inkDim, lineHeight: 1.55, resize: 'vertical' }} />
                          {entwurf.linkedin && (
                            <>
                              <div style={{ ...mikro, color: LEUCHT.business }}>LinkedIn-Erstnachricht</div>
                              <textarea value={entwurf.linkedin} onChange={e => setEntwurf({ ...entwurf, linkedin: e.target.value })} rows={3} aria-label="LinkedIn-Erstnachricht"
                                style={{ ...feld, color: C.inkDim, lineHeight: 1.55, resize: 'vertical' }} />
                            </>
                          )}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Knopf onClick={inMailOeffnen} farbe={LEUCHT.business}>In der Inbox schreiben</Knopf>
                            <Knopf leise onClick={() => { try { navigator.clipboard.writeText(`${entwurf.betreff}\n\n${entwurf.email}`); } catch { /* egal */ } }}>E-Mail kopieren</Knopf>
                            {entwurf.linkedin && <Knopf leise onClick={() => { try { navigator.clipboard.writeText(entwurf.linkedin); } catch { /* egal */ } }}>LinkedIn kopieren</Knopf>}
                            <Knopf leise onClick={() => aendern(p, { status: 'kontaktiert' })}>→ als kontaktiert markieren</Knopf>
                            {mailInfo && <span style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>{mailInfo}</span>}
                          </div>
                          {entwurf.hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{entwurf.hinweis}</div>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {PROSPECT_STATUS_ORDER.map(s => (
                          <Wahl key={s} an={p.status === s} farbe={statusColor(s)} onClick={() => void aendern(p, { status: s })}>{PROSPECT_STATUS_LABEL[s]}</Wahl>
                        ))}
                        <span style={{ marginLeft: 'auto' }}><Knopf leise onClick={() => loeschen(p)}>Löschen</Knopf></span>
                      </div>
                      {p.source && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Quelle: {p.source}</div>}
                      {/* 1.14: in die Kartei — Firma (und Ansprechpartner) über den EINEN Weg; dort wird daraus ein Lead (Art. 14: Recherche). */}
                      {p.kartei ? (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien }}>
                          <Chip farbe={LEUCHT.gut}>In der Kartei</Chip>
                          <Link href={WEG.firma(p.kartei.firmaId)} style={{ color: C.aktiv }}>Firma öffnen ›</Link>
                          {p.kartei.kontaktId && <Link href={WEG.akte(p.kartei.kontaktId)} style={{ color: C.aktiv }}>Ansprechpartner ›</Link>}
                        </div>
                      ) : uebernahme?.id === p.id ? (
                        <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
                          <div style={{ ...mikro, color: LEUCHT.business }}>In die Kartei übernehmen</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 8 }}>
                            {(['vorname', 'nachname', 'email', 'position'] as const).map(f => (
                              <input key={f} value={uebernahme[f]} onChange={e => setUebernahme({ ...uebernahme, [f]: e.target.value })} aria-label={f}
                                placeholder={{ vorname: 'Vorname (optional)', nachname: 'Nachname (optional)', email: 'E-Mail (optional)', position: 'Position (optional)' }[f]} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
                            ))}
                          </div>
                          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Mit Ansprechpartner wird die Firma ein Lead; ohne steht nur die Firma in der Kartei (Person später in der Firmenkarte). Herkunft: Recherche — Art. 14 (Information binnen eines Monats) gilt.</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf onClick={() => inKartei(p)}>Übernehmen</Knopf><Knopf leise onClick={() => setUebernahme(null)}>Abbrechen</Knopf></div>
                        </div>
                      ) : (
                        <div><Knopf leise onClick={() => setUebernahme({ id: p.id, vorname: '', nachname: '', email: '', position: '' })}>In die Kartei übernehmen</Knopf></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Liste>
        )}
      </Karte>
    </Seite>
  );
}
