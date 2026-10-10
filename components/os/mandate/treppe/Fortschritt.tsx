'use client';

// ─── Produkte & Mandate · Fortschritt im Paket — je Mandat (intern) und der Report an den Kunden (10.10.) ─────────────
// Im geöffneten Mandat: Stufe der Leistungstreppe (abgeleitet aus dem Produkt oder gewählt), aktueller Schritt (= Phase des Mandats),
// Lieferobjekte zum Abhaken, nächster Schritt mit Datum, Health-Ampel (Termine · Lieferungen · Zahlungen · Zufriedenheit), „reif für die
// nächste Stufe“ (Regel; der Head of Sales schlägt es im Stapel vor) — und der Fortschritts-Report: PDF erstellen (am Mandat abgelegt),
// Mail vorbereiten (Vorlage Du/Sie oder KI-Entwurf mit Kennzeichnung), PDF angehängt, gesendet NUR per Klick über die Inbox
// (POST /api/inbox/senden — Art. 18, § 7 UWG mit Rückfrage, Absender = Postfach des Business-Bereichs).
// Fulfillment (C2, 10.10., FULFILLMENT_KONZEPT.md 5.2): mit Fall zeigt die Vorschau „Erledigt · Als Nächstes · Wartet auf euch · Wert-Konto · Kunden-Puls“;
// EIN Klick „Senden“ macht nacheinander: PDF erstellen (wenn heute noch keins) → Puls-Link anlegen (nur wenn der Text den Platzhalter trägt, bei aktivem
// Kunden-Link) → Mail über die Inbox → „gesendet“ vermerken. Ohne Fall ist alles wie vorher. Link „Fulfillment öffnen ›“ in den Fall.

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
import { PULS_PLATZHALTER, hatZusatz, type ReportDokument } from '@/lib/crm/treppe-report';
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
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={beschriftung}>Fortschritt im Paket</span>
          <Link href={WEG.fall(mandatId, 'kunde')} style={{ fontSize: TYP.bedien, color: C.aktiv, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Fulfillment öffnen ›</Link>
        </span>
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
        <Knopf leise onClick={() => setSenden(true)}>{z.report.dateiId ? 'Mail vorbereiten' : 'Vorschau & senden'}</Knopf>
        {z.report.dateiId && <a href={`/api/crm/treppe/report?datei=${encodeURIComponent(z.report.dateiId)}`} download style={{ fontSize: TYP.bedien, color: C.aktiv, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>↓ PDF</a>}
        <span style={klein}>{z.report.gesendetAm ? `zuletzt gesendet am ${datum(z.report.gesendetAm)}` : z.report.erstelltAm ? `erstellt am ${datum(z.report.erstelltAm)}, noch nicht gesendet` : 'noch kein Report'}{z.report.faellig ? ' · fällig (alle zwei Wochen)' : ''}</span>
      </div>
      {meldung && <Hinweis art="kritisch">{meldung}</Hinweis>}
      {senden && <ReportSenden mandatId={mandatId} ki={lage.ki} heuteErstellt={!!z.report.dateiId && z.report.erstelltAm === heuteTag()} onZu={() => setSenden(false)} onGesendet={() => { void api.schreibe([{ op: 'report-gesendet', mandatId }]); setSenden(false); }} />}
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
interface Entwurf { betreff: string; text: string; an: { email: string; name?: string } | null; ohneEmpfaenger?: string; anrede: 'Du' | 'Sie'; gesellschaft: string; datei?: { id: string; name: string }; ki?: unknown; kiHinweis?: string; dok?: ReportDokument }
/** Heute (Berliner Tag) im Browser — nur für „heute schon ein PDF?“. */
const heuteTag = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Mail mit dem Report: Vorlage oder KI-Entwurf, Postfach des Business-Bereichs, PDF angehängt — gesendet erst per Klick. */
function ReportSenden({ mandatId, ki, heuteErstellt, onZu, onGesendet }: { mandatId: string; ki: boolean; heuteErstellt: boolean; onZu: () => void; onGesendet: () => void }) {
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
  const pdfAnfrage = useRef(neueId());
  const [schritt, setSchritt] = useState<string | null>(null);
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
  // Ein Klick „Senden“ (Konzept 5.2): PDF (wenn heute noch keins) → Puls-Link (nur mit Platzhalter) → Mail → vermerken. Kein Schritt ohne diesen Klick.
  const pdfSicher = async (): Promise<{ id: string; name: string } | null> => {
    if (e?.datei && heuteErstellt) return e.datei;
    setSchritt('PDF wird erstellt …');
    const r = await fetch('/api/crm/treppe/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'erstellen', mandatId, anfrageId: pdfAnfrage.current }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok || !j.datei) { setFehler(String(j.fehler ?? 'Der Report wurde nicht erstellt.')); return null; }
    setE(x => (x ? { ...x, datei: j.datei } : x));
    return j.datei as { id: string; name: string };
  };
  const mitPulsLink = async (t: string): Promise<string | null> => {
    if (!t.includes(PULS_PLATZHALTER)) return t;
    setSchritt('Puls-Link wird angelegt …');
    const r = await fetch('/api/fulfillment/kunde', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'puls-anfrage', mandatId }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok || !j.ok || typeof j.pfad !== 'string') { setFehler(`Der Puls-Link ließ sich nicht anlegen (${String(j.fehler ?? 'keine Antwort')}). Den Satz mit „${PULS_PLATZHALTER}“ aus dem Text nehmen oder später senden.`); return null; }
    const url = typeof j.url === 'string' ? j.url : `${window.location.origin}${j.pfad}`;
    return t.split(PULS_PLATZHALTER).join(url);
  };
  const los = async (uwg = false): Promise<void> => {
    if (!postfach) { setFehler('Bitte ein Postfach des Business-Bereichs wählen (Inbox › Postfächer).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim())) { setFehler('Bitte eine gültige Empfänger-Adresse.'); return; }
    setFehler(null);
    const datei = await pdfSicher();
    if (!datei) { setSchritt(null); return; }
    const endText = await mitPulsLink(text);
    if (endText === null) { setSchritt(null); return; }
    setSchritt('Mail wird gesendet …');
    const r = await fetch('/api/inbox/senden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      neu: { postfach, betreff }, an: [{ email: an.trim(), ...(e?.an?.email === an.trim() && e.an.name ? { name: e.an.name } : {}) }], text: endText, anhaenge: [{ datei: datei.id }], uwgBestaetigt: uwg, anfrageId: anfrageId.current,
    }) }).catch(() => null);
    setSchritt(null);
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
          {e.dok && hatZusatz(e.dok) && <FallVorschau dok={e.dok} />}
          {text.includes(PULS_PLATZHALTER) && <div style={klein}>Beim Senden entsteht der Puls-Link (eigener Link, 14 Tage gültig, öffnet nur die Frage 0–10) und ersetzt „{PULS_PLATZHALTER}“.</div>}
          <div style={klein}>Anhang: {e.datei && heuteErstellt ? <a href={`/api/crm/treppe/report?datei=${encodeURIComponent(e.datei.id)}`} download style={{ color: C.aktiv }}>{e.datei.name}</a> : 'das PDF entsteht beim Senden (Stand heute)'}. Gesendet wird erst mit „Senden“ — aus dem gewählten Postfach, wie jede Mail der Inbox.</div>
          {schritt && <div role="status" style={klein}>{schritt}</div>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {ki && <Knopf leise onClick={() => laden(true)}>Mit KI formulieren</Knopf>}
            {mitKi && <Knopf leise onClick={() => laden(false)}>Vorlage nehmen</Knopf>}
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
            <Knopf haupt onClick={() => los(false)} aus={!!schritt || !postfach || !an.trim() || !betreff.trim() || !text.trim()}>Senden</Knopf>
          </div>
        </div>
      )}
      {dialog}
    </Fenster>
  );
}

/** Vorschau der Fulfillment-Abschnitte (nur mit Fall): Wartet auf euch · Wert-Konto · Kunden-Puls — derselbe Inhalt wie im PDF. */
function FallVorschau({ dok }: { dok: ReportDokument }) {
  return (
    <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
      <span style={beschriftung}>Wartet auf euch</span>
      <div style={klein}>{dok.wartetAufEuch?.length ? dok.wartetAufEuch.map(x => <div key={x}>· {x}</div>) : 'Gerade nichts.'}</div>
      {!!dok.wertKonto?.length && (<>
        <span style={beschriftung}>Wert-Konto (vorher → jetzt → Ziel)</span>
        <div style={klein}>{dok.wertKonto.map(w => <div key={w.name}>· {w.name}: {w.vorher} → {w.jetzt} → {w.ziel}{w.bis ? ` (bis ${w.bis})` : ''}</div>)}</div>
      </>)}
      {dok.puls && (<><span style={beschriftung}>Kunden-Puls</span><div style={klein}>{dok.puls.wert} von 10 ({dok.puls.am})</div></>)}
    </div>
  );
}
