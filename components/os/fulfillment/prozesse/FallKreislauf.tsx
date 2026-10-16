'use client';

// ─── Fulfillment › Fall › Abschluss & Kreislauf (12.10.; vorher Teil von „Takt“ — FULFILLMENT_KONZEPT.md 5.3) ─────────────────────────────────
// Rückmeldung 12.10.: „Wirkungsbericht + Nachsorge — zurück in den Kreislauf/Markttraktion. Keine losen Enden.“ Das Ende der Reise an EINER Stelle:
//   1. Antwort zuerst: wo steht dieser Kunde im Kreislauf, was ist der nächste Handgriff am Ende (`abschlussSchritt`: Fall abschließen →
//      Wirkungsbericht → Mandat beenden → Nachsorge), Befähigung „läuft ohne uns“.
//   2. Das Kreislauf-Rad (dieselben sieben Stufen wie Markttraktion › Planung) mit „hier steht dieser Kunde“ — jede Stufe springt in ihre Ansicht.
//   3. Befähigung (Kriterien, Ziel: der Kunde kann es selbst) und Wirkungsbericht (PDF, Kundenzitat nur mit Einwilligung, senden nur per Klick).
//   4. Nach der Leistung: die Schritte der Markttraktion je Mandat (Testimonial, Bewertung, Upselling, Cross-Selling, Newsletter, Leistung beendet —
//      dieselbe Liste wie Markttraktion › Planung › Kreislauf, abgehakt über deren Schreibweg), die Folgen des Wirkungsberichts als Vorschläge
//      (Kundenstimme, Fallstudie, Empfehlung, nächste Stufe), die Nachsorge als Plan (Tag 14 · 45 · 90 nach Mandatsende) und die Follow-ups am Mandat.
// Nichts geht automatisch nach außen: der Bericht wird per Klick gesendet, die Nachsorge kommt als Vorschlag in den Freigabe-Stapel.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Feldzeile, HakenZiel, Punkt, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { wort } from '@/lib/text/zahlwort';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { fallReise } from '@/lib/fulfillment/prozesse/reise';
import { abschlussSchritt, kreislaufLage, kreislaufStand, kreislaufWeg, KREISLAUF_REIHE, KREISLAUF_NAME, type NachsorgePunkt } from '@/lib/fulfillment/prozesse/ansichten';
import { abstimmungsNummern, ohneKuerzel } from '@/lib/fulfillment/prozesse/darstellung';
import type { WirkungsDokument } from '@/lib/fulfillment/prozesse/wirkung';
import { useFall, fallOps, fehlerText, holeJson, geaendert, neueAnfrageId, tagKurz, type FallAntwort } from './daten';
import { klein, feld, Leiste, Meldung } from './teile';
import { MailSenden, type MailEntwurf } from './MailSenden';
import { ReiterAntwort, KreislaufRad, MehrKnopf, type RadStufe } from '../reise/teile';
import { FortschrittsRing } from '../reise/bilder';
import { insBild, useStellenSprung } from '../reise/sprung';

type Melde = (text: string | null, art?: 'gut' | 'kritisch' | 'achtung') => void;
type Ops = (o: Record<string, unknown>[], gut?: string) => Promise<boolean>;
interface NachLeistungSchritt { id: string; label: string; erledigt: boolean; quelle: 'abgeleitet' | 'hand' | null; am?: string; grund?: string }


