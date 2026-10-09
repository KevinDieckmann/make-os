'use client';

// ─── Agenten-Seite: die Fenster hinter „+ Neu ▾“ und „⋯“ (09.10., Paket 2) ─────────────────────────────────────────────
// • Auftrag · An mehrere Heads · Hintergrundaufgabe (jetzt / einmal geplant / wiederkehrend) — der Auftrag in den vier Teilen
//   aus C3 (Ziel, Format, Grenzen, Quellen); „jetzt“ = Thread (POST /api/agenten/faden, `hintergrund`), geplant = Plan
//   (POST /api/agenten/laeufe `planen`).
// • Mitarbeiter (Fragerunde 7): aus Vorlage · beschreiben → Rückfragen → Plan bestätigen · duplizieren · Probelauf ohne Wirkung.
// • Skill-Editor (Antwort 7, Recherche 3.5): Name, Beschreibung, Anleitung mit Beispielen, Werkzeuge (nur die des Heads),
//   Auslöser (von Hand · Zeitplan mit Bestätigung in Klartext · Ereignis), Eingabe-Felder, Freigabe-Pflicht, Ergebnis, Modell,
//   Kostengrenze, Tests (≥ 3) und Testlauf vor dem Einschalten, Import SKILL.md (nur Entwurf, nichts ausführbar).
// • Leitplanken, Geplant (Paket 4b: pausieren/fortsetzen/löschen mit Stand), Budget (Paket 4b: Grenze je Monat ODER gesamt setzen —
//   nur der Inhaber; die Route entscheidet).
// Solange eine Route 501 antwortet, sagt das Fenster ruhig „kommt mit dem nächsten Paket“ — nichts geht verloren, das Fenster
// bleibt offen.

import { useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, ABSTAND, LEUCHT, MIKRO, SCHRIFT, TYP, ZIEL } from '@/lib/make-one/design';
import { headDef, vorlagenFuer } from '@/lib/agenten/katalog';
import {
  agentSchluessel, GRENZEN, type AgentRef, type HeadKarte, type Mitarbeiter, type ModelTier, type Rhythmus, type SkillAusloeser, type SkillEingabeFeld,
  type SkillEreignis, type Skill, type SkillKurz, type Zeitplan,
} from '@/lib/agenten/typen';
import { MODEL_LABEL } from '@/lib/make-one/agents-data';
import { Fenster } from '../Fenster';
import { Chip, Eigenschaft, Feldzeile, Hinweis, Knopf, Leer, Liste, MehrfachPillen, Pillen, Schalter, Schritte, Segmente, SymbolKnopf, Zeile, auswahl, eingabe, feld } from '../ui';
import { anfrageId, budgetSetzen, fadenSenden, laeufeSenden, ladeSkill, mitRueckfrage, skillSenden } from './daten';
import { sichtbareHeads, useAgenten, type DialogArt } from './kontext';
import {
  agentAusSchluessel, aktivierenFehlt, auftragText, ausloeserText, centAus, EREIGNIS_NAME, EREIGNIS_NOCH_NICHT, euro, kostenImMonat, leererSkill, naechsterLaufText,
  RHYTHMUS_NAME, skillName, skillPruefen, type Delegation, type SkillEntwurf,
} from './regeln';

