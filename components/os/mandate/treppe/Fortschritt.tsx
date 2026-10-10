'use client';

// ─── Produkte & Mandate · Fortschritt im Paket — je Mandat (intern) und der Report an den Kunden (10.10.) ─────────────
// Im geöffneten Mandat: Stufe der Leistungstreppe (abgeleitet aus dem Produkt oder gewählt), aktueller Schritt (= Phase des Mandats),
// Lieferobjekte zum Abhaken, nächster Schritt mit Datum, Health-Ampel (Termine · Lieferungen · Zahlungen · Zufriedenheit), „reif für die
// nächste Stufe“ (Regel; der Head of Sales schlägt es im Stapel vor) — und der Fortschritts-Report: PDF erstellen (am Mandat abgelegt),
// Mail vorbereiten (Vorlage Du/Sie oder KI-Entwurf mit Kennzeichnung), PDF angehängt, gesendet NUR per Klick über die Inbox
// (POST /api/inbox/senden — Art. 18, § 7 UWG mit Rückfrage, Absender = Postfach des Business-Bereichs).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, Chip, Hinweis, feld, LEUCHT, useRueckfrage } from '../../ui';
import { Fenster } from '../../Fenster';
import { KiMarke } from '../../KiMarke';
import { Wahl } from '../../crm/Wahl';
import { Feld } from '../../crm/teile';
import { WEG } from '@/lib/wege';
import type { Ampel } from '@/lib/crm/treppe';
import { useTreppe, datum } from './daten';

const AMPEL: Record<Ampel, string> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch };
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const beschriftung = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: C.inkLeise };
const neueId = () => `report-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-')}`;

