'use client';

// ─── Rechnungen schreiben · Editor (08.10.) ─────────────────────────────────
// Kevin 08.10.: „Rechnungen schreiben wie das Angebots-Tool.“ Ein Entwurf auf EINER Fläche: Absender (Gesellschaft), Empfänger
// (Momentaufnahme, aus der Kartei vorbelegt), Leistungszeitraum, Positionen, Steuerhinweis, Texte — darunter die Vorschau im
// Layout des PDFs und EINE Hauptaktion „Rechnung stellen“. Der Entwurf speichert von selbst (Stand/409, nacheinander). Fehlt eine
// Pflichtangabe (§ 14 Abs. 4 UStG), steht sie als Liste mit Weg da, und „stellen“ bleibt aus — der Server prüft dasselbe (409).
// Gestellte Rechnungen zeigt dieselbe Fläche nur lesend: PDF, Mail-Entwurf, Storno, Mahnung. Hinweis, keine Steuerberatung.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { RechnungEmpfaenger, RechnungPosition, SteuerHinweis } from '@/lib/finanzen/rechnung/typen';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { KERN_EINHEITEN, type Gesellschaftskennung } from '@/lib/einheiten';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { absenderAus } from '@/lib/crm/angebot-dokument';
import { euroCent, centAusEingabe, eingabeAusCent, mengeAusEingabe, mengeText, mailtoLink, UST_SAETZE } from '@/lib/crm/angebote';
import {
  pflichtFehlt, rechnungSummen, kundeAus, mahnVorschlag, mahnMail, rechnungMail, positionNetto, mahnstufeVon, mahnLabel, KEINE_STEUERBERATUNG,
  RECHNUNG_GRENZEN,
} from '@/lib/finanzen/rechnung/regeln';
import { rechnungDokument, bankZeile } from '@/lib/finanzen/rechnung/dokument';
import { Blatt } from '../crm/angebot/Blatt';
import { Karte, Knopf, Chip, Hinweis, Pillen, Segmente, Feldzeile, Ueberschrift, feld } from '../ui';
import { neueAnfrage, pdfLaden, rechnungPost, type RechnungDaten, type RechnungMitFassung, type AbsenderAnzeige } from './daten';
import { localDay } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';

type Form = Pick<Rechnung, 'firmaId' | 'titel' | 'leistungVon' | 'leistungBis' | 'notiz'> & {
  empfaenger: RechnungEmpfaenger; positionen: RechnungPosition[]; zahlungszielTage: number;
  steuerHinweis?: SteuerHinweis; steuerfreiGrund?: string; einleitung?: string; schluss?: string;
};
const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;
const kopf = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim } as const;
const zelle = { ...feld, fontSize: TYP.bedien, padding: '8px 10px' } as const;
const gesName = (g: string) => KERN_EINHEITEN.find(e => e.id === g)?.label ?? g;

/** Ein Entwurf ohne Positionen (Altbestand „+ Rechnung“): eine Position aus Betrag/Netto vorbelegen, damit er gestellt werden kann. */
function formAus(r: Rechnung): Form {
  const positionen = r.positionen?.length ? r.positionen : r.betrag > 0 ? [{
    id: 'p1', titel: r.titel || 'Leistung', text: '', menge: 1, einheit: 'pauschal',
    einzelpreisCent: Math.round((r.netto ?? nettoAusBrutto(r.betrag, r.ustSatz ?? 19)) * 100), ustSatz: (UST_SAETZE as readonly number[]).includes(r.ustSatz ?? 19) ? r.ustSatz ?? 19 : 19,
  }] : [];
  return {
    firmaId: r.firmaId, titel: r.titel, leistungVon: r.leistungVon, leistungBis: r.leistungBis, notiz: r.notiz,
    empfaenger: r.empfaenger ?? (r.kunde ? { firma: r.kunde } : {}), positionen, zahlungszielTage: r.zahlungszielTage ?? 14,
    steuerHinweis: r.steuerHinweis, steuerfreiGrund: r.steuerfreiGrund, einleitung: r.einleitung, schluss: r.schluss,
  };
}

export function RechnungEditor({ start, daten, onZu }: { start: RechnungMitFassung; daten: RechnungDaten; onZu: () => void }) {
  if (start.status !== 'geplant') return <RechnungAnsicht r={start} daten={daten} onZu={onZu} />;
  return <Entwurf start={start} daten={daten} onZu={onZu} />;
}