/** Cent als Eingabetext („0,20“). */
const euroFeld = (cent: number) => (cent / 100).toFixed(2).replace('.', ',');
const STUFEN: { id: ModelTier; label: string }[] = [{ id: 'schnell', label: 'Schnell' }, { id: 'ausgewogen', label: 'Ausgewogen' }, { id: 'stark', label: 'Stark' }];
const TAGE: { id: string; label: string }[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((t, i) => ({ id: String(i + 1), label: t }));
const RHYTHMEN = (Object.keys(RHYTHMUS_NAME) as Rhythmus[]).map(r => ({ id: r, label: RHYTHMUS_NAME[r] }));

function Fehlerliste({ fehler }: { fehler: readonly string[] }) {
  if (!fehler.length) return null;
  return <Hinweis art="achtung" titel="Noch nicht fertig">{fehler.map(f => <div key={f}>{f}</div>)}</Hinweis>;
}

function Rueckmeldung({ r }: { r: { art: 'gut' | 'info' | 'kritisch'; text: string } | null }) {
  if (!r) return null;
  return <Hinweis art={r.art} rolle={r.art === 'kritisch' ? 'alert' : 'status'}>{r.text}</Hinweis>;
}
type Meldung = { art: 'gut' | 'info' | 'kritisch'; text: string } | null;
const ausErgebnis = (r: { ok: false; kommt: boolean; text: string }, kommt: string): Meldung => (r.kommt ? { art: 'info', text: kommt } : { art: 'kritisch', text: r.text });

// ── Agent wählen (Heads und ihre Mitarbeiter) ───────────────────────────────────────────────────────────────────────────

function AgentWahl({ wert, onWahl, heads, label = 'An wen' }: { wert: AgentRef | null; onWahl: (a: AgentRef) => void; heads: readonly HeadKarte[]; label?: string }) {
  const gruppen = (['business', 'privat'] as const).map(b => ({ b, heads: heads.filter(h => h.bereich === b) })).filter(g => g.heads.length);
  return (
    <Feldzeile label={label}>
      <select value={wert ? agentSchluessel(wert) : ''} onChange={e => { const a = agentAusSchluessel(e.target.value); if (a) onWahl(a); }} style={{ ...auswahl, width: '100%', minHeight: ZIEL.handy }}>
        <option value="" disabled>Head oder Mitarbeiter wählen …</option>
        {gruppen.map(g => g.heads.map(h => (
          <optgroup key={h.id} label={`${g.b === 'business' ? 'Business' : 'Privat'} · ${h.name}`}>
            <option value={`head:${h.id}`}>{h.name}</option>
            {h.mitarbeiter.filter(m => m.aktiv).map(m => <option key={m.id} value={`mitarbeiter:${h.id}:${m.id}`}>↳ {m.name}</option>)}
          </optgroup>
        )))}
      </select>
    </Feldzeile>
  );
}

/** Der Auftrag in vier Teilen (C3). Ziel ist Pflicht. */
function AuftragFelder({ wert, setze }: { wert: Delegation; setze: (d: Delegation) => void }) {
  const teil = (k: keyof Delegation, label: string, beispiel: string, zeilen = 1) => (
    <Feldzeile label={label}>
      {zeilen > 1
        ? <textarea value={wert[k] ?? ''} onChange={e => setze({ ...wert, [k]: e.target.value })} placeholder={beispiel} rows={zeilen} style={{ ...eingabe, resize: 'vertical' }} />
        : <input value={wert[k] ?? ''} onChange={e => setze({ ...wert, [k]: e.target.value })} placeholder={beispiel} style={eingabe} />}
    </Feldzeile>
  );
  return (
    <div style={{ display: 'grid', gap: ABSTAND.m }}>
      {teil('ziel', 'Ziel', 'z. B. Drei Entwürfe für das Nachfassen vorbereiten', 2)}
      {teil('format', 'Format (optional)', 'z. B. Betreff + 120 Wörter je Entwurf')}
      {teil('grenzen', 'Grenzen (optional)', 'z. B. nichts senden, nur Vorschläge')}
      {teil('quellen', 'Quellen (optional)', 'z. B. Deal-Verlauf, letzte Aktivitäten')}
    </div>
  );
}

// ── Auftrag · an mehrere Heads · Hintergrundaufgabe ─────────────────────────────────────────────────────────────────────

export function AuftragDialog({ art, start, onZu }: { art: 'auftrag' | 'mehrere' | 'hintergrund'; start?: AgentRef; onZu: () => void }) {
  const w = useAgenten();
  const heads = sichtbareHeads(w).filter(h => h.aktiv);
  const [agent, setAgent] = useState<AgentRef | null>(start && start.art !== 'zoe' ? start : null);
  const [mehrere, setMehrere] = useState<string[]>([]);
  const [d, setD] = useState<Delegation>({});
  const [titel, setTitel] = useState('');
  const [wann, setWann] = useState<'jetzt' | 'einmalig' | 'wiederkehrend'>('jetzt');
  const [einmalig, setEinmalig] = useState('');
  const [rhythmus, setRhythmus] = useState<Rhythmus>('werktags');
  const [uhrzeit, setUhrzeit] = useState('08:00');
  const [tage, setTage] = useState<string[]>(['1']);
  const [grenze, setGrenze] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [ergebnisse, setErgebnisse] = useState<{ head: string; ok: boolean; text: string; fadenId?: string }[]>([]);

  const cent = centAus(grenze);
  const text = auftragText(d);
  const ziel = art === 'mehrere' ? mehrere.length > 0 : !!agent;
  const zeitplan: Zeitplan | null = wann === 'einmalig' ? (einmalig ? { art: 'einmalig', wann: `${einmalig}:00`.slice(0, 19) } : null)
    : wann === 'wiederkehrend' ? { art: 'wiederkehrend', rhythmus, uhrzeit, ...(rhythmus === 'woechentlich' || rhythmus === 'monatlich' ? { tage: tage.map(Number) } : {}) } : null;
  const fehler = [
    ...(!ziel ? [art === 'mehrere' ? 'Wähle mindestens einen Head.' : 'Wähle, wer den Auftrag bekommt.'] : []),
    ...(!d.ziel?.trim() ? ['Das Ziel fehlt.'] : []),
    ...(text.length > GRENZEN.auftragZeichen ? [`Der Auftrag ist länger als ${GRENZEN.auftragZeichen.toLocaleString('de-DE')} Zeichen.`] : []),
    ...(Number.isNaN(cent) ? ['Die Kostengrenze ist kein gültiger Betrag (z. B. 0,50).'] : []),
    ...(art === 'hintergrund' && wann !== 'jetzt' && !titel.trim() ? ['Eine geplante Aufgabe braucht einen Titel.'] : []),
    ...(art === 'hintergrund' && wann === 'einmalig' && !einmalig ? ['Wähle Tag und Uhrzeit.'] : []),
    ...(art === 'hintergrund' && wann === 'wiederkehrend' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(uhrzeit) ? ['Die Uhrzeit hat die Form „HH:MM“.'] : []),
  ];
  const vorschau = wann === 'wiederkehrend' ? naechsterLaufText({ art: 'zeitplan', rhythmus, uhrzeit, ...(zeitplan && 'tage' in zeitplan && zeitplan.tage ? { tage: zeitplan.tage } : {}) }, w.jetzt) : null;

  const los = async () => {
    if (fehler.length) return;
    setMeldung(null);
    if (art === 'mehrere') {
      const raus: typeof ergebnisse = [];
      for (const id of mehrere) {
        const h = heads.find(x => x.id === id);
        const r = await fadenSenden({ aktion: 'senden', agent: { art: 'head', headId: id }, text, hintergrund: true, ...(cent ? { kostenGrenzeCent: cent } : {}), anfrageId: anfrageId() });
        raus.push(r.ok ? { head: h?.kurz ?? id, ok: true, text: 'gesendet', fadenId: r.daten.faden.id } : { head: h?.kurz ?? id, ok: false, text: r.kommt ? 'kommt mit dem Agenten-Kern' : r.text });
      }
      setErgebnisse(raus);
      if (raus.every(x => x.ok)) w.melde(`An ${raus.length} Heads gesendet.`, 'gut');
      return;
    }
    if (!agent) return;
    if (art === 'hintergrund' && wann !== 'jetzt' && zeitplan) {
      const id = anfrageId();
      const r = await mitRueckfrage(z => laeufeSenden({ aktion: 'planen', aufgabe: { agent, titel: titel.trim(), auftrag: text, zeitplan, ...(cent ? { kostenGrenzeCent: cent } : {}) }, anfrageId: z.kostenBestaetigt ? anfrageId() : id, ...(z.kostenBestaetigt ? { kostenBestaetigt: true } : {}) }), w.bestaetigen, 'Hintergrundaufgabe planen?');
      if (!r.ok) { if (r.text) setMeldung(ausErgebnis(r, 'Geplante Hintergrundaufgaben kommen mit dem nächsten Paket.')); return; }
      w.melde(`„${titel.trim()}“ ist geplant.`, 'gut');
      onZu();
      return;
    }
    const r = await fadenSenden({ aktion: 'senden', agent, text, ...(art === 'hintergrund' ? { hintergrund: true } : {}), ...(cent ? { kostenGrenzeCent: cent } : {}), anfrageId: anfrageId() });
    if (!r.ok) { setMeldung(ausErgebnis(r, 'Aufträge an Heads und Mitarbeiter kommen mit dem Agenten-Kern.')); return; }
    w.melde(art === 'hintergrund' ? 'Läuft im Hintergrund.' : 'Auftrag gesendet.', 'gut');
    onZu();
    w.oeffne(agent.art === 'head' ? { h: agent.headId, f: r.daten.faden.id } : { f: r.daten.faden.id });
  };

  const titelText = art === 'mehrere' ? 'Auftrag an mehrere Heads' : art === 'hintergrund' ? 'Neue Hintergrundaufgabe' : 'Neuer Auftrag';
  return (
    <Fenster titel={titelText} onZu={onZu} breit={640}>
      {!heads.length && <Hinweis art="info">Heads erscheinen, sobald der Agenten-Kern läuft. An ZOE schreibst du direkt unten im Chat.</Hinweis>}
      {art === 'mehrere'
        ? <Feldzeile label="An welche Heads"><MehrfachPillen liste={heads.map(h => ({ id: h.id, label: h.kurz }))} aktiv={mehrere} onWahl={setMehrere} /></Feldzeile>
        : <AgentWahl wert={agent} onWahl={setAgent} heads={heads} />}
      {art === 'hintergrund' && (
        <>
          <Feldzeile label="Wann"><Segmente liste={[{ id: 'jetzt', label: 'Jetzt' }, { id: 'einmalig', label: 'Einmal geplant' }, { id: 'wiederkehrend', label: 'Wiederkehrend' }]} aktiv={wann} onWahl={setWann} /></Feldzeile>
          {wann !== 'jetzt' && <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} placeholder="z. B. Wochenbericht" style={eingabe} /></Feldzeile>}
          {wann === 'einmalig' && <Feldzeile label="Tag und Uhrzeit"><input type="datetime-local" value={einmalig} onChange={e => setEinmalig(e.target.value)} style={eingabe} /></Feldzeile>}
          {wann === 'wiederkehrend' && (
            <div style={{ display: 'grid', gap: ABSTAND.m }}>
              <Feldzeile label="Rhythmus"><Pillen liste={RHYTHMEN} aktiv={rhythmus} onWahl={setRhythmus} /></Feldzeile>
              {rhythmus === 'woechentlich' && <Feldzeile label="An diesen Tagen"><MehrfachPillen liste={TAGE} aktiv={tage} onWahl={setTage} /></Feldzeile>}
              {rhythmus === 'monatlich' && <Feldzeile label="Am Monatstag"><input inputMode="numeric" value={tage[0] ?? '1'} onChange={e => setTage([e.target.value.replace(/\D/g, '').slice(0, 2) || '1'])} style={eingabe} /></Feldzeile>}
              <Feldzeile label="Uhrzeit"><input type="time" value={uhrzeit} onChange={e => setUhrzeit(e.target.value)} style={eingabe} /></Feldzeile>
              {vorschau && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Läuft effektiv {ausloeserText({ art: 'zeitplan', rhythmus, uhrzeit, tage: tage.map(Number) })} — {vorschau}.</span>}
            </div>
          )}
        </>
      )}
      <AuftragFelder wert={d} setze={setD} />
      {art !== 'auftrag' && (
        <Feldzeile label="Kostengrenze je Auftrag in Euro (optional)"><input inputMode="decimal" value={grenze} onChange={e => setGrenze(e.target.value)} placeholder="z. B. 0,50" style={eingabe} /></Feldzeile>
      )}
      {art === 'mehrere' && mehrere.length > 0 && (
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Je Head ein Thread, alle laufen im Hintergrund{cent ? ` · höchstens ${euro(cent)} je Head` : ''}. Ergebnisse kommen als Bericht zurück.</span>
      )}
      {ergebnisse.length > 0 && (
        <Liste>{ergebnisse.map(e => <Zeile key={e.head} titel={e.head} unter={e.text} rechts={<Chip farbe={e.ok ? LEUCHT.gut : C.inkDim}>{e.ok ? 'gesendet' : 'nicht gesendet'}</Chip>} onClick={e.fadenId ? () => { onZu(); w.oeffne({ f: e.fadenId }); } : undefined} />)}</Liste>
      )}
      <Fehlerliste fehler={d.ziel || ziel ? fehler : []} />
      <Rueckmeldung r={meldung} />
      <div style={{ display: 'flex', gap: ABSTAND.s, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        <Knopf haupt aus={fehler.length > 0} onClick={los}>{art === 'hintergrund' && wann !== 'jetzt' ? 'Planen' : art === 'hintergrund' ? 'Im Hintergrund starten' : 'Senden'}</Knopf>
      </div>
    </Fenster>
  );
}

// ── Neuer Mitarbeiter ───────────────────────────────────────────────────────────────────────────────────────────────────

interface MaEntwurf { headId: string; name: string; rolle: string; anleitung: string; werkzeuge: string[]; auchFuer: string[]; stufe: ModelTier }

export function MitarbeiterDialog({ headId, vorlage, onZu }: { headId?: string; vorlage?: Partial<Mitarbeiter>; onZu: () => void }) {
  const w = useAgenten();
  const heads = sichtbareHeads(w);
  const [schritt, setSchritt] = useState(vorlage ? 1 : 0);
  const [weg, setWeg] = useState<'vorlage' | 'beschreiben'>('vorlage');
  const [beschreibung, setBeschreibung] = useState('');
  const [e, setE] = useState<MaEntwurf>({
    headId: headId ?? vorlage?.headId ?? heads[0]?.id ?? '', name: vorlage?.name ?? '', rolle: vorlage?.rolle ?? '', anleitung: vorlage?.anleitung ?? '',
    werkzeuge: vorlage?.werkzeuge ? [...vorlage.werkzeuge] : [], auchFuer: vorlage?.auchFuer ? [...vorlage.auchFuer] : [], stufe: vorlage?.stufe ?? 'schnell',
  });
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [probe, setProbe] = useState<string | null>(null);
  const def = headDef(e.headId);
  const head = heads.find(h => h.id === e.headId);
  const nachbarn = heads.filter(h => h.id !== e.headId && h.bereich === head?.bereich);
  /** Probelauf ohne Wirkung (Paket 4b): eine Testeingabe, ein Lauf ohne Werkzeuge — das Ergebnis steht in einem eigenen Thread. */
  const probelauf = async (bestaetigt = false) => {
    if (!probe?.trim()) { setMeldung({ art: 'info', text: 'Schreib eine Testeingabe — z. B. einen typischen Auftrag.' }); return; }
    const r = await skillSenden({ aktion: 'mitarbeiter-probelauf', headId: e.headId, ...(vorlage?.id && vorlage.name === e.name ? { id: vorlage.id } : { entwurf: { name: e.name.trim(), rolle: e.rolle.trim(), anleitung: e.anleitung.trim() || undefined, werkzeuge: e.werkzeuge, stufe: e.stufe } }), eingabe: probe.trim(), ...(bestaetigt ? { kostenBestaetigt: true } : {}) });
    if (!r.ok) {
      const d = r.daten as { kostenBestaetigen?: boolean } | undefined;
      if (r.status === 409 && d?.kostenBestaetigen && await w.bestaetigen({ titel: 'Probelauf starten?', text: r.text, ja: 'Starten' })) { void probelauf(true); return; }
      setMeldung(ausErgebnis(r, 'Der Probelauf kommt mit dem nächsten Paket.'));
      return;
    }
    const fadenId = (r.daten as { fadenId?: string }).fadenId;
    w.melde('Probelauf fertig — das Ergebnis steht im Thread. Nichts wurde gespeichert oder gesendet.', 'gut');
    if (fadenId) { onZu(); w.oeffne({ f: fadenId }); }
  };
  const vorlagen = e.headId ? vorlagenFuer(e.headId) : [];
  const fehler = [
    ...(!e.headId ? ['Wähle den Head, zu dem der Mitarbeiter gehört.'] : []),
    ...(!e.name.trim() ? ['Der Mitarbeiter braucht einen Namen.'] : []),
    ...(!e.rolle.trim() ? ['Die Rolle fehlt — ein Satz, was er tut.'] : []),
    ...(e.anleitung.length > GRENZEN.mitarbeiterAnleitung ? [`Die Anleitung ist länger als ${GRENZEN.mitarbeiterAnleitung.toLocaleString('de-DE')} Zeichen.`] : []),
  ];
  const ausBeschreibung = () => {
    const satz = beschreibung.trim().split(/(?<=[.!?])\s/)[0] ?? '';
    const name = satz.split(/\s+/).slice(0, 3).join(' ').replace(/[.,!?:;]+$/, '');
    setE(x => ({ ...x, name: x.name || (name ? name[0].toUpperCase() + name.slice(1) : ''), rolle: x.rolle || satz, anleitung: x.anleitung || beschreibung.trim() }));
    setSchritt(1);
  };
  const anlegen = async () => {
    if (fehler.length) return;
    const r = await skillSenden({ aktion: 'mitarbeiter-anlegen', headId: e.headId, mitarbeiter: { name: e.name.trim(), rolle: e.rolle.trim(), anleitung: e.anleitung.trim() || undefined, werkzeuge: e.werkzeuge, auchFuer: e.auchFuer, stufe: e.stufe }, anfrageId: anfrageId() });
    if (!r.ok) { setMeldung(ausErgebnis(r, 'Eigene Mitarbeiter anlegen kommt mit dem nächsten Paket — dein Entwurf bleibt hier stehen.')); return; }
    w.melde(`${e.name.trim()} ist angelegt.`, 'gut');
    onZu();
  };
  return (
    <Fenster titel={vorlage ? 'Mitarbeiter duplizieren' : 'Neuer Mitarbeiter'} onZu={onZu} breit={680}>
      <Schritte punkte={['Weg', 'Rückfragen', 'Plan bestätigen']} nr={schritt} />
      {schritt === 0 && (
        <div style={{ display: 'grid', gap: ABSTAND.m }}>
          <Feldzeile label="Für welchen Head">
            <select value={e.headId} onChange={x => setE({ ...e, headId: x.target.value, werkzeuge: [], auchFuer: [] })} style={{ ...auswahl, width: '100%', minHeight: ZIEL.handy }}>
              <option value="" disabled>Head wählen …</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Feldzeile>
          <Segmente liste={[{ id: 'vorlage', label: 'Aus Vorlage' }, { id: 'beschreiben', label: 'Beschreiben' }]} aktiv={weg} onWahl={setWeg} />
          {weg === 'vorlage' ? (
            vorlagen.length ? (
              <Liste>
                {vorlagen.map(v => (
                  <Zeile key={v.vorlage.id} titel={v.vorlage.name} unter={`${v.vorlage.rolle}${v.aushilfe ? ' · hilft aus einem anderen Head aus' : ''}`} umbrechen
                    onClick={() => { setE({ ...e, name: v.vorlage.name, rolle: v.vorlage.rolle, werkzeuge: [...v.vorlage.werkzeuge], auchFuer: [...(v.vorlage.auchFuer ?? [])], stufe: v.vorlage.stufe }); setSchritt(1); }} />
                ))}
              </Liste>
            ) : <Leer>{e.headId ? 'Für diesen Head gibt es keine Vorlage — beschreib, was er tun soll.' : 'Wähle zuerst einen Head.'}</Leer>
          ) : (
            <>
              <Feldzeile label="Was soll er tun?">
                <textarea value={beschreibung} onChange={x => setBeschreibung(x.target.value)} rows={5} style={{ ...eingabe, resize: 'vertical' }}
                  placeholder="z. B. Bittet zufriedene Kunden nach Projektende um eine Empfehlung — nur als Entwurf, nie selbst senden." />
              </Feldzeile>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Knopf haupt aus={!beschreibung.trim() || !e.headId} onClick={ausBeschreibung}>Weiter</Knopf></div>
            </>
          )}
        </div>
      )}
      {schritt === 1 && (
        <div style={{ display: 'grid', gap: ABSTAND.m }}>
          <Feldzeile label="Name"><input value={e.name} onChange={x => setE({ ...e, name: x.target.value })} style={eingabe} /></Feldzeile>
          <Feldzeile label="Rolle in einem Satz"><input value={e.rolle} onChange={x => setE({ ...e, rolle: x.target.value })} style={eingabe} /></Feldzeile>
          <Feldzeile label="Anleitung (optional)"><textarea value={e.anleitung} onChange={x => setE({ ...e, anleitung: x.target.value })} rows={4} style={{ ...eingabe, resize: 'vertical' }} placeholder="Wie er arbeitet, was er nie tut, Beispiele …" /></Feldzeile>
          <Feldzeile label="Welche Werkzeuge darf er nutzen (nur die seines Heads)?">
            {def ? <MehrfachPillen liste={def.werkzeuge.map(x => ({ id: x, label: x }))} aktiv={e.werkzeuge} onWahl={x => setE({ ...e, werkzeuge: x })} /> : <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>—</span>}
          </Feldzeile>
          {nachbarn.length > 0 && <Feldzeile label="Hilft auch (nur Heads desselben Bereichs)"><MehrfachPillen liste={nachbarn.map(h => ({ id: h.id, label: h.kurz }))} aktiv={e.auchFuer} onWahl={x => setE({ ...e, auchFuer: x })} /></Feldzeile>}
          <Feldzeile label="Modell"><Segmente liste={STUFEN} aktiv={e.stufe} onWahl={x => setE({ ...e, stufe: x })} /></Feldzeile>
          <Fehlerliste fehler={fehler} />
          <div style={{ display: 'flex', gap: ABSTAND.s, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {!vorlage && <Knopf leise onClick={() => setSchritt(0)}>Zurück</Knopf>}
            <Knopf haupt aus={fehler.length > 0} onClick={() => setSchritt(2)}>Plan ansehen</Knopf>
          </div>
        </div>
      )}
      {schritt === 2 && (
        <div style={{ display: 'grid', gap: ABSTAND.m }}>
          <span style={{ fontSize: TYP.body, color: C.inkDim }}>So würde ich ihn anlegen — erst dein Klick legt ihn an.</span>
          <div style={{ display: 'grid', gap: ABSTAND.xs }}>
            <Eigenschaft label="Head">{head?.name ?? e.headId}</Eigenschaft>
            <Eigenschaft label="Name">{e.name}</Eigenschaft>
            <Eigenschaft label="Rolle">{e.rolle}</Eigenschaft>
            <Eigenschaft label="Werkzeuge">{e.werkzeuge.length ? e.werkzeuge.join(', ') : 'keine — nur lesen, was im Auftrag steht'}</Eigenschaft>
            <Eigenschaft label="Hilft auch">{e.auchFuer.length ? e.auchFuer.map(id => heads.find(h => h.id === id)?.kurz ?? id).join(', ') : '—'}</Eigenschaft>
            <Eigenschaft label="Modell">{MODEL_LABEL[e.stufe]}</Eigenschaft>
            <Eigenschaft label="Delegiert">nie weiter (ZOE → Head → Mitarbeiter)</Eigenschaft>
          </div>
          <Rueckmeldung r={meldung} />
          <div style={{ display: 'flex', gap: ABSTAND.s, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setSchritt(1)}>Ändern</Knopf>
            <Knopf leise onClick={() => setProbe(x => (x === null ? '' : null))}>Probelauf</Knopf>
            <Knopf haupt onClick={anlegen}>Anlegen</Knopf>
          </div>
          {probe !== null && (
            <form onSubmit={x => { x.preventDefault(); void probelauf(); }} style={{ display: 'grid', gap: ABSTAND.s }}>
              <Feldzeile label="Testeingabe (ohne Wirkung — Werkzeuge werden nur genannt)">
                <textarea value={probe} onChange={x => setProbe(x.target.value)} rows={3} style={{ ...eingabe, resize: 'vertical' }} placeholder="z. B. Ein typischer Auftrag, wie ihn der Head schicken würde" />
              </Feldzeile>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Knopf typ="submit" aus={!probe.trim()}>Probelauf starten</Knopf></div>
            </form>
          )}
        </div>
      )}
    </Fenster>
  );
}

// ── Skill-Editor ────────────────────────────────────────────────────────────────────────────────────────────────────────

const EREIGNISSE = (Object.keys(EREIGNIS_NAME) as SkillEreignis[]).map(x => ({ id: x, label: EREIGNIS_NAME[x] }));
const FELD_ARTEN: { id: SkillEingabeFeld['art']; label: string }[] = [
  { id: 'text', label: 'Text' }, { id: 'zahl', label: 'Zahl' }, { id: 'datum', label: 'Datum' }, { id: 'auswahl', label: 'Auswahl' }, { id: 'kontakt', label: 'Kontakt' }, { id: 'firma', label: 'Firma' },
];

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return <section style={{ display: 'grid', gap: ABSTAND.s }}><span style={{ ...MIKRO }}>{titel}</span>{children}</section>;
}

export function SkillEditor({ headId, skillId, start, onZu }: { headId?: string; skillId?: string; start?: Partial<SkillEntwurf>; onZu: () => void }) {
  const w = useAgenten();
  const heads = sichtbareHeads(w);
  const eingebaut: SkillKurz | undefined = skillId?.startsWith('eingebaut:') ? heads.flatMap(h => h.skills).find(s => s.id === skillId) : undefined;
  const [e, setE] = useState<SkillEntwurf>(() => leererSkill(headId ?? heads[0]?.id ?? '', start));
  const [id, setId] = useState<string | null>(skillId && !eingebaut ? skillId : null);
  const [stand, setStand] = useState<string | null>(null);
  const [geladen, setGeladen] = useState<Skill | null>(null);
  const [ansicht, setAnsicht] = useState<'bauen' | 'testen'>('bauen');
  const [grenze, setGrenze] = useState(start?.kostenGrenzeCent != null ? euroFeld(start.kostenGrenzeCent) : '');
  const [importText, setImportText] = useState('');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const def = headDef(e.headId);

  useEffect(() => {
    if (!skillId || eingebaut) return;
    let lebt = true;
    void ladeSkill(skillId).then(a => {
      if (!lebt) return;
      if (a.zustand === 'da') {
        const s = a.daten.skill;
        setGeladen(s); setStand(a.daten.stand);
        setE({ headId: s.headId, mitarbeiterId: s.mitarbeiterId, name: s.name, beschreibung: s.beschreibung, anleitung: s.anleitung, beispiele: s.beispiele ?? [], werkzeuge: s.werkzeuge,
          ausloeser: s.ausloeser, eingabeFelder: s.eingabeFelder, freigabePflicht: s.freigabePflicht, ergebnis: s.ergebnis, stufe: s.stufe, kostenGrenzeCent: s.kostenGrenzeCent, tests: s.tests, quelle: s.quelle });
        if (s.kostenGrenzeCent != null) setGrenze(euroFeld(s.kostenGrenzeCent));
      } else setMeldung({ art: a.zustand === 'kommt' ? 'info' : 'kritisch', text: a.zustand === 'kommt' ? 'Skills laden kommt mit dem nächsten Paket.' : 'text' in a ? a.text : '' });
    });
    return () => { lebt = false; };
  }, [skillId, eingebaut]);

  const cent = centAus(grenze);
  const entwurf: SkillEntwurf = { ...e, ...(cent != null && !Number.isNaN(cent) ? { kostenGrenzeCent: cent } : { kostenGrenzeCent: undefined }) };
  const fehler = [...skillPruefen(entwurf, def?.werkzeuge ?? []), ...(Number.isNaN(cent) ? ['Die Kostengrenze ist kein gültiger Betrag (z. B. 0,50).'] : [])];
  const zeitplanText = e.ausloeser.art === 'zeitplan' ? naechsterLaufText(e.ausloeser, w.jetzt) : null;
  const aktivFehlt = aktivierenFehlt(e.tests.length, geladen?.testlauf?.ok);

  if (eingebaut) {
    return (
      <Fenster titel={`/${eingebaut.name}`} onZu={onZu} breit={600}>
        <Hinweis art="info" titel="Eingebauter Skill">Eingebaute Skills sind die bewährten Abläufe des Heads — sichtbar, aber nicht änderbar. Eine eigene Fassung legst du als neuen Skill an.</Hinweis>
        <Eigenschaft label="Beschreibung">{eingebaut.beschreibung}</Eigenschaft>
        <Eigenschaft label="Auslöser">{ausloeserText(eingebaut.ausloeser)}</Eigenschaft>
        <Eigenschaft label="Zustand">{eingebaut.aktiv ? 'an' : 'aus'}</Eigenschaft>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: ABSTAND.s }}>
          <Knopf leise onClick={onZu}>Schließen</Knopf>
          <Knopf haupt onClick={() => { w.dialog({ art: 'skill', headId: eingebaut.headId, entwurf: { name: `${eingebaut.name}-eigen`, beschreibung: eingebaut.beschreibung, ausloeser: eingebaut.ausloeser } }); }}>Eigene Fassung anlegen</Knopf>
        </div>
      </Fenster>
    );
  }

  const speichern = async () => {
    if (fehler.length) return;
    setMeldung(null);
    const { headId: h, ...rest } = entwurf;
    const r = id && stand
      ? await skillSenden({ aktion: 'aendern', id, teil: { ...rest, headId: h } as Partial<Skill>, stand })
      : await skillSenden({ aktion: 'anlegen', skill: { headId: h, ...rest, beispiele: rest.beispiele }, anfrageId: anfrageId() });
    if (!r.ok) { setMeldung(r.status === 409 ? { art: 'kritisch', text: 'Der Skill wurde inzwischen geändert — bitte neu öffnen. Deine Fassung steht noch hier.' } : ausErgebnis(r, 'Skills speichern kommt mit dem nächsten Paket — dein Entwurf bleibt hier stehen.')); return; }
    if (r.daten.skill) { setId(r.daten.skill.id); setGeladen(r.daten.skill); }
    if (r.daten.stand) setStand(r.daten.stand);
    setMeldung({ art: 'gut', text: 'Gespeichert. Einschalten geht nach bestandenem Testlauf.' });
  };
  const testlauf = async () => {
    if (!id) { setMeldung({ art: 'info', text: 'Erst speichern — der Testlauf prüft die gespeicherte Fassung, ohne Wirkung.' }); return; }
    // Über der Kostenschwelle fragt der Server nach (409 `kostenBestaetigen`) — dann mit Bestätigung erneut (Gegenprüfung 09.10.).
    const r = await mitRueckfrage(z => skillSenden({ aktion: 'testlauf', id, ...(z.kostenBestaetigt ? { kostenBestaetigt: true } : {}) }), w.bestaetigen, 'Testlauf starten?');
    if (!r.ok) { if (r.text) setMeldung(ausErgebnis(r, 'Der Testlauf kommt mit dem nächsten Paket.')); return; }
    if (r.daten.skill) setGeladen(r.daten.skill);
    if (r.daten.stand) setStand(r.daten.stand);
    setMeldung({ art: r.daten.skill?.testlauf?.ok ? 'gut' : 'info', text: r.daten.skill?.testlauf?.ok ? 'Testlauf bestanden.' : 'Testlauf beendet — sieh dir die Ergebnisse an.' });
  };
  const schalten = async (an: boolean) => {
    if (!id || !stand) return;
    const r = await skillSenden({ aktion: an ? 'aktivieren' : 'deaktivieren', id, stand });
    if (!r.ok) { setMeldung(ausErgebnis(r, 'Einschalten kommt mit dem nächsten Paket.')); return; }
    if (r.daten.skill) setGeladen(r.daten.skill);
    if (r.daten.stand) setStand(r.daten.stand);
    w.melde(an ? `/${e.name} ist an.` : `/${e.name} ist aus.`, 'gut');
  };
  const importieren = async () => {
    if (!importText.trim() || !e.headId) return;
    const r = await skillSenden({ aktion: 'import', headId: e.headId, skillMd: importText });
    if (!r.ok) { setMeldung(ausErgebnis(r, 'Der Import von SKILL.md kommt mit dem nächsten Paket.')); return; }
    if (r.daten.skill) { setId(r.daten.skill.id); setGeladen(r.daten.skill); setE(x => ({ ...x, ...r.daten.skill, beispiele: r.daten.skill?.beispiele ?? [] } as SkillEntwurf)); }
    if (r.daten.stand) setStand(r.daten.stand);
    setMeldung({ art: 'gut', text: 'Als Entwurf übernommen — nichts davon ist ausführbar, bis du es prüfst und einschaltest.' });
  };
  const setzeAusloeser = (a: SkillAusloeser) => setE({ ...e, ausloeser: a });

  return (
    <Fenster titel={id ? `Skill /${e.name || '…'}` : 'Neuer Skill'} onZu={onZu} breit={760}>
      <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s, flexWrap: 'wrap' }}>
        <Segmente liste={[{ id: 'bauen', label: 'Bauen' }, { id: 'testen', label: `Testen (${e.tests.length})` }]} aktiv={ansicht} onWahl={setAnsicht} />
        <span style={{ flex: 1 }} />
        {geladen && <Chip farbe={geladen.aktiv ? LEUCHT.gut : C.inkDim}>{geladen.aktiv ? 'an' : 'aus'} · Version {geladen.version}</Chip>}
        {e.quelle === 'gespraech' && <Chip farbe={C.aktiv}>aus dem Chat</Chip>}
        {geladen?.ausFremdemText && <Chip farbe={LEUCHT.achtung}>aus fremdem Text — im Prompt gekapselt</Chip>}
      </div>

      {ansicht === 'bauen' && (
        <div style={{ display: 'grid', gap: ABSTAND.l }}>
          <Feldzeile label="Head">
            <select value={e.headId} onChange={x => setE({ ...e, headId: x.target.value, werkzeuge: [] })} disabled={!!id} style={{ ...auswahl, width: '100%', minHeight: ZIEL.handy }}>
              <option value="" disabled>Head wählen …</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Feldzeile>
          <Feldzeile label={`Name (Kleinbuchstaben und Bindestriche, ≤ ${GRENZEN.skillName})`}>
            <input value={e.name} onChange={x => setE({ ...e, name: x.target.value })} onBlur={() => setE(v => ({ ...v, name: skillName(v.name) }))} placeholder="z. B. angebot-nachfassen" style={{ ...eingabe, fontFamily: SCHRIFT.mono }} />
          </Feldzeile>
          <Feldzeile label="Beschreibung — was er tut und wann er gebraucht wird">
            <textarea value={e.beschreibung} onChange={x => setE({ ...e, beschreibung: x.target.value })} rows={2} style={{ ...eingabe, resize: 'vertical' }} placeholder="Fasst gestellte Angebote nach drei Werktagen nach, wenn keine Antwort da ist." />
          </Feldzeile>
          <Feldzeile label={`Anleitung (${e.anleitung.length.toLocaleString('de-DE')} / ${GRENZEN.skillAnleitung.toLocaleString('de-DE')} Zeichen)`}>
            <textarea value={e.anleitung} onChange={x => setE({ ...e, anleitung: x.target.value })} rows={8} style={{ ...eingabe, resize: 'vertical', fontFamily: SCHRIFT.mono }} placeholder={'1. …\n2. …\nNie: …'} />
          </Feldzeile>
          <Abschnitt titel="Beispiele (gut / Ergebnis)">
            {e.beispiele.map((b, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: ABSTAND.s, alignItems: 'center' }}>
                <input value={b.eingabe} onChange={x => setE({ ...e, beispiele: e.beispiele.map((y, j) => (j === i ? { ...y, eingabe: x.target.value } : y)) })} placeholder="Eingabe" aria-label={`Beispiel ${i + 1}: Eingabe`} style={feld} />
                <input value={b.ergebnis} onChange={x => setE({ ...e, beispiele: e.beispiele.map((y, j) => (j === i ? { ...y, ergebnis: x.target.value } : y)) })} placeholder="Ergebnis" aria-label={`Beispiel ${i + 1}: Ergebnis`} style={feld} />
                <SymbolKnopf ariaLabel={`Beispiel ${i + 1} entfernen`} gefahr onClick={() => setE({ ...e, beispiele: e.beispiele.filter((_, j) => j !== i) })}>×</SymbolKnopf>
              </div>
            ))}
            <div><Knopf leise onClick={() => setE({ ...e, beispiele: [...e.beispiele, { eingabe: '', ergebnis: '' }] })}>+ Beispiel</Knopf></div>
          </Abschnitt>
          <Abschnitt titel="Werkzeuge (nur die des Heads — die Freigabe-Stufe bleibt die des Werkzeugs)">
            {def ? <MehrfachPillen liste={def.werkzeuge.map(x => ({ id: x, label: x }))} aktiv={e.werkzeuge} onWahl={x => setE({ ...e, werkzeuge: x })} /> : <Leer>Wähle zuerst einen Head.</Leer>}
          </Abschnitt>
          <Abschnitt titel="Auslöser">
            <Segmente liste={[{ id: 'hand', label: 'Von Hand' }, { id: 'zeitplan', label: 'Zeitplan' }, { id: 'ereignis', label: 'Ereignis' }]} aktiv={e.ausloeser.art}
              onWahl={a => setzeAusloeser(a === 'hand' ? { art: 'hand' } : a === 'zeitplan' ? { art: 'zeitplan', rhythmus: 'werktags', uhrzeit: '08:00' } : { art: 'ereignis', ereignis: 'neue-mail' })} />
            {e.ausloeser.art === 'zeitplan' && (() => {
              const a = e.ausloeser;
              return (
                <div style={{ display: 'grid', gap: ABSTAND.s }}>
                  <Pillen liste={RHYTHMEN} aktiv={a.rhythmus} onWahl={r => setzeAusloeser({ ...a, rhythmus: r, ...(r === 'woechentlich' ? { tage: a.tage ?? [1] } : r === 'monatlich' ? { tage: [1] } : { tage: undefined }) })} />
                  {a.rhythmus === 'woechentlich' && <MehrfachPillen liste={TAGE} aktiv={(a.tage ?? []).map(String)} onWahl={t => setzeAusloeser({ ...a, tage: t.map(Number).sort() })} />}
                  {a.rhythmus === 'monatlich' && <Feldzeile label="Am Monatstag"><input inputMode="numeric" value={String(a.tage?.[0] ?? 1)} onChange={x => setzeAusloeser({ ...a, tage: [Math.min(31, Math.max(1, Number(x.target.value.replace(/\D/g, '')) || 1))] })} style={eingabe} /></Feldzeile>}
                  <Feldzeile label="Uhrzeit"><input type="time" value={a.uhrzeit} onChange={x => setzeAusloeser({ ...a, uhrzeit: x.target.value })} style={eingabe} /></Feldzeile>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Läuft effektiv {ausloeserText(a)}{zeitplanText ? ` — ${zeitplanText}` : ''}.</span>
                </div>
              );
            })()}
            {e.ausloeser.art === 'ereignis' && (() => {
              const a = e.ausloeser;
              return (
                <div style={{ display: 'grid', gap: ABSTAND.s }}>
                  <Pillen liste={EREIGNISSE} aktiv={a.ereignis} onWahl={x => setzeAusloeser({ ...a, ereignis: x })} />
                  {/* Durchstich 09.10.: kein Takt und keine Quelle stößt Ereignis-Skills bisher an — ehrlich sagen statt still nie laufen. */}
                  <Hinweis art="info">{EREIGNIS_NOCH_NICHT}</Hinweis>
                  <Feldzeile label="Nur wenn … (optional, als Satz)"><input value={a.filter ?? ''} onChange={x => setzeAusloeser({ ...a, filter: x.target.value || undefined })} placeholder="z. B. nur Leads aus Events" style={eingabe} /></Feldzeile>
                </div>
              );
            })()}
          </Abschnitt>
          <Abschnitt titel="Eingabe-Felder (was der Skill beim Start fragt)">
            {e.eingabeFelder.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto auto', gap: ABSTAND.s, alignItems: 'center' }}>
                <input value={f.label} onChange={x => setE({ ...e, eingabeFelder: e.eingabeFelder.map((y, j) => (j === i ? { ...y, label: x.target.value, id: skillName(x.target.value) || y.id } : y)) })} placeholder="Beschriftung" aria-label={`Feld ${i + 1}: Beschriftung`} style={feld} />
                <select value={f.art} onChange={x => setE({ ...e, eingabeFelder: e.eingabeFelder.map((y, j) => (j === i ? { ...y, art: x.target.value as SkillEingabeFeld['art'] } : y)) })} aria-label={`Feld ${i + 1}: Art`} style={{ ...auswahl, minHeight: ZIEL.handy }}>
                  {FELD_ARTEN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <Schalter an={!!f.pflicht} onChange={v => setE({ ...e, eingabeFelder: e.eingabeFelder.map((y, j) => (j === i ? { ...y, pflicht: v } : y)) })} ariaLabel={`Feld ${i + 1}: Pflicht`} />
                <SymbolKnopf ariaLabel={`Feld ${i + 1} entfernen`} gefahr onClick={() => setE({ ...e, eingabeFelder: e.eingabeFelder.filter((_, j) => j !== i) })}>×</SymbolKnopf>
              </div>
            ))}
            <div><Knopf leise onClick={() => setE({ ...e, eingabeFelder: [...e.eingabeFelder, { id: `feld-${e.eingabeFelder.length + 1}`, label: '', art: 'text' }] })}>+ Feld</Knopf></div>
          </Abschnitt>
          <Abschnitt titel="Ergebnis und Freigabe">
            <Segmente liste={[{ id: 'stapel', label: 'Als Vorschlag in die Freigaben' }, { id: 'faden', label: 'Als Thread' }]} aktiv={e.ergebnis} onWahl={x => setE({ ...e, ergebnis: x })} umbrechen />
            <Schalter karte an={e.freigabePflicht} onChange={v => setE({ ...e, freigabePflicht: v })} beschreibung="Jede Wirkung geht als Vorschlag in die Freigaben — auch wenn das Werkzeug frei wäre. Lockern geht nie.">Freigabe-Pflicht</Schalter>
          </Abschnitt>
          <Abschnitt titel="Modell und Kosten">
            <Segmente liste={STUFEN} aktiv={e.stufe} onWahl={x => setE({ ...e, stufe: x })} />
            <Feldzeile label="Kostengrenze je Lauf in Euro (optional)"><input inputMode="decimal" value={grenze} onChange={x => setGrenze(x.target.value)} placeholder="z. B. 0,50" style={eingabe} /></Feldzeile>
          </Abschnitt>
          <details>
            <summary style={{ cursor: 'pointer', fontSize: TYP.bedien, color: C.inkDim, minHeight: ZIEL.handy, display: 'flex', alignItems: 'center' }}>SKILL.md importieren …</summary>
            <div style={{ display: 'grid', gap: ABSTAND.s, marginTop: ABSTAND.s }}>
              <textarea value={importText} onChange={x => setImportText(x.target.value)} rows={6} style={{ ...eingabe, resize: 'vertical', fontFamily: SCHRIFT.mono }} placeholder={'---\nname: …\ndescription: …\n---\nAnleitung …'} />
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Wird nur als Entwurf übernommen — Skripte werden nie ausgeführt.</span>
              <div><Knopf leise aus={!importText.trim() || !e.headId} onClick={importieren}>Als Entwurf übernehmen</Knopf></div>
            </div>
          </details>
        </div>
      )}

      {ansicht === 'testen' && (
        <div style={{ display: 'grid', gap: ABSTAND.l }}>
          <span style={{ fontSize: TYP.body, color: C.inkDim }}>Tests zuerst: mindestens {GRENZEN.skillTestsMin}, bevor der Skill eingeschaltet wird. Der Testlauf wirkt nicht und legt nichts ab.</span>
          {e.tests.map((t, i) => {
            const erg = geladen?.testlauf?.ergebnisse.find(x => x.test === i);
            return (
              <div key={i} style={{ display: 'grid', gap: ABSTAND.xs }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: ABSTAND.s }}>
                  <span style={{ ...MIKRO }}>Test {i + 1}</span>
                  {erg && <Chip farbe={erg.ok ? LEUCHT.gut : LEUCHT.kritisch}>{erg.ok ? 'bestanden' : 'nicht bestanden'}</Chip>}
                  <span style={{ flex: 1 }} />
                  <SymbolKnopf ariaLabel={`Test ${i + 1} entfernen`} gefahr onClick={() => setE({ ...e, tests: e.tests.filter((_, j) => j !== i) })}>×</SymbolKnopf>
                </div>
                <input value={t.eingabe} onChange={x => setE({ ...e, tests: e.tests.map((y, j) => (j === i ? { ...y, eingabe: x.target.value } : y)) })} placeholder="Ausgangslage, z. B. „Ein Angebot seit 9 Tagen offen“" aria-label={`Test ${i + 1}: Eingabe`} style={feld} />
                <input value={t.erwartet.join('; ')} onChange={x => setE({ ...e, tests: e.tests.map((y, j) => (j === i ? { ...y, erwartet: x.target.value.split(';').map(s => s.trim()) } : y)) })} placeholder="Erwartet (mit ; getrennt), z. B. „ein Entwurf; kein Versand“" aria-label={`Test ${i + 1}: Erwartet`} style={feld} />
                {erg?.notiz && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{erg.notiz}</span>}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: ABSTAND.s, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setE({ ...e, tests: [...e.tests, { eingabe: '', erwartet: [''] }] })}>+ Test</Knopf>
            <Knopf onClick={testlauf}>Testlauf starten</Knopf>
          </div>
          {geladen?.erfolg && geladen.erfolg.laeufe > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Erfolg bisher: {geladen.erfolg.angenommen} angenommen · {geladen.erfolg.abgelehnt} abgelehnt · {geladen.erfolg.fehler} Fehler in {geladen.erfolg.laeufe} Läufen.</span>}
        </div>
      )}

      <Fehlerliste fehler={e.name || e.beschreibung || e.anleitung ? fehler : []} />
      <Rueckmeldung r={meldung} />
      <div style={{ display: 'flex', gap: ABSTAND.s, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
        {id && aktivFehlt && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, flex: '1 1 240px' }}>{aktivFehlt}</span>}
        <Knopf leise onClick={onZu}>Schließen</Knopf>
        {id && geladen && (geladen.aktiv
          ? <Knopf leise onClick={() => schalten(false)}>Ausschalten</Knopf>
          : <Knopf leise aus={!!aktivFehlt} onClick={() => schalten(true)}>Einschalten</Knopf>)}
        <Knopf haupt aus={fehler.length > 0} onClick={speichern}>{id ? 'Speichern' : 'Anlegen'}</Knopf>
      </div>
    </Fenster>
  );
}