/** Fortschritt im Paket — eingehängt im geöffneten Mandat (Produkte & Mandate › Mandate). Ohne Treppe: ein Satz mit Weg. */
export function MandatFortschritt({ mandatId }: { mandatId: string }) {
  const api = useTreppe();
  const [senden, setSenden] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const lage = api.lage;
  if (!lage) return api.fehler ? <Hinweis art="kritisch">{api.fehler}</Hinweis> : null;
  if (!lage.datei.stufen.length) return <div style={klein}>Noch keine Leistungstreppe — unter <Link href={WEG.produkt()} style={{ color: C.aktiv }}>Produkte</Link> anlegen, dann zeigt jedes Mandat hier seinen Fortschritt im Paket.</div>;
  const z = lage.kunden.find(k => k.mandatId === mandatId);
  if (!z) return <div style={klein}>Fortschritt gibt es für aktive und pausierte Mandate.</div>;
  const stufen = lage.datei.stufen.map(s => ({ id: s.id, label: `${s.ebene}. ${s.name}` }));
  const erstellen = async () => {
    setLaeuft(true);
    const r = await fetch('/api/crm/treppe/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'erstellen', mandatId, anfrageId: neueId() }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setLaeuft(false);
    if (!r || !r.ok || !j.ok) { setMeldung(String(j.fehler ?? 'Der Report wurde nicht erstellt.')); return; }
    setMeldung(null);
    await api.neuLaden();
    setSenden(true);
  };
  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={beschriftung}>Fortschritt im Paket</span>
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {z.ampel.gesamt && <Chip farbe={AMPEL[z.ampel.gesamt]}>{z.ampel.gesamt === 'gruen' ? 'läuft' : z.ampel.gesamt === 'gelb' ? 'im Blick behalten' : 'braucht Aufmerksamkeit'}</Chip>}
          {z.naechsteStufe && <Chip farbe={LEUCHT.gut}>reif für: {z.naechsteStufe.stufen.map(s => s.name).join(' oder ')}</Chip>}
        </span>
      </div>
      {api.hinweis && <Hinweis art="achtung">{api.hinweis}</Hinweis>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Wahl label="Stufe" liste={stufen} wert={z.stufe?.id} leer="Stufe wählen" leerenLabel="aus dem Produkt ableiten"
          onLeeren={z.stufeQuelle === 'hand' ? () => void api.schreibe([{ op: 'kunde', mandatId, felder: { stufeId: null }, stand: z.stand }]) : undefined}
          onWahl={v => void api.schreibe([{ op: 'kunde', mandatId, felder: { stufeId: v }, stand: z.stand }])} />
        <span style={klein}>{z.stufeQuelle === 'produkt' ? 'aus dem Produkt' : z.stufeQuelle === 'hand' ? 'gewählt' : 'Produkt gehört zu keiner Stufe'}{z.stufeSeit ? ` · seit ${datum(z.stufeSeit)}` : ''}{z.schritt ? ` · Schritt ${z.schritt.nr}/${z.schritt.von}: ${z.schritt.name}` : ''}</span>
      </div>
      {z.lieferobjekte.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {z.lieferobjekte.map(l => (
            <button key={l.was} type="button" aria-pressed={l.erledigt} title={l.erledigt ? `Erledigt am ${datum(l.am ?? '')} — antippen nimmt es zurück` : 'Antippen hakt ab'}
              onClick={() => void api.schreibe([{ op: 'lieferobjekt', mandatId, was: l.was, erledigt: !l.erledigt }])} className="fassbar"
              style={{ minHeight: 40, padding: '6px 12px', borderRadius: 999, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: 'pointer', background: l.erledigt ? `${LEUCHT.gut}22` : 'transparent', color: l.erledigt ? LEUCHT.gut : C.inkDim, border: `1px ${l.erledigt ? 'solid' : 'dashed'} ${l.erledigt ? LEUCHT.gut : 'rgba(255,255,255,.18)'}` }}>
              {l.erledigt ? '✓ ' : ''}{l.was}
            </button>
          ))}
        </div>
      )}
      <NaechsterSchritt wert={z.naechster} onSpeichern={n => api.schreibe([{ op: 'kunde', mandatId, felder: { naechster: n }, stand: z.stand }])} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {z.ampel.teile.map(t => <Chip key={t.id} farbe={t.farbe ? AMPEL[t.farbe] : C.inkLeise}>{t.label}: {t.text}</Chip>)}
      </div>
      {z.naechsteStufe && <div style={klein}>Reif für die nächste Stufe ({z.naechsteStufe.grund}) — der Head of Sales legt dazu einen Vorschlag in den <Link href={WEG.freigaben(undefined, 'business')} style={{ color: C.aktiv }}>Freigabe-Stapel</Link>.</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Knopf onClick={erstellen} aus={laeuft}>{laeuft ? 'Report entsteht …' : z.report.dateiId ? 'Neuen Report erstellen' : 'Fortschritts-Report erstellen'}</Knopf>
        {z.report.dateiId && <Knopf leise onClick={() => setSenden(true)}>Mail vorbereiten</Knopf>}
        {z.report.dateiId && <a href={`/api/crm/treppe/report?datei=${encodeURIComponent(z.report.dateiId)}`} download style={{ fontSize: TYP.bedien, color: C.aktiv, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>↓ PDF</a>}
        <span style={klein}>{z.report.gesendetAm ? `zuletzt gesendet am ${datum(z.report.gesendetAm)}` : z.report.erstelltAm ? `erstellt am ${datum(z.report.erstelltAm)}, noch nicht gesendet` : 'noch kein Report'}{z.report.faellig ? ' · fällig (alle zwei Wochen)' : ''}</span>
      </div>
      {meldung && <Hinweis art="kritisch">{meldung}</Hinweis>}
      {senden && <ReportSenden mandatId={mandatId} ki={lage.ki} onZu={() => setSenden(false)} onGesendet={() => { void api.schreibe([{ op: 'report-gesendet', mandatId }]); setSenden(false); }} />}
    </div>
  );
}

function NaechsterSchritt({ wert, onSpeichern }: { wert?: { text: string; datum: string; ueberfaellig: boolean }; onSpeichern: (n: { text: string; datum: string } | null) => Promise<boolean> }) {
  const [text, setText] = useState(wert?.text ?? '');
  const [tag, setTag] = useState(wert?.datum ?? '');
  const [alt, setAlt] = useState(wert);
  if (alt !== wert) { setAlt(wert); setText(wert?.text ?? ''); setTag(wert?.datum ?? ''); }
  const aendern = (t: string, d: string) => { if (t.trim() && d && (t.trim() !== wert?.text || d !== wert?.datum)) void onSpeichern({ text: t.trim(), datum: d }); else if (!t.trim() && wert) void onSpeichern(null); };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <span style={{ ...beschriftung, color: wert?.ueberfaellig ? LEUCHT.kritisch : C.inkLeise }}>Nächster Schritt</span>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}><Feld wert={text} platzhalter="Was als Nächstes passiert" onFertig={t => { setText(t); aendern(t, tag); }} /></div>
      <Feld typ="date" breite={160} wert={tag} platzhalter="Datum" onFertig={d => { setTag(d); aendern(text, d); }} />
    </div>
  );
}

interface Postfach { id: string; anzeigename?: string; adresse?: string; bereich?: string | null; bereichName?: string; zustand?: string }
interface Entwurf { betreff: string; text: string; an: { email: string; name?: string } | null; ohneEmpfaenger?: string; anrede: 'Du' | 'Sie'; gesellschaft: string; datei?: { id: string; name: string }; ki?: unknown; kiHinweis?: string }

/** Mail mit dem Report: Vorlage oder KI-Entwurf, Postfach des Business-Bereichs, PDF angehängt — gesendet erst per Klick. */
function ReportSenden({ mandatId, ki, onZu, onGesendet }: { mandatId: string; ki: boolean; onZu: () => void; onGesendet: () => void }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [e, setE] = useState<Entwurf | null>(null);
  const [postfaecher, setPostfaecher] = useState<Postfach[] | null>(null);
  const [postfach, setPostfach] = useState<string | null>(null);
  const [an, setAn] = useState('');
  const [betreff, setBetreff] = useState('');
  const [text, setText] = useState('');
  const [mitKi, setMitKi] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const anfrageId = useRef(neueId());
  const laden = async (k: boolean) => {
    const r = await fetch('/api/crm/treppe/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'entwurf', mandatId, ki: k }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok) { setFehler(String(j.fehler ?? 'Der Entwurf ließ sich nicht laden.')); return; }
    setE(j as Entwurf); setBetreff(j.betreff); setText(j.text); setAn(j.an?.email ?? ''); setMitKi(!!j.ki);
    if (j.kiHinweis) setFehler(String(j.kiHinweis));
  };
  useEffect(() => {
    void laden(false);
    fetch('/api/inbox/postfaecher?space=business', { cache: 'no-store' }).then(r => r.json()).then((j: { postfaecher?: Postfach[] }) => setPostfaecher(Array.isArray(j.postfaecher) ? j.postfaecher : [])).catch(() => setPostfaecher([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal beim Öffnen
  }, []);
  // Vorwahl: das Postfach des Bereichs der Gesellschaft des Mandats, sonst das erste Business-Postfach.
  useEffect(() => {
    if (!postfaecher || postfach || !e) return;
    const p = postfaecher.find(x => x.bereich === e.gesellschaft) ?? postfaecher[0];
    if (p) setPostfach(p.id);
  }, [postfaecher, postfach, e]);
  const los = async (uwg = false): Promise<void> => {
    if (!e?.datei) { setFehler('Erst den Report erstellen.'); return; }
    if (!postfach) { setFehler('Bitte ein Postfach des Business-Bereichs wählen (Inbox › Postfächer).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim())) { setFehler('Bitte eine gültige Empfänger-Adresse.'); return; }
    const r = await fetch('/api/inbox/senden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      neu: { postfach, betreff }, an: [{ email: an.trim(), ...(e.an?.email === an.trim() && e.an.name ? { name: e.an.name } : {}) }], text, anhaenge: [{ datei: e.datei.id }], uwgBestaetigt: uwg, anfrageId: anfrageId.current,
    }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.status === 409 && j.code === 'uwg' && j.uwg) {
      const wer = (j.uwg.empfaenger as { name: string; grund: string }[]).map(x => `${x.name} (${x.grund})`).join('\n');
      if (await bestaetigen({ titel: 'Trotzdem senden?', text: `Der Text enthält werbliche Wörter (${(j.uwg.woerter as string[]).join(', ')}), und für diese Person fehlt die Grundlage für Werbung (§ 7 UWG):\n\n${wer}\n\nNur senden, wenn es eine persönliche 1:1-Mail bleibt.`, ja: 'Trotzdem senden', gefahr: true })) { anfrageId.current = neueId(); await los(true); }
      return;
    }
    if (!r || !r.ok || j.ok === false) { setFehler(String(j.fehler ?? 'Nicht gesendet.')); anfrageId.current = neueId(); return; }
    setFertig(true);
    onGesendet();
  };
  return (
    <Fenster titel="Fortschritts-Report senden" onZu={onZu} breit={680}>
      {!e ? <div style={klein}>{fehler ?? 'Entwurf lädt …'}</div> : fertig ? <Hinweis art="gut">Gesendet — die Mail steht in der Inbox unter „Gesendet“.</Hinweis> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
          {e.ohneEmpfaenger && <Hinweis art="achtung">{e.ohneEmpfaenger}</Hinweis>}
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Von (Postfach)</span>
            {postfaecher && !postfaecher.length ? <span style={klein}>Kein Postfach im Business-Bereich — unter <Link href={WEG.inbox()} style={{ color: C.aktiv }}>Inbox</Link> ein Postfach verbinden und dem Business zuordnen.</span>
              : <Wahl label="Postfach" liste={(postfaecher ?? []).map(p => ({ id: p.id, label: `${p.anzeigename ?? p.adresse ?? p.id}${p.bereichName ? ` · ${p.bereichName}` : ''}` }))} wert={postfach} onWahl={setPostfach} />}
          </label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>An</span><input value={an} type="email" onChange={x => setAn(x.target.value)} style={{ ...feld, fontSize: 16 }} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Betreff</span><input value={betreff} onChange={x => setBetreff(x.target.value)} style={{ ...feld, fontSize: 16 }} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Text ({e.anrede})</span><textarea value={text} rows={12} onChange={x => setText(x.target.value)} style={{ ...feld, fontSize: 16, fontFamily: SCHRIFT.text }} /></label>
          {mitKi && <KiMarke />}
          <div style={klein}>Anhang: {e.datei ? <a href={`/api/crm/treppe/report?datei=${encodeURIComponent(e.datei.id)}`} download style={{ color: C.aktiv }}>{e.datei.name}</a> : 'noch kein Report erstellt'}. Gesendet wird erst mit „Senden“ — aus dem gewählten Postfach, wie jede Mail der Inbox.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {ki && <Knopf leise onClick={() => laden(true)}>Mit KI formulieren</Knopf>}
            {mitKi && <Knopf leise onClick={() => laden(false)}>Vorlage nehmen</Knopf>}
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
            <Knopf haupt onClick={() => los(false)} aus={!e.datei || !postfach || !an.trim() || !betreff.trim() || !text.trim()}>Senden</Knopf>
          </div>
        </div>
      )}
      {dialog}
    </Fenster>
  );
}