export function FallKreislauf({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const router = useRouter();
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [nachLeistung, setNachLeistung] = useState<NachLeistungSchritt[] | null>(null);
  const [nlFehler, setNlFehler] = useState<string | null>(null);
  useStellenSprung();
  const ladeNL = async () => {
    const a = await holeJson<{ kreislauf?: { kunden?: { mandatId: string; schritte: NachLeistungSchritt[] }[] } }>('/api/crm/planung');
    if (!a.ok) { setNlFehler(fehlerText(a)); return; }
    setNlFehler(null);
    setNachLeistung(a.j.kreislauf?.kunden?.find(k => k.mandatId === mandatId)?.schritte ?? []);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Mandat
  useEffect(() => { void ladeNL(); }, [mandatId]);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const f = daten.fall;
  const heute = localDay();
  const melde: Melde = (text, art = 'gut') => setMeldung(text ? { text, art } : null);
  const ops: Ops = async (o, gut) => { const a = await fallOps(mandatId, o); melde(a.ok ? gut ?? null : fehlerText(a), a.ok ? 'gut' : 'kritisch'); return a.ok; };
  const reise = fallReise(f, daten.vorlage?.freigaben ?? [], heute);
  const plan = daten.nachsorge?.plan ?? [];
  const stand = kreislaufStand(f, plan);
  const abschluss = abschlussSchritt({ fall: f, allePhasenFertig: reise.fertig, mandatEnde: daten.nachsorge?.ende ?? null, nachsorge: plan });
  const lage = kreislaufLage(stand, abschluss);
  const erfuellt = f.befaehigung.filter(b => b.erfuellt).length;
  const befProzent = f.befaehigung.length ? Math.round((erfuellt / f.befaehigung.length) * 100) : 0;
  const idx = KREISLAUF_REIHE.indexOf(stand);
  // „Nach der Leistung“ steht in diesem Reiter (unten) — sonst EINE Tabelle `kreislaufWeg` (15.10., Abnahme B7).
  const stufen: RadStufe[] = KREISLAUF_REIHE.map(id => ({ id, ...(id === 'nachher' ? {} : { href: kreislaufWeg(id, daten.mandat) }) }));
  const hauptaktion = () => {
    if (!abschluss) return insBild('kreislauf-befaehigung');
    if (abschluss.art === 'mandat-beenden') return router.push(WEG.mandat(mandatId));
    if (abschluss.art === 'nachsorge') return insBild('kreislauf-nachher');
    return insBild('kreislauf-wirkung');
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      <ReiterAntwort titel="Abschluss & Kreislauf" erklaerung="fulfillment.wirkung"
        antworten={[
          { frage: 'Wo steht der Kunde im Kreislauf?', ...lage },
          { frage: 'Läuft es ohne uns?', ampel: !f.befaehigung.length ? 'gelb' : befProzent >= 75 ? 'gruen' : befProzent >= 25 ? 'gelb' : 'rot', antwort: f.befaehigung.length ? `${erfuellt} von ${f.befaehigung.length} ${wort(f.befaehigung.length, 'Kriterium', 'Kriterien')} erfüllt` : 'Noch keine Kriterien', unter: 'Ziel: Der Kunde führt Prozess, Rituale und Kennzahlen selbst.', links: <FortschrittsRing prozent={befProzent} farbe={LEUCHT.gut} groesse={48} label="Befähigung" />, onClick: () => insBild('kreislauf-befaehigung') },
          { frage: 'Wirkungsbericht', ampel: f.wirkung ? 'gruen' : f.status === 'abgeschlossen' ? 'rot' : 'gelb', antwort: f.wirkung ? `Erstellt am ${tagKurz(f.wirkung.erstelltAm)}` : 'Noch nicht erstellt', unter: f.wirkung ? 'Vorher → jetzt, Quick Wins, Geliefertes, Befähigung.' : 'Am Ende: vorher → jetzt aus dem Wert-Konto — die Vorschau steht unten.', onClick: () => insBild('kreislauf-wirkung') },
        ]}
        aktion={<Knopf haupt onClick={hauptaktion}>{abschluss ? abschluss.text : 'Befähigung prüfen'}</Knopf>} />
      <Karte i={1} ton="fokus" licht={LEUCHT.business}>
        <Ueberschrift erklaerung="fulfillment.kreislauf" rechts={<Link href={WEG.vertriebsplanung('kreislauf')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Kreislauf der Markttraktion ›</Link>}>Der Kreislauf — hier steht {daten.mandat.kunde}</Ueberschrift>
        <KreislaufRad stufen={stufen} hier={stand} durchlaufen={KREISLAUF_REIHE.slice(0, Math.max(0, idx))}
          beschreibung={`Kreislauf: ${daten.mandat.kunde} steht bei „${KREISLAUF_NAME[stand]}“.`}
          mitte={<span style={{ display: 'grid', gap: 4 }}><span style={{ ...MIKRO }}>hier steht</span><b style={{ fontSize: TYP.body, color: C.ink }}>{daten.mandat.kunde}</b><span style={klein}>{KREISLAUF_NAME[stand]}</span></span>}
          onStufe={s => { if (s.href) router.push(s.href); else insBild('kreislauf-nachher'); }}
          onMitte={() => { if (stand === 'nachher') insBild('kreislauf-nachher'); else router.push(kreislaufWeg(stand, daten.mandat)); }} />
        <div style={klein}>Ein Kunde läuft einmal herum: aus einem Kanal wird ein Lead, ein Deal, ein Abschluss — dann liefern wir. Nach der Leistung (Empfehlung, nächste Stufe, Wiederkauf) beginnt der Kreis von vorn. Jede Stufe öffnet ihre Ansicht.</div>
      </Karte>
      <BefaehigungKarte daten={daten} ops={ops} />
      <WirkungKarte daten={daten} melde={melde} ops={ops} />
      <NachLeistungKarte daten={daten} schritte={nachLeistung} fehler={nlFehler} neuLaden={ladeNL} melde={melde} plan={plan} />
    </div>
  );
}

// ─── Befähigung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function BefaehigungKarte({ daten, ops }: { daten: FallAntwort; ops: Ops }) {
  // 15.10. (Abnahme B5): nie „F7“ — der Abstimmungspunkt heißt wie im Ablauf (Nummer + Titel).
  const kuerzel = (t: string) => ohneKuerzel(t, abstimmungsNummern(daten.fall?.knoten ?? []), daten.vorlage?.freigaben ?? []);
  const f = daten.fall!;
  const [neu, setNeu] = useState('');
  const [schreiben, setSchreiben] = useState(false);
  const erfuellt = f.befaehigung.filter(b => b.erfuellt).length;
  return (
    <Karte i={2} id="kreislauf-befaehigung">
      <Ueberschrift erklaerung="fulfillment.befaehigung" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span>{erfuellt}/{f.befaehigung.length}</span><MehrKnopf titel="Befähigung" mehr={[{ id: 'neu', label: 'Kriterium hinzufügen', tun: () => setSchreiben(true) }]} /></span>}>Befähigung — läuft es ohne uns?</Ueberschrift>
      {f.befaehigung.length > 0 && (
        <Liste>
          {f.befaehigung.map(b => (
            <Zeile key={b.id} links={<HakenZiel an={b.erfuellt} onChange={() => ops([{ op: 'befaehigung', id: b.id, erfuellt: !b.erfuellt }])} label={b.text} />} titel={b.text} umbrechen
              unter={b.erfuellt && b.am ? `erfüllt ${tagKurz(b.am)}` : 'noch nicht'}
              rechts={<Knopf leise ariaLabel={`„${b.text}“ entfernen`} onClick={() => ops([{ op: 'befaehigung', id: b.id, weg: true }])}>×</Knopf>} />
          ))}
        </Liste>
      )}
      {(schreiben || !f.befaehigung.length) && (
        <form onSubmit={e => { e.preventDefault(); if (neu.trim()) void ops([{ op: 'befaehigung', text: neu.trim() }]).then(ok => { if (ok) { setNeu(''); setSchreiben(false); } }); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="z. B. Das Team führt den Wochen-Check selbst" aria-label="Neues Kriterium" style={{ ...feld, flex: '1 1 260px', minWidth: 0 }} />
          <Knopf typ="submit" aus={!neu.trim()}>Hinzufügen</Knopf>
        </form>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Erfüllte Kriterien stehen im Wirkungsbericht — und sagen, wann die Übergabe dran ist ({kuerzel('F7')}).</div>
    </Karte>
  );
}

// ─── Wirkungsbericht ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function WirkungKarte({ daten, melde, ops }: { daten: FallAntwort; melde: Melde; ops: Ops }) {
  const m = daten.mandat;
  const f = daten.fall!;
  const [dok, setDok] = useState<WirkungsDokument | null>(null);
  const [zitat, setZitat] = useState({ text: '', am: '', wie: '' });
  const [mail, setMail] = useState<MailEntwurf | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const erstellt = f.wirkung;
  useEffect(() => {
    let weg = false;
    void holeJson<{ dokument: WirkungsDokument }>(`/api/fulfillment/wirkung?m=${encodeURIComponent(m.id)}&vorschau=1`).then(a => { if (!weg && a.ok) setDok(a.j.dokument); });
    return () => { weg = true; };
  }, [m.id, erstellt?.erstelltAm]);
  const post = (body: Record<string, unknown>) => holeJson<Record<string, unknown>>('/api/fulfillment/wirkung', { method: 'POST', body: JSON.stringify({ mandatId: m.id, ...body }) });
  const erstellen = async () => {
    setLaeuft(true);
    const mitZitat = zitat.text.trim() ? { zitat: { text: zitat.text.trim(), einwilligungAm: zitat.am, wie: zitat.wie.trim() } } : {};
    const a = await post({ aktion: 'erstellen', ...mitZitat });
    setLaeuft(false);
    if (a.ok) { geaendert(); melde('Wirkungsbericht erstellt.'); } else melde(fehlerText(a), 'kritisch');
  };
  const perMail = async () => {
    const a = await post({ aktion: 'fuer-mail' });
    if (!a.ok) { melde(fehlerText(a), 'kritisch'); return; }
    const j = a.j as { datei: { id: string; name: string }; anrede: 'Du' | 'Sie'; gesellschaft: string; an: { email: string; name?: string } | null; vorname?: string };
    const du = j.anrede === 'Du';
    const gruss = du ? `Hallo${j.vorname ? ` ${j.vorname}` : ''},` : 'Guten Tag,';
    const text = du
      ? `${gruss}\n\nim Anhang findest du unseren Wirkungsbericht: was wir gemeinsam erreicht haben, vorher und jetzt.\n\nDanke für die Zusammenarbeit!\n`
      : `${gruss}\n\nim Anhang finden Sie unseren Wirkungsbericht: was wir gemeinsam erreicht haben, vorher und jetzt.\n\nVielen Dank für die Zusammenarbeit.\n`;
    setMail({ betreff: `Wirkungsbericht · ${m.kunde}`.slice(0, 200), text, an: j.an, gesellschaft: j.gesellschaft, anhang: j.datei });
  };
  return (
    <Karte i={3} id="kreislauf-wirkung">
      <Ueberschrift erklaerung="fulfillment.wirkung" rechts={erstellt ? <Chip farbe={LEUCHT.gut}>erstellt {tagKurz(erstellt.erstelltAm)}</Chip> : <Chip farbe={C.inkLeise}>Vorschau</Chip>}>Wirkungsbericht</Ueberschrift>
      {dok && (
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={klein}>{dok.zeitraum}</span>
          {dok.wertKonto.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={MIKRO}>Wert-Konto · vorher → jetzt (Ziel)</span>
              {dok.wertKonto.map(z => (
                <div key={z.zielId} style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600 }}>{z.name}</span>
                  <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{z.vorher} → <b style={{ color: z.jetzt === '—' ? C.inkLeise : LEUCHT.gut }}>{z.jetzt === '—' ? 'noch keine Messung' : z.jetzt}</b> (Ziel {z.ziel})</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip farbe={dok.quickWins.length ? LEUCHT.gut : C.inkLeise}>{dok.quickWins.length} Quick Win{dok.quickWins.length === 1 ? '' : 's'} erledigt</Chip>
            <Chip farbe={dok.lieferobjekte.length ? LEUCHT.gut : C.inkLeise}>{dok.lieferobjekte.length} Ergebnis{dok.lieferobjekte.length === 1 ? '' : 'se'} geliefert</Chip>
            {dok.befaehigung.length > 0 && <Chip farbe={C.inkDim}>Befähigung {dok.befaehigung.filter(b => b.erfuellt).length} von {dok.befaehigung.length}</Chip>}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Interne Bausteine, Onboarding-Schritte, die Gesundheit des Mandats und das Honorar erscheinen nie im Bericht.</div>
        </div>
      )}
      <Feldzeile label="Kundenzitat (nur mit Einwilligung)"><textarea rows={2} maxLength={1000} value={zitat.text} onChange={e => setZitat({ ...zitat, text: e.target.value })} style={{ ...feld, fontSize: 16 }} /></Feldzeile>
      {zitat.text.trim() && (
        <Leiste>
          <Feldzeile label="Einwilligung am"><input type="date" value={zitat.am} max={localDay()} onChange={e => setZitat({ ...zitat, am: e.target.value })} style={{ ...feld, width: 170 }} /></Feldzeile>
          <Feldzeile label="Wie (z. B. per Mail)"><input value={zitat.wie} maxLength={300} onChange={e => setZitat({ ...zitat, wie: e.target.value })} style={feld} /></Feldzeile>
        </Leiste>
      )}
      <Leiste>
        <Knopf onClick={erstellen} aus={laeuft || (!!zitat.text.trim() && (!zitat.am || !zitat.wie.trim()))}>{erstellt ? 'Neu erstellen' : 'Bericht erstellen'}</Knopf>
        {erstellt?.dateiName && <a href={`/api/fulfillment/wirkung?m=${encodeURIComponent(m.id)}`} download style={{ color: C.aktiv, fontSize: TYP.bedien, alignSelf: 'center', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>↓ PDF</a>}
        {erstellt?.dateiName && <Knopf onClick={perMail}>Per Mail senden …</Knopf>}
        {erstellt && f.status !== 'abgeschlossen' && <Knopf leise onClick={() => ops([{ op: 'fall-status', status: 'abgeschlossen' }], 'Fall abgeschlossen — die Nachsorge zählt ab dem Mandatsende.')}>Fall abschließen</Knopf>}
      </Leiste>
      {mail && <MailSenden titel="Wirkungsbericht senden" entwurf={mail} hinweis="Der Bericht hängt als PDF an." onZu={() => setMail(null)} onGesendet={() => { melde('Gesendet.'); }} />}
    </Karte>
  );
}

// ─── Nach der Leistung: Markttraktion-Schritte, Folgen des Berichts, Nachsorge, Follow-ups ──────────────────────────────────────────
const ZUSTAND: Record<NachsorgePunkt['zustand'], { text: string; farbe: string }> = {
  vorgeschlagen: { text: 'im Stapel vorgeschlagen', farbe: LEUCHT.gut }, faellig: { text: 'fällig — kommt am Morgen in den Stapel', farbe: LEUCHT.achtung },
  kommt: { text: 'kommt', farbe: C.inkDim }, wartet: { text: 'startet mit dem Mandatsende', farbe: C.inkLeise },
};

function NachLeistungKarte({ daten, schritte, fehler, neuLaden, melde, plan }: { daten: FallAntwort; schritte: NachLeistungSchritt[] | null; fehler: string | null; neuLaden: () => Promise<void>; melde: Melde; plan: NachsorgePunkt[] }) {
  const m = daten.mandat;
  const f = daten.fall!;
  const ende = daten.nachsorge?.ende ?? null;
  const haken = async (s: NachLeistungSchritt) => {
    const a = await holeJson('/api/crm/planung', { method: 'PATCH', body: JSON.stringify({ ops: [{ op: 'schritt', mandatId: m.id, schritt: s.id, erledigt: !s.erledigt }] }) });
    if (!a.ok) melde(fehlerText(a), 'kritisch'); else await neuLaden();
  };
  const testimonial = async () => {
    const spaceId = m.firmaId ? `m-${m.firmaId}` : m.gesellschaft;
    const a = await holeJson<{ id?: string }>('/api/tasks/create', { method: 'POST', body: JSON.stringify({ title: `Kundenstimme erbitten · ${m.kunde}`.slice(0, 300), description: 'Nach dem Wirkungsbericht um eine kurze Kundenstimme bitten — Einwilligung zur Nutzung schriftlich festhalten.', priority: 'medium', bezug: { mandatId: m.id }, spaceId }) });
    melde(a.ok ? 'Aufgabe „Kundenstimme erbitten“ angelegt — abgehakt wird „Testimonial“, sobald die Stimme mit Einwilligung da ist.' : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  const empfehlung = async () => {
    const faellig = tagPlus(localDay(), 14);
    const a = await holeJson('/api/crm/followup', { method: 'POST', body: JSON.stringify({ aktion: 'anlegen', bezug: { art: 'mandat', id: m.id }, ...(m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), text: 'Nach einer Empfehlung fragen', faellig, anfrageId: neueAnfrageId() }) });
    if (a.ok) geaendert();
    melde(a.ok ? `Follow-up „Nach einer Empfehlung fragen“ am ${tagKurz(faellig)} steht.` : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  const fallstudie = async (mitNamen: boolean) => {
    const a = await holeJson<Record<string, unknown>>('/api/fulfillment/wirkung', { method: 'POST', body: JSON.stringify({ mandatId: m.id, aktion: 'fallstudie', mitNamen }) });
    if (a.ok) geaendert();
    melde(a.ok ? String(a.j.text ?? 'Fallstudie als Entwurf in der Bibliothek.') : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  const folgen = [
    { id: 'stimme', label: 'Kundenstimme erbitten', hinweis: 'Aufgabe am Mandat — Einwilligung festhalten.', tun: testimonial },
    { id: 'fallstudie', label: 'Fallstudie als Entwurf (anonym)', hinweis: 'Baustein-Entwurf in der Bibliothek, ohne Namen.', tun: () => fallstudie(false) },
    ...(f.wirkung?.zitat?.einwilligungAm ? [{ id: 'fallstudie-name', label: 'Fallstudie mit Namen', hinweis: 'Nur mit vermerkter Einwilligung.', tun: () => fallstudie(true) }] : []),
    { id: 'empfehlung', label: 'Empfehlung erbitten (in 14 Tagen)', hinweis: 'Follow-up am Mandat in der Markttraktion.', tun: empfehlung },
  ];
  return (
    <Karte i={4} id="kreislauf-nachher">
      <Ueberschrift erklaerung="fulfillment.nachsorge" rechts={<MehrKnopf titel="Nach der Leistung" mehr={folgen} />}>Nach der Leistung</Ueberschrift>
      {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
      {schritte && schritte.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Schritte der Markttraktion für diesen Kunden</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {schritte.map(s => (
              <button key={s.id} type="button" className="fassbar" disabled={s.quelle === 'abgeleitet'} aria-pressed={s.erledigt} onClick={() => void haken(s)}
                title={s.quelle === 'abgeleitet' ? `${s.grund ?? 'abgeleitet'} — kommt aus den Daten` : s.erledigt ? `abgehakt ${s.am ? tagKurz(s.am) : ''} — antippen nimmt es zurück` : 'antippen hakt ab'}
                style={{ minHeight: 44, padding: '6px 12px', borderRadius: 999, fontSize: TYP.bedien, cursor: s.quelle === 'abgeleitet' ? 'default' : 'pointer', background: s.erledigt ? `${LEUCHT.gut}22` : 'transparent', color: s.erledigt ? LEUCHT.gut : C.inkDim, border: `1px ${s.erledigt ? 'solid' : 'dashed'} ${s.erledigt ? LEUCHT.gut : 'rgba(255,255,255,.18)'}` }}>
                {s.erledigt ? '✓ ' : ''}{s.label}{s.quelle === 'abgeleitet' ? ' · automatisch' : ''}
              </button>
            ))}
          </div>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Dieselbe Liste wie Markttraktion › Planung › Kreislauf. Upselling und Cross-Selling hakt ein neuer Deal der Firma von selbst ab.</span>
        </div>
      )}
      <Leiste>
        <Knopf onClick={testimonial}>Kundenstimme erbitten</Knopf>
        <Knopf leise onClick={empfehlung}>Empfehlung erbitten</Knopf>
        <Link href={WEG.mandat(m.id)} style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Nächste Stufe anbieten ›</Link>
      </Leiste>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={MIKRO}>Nachsorge {ende ? `ab Mandatsende ${tagKurz(ende)}` : '— startet mit dem Mandatsende'}</span>
        <Liste>
          {plan.map(p => (
            <Zeile key={p.tag} umbrechen links={<Punkt farbe={ZUSTAND[p.zustand].farbe} />} titel={`Tag ${p.tag} · ${p.text}`}
              unter={`${p.am ? `${tagKurz(p.am)} · ` : ''}${ZUSTAND[p.zustand].text}`}
              rechts={p.zustand === 'vorgeschlagen' ? <Link href={WEG.freigaben(undefined, 'business')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Stapel ›</Link> : undefined} />
          ))}
        </Liste>
        {!ende && <div style={klein}>Die Nachsorge zählt ab dem Mandatsende — beendet wird das Mandat unter <Link href={WEG.mandat(m.id)} style={{ color: C.aktiv }}>Produkte & Mandate › Mandat</Link>. Jeder Vorschlag kommt am Morgen in den Freigabe-Stapel; angelegt wird erst per Klick.</div>}
      </div>
      {(daten.followups?.length ?? 0) > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={MIKRO}>Follow-ups am Mandat</span>
          <Liste>
            {daten.followups!.slice(0, 6).map(x => (
              <Zeile key={x.id} umbrechen links={<Punkt farbe={x.status === 'offen' ? (x.faellig < localDay() ? LEUCHT.kritisch : LEUCHT.achtung) : LEUCHT.gut} />} titel={x.text} unter={`${x.status === 'offen' ? 'fällig' : x.status} ${tagKurz(x.faellig)}`} />
            ))}
          </Liste>
          <Link href={WEG.followup()} style={{ color: C.aktiv, fontSize: TYP.bedien }}>In der Markttraktion › Follow-up ›</Link>
        </div>
      )}
    </Karte>
  );
}