// ── Leitplanken · Geplant · Budget ──────────────────────────────────────────────────────────────────────────────────────

export function LeitplankenFenster({ onZu }: { onZu: () => void }) {
  const punkte: [string, string][] = [
    ['Nach außen', 'Nichts verlässt das System ohne deinen Klick — keine Mail, keine Nachricht, kein Angebot. Agenten bereiten vor, du entscheidest.'],
    ['Freigaben', 'Die Stufe kommt vom Werkzeug. Ein Head oder Skill kann sie nur verschärfen, nie lockern. Eine Nachricht eines Agenten ist nie eine Zustimmung.'],
    ['Daten', 'Jeder Head sieht nur die Daten seines Bereichs. Privat-Heads gehören dir; wer nur Business sieht, bekommt keine Privat-Heads. Gesundheit nur mit Einwilligung.'],
    ['Fremder Text', 'Liest ein Thread Web, Mails oder Notizen, gilt er ab dann als „nur Vorschlag“.'],
    ['Tiefe', `ZOE → Head → Mitarbeiter. Mitarbeiter delegieren nie weiter; höchstens ${GRENZEN.offeneLaeufeJePerson} Mitarbeiter-Läufe gleichzeitig, je Lauf höchstens ${GRENZEN.mitarbeiterRunden} Runden und ${GRENZEN.mitarbeiterWerkzeugAufrufe} Werkzeuge.`],
    ['Kosten', 'Euro statt Credits. Ohne Grenze wird nur gemessen. Grenze für alles je Monat oder gesamt (der Inhaber) und je Head; Glocke bei 80 % und 95 %, bei 100 % arbeiten die Läufe mit dem Regelwerk weiter bzw. der Head pausiert.'],
    ['Not-Aus', 'Für alle oder je Head: hält laufende Hintergrundläufe sofort an, Zeitpläne und Aufträge an Heads ruhen. Mit ZOE sprechen geht weiter.'],
    ['Business-frei', 'In Business-freien Zeiten ruhen alle Business-Agenten im Hintergrund.'],
  ];
  return (
    <Fenster titel="Leitplanken" onZu={onZu} breit={640}>
      <div style={{ display: 'grid', gap: ABSTAND.s }}>{punkte.map(([t, s]) => <Eigenschaft key={t} label={t}>{s}</Eigenschaft>)}</div>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Diese Regeln gelten auf dem Server — die Seite zeigt sie nur.</span>
    </Fenster>
  );
}