// ── Entwurf ──────────────────────────────────────────────────────────────────

function Entwurf({ start, daten, onZu }: { start: RechnungMitFassung; daten: RechnungDaten; onZu: () => void }) {
  const heute = localDay();
  const gesellschaften = daten.stand?.gesellschaften ?? [];
  const [form, setForm] = useState<Form>(() => formAus(start));
  // Ein Altbestand-Entwurf ohne Positionen wird beim bloßen Öffnen nicht umgeschrieben — erst eine Änderung oder „stellen“ speichert ihn.
  const [status, setStatus] = useState<'neu' | 'gespeichert' | 'wartet' | 'speichert' | 'fehler'>(start.positionen ? 'gespeichert' : 'neu');
  const [meldung, setMeldung] = useState<string | null>(null);
  const [serverFehlt, setServerFehlt] = useState<{ text: string; weg?: string }[] | null>(null);
  const [meine, setMeine] = useState<Form | null>(null);
  const [ansicht, setAnsicht] = useState<'bearbeiten' | 'vorschau'>('bearbeiten');
  const [fertig, setFertig] = useState<{ r: RechnungMitFassung; pdf: { id: string; name: string }; mailto: string } | null>(null);
  const [loeschFrage, setLoeschFrage] = useState(false);

  // ── Automatisch speichern: nacheinander, mit dem Stand der letzten Antwort ──
  const formRef = useRef(form); formRef.current = form;
  const standRef = useRef<string>(start.fassung);
  const kette = useRef<Promise<void>>(Promise.resolve());
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offen = useRef(false);
  const datenRef = useRef(daten); datenRef.current = daten;
  const speichernJetzt = useCallback((opt: { keepalive?: boolean } = {}) => {
    if (uhr.current) { clearTimeout(uhr.current); uhr.current = null; }
    if (!offen.current) return kette.current;
    offen.current = false;
    kette.current = kette.current.then(async () => {
      setStatus('speichert');
      const f = formRef.current;
      const r = await rechnungPost({ aktion: 'speichern', id: start.id, stand: standRef.current, felder: { ...f, kunde: kundeAus(f.empfaenger, start.kunde) } }, opt);
      if (r.ok && r.rechnung) {
        standRef.current = r.rechnung.fassung; datenRef.current.uebernehmen(r.rechnung); setStatus(offen.current ? 'wartet' : 'gespeichert'); setMeldung(null);
      } else if (r.status === 409 && r.aktuell) {
        // Die eigene Eingabe bleibt als „Deine Fassung“ — angezeigt wird der gespeicherte Stand.
        standRef.current = r.aktuell.fassung; datenRef.current.uebernehmen(r.aktuell); setStatus('fehler');
        if (r.aktuell.status === 'geplant') { setMeine(f); setForm(formAus(r.aktuell)); setMeldung('Jemand hat diesen Entwurf inzwischen geändert — sein Stand ist geladen. Deine Fassung ist gemerkt: übernehmen oder verwerfen.'); }
        else setMeldung(`Die Rechnung ist inzwischen ${r.aktuell.status} — Änderungen nur über Storno und neue Rechnung.`);
      } else {
        offen.current = true; setStatus('fehler');
        setMeldung(`${r.fehler ?? 'Nicht gespeichert.'} Die Eingabe bleibt — ${r.status === 0 || r.status >= 500 ? 'neuer Versuch in 5 s.' : 'bitte anpassen.'}`);
        if (r.status === 0 || r.status >= 500) { if (uhr.current) clearTimeout(uhr.current); uhr.current = setTimeout(() => { void speichernJetzt(); }, 5000); }
      }
    });
    return kette.current;
  }, [start.id, start.kunde]);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); if (offen.current) void speichernJetzt({ keepalive: true }); }, [speichernJetzt]);
  useEffect(() => {
    const raus = () => { if (offen.current) void speichernJetzt({ keepalive: true }); };
    const warnen = (e: BeforeUnloadEvent) => { if (!offen.current) return; raus(); e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('pagehide', raus);
    window.addEventListener('beforeunload', warnen);
    return () => { window.removeEventListener('pagehide', raus); window.removeEventListener('beforeunload', warnen); };
  }, [speichernJetzt]);
  const aendern = useCallback((teil: Partial<Form>) => {
    setForm(f => ({ ...f, ...teil }));
    offen.current = true; setStatus('wartet'); setServerFehlt(null);
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = setTimeout(() => { void speichernJetzt(); }, 700);
  }, [speichernJetzt]);
  const empf = (teil: Partial<RechnungEmpfaenger>) => aendern({ empfaenger: { ...form.empfaenger, ...teil } });

  // ── Abgeleitet ──
  const g: AbsenderAnzeige | undefined = gesellschaften.find(x => x.id === form.firmaId);
  const ku = !!g?.kleinunternehmer;
  const s = rechnungSummen(form.positionen, { kleinunternehmer: ku });
  const fehlt = pflichtFehlt(form, g ?? null);
  const nullSatz = !ku && form.positionen.some(p => p.ustSatz === 0);
  const entwurfAlsRechnung: Rechnung = { ...start, ...form, kunde: kundeAus(form.empfaenger, start.kunde), betrag: s.brutto / 100, status: 'geplant' };
  const dok = useMemo(() => rechnungDokument(entwurfAlsRechnung, absenderAus(g ?? { id: (form.firmaId || 'kdc') as Gesellschaftskennung }), { datum: heute, bank: bankZeile(g?.bank), kleinunternehmer: ku }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Vorschau folgt dem Formular
    [form, g, ku, heute]);
  const setzePos = (l: RechnungPosition[]) => aendern({ positionen: l });

  async function stellen() {
    if (!start.positionen) offen.current = true; // Altbestand: die vorbelegte Position erst jetzt speichern
    await speichernJetzt();
    if (offen.current) { setMeldung('Der Entwurf ist noch nicht gespeichert — bitte kurz warten und noch einmal.'); return; }
    const r = await rechnungPost({ aktion: 'stellen', id: start.id, stand: standRef.current, anfrageId: neueAnfrage() });
    if (!r.ok || !r.rechnung || !r.pdf) {
      if (r.fehlt) setServerFehlt(r.fehlt);
      if (r.status === 409 && r.aktuell) { standRef.current = r.aktuell.fassung; daten.uebernehmen(r.aktuell); }
      setMeldung(r.fehler ?? 'Nicht gestellt.');
      return;
    }
    daten.uebernehmen(r.rechnung);
    pdfLaden(r.rechnung.id, r.pdf.name);
    const mail: { an?: string; betreff: string; text: string } = r.mail ?? { ...rechnungMail(r.rechnung), an: r.rechnung.empfaenger?.email };
    setFertig({ r: r.rechnung, pdf: r.pdf, mailto: mailtoLink(mail.an, mail.betreff, mail.text) });
    void daten.laden();
  }
  async function loeschen() {
    await speichernJetzt();
    const r = await rechnungPost({ aktion: 'loeschen', id: start.id, stand: standRef.current });
    if (!r.ok) { setMeldung(r.fehler ?? 'Nicht gelöscht.'); return; }
    daten.entfernen(start.id); onZu();
  }

  if (fertig) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Hinweis art="gut" titel={`Rechnung ${fertig.r.nummer ?? ''} gestellt`}>
          Nummer vergeben, PDF erstellt und als Beleg abgelegt (nicht löschbar, Prüfsumme gespeichert). Das PDF wird heruntergeladen — im Mail-Programm anhängen und abschicken. MAKE OS verschickt nichts.
        </Hinweis>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf haupt href={fertig.mailto}>Mail-Programm öffnen</Knopf>
          <Knopf leise onClick={() => pdfLaden(fertig.r.id, fertig.pdf.name)}>PDF noch einmal laden</Knopf>
          <Knopf leise onClick={onZu}>Schließen</Knopf>
        </div>
      </div>
    );
  }

  const statusText = { neu: 'noch nicht gespeichert', gespeichert: 'Entwurf gespeichert', wartet: 'Änderung …', speichert: 'speichert …', fehler: 'nicht gespeichert' }[status];
  const zeigFehlt = serverFehlt ?? fehlt;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      {meldung && <Hinweis art="achtung" rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung}</Hinweis>}
      {meine && (
        <Hinweis art="info" titel="Deine Fassung" aktion={<span style={{ display: 'flex', gap: 8 }}><Knopf onClick={() => { const f = meine; setMeine(null); aendern(f); }}>übernehmen</Knopf><Knopf leise onClick={() => setMeine(null)}>verwerfen</Knopf></span>}>
          „{meine.titel || 'ohne Titel'}“ mit {meine.positionen.length} Position{meine.positionen.length === 1 ? '' : 'en'} ist gemerkt.
        </Hinweis>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmente<'bearbeiten' | 'vorschau'> liste={[{ id: 'bearbeiten', label: 'Bearbeiten' }, { id: 'vorschau', label: 'Vorschau' }]} aktiv={ansicht} onWahl={a => { void speichernJetzt(); setAnsicht(a); }} />
        <span style={{ fontSize: TYP.bedien, color: status === 'fehler' ? LEUCHT.kritisch : C.inkLeise }}>{statusText}</span>
      </div>

      {ansicht === 'vorschau' ? <Blatt d={dok} /> : <>
        <Karte flach>
          <Ueberschrift>Absender</Ueberschrift>
          {gesellschaften.length
            ? <Pillen<string> liste={gesellschaften.map(x => ({ id: x.id, label: gesName(x.id) }))} aktiv={form.firmaId || null} onWahl={id => aendern({ firmaId: id })} />
            : <div style={klein}>Keine Gesellschaft für dieses Konto freigegeben.</div>}
          {g && g.luecken.length > 0 && <div style={{ marginTop: 8 }}><Chip farbe={LEUCHT.achtung}>Absender: {g.luecken.join(', ')} fehlt</Chip></div>}
          {ku && <div style={{ marginTop: 8 }}><Chip farbe={C.inkDim}>Kleinunternehmer · ohne Umsatzsteuer</Chip></div>}
        </Karte>

        <Karte flach>
          <Ueberschrift>Empfänger</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <Feldzeile label="Firma"><input value={form.empfaenger.firma ?? ''} onChange={e => empf({ firma: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="z. Hd. / Name"><input value={form.empfaenger.name ?? ''} onChange={e => empf({ name: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Straße und Hausnummer"><input value={form.empfaenger.strasse ?? ''} onChange={e => empf({ strasse: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="PLZ"><input value={form.empfaenger.plz ?? ''} inputMode="numeric" onChange={e => empf({ plz: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Ort"><input value={form.empfaenger.ort ?? ''} onChange={e => empf({ ort: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Land (leer = Deutschland)"><input value={form.empfaenger.land ?? ''} onChange={e => empf({ land: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="USt-IdNr. des Kunden"><input value={form.empfaenger.ustId ?? ''} onChange={e => empf({ ustId: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Ihre Referenz / Bestellnummer"><input value={form.empfaenger.referenz ?? ''} onChange={e => empf({ referenz: e.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="E-Mail für den Versand"><input value={form.empfaenger.email ?? ''} type="email" onChange={e => empf({ email: e.target.value })} style={feld} /></Feldzeile>
          </div>
        </Karte>

        <Karte flach>
          <Ueberschrift>Leistung</Ueberschrift>
          <Feldzeile label="Titel"><input value={form.titel} maxLength={RECHNUNG_GRENZEN.titel} onChange={e => aendern({ titel: e.target.value })} placeholder="z. B. Beratung Oktober" style={feld} /></Feldzeile>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <Feldzeile label="Leistung von (bzw. Leistungsdatum)"><input type="date" value={form.leistungVon ?? ''} onChange={e => aendern({ leistungVon: e.target.value || undefined })} style={{ ...feld, width: 180, colorScheme: 'dark' }} /></Feldzeile>
            <Feldzeile label="bis (leer = ein Tag)"><input type="date" value={form.leistungBis ?? ''} min={form.leistungVon} onChange={e => aendern({ leistungBis: e.target.value || undefined })} style={{ ...feld, width: 180, colorScheme: 'dark' }} /></Feldzeile>
            <Feldzeile label="Zahlungsziel (Tage)"><input inputMode="numeric" value={String(form.zahlungszielTage)} onChange={e => { const n = Math.round(Number(e.target.value)); if (e.target.value === '' || (Number.isFinite(n) && n >= 0 && n <= 365)) aendern({ zahlungszielTage: e.target.value === '' ? 0 : n }); }} style={{ ...feld, width: 110, textAlign: 'right' }} /></Feldzeile>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={kopf}>Positionen</div>
            {form.positionen.map((p, i) => (
              <PositionZeile key={p.id} p={p} nr={i + 1} ku={ku}
                onAendern={teil => setzePos(form.positionen.map(x => (x.id === p.id ? { ...x, ...teil } : x)))}
                onWeg={() => setzePos(form.positionen.filter(x => x.id !== p.id))} />
            ))}
            {!form.positionen.length && <div style={{ ...klein, padding: '10px 0' }}>Noch keine Position — Menge und Art der Leistung gehören auf jede Rechnung.</div>}
            <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setzePos([...form.positionen, { id: neueKennung('p').slice(0, 20), titel: 'Leistung', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 0, ustSatz: ku ? 0 : 19 }])}>+ Position</Knopf></div>
          </div>
          {nullSatz && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div style={klein}>Eine Position ohne Umsatzsteuer — warum?</div>
              <Pillen<SteuerHinweis> liste={[{ id: 'reverse-charge', label: 'Reverse Charge (§ 13b UStG)' }, { id: 'steuerfrei', label: 'steuerfrei' }]} aktiv={form.steuerHinweis ?? null} onWahl={id => aendern({ steuerHinweis: id })} />
              {form.steuerHinweis === 'steuerfrei' && <Feldzeile label="Grund der Steuerbefreiung"><input value={form.steuerfreiGrund ?? ''} onChange={e => aendern({ steuerfreiGrund: e.target.value })} placeholder="z. B. § 4 Nr. … UStG" style={feld} /></Feldzeile>}
            </div>
          )}
        </Karte>

        <Karte flach>
          <Ueberschrift>Texte</Ueberschrift>
          <Feldzeile label="Einleitung"><textarea value={form.einleitung ?? ''} rows={3} onChange={e => aendern({ einleitung: e.target.value })} style={{ ...feld, lineHeight: 1.5, resize: 'vertical' }} /></Feldzeile>
          <div style={{ height: 8 }} />
          <Feldzeile label="Schluss"><textarea value={form.schluss ?? ''} rows={2} onChange={e => aendern({ schluss: e.target.value })} style={{ ...feld, lineHeight: 1.5, resize: 'vertical' }} /></Feldzeile>
        </Karte>
      </>}

      {zeigFehlt.length > 0 && (
        <Hinweis art={serverFehlt ? 'kritisch' : 'achtung'} titel="Bis zum Stellen fehlt noch">
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {zeigFehlt.map((f, i) => <li key={i}>{f.text}{f.weg && <> · <Link href={f.weg} style={{ color: C.aktiv }}>beheben ›</Link></>}</li>)}
          </ul>
        </Hinweis>
      )}

      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, background: C.flaeche, borderTop: '1px solid rgba(255,255,255,.08)', padding: '12px 0 4px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'grid', gap: 1 }}>
          <span style={kopf}>Rechnungsbetrag</span>
          <span style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: LEUCHT.gut }}>{euroCent(s.brutto)}{!ku && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}> · {euroCent(s.netto)} netto</span>}</span>
        </span>
        <span style={{ flex: 1 }} />
        {loeschFrage
          ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>Entwurf löschen? <Knopf farbe={LEUCHT.kritisch} onClick={loeschen}>Löschen</Knopf><Knopf leise onClick={() => setLoeschFrage(false)}>Nein</Knopf></span>
          : <Knopf leise onClick={() => setLoeschFrage(true)}>Entwurf löschen</Knopf>}
        <Knopf haupt farbe={LEUCHT.gut} aus={fehlt.length > 0} onClick={stellen}>Rechnung stellen</Knopf>
      </div>
      <div style={klein}>Stellen vergibt die nächste fortlaufende Nummer der Gesellschaft, schreibt das PDF fest (danach nicht mehr änderbar) und legt es als Beleg ab. {KEINE_STEUERBERATUNG}</div>
    </div>
  );
}

function PositionZeile({ p, nr, ku, onAendern, onWeg }: { p: RechnungPosition; nr: number; ku: boolean; onAendern: (t: Partial<RechnungPosition>) => void; onWeg: () => void }) {
  const [offen, setOffen] = useState(!!p.text);
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: 20, color: C.inkLeise, fontSize: TYP.bedien, textAlign: 'right' }}>{nr}</span>
        <input value={p.titel} aria-label="Leistung" onChange={e => onAendern({ titel: e.target.value })} style={{ ...zelle, flex: '1 1 200px', minWidth: 160, fontWeight: 600 }} />
        <ZahlFeld label="Menge" breite={72} wert={mengeText(p.menge)} onWert={t => { const m = mengeAusEingabe(t); if (m === null) return false; onAendern({ menge: m }); return true; }} />
        <input value={p.einheit} aria-label="Einheit" onChange={e => onAendern({ einheit: e.target.value })} style={{ ...zelle, width: 90 }} />
        <ZahlFeld label="Einzelpreis € netto" breite={110} wert={eingabeAusCent(p.einzelpreisCent)} onWert={t => { const c = centAusEingabe(t); if (c === null) return false; onAendern({ einzelpreisCent: c }); return true; }} />
        <ZahlFeld label="Rabatt %" breite={70} wert={p.rabattProzent ? String(p.rabattProzent).replace('.', ',') : ''} onWert={t => { const n = t.trim() ? Number(t.replace(',', '.')) : 0; if (!Number.isFinite(n) || n < 0 || n > 100) return false; onAendern({ rabattProzent: n || undefined }); return true; }} />
        {!ku && (
          <select value={p.ustSatz} aria-label="Umsatzsteuer" onChange={e => onAendern({ ustSatz: Number(e.target.value) })} style={{ ...zelle, width: 100, colorScheme: 'dark' }}>
            {UST_SAETZE.map(x => <option key={x} value={x}>{x} % USt</option>)}
          </select>
        )}
        <span style={{ minWidth: 96, textAlign: 'right', fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{euroCent(positionNetto(p))}</span>
        <Knopf leise onClick={onWeg} ariaLabel={`Position ${nr} entfernen`} titel="Entfernen">×</Knopf>
      </div>
      <div style={{ paddingLeft: 26 }}>
        <button onClick={() => setOffen(!offen)} aria-expanded={offen} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, minHeight: 32 }}>{offen ? 'Beschreibung zuklappen' : p.text.trim() ? 'Beschreibung' : '+ Beschreibung'}</button>
        {offen && <textarea value={p.text} rows={3} aria-label="Beschreibung der Position" onChange={e => onAendern({ text: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, marginTop: 6, resize: 'vertical' }} />}
      </div>
    </div>
  );
}

/** Zahlfeld, das lokal tippt und beim Verlassen/Enter übernimmt (ungültig → alter Wert). */
function ZahlFeld({ wert, onWert, breite, label }: { wert: string; onWert: (t: string) => boolean; breite: number; label: string }) {
  const [t, setT] = useState(wert);
  const fokus = useRef(false);
  useEffect(() => { if (!fokus.current) setT(wert); }, [wert]);
  const fertig = () => { fokus.current = false; if (t !== wert && !onWert(t)) setT(wert); };
  return <input inputMode="decimal" value={t} aria-label={label} title={label} onFocus={e => { fokus.current = true; e.target.select(); }} onChange={e => setT(e.target.value)} onBlur={fertig}
    onKeyDown={e => { if (e.key === 'Enter') fertig(); if (e.key === 'Escape') { setT(wert); (e.target as HTMLInputElement).blur(); } }}
    style={{ ...zelle, width: breite, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />;
}

// ── Gestellte Rechnung: lesen, PDF, Mail, Storno, Mahnung ────────────────────

function RechnungAnsicht({ r, daten, onZu }: { r: RechnungMitFassung; daten: RechnungDaten; onZu: () => void }) {
  const heute = localDay();
  const g = daten.stand?.gesellschaften.find(x => x.id === r.firmaId);
  const original = r.stornoZu ? daten.stand?.rechnungen.find(x => x.id === r.stornoZu) : undefined;
  const dok = rechnungDokument(r, r.absender ?? absenderAus(g ?? { id: (r.firmaId || 'kdc') as Gesellschaftskennung }), { datum: r.datum ?? heute, bank: bankZeile(g?.bank), ...(original ? { original } : {}) });
  const [meldung, setMeldung] = useState<string | null>(null);
  const [grund, setGrund] = useState<string | null>(null);
  const tage = daten.stand?.mahnTage;
  const vorschlag = mahnVorschlag(r, heute, tage);
  const stufe = mahnstufeVon(r);
  const name = g ? mitVorgaben(g).name : undefined;
  const mail = rechnungMail(r, name);

  async function stornieren() {
    if (!grund || grund.trim().length < 3) return;
    const a = await rechnungPost({ aktion: 'storno', id: r.id, grund: grund.trim(), stand: r.fassung, anfrageId: neueAnfrage() });
    if (!a.ok) { setMeldung(a.fehler ?? 'Nicht storniert.'); return; }
    setGrund(null);
    setMeldung(`Storniert — Stornorechnung ${a.storno?.nummer ?? ''} mit eigenem PDF angelegt${a.gegenbuchung === 'neu' ? ', Gegenbuchung zum Zahlungseingang gebucht' : ''}.`);
    if (a.storno) pdfLaden(a.storno.id, a.pdf?.name);
    void daten.laden();
  }
  async function mahnen(s: 1 | 2 | 3) {
    const a = await rechnungPost({ aktion: 'mahnung', id: r.id, stufe: s, anfrageId: neueAnfrage() });
    if (!a.ok || !a.mail) { setMeldung(a.fehler ?? 'Nicht vermerkt.'); return; }
    if (a.rechnung) daten.uebernehmen(a.rechnung);
    window.location.href = mailtoLink(a.mail.an, a.mail.betreff, a.mail.text);
    setMeldung(`${mahnLabel(s)} vermerkt — das Mail-Programm öffnet den Entwurf.`);
  }

  const vorschlagText = vorschlag ? mahnMail(vorschlag.stufe, r, { heute, ...(name ? { absender: name } : {}) }) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      {meldung && <Hinweis art={meldung.startsWith('Storniert') || meldung.includes('vermerkt') ? 'gut' : 'achtung'} rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={r.status === 'bezahlt' ? LEUCHT.gut : r.status === 'storniert' ? C.inkLeise : LEUCHT.achtung}>{r.art === 'storno' ? 'Stornorechnung' : r.status}</Chip>
        {r.pdfDateiId && <Chip farbe={C.inkDim}>PDF · Prüfsumme gespeichert</Chip>}
        {stufe > 0 && <Chip farbe={LEUCHT.achtung}>{mahnLabel(stufe as 1 | 2 | 3)} am {r.mahnungen?.find(m => m.stufe === stufe)?.am}</Chip>}
        <span style={{ flex: 1 }} />
        {r.pdfDateiId && <Knopf leise onClick={() => pdfLaden(r.id)}>PDF herunterladen</Knopf>}
        {r.art !== 'storno' && r.status === 'gestellt' && <Knopf leise href={mailtoLink(r.empfaenger?.email, mail.betreff, mail.text)}>Mail-Entwurf</Knopf>}
      </div>
      {vorschlag && vorschlagText && (
        <Hinweis art="achtung" titel={`${vorschlag.label} ist dran — ${vorschlag.tageUeberfaellig} Tage überfällig`}
          aktion={<Knopf onClick={() => mahnen(vorschlag.stufe)}>Im Mail-Programm öffnen</Knopf>}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: TYP.bedien }}>{vorschlagText.betreff}{'\n\n'}{vorschlagText.text}</div>
        </Hinweis>
      )}
      <Blatt d={dok} />
      {(r.status === 'gestellt' || r.status === 'bezahlt') && r.art !== 'storno' && r.pdfDateiId && (
        <Karte flach>
          <Ueberschrift>Stornieren</Ueberschrift>
          {grund === null
            ? <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={klein}>Eine gestellte Rechnung wird nie geändert oder gelöscht — Storno legt eine Stornorechnung mit eigener Nummer und eigenem PDF an.</span><Knopf leise onClick={() => setGrund('')}>Stornorechnung anlegen</Knopf></div>
            : <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={grund} onChange={e => setGrund(e.target.value)} placeholder="Grund des Stornos" aria-label="Grund des Stornos" style={{ ...feld, flex: '1 1 220px' }} />
              <Knopf farbe={LEUCHT.kritisch} aus={grund.trim().length < 3} onClick={stornieren}>Stornieren</Knopf>
              <Knopf leise onClick={() => setGrund(null)}>Abbrechen</Knopf>
            </div>}
        </Karte>
      )}
      <div style={{ display: 'flex', gap: 10 }}><Knopf leise onClick={onZu}>Schließen</Knopf></div>
      <div style={klein}>{KEINE_STEUERBERATUNG}</div>
    </div>
  );
}