export function GeplantFenster({ onZu }: { onZu: () => void }) {
  const { laeufe, agenten, dialog, jetzt, melde, bestaetigen } = useAgenten();
  const staende = laeufe.zustand === 'da' ? laeufe.daten.planStaende ?? {} : {};
  /** Pausieren/Fortsetzen und Löschen mit dem Stand aus der letzten Antwort (Paket 4b) — 409 → neu laden. */
  const schalten = async (id: string, aktiv: boolean) => {
    const r = await laeufeSenden({ aktion: 'plan-aendern', id, teil: { aktiv }, stand: staende[id] ?? '' });
    if (r.ok) melde(aktiv ? 'Läuft wieder nach Plan.' : 'Pausiert.', 'gut'); else melde(r.status === 409 ? 'Inzwischen geändert — neu geladen, bitte noch einmal.' : r.text, 'kritisch');
  };
  const loeschen = async (id: string, titel: string) => {
    if (!(await bestaetigen({ titel: 'Geplante Aufgabe löschen?', text: `„${titel}“ läuft danach nicht mehr.`, ja: 'Löschen', gefahr: true }))) return;
    const r = await laeufeSenden({ aktion: 'plan-loeschen', id, stand: staende[id] ?? '' });
    if (r.ok) melde('Gelöscht.', 'gut'); else melde(r.status === 409 ? 'Inzwischen geändert — neu geladen, bitte noch einmal.' : r.text, 'kritisch');
  };
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const plan = laeufe.zustand === 'da' ? laeufe.daten.plan : [];
  const zeitplaene = laeufe.zustand === 'da' ? laeufe.daten.naechstes.filter(n => n.art === 'zeitplan' || n.art === 'skill' || n.art === 'plan') : [];
  const wer = (a: AgentRef) => (a.art === 'zoe' ? 'ZOE' : heads.find(h => h.id === a.headId)?.kurz ?? a.headId);
  const zeitText = (z: Zeitplan) => (z.art === 'einmalig' ? `einmal am ${z.wann.slice(8, 10)}.${z.wann.slice(5, 7)}. ${z.wann.slice(11, 16)}` : ausloeserText({ art: 'zeitplan', rhythmus: z.rhythmus, uhrzeit: z.uhrzeit, tage: z.tage }));
  return (
    <Fenster titel="Geplant" onZu={onZu} breit={640}>
      {laeufe.zustand === 'kommt' && <Leer>Geplante und wiederkehrende Aufgaben erscheinen hier, sobald die Vorschau läuft.</Leer>}
      {plan.length > 0 && (
        <Liste>
          {plan.map(p => <Zeile key={p.id} titel={p.titel} umbrechen unter={`${wer(p.agent)} · ${zeitText(p.zeitplan)}${p.kostenGrenzeCent ? ` · höchstens ${euro(p.kostenGrenzeCent)}` : ''}${p.letzterLauf ? ` · zuletzt ${p.letzterLauf.slice(0, 10)}` : ''}`}
            rechts={<span style={{ display: 'flex', gap: ABSTAND.xs, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Chip farbe={p.aktiv ? LEUCHT.gut : C.inkLeise}>{p.aktiv ? 'an' : 'pausiert'}</Chip>
              <Knopf leise onClick={() => schalten(p.id, !p.aktiv)} ariaLabel={`„${p.titel}“ ${p.aktiv ? 'pausieren' : 'fortsetzen'}`}>{p.aktiv ? 'Pausieren' : 'Fortsetzen'}</Knopf>
              <Knopf leise farbe={LEUCHT.kritisch} onClick={() => loeschen(p.id, p.titel)} ariaLabel={`„${p.titel}“ löschen`}>Löschen</Knopf>
            </span>} />)}
        </Liste>
      )}
      {zeitplaene.length > 0 && (
        <div style={{ display: 'grid', gap: ABSTAND.s }}>
          <span style={{ ...MIKRO }}>Zeitpläne der Heads und Skills</span>
          <Liste>{zeitplaene.map(n => <Zeile key={n.id} titel={n.titel} unter={`${n.headId ? heads.find(h => h.id === n.headId)?.kurz ?? n.headId : 'ZOE'} · ${new Date(n.wann).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })}`} />)}</Liste>
        </div>
      )}
      {laeufe.zustand === 'da' && !plan.length && !zeitplaene.length && <Leer>Noch nichts geplant.</Leer>}
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Stand {jetzt.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} · geplante Läufe teilen sich einen gemeinsamen Raum im Haushalt.</span>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Knopf haupt onClick={() => dialog({ art: 'hintergrund' })}>+ Hintergrundaufgabe</Knopf></div>
    </Fenster>
  );
}

/** Euro-Eingabe („50“, „50,00“) → Cent; leer = null (keine Grenze). */
const euroEingabe = (t: string): number | null | 'falsch' => {
  const x = t.trim().replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.');
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 && n <= 100_000 ? Math.round(n * 100) : 'falsch';
};

/**
 * Kosten und Budget (Paket 4b): das Instanz-Budget vom Server — Grenze JE KALENDERMONAT (Vorgabe) und/oder GESAMT ab jetzt (z. B. ein
 * Test-Budget). Setzen nur der Inhaber (`budget.setzen`, die Route entscheidet). Darunter die Kosten je Head in diesem Monat.
 */
export function BudgetFenster({ onZu }: { onZu: () => void }) {
  const { laeufe, agenten, jetzt, melde } = useAgenten();
  const alle = laeufe.zustand === 'da' ? laeufe.daten.laeufe : [];
  const heads = agenten.zustand === 'da' ? agenten.daten.heads : [];
  const b = agenten.zustand === 'da' ? agenten.daten.budget : undefined;
  const jeHead = heads.map(h => ({ h, cent: h.einstellung?.kostenCentMonat ?? kostenImMonat(alle.filter(l => l.headId === h.id), jetzt) })).filter(x => x.cent > 0).sort((a, c) => c.cent - a.cent);
  const [art, setArt] = useState<'monat' | 'gesamt'>(b?.gesamt && b.monat.grenzeCent === null ? 'gesamt' : 'monat');
  const aktuell = art === 'gesamt' ? b?.gesamt?.grenzeCent ?? null : b?.monat.grenzeCent ?? null;
  const [betrag, setBetrag] = useState(aktuell != null ? euroFeld(aktuell) : '');
  const [meldung, setMeldung] = useState<Meldung>(null);
  const wechsel = (a: 'monat' | 'gesamt') => { setArt(a); const g = a === 'gesamt' ? b?.gesamt?.grenzeCent ?? null : b?.monat.grenzeCent ?? null; setBetrag(g != null ? euroFeld(g) : ''); setMeldung(null); };
  const speichern = async (aus = false) => {
    const cent = aus ? null : euroEingabe(betrag);
    if (cent === 'falsch') { setMeldung({ art: 'kritisch', text: 'Betrag in Euro, z. B. 50 oder 50,00 (höchstens 100.000 €).' }); return; }
    const r = await budgetSetzen(art === 'gesamt' ? { gesamtEuroCent: cent } : { monatEuroCent: cent });
    if (!r.ok) { setMeldung({ art: 'kritisch', text: r.text }); return; }
    setMeldung(null);
    melde(cent == null ? 'Keine Grenze — es wird nur gemessen.' : `Grenze gesetzt: ${euro(cent)} ${art === 'gesamt' ? 'gesamt ab jetzt' : 'je Kalendermonat'}.`, 'gut');
  };
  const teil = (t: { verbrauchtCent: number; grenzeCent: number | null; prozent: number | null; stufe: number; text: string }, label: string) => (
    <Eigenschaft label={label}>
      <span style={{ color: t.stufe >= 95 ? LEUCHT.kritisch : t.stufe >= 80 ? LEUCHT.achtung : C.ink }}>{t.grenzeCent == null ? `${euro(t.verbrauchtCent)} — keine Grenze, nur gemessen` : t.text}</span>
    </Eigenschaft>
  );
  return (
    <Fenster titel="Budget und Kosten" onZu={onZu} breit={600}>
      {b ? (
        <div style={{ display: 'grid', gap: ABSTAND.xs }}>
          {teil(b.monat, 'Diesen Monat')}
          {b.gesamt && teil(b.gesamt, 'Gesamt')}
        </div>
      ) : <Leer>Der Stand des Budgets kommt mit dem Agenten-Kern.</Leer>}
      {b?.setzen ? (
        <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: ABSTAND.s }}>
          <Feldzeile label="Grenze gilt">
            <Segmente liste={[{ id: 'monat', label: 'Je Kalendermonat' }, { id: 'gesamt', label: 'Gesamt ab jetzt' }]} aktiv={art} onWahl={wechsel} />
          </Feldzeile>
          <Feldzeile label={art === 'gesamt' ? 'Gesamt-Grenze in Euro (z. B. ein Test-Budget — zählt ab dem Speichern)' : 'Grenze je Kalendermonat in Euro'}>
            <input value={betrag} onChange={x => setBetrag(x.target.value)} inputMode="decimal" placeholder="z. B. 50" aria-label="Betrag in Euro" style={eingabe} />
          </Feldzeile>
          <Rueckmeldung r={meldung} />
          <div style={{ display: 'flex', gap: ABSTAND.s, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {aktuell != null && <Knopf leise onClick={() => speichern(true)}>Keine Grenze (nur messen)</Knopf>}
            <Knopf haupt typ="submit" aus={!betrag.trim()}>Grenze speichern</Knopf>
          </div>
        </form>
      ) : b ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Die Grenze setzt der Inhaber der Instanz.</span> : null}
      <div style={{ display: 'grid', gap: ABSTAND.s }}>
        <span style={{ ...MIKRO }}>Je Head in diesem Monat</span>
        {jeHead.length ? <Liste>{jeHead.map(x => <Zeile key={x.h.id} titel={x.h.name} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{euro(x.cent)}{x.h.einstellung?.budgetCentMonat != null ? ` / ${euro(x.h.einstellung.budgetCentMonat)}` : ''}</span>} />)}</Liste> : <Leer>Diesen Monat noch keine Kosten.</Leer>}
      </div>
      <Hinweis art="info">Ohne Grenze wird nur gemessen. Mit Grenze: Glocke bei 80 % und 95 %; bei 100 % ruft kein Weg mehr ein Modell auf — automatische Läufe nutzen ihr Regelwerk, die Glocke meldet sich. Eine Grenze je Head stellst du in den Einstellungen des Heads ein.</Hinweis>
    </Fenster>
  );
}

/** Welches Fenster gerade offen ist. */
export function AgentenDialog({ d, onZu }: { d: DialogArt | null; onZu: () => void }) {
  if (!d) return null;
  switch (d.art) {
    case 'auftrag': case 'mehrere': case 'hintergrund':
      return <AuftragDialog key={d.art} art={d.art} start={'agent' in d ? d.agent : undefined} onZu={onZu} />;
    case 'mitarbeiter': return <MitarbeiterDialog key={`${d.headId ?? ''}-${d.vorlage?.id ?? ''}`} headId={d.headId} vorlage={d.vorlage} onZu={onZu} />;
    case 'skill': return <SkillEditor key={`${d.headId ?? ''}-${d.skillId ?? ''}-${d.entwurf?.name ?? ''}`} headId={d.headId} skillId={d.skillId} start={d.entwurf} onZu={onZu} />;
    case 'leitplanken': return <LeitplankenFenster onZu={onZu} />;
    case 'geplant': return <GeplantFenster onZu={onZu} />;
    case 'budget': return <BudgetFenster onZu={onZu} />;
    default: return null;
  }
}
