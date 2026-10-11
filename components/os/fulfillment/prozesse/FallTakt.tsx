'use client';

// ─── Fulfillment › Fall › Takt & Wirkung (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 5.1, 5.3) ──────────────────────────────────────────
// Rituale: „Termin anlegen“ öffnet den VORHANDENEN Anlege-Dialog des Kalenders (vorbelegt: Titel, Dauer, Bezug zum Mandat, Gäste aus der
// Stakeholder-Karte — eingeladen wird erst nach der Rückfrage im Dialog); danach merkt sich der Fall die Termin-Kennung. Mitschriften im
// 4-Zeilen-Standard (Anlass · Ergebnis · nächster Schritt · Frist) — per Klick ins Entscheidungs-Log oder als Aufgabe. Befähigung (Ziel ist,
// dass der Kunde es selbst kann). Wirkungsbericht als PDF (Kundenzitat nur mit vermerkter Einwilligung), senden nur per Klick, Folgen als
// Vorschläge (Aufgabe, Fallstudie-Entwurf, Empfehlung als Follow-up, nächste Stufe).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Feldzeile, HakenZiel, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { NeuerTermin } from '../../kalender/NeuerTermin';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { tagPlus } from '@/lib/kalender/zeit';
import { RHYTHMUS_TEXT, ritualVorgabe, mitschriftAlsAufgabe, mitschriftAlsEntscheidung } from '@/lib/fulfillment/prozesse/rituale';
import type { WirkungsDokument } from '@/lib/fulfillment/prozesse/wirkung';
import type { Mitschrift, RitualVorlage } from '@/lib/fulfillment/typen';
import type { Vorgabe } from '@/lib/kalender/formular';
import { useFall, fallOps, fehlerText, holeJson, geaendert, neueAnfrageId, tagKurz, tagLang, type FallAntwort } from './daten';
import { klein, feld, Leiste, Meldung } from './teile';
import { MailSenden, type MailEntwurf } from './MailSenden';

type Melde = (text: string | null, art?: 'gut' | 'kritisch' | 'achtung') => void;

export function FallTakt({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const melde: Melde = (text, art = 'gut') => setMeldung(text ? { text, art } : null);
  const ops = async (o: Record<string, unknown>[], gut?: string) => { const a = await fallOps(mandatId, o); melde(a.ok ? gut ?? null : fehlerText(a), a.ok ? 'gut' : 'kritisch'); return a.ok; };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      <RitualeKarte daten={daten} ops={ops} melde={melde} />
      <MitschriftenKarte daten={daten} ops={ops} melde={melde} />
      <BefaehigungKarte daten={daten} ops={ops} />
      <WirkungKarte daten={daten} melde={melde} />
    </div>
  );
}

// ─── Rituale ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function RitualeKarte({ daten, ops, melde }: { daten: FallAntwort; ops: (o: Record<string, unknown>[], gut?: string) => Promise<boolean>; melde: Melde }) {
  const [offen, setOffen] = useState<{ ritual: RitualVorlage; vorgabe: Vorgabe; wiederholung: string | null } | null>(null);
  const f = daten.fall!;
  const heute = localDay();
  const namen = new Map((daten.personen ?? []).map(p => [p.id, p]));
  // Gäste: Stakeholder mit Adresse (eingeschränkte Personen fehlen schon in der Liste der Personen).
  const gaeste = f.stakeholder.map(s => namen.get(s.kontaktId)).filter((p): p is NonNullable<typeof p> => !!p?.email).map(p => ({ email: p.email!, name: p.name, kontaktId: p.id }));
  const genutzt = new Map(f.rituale.map(r => [r.ritualId, r]));
  const rituale = daten.rituale ?? [];
  return (
    <Karte i={1}>
      <Ueberschrift erklaerung="fulfillment.rituale">Rituale</Ueberschrift>
      {!rituale.length && <div style={klein}>Die Bibliothek hat noch keine Rituale — unter Fulfillment › Prozesse „Aus Muster anlegen“.</div>}
      {rituale.length > 0 && (
        <Liste>
          {rituale.map(r => {
            const g = genutzt.get(r.id);
            const naechster = daten.termine?.[r.id];
            return (
              <Zeile key={r.id} titel={r.titel} umbrechen
                unter={[RHYTHMUS_TEXT[r.rhythmus], `${r.dauerMin} Min.`, g ? `${g.terminUids.length} Termin${g.terminUids.length === 1 ? '' : 'e'} angelegt` : null, naechster ? `nächster ${tagKurz(naechster)}` : null].filter(Boolean).join(' · ')}
                rechts={<Knopf leise onClick={() => {
                  const v = ritualVorgabe(r, { mandatId: daten.mandat.id, ...(daten.mandat.firmaId ? { firmaId: daten.mandat.firmaId } : {}), kunde: daten.mandat.kunde, heute, gaeste });
                  setOffen({ ritual: r, ...v });
                }}>Termin anlegen</Knopf>} />
            );
          })}
        </Liste>
      )}
      {offen?.wiederholung && <Hinweis art="info">Rhythmus „{offen.wiederholung}“ — im Dialog unter „Wiederholt sich nicht ▾“ einstellen.</Hinweis>}
      {offen && (
        <NeuerTermin vorgabe={offen.vorgabe} heute={heute} standardDauer={offen.ritual.dauerMin} kalender={[]} bereich="business"
          onZu={() => setOffen(null)}
          onAngelegt={was => {
            const r = offen.ritual;
            if (was.uid) void ops([{ op: 'ritual-merken', ritualId: r.id, terminUid: was.uid }], `Termin „${r.titel}“ angelegt und am Fall vermerkt.`);
            else melde(was.hinweis ?? 'Angelegt.', 'achtung');
          }} />
      )}
    </Karte>
  );
}

// ─── Mitschriften ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function MitschriftenKarte({ daten, ops, melde }: { daten: FallAntwort; ops: (o: Record<string, unknown>[], gut?: string) => Promise<boolean>; melde: Melde }) {
  const f = daten.fall!;
  const leer = { anlass: '', ergebnis: '', naechster: '', frist: '', ritualId: null as string | null };
  const [w, setW] = useState(leer);
  const rituale = daten.rituale ?? [];
  const liste = [...f.mitschriften].sort((a, b) => (a.am < b.am ? 1 : -1));
  const alsAufgabe = async (m: Mitschrift) => {
    const spaceId = daten.mandat.firmaId ? `m-${daten.mandat.firmaId}` : daten.mandat.gesellschaft;
    const a = await holeJson<{ id?: string }>('/api/tasks/create', { method: 'POST', body: JSON.stringify({ ...mitschriftAlsAufgabe(m, daten.mandat.id), spaceId }) });
    melde(a.ok ? `Aufgabe „${m.naechster.slice(0, 60)}“ angelegt.` : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  return (
    <Karte i={2}>
      <Ueberschrift erklaerung="fulfillment.mitschrift" rechts={<span>{f.mitschriften.length}</span>}>Mitschriften</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void ops([{ op: 'mitschrift', eintrag: { anlass: w.anlass, ergebnis: w.ergebnis, naechster: w.naechster, ...(w.frist ? { frist: w.frist } : {}), ...(w.ritualId ? { ritualId: w.ritualId } : {}) } }], 'Mitschrift gespeichert.').then(ok => { if (ok) setW(leer); }); }} style={{ display: 'grid', gap: 8 }}>
        <Feldzeile label="Anlass"><input value={w.anlass} maxLength={300} onChange={e => setW({ ...w, anlass: e.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Ergebnis"><input value={w.ergebnis} maxLength={300} onChange={e => setW({ ...w, ergebnis: e.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Nächster Schritt"><input value={w.naechster} maxLength={300} onChange={e => setW({ ...w, naechster: e.target.value })} style={feld} /></Feldzeile>
        <Leiste>
          <Feldzeile label="Frist"><input type="date" value={w.frist} onChange={e => setW({ ...w, frist: e.target.value })} style={{ ...feld, width: 170 }} /></Feldzeile>
          {rituale.length > 0 && <Wahl label="Ritual" liste={rituale.map(r => ({ id: r.id, label: r.titel }))} wert={w.ritualId} onWahl={ritualId => setW({ ...w, ritualId })} onLeeren={() => setW({ ...w, ritualId: null })} leerenLabel="ohne Ritual" />}
        </Leiste>
        <div style={klein}>Kein Freitext über Personen — nur, was besprochen und vereinbart ist.</div>
        <div><Knopf typ="submit" aus={!w.anlass.trim() || !w.ergebnis.trim() || !w.naechster.trim()}>Mitschrift speichern</Knopf></div>
      </form>
      {liste.length > 0 && (
        <Liste>
          {liste.map(m => (
            <div key={m.id} style={{ display: 'grid', gap: 4, padding: '8px 0' }}>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{tagLang(m.am)}{m.ritualId ? ` · ${rituale.find(r => r.id === m.ritualId)?.titel ?? 'Ritual'}` : ''}{m.frist ? ` · Frist ${tagKurz(m.frist)}` : ''}</div>
              <div style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere' }}><b>{m.anlass}</b> — {m.ergebnis}</div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>Nächster Schritt: {m.naechster}</div>
              <Leiste>
                <Knopf leise onClick={() => ops([{ op: 'entscheidung', eintrag: mitschriftAlsEntscheidung(m) }], 'Ins Entscheidungs-Log übernommen.')}>→ Entscheidung</Knopf>
                <Knopf leise onClick={() => alsAufgabe(m)}>→ Aufgabe</Knopf>
                <Knopf leise onClick={() => ops([{ op: 'mitschrift', id: m.id, weg: true }])}>Entfernen</Knopf>
              </Leiste>
            </div>
          ))}
        </Liste>
      )}
    </Karte>
  );
}

// ─── Befähigung ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function BefaehigungKarte({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[], gut?: string) => Promise<boolean> }) {
  const f = daten.fall!;
  const [neu, setNeu] = useState('');
  const erfuellt = f.befaehigung.filter(b => b.erfuellt).length;
  return (
    <Karte i={3}>
      <Ueberschrift erklaerung="fulfillment.befaehigung" rechts={<span>{erfuellt}/{f.befaehigung.length}</span>}>Befähigung</Ueberschrift>
      {f.befaehigung.length > 0 && (
        <Liste>
          {f.befaehigung.map(b => (
            <Zeile key={b.id} links={<HakenZiel an={b.erfuellt} onChange={() => ops([{ op: 'befaehigung', id: b.id, erfuellt: !b.erfuellt }])} label={b.text} />} titel={b.text} umbrechen
              unter={b.erfuellt && b.am ? `erfüllt ${tagKurz(b.am)}` : undefined}
              rechts={<Knopf leise ariaLabel={`„${b.text}“ entfernen`} onClick={() => ops([{ op: 'befaehigung', id: b.id, weg: true }])}>×</Knopf>} />
          ))}
        </Liste>
      )}
      <form onSubmit={e => { e.preventDefault(); if (neu.trim()) void ops([{ op: 'befaehigung', text: neu.trim() }]).then(ok => { if (ok) setNeu(''); }); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="z. B. Das Team führt den Wochen-Check selbst" aria-label="Neues Kriterium" style={{ ...feld, flex: '1 1 260px', minWidth: 0 }} />
        <Knopf typ="submit" aus={!neu.trim()}>Hinzufügen</Knopf>
      </form>
    </Karte>
  );
}

// ─── Wirkungsbericht ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function WirkungKarte({ daten, melde }: { daten: FallAntwort; melde: Melde }) {
  const m = daten.mandat;
  const [dok, setDok] = useState<WirkungsDokument | null>(null);
  const [zitat, setZitat] = useState({ text: '', am: '', wie: '' });
  const [mail, setMail] = useState<MailEntwurf | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const erstellt = daten.fall!.wirkung;
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
  const testimonial = async () => {
    const spaceId = m.firmaId ? `m-${m.firmaId}` : m.gesellschaft;
    const a = await holeJson('/api/tasks/create', { method: 'POST', body: JSON.stringify({ title: `Kundenstimme erbitten · ${m.kunde}`.slice(0, 300), description: 'Nach dem Wirkungsbericht um eine kurze Kundenstimme bitten — Einwilligung zur Nutzung schriftlich festhalten.', priority: 'medium', bezug: { mandatId: m.id }, spaceId }) });
    melde(a.ok ? 'Aufgabe „Kundenstimme erbitten“ angelegt.' : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  const empfehlung = async () => {
    const faellig = tagPlus(localDay(), 14);
    const a = await holeJson('/api/crm/followup', { method: 'POST', body: JSON.stringify({ aktion: 'anlegen', bezug: { art: 'mandat', id: m.id }, ...(m.kontaktIds[0] ? { kontaktId: m.kontaktIds[0] } : {}), text: 'Nach einer Empfehlung fragen', faellig, anfrageId: neueAnfrageId() }) });
    melde(a.ok ? `Follow-up „Nach einer Empfehlung fragen“ am ${tagKurz(faellig)} steht.` : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  const fallstudie = async (mitNamen: boolean) => {
    const a = await post({ aktion: 'fallstudie', mitNamen });
    if (a.ok) geaendert();
    melde(a.ok ? String(a.j.text ?? 'Fallstudie als Entwurf in der Bibliothek.') : fehlerText(a), a.ok ? 'gut' : 'kritisch');
  };
  return (
    <Karte i={4}>
      <Ueberschrift erklaerung="fulfillment.wirkung" rechts={erstellt ? <Chip farbe={LEUCHT.gut}>erstellt {tagKurz(erstellt.erstelltAm)}</Chip> : undefined}>Wirkungsbericht</Ueberschrift>
      {dok && (
        <div style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, color: C.inkDim }}>
          <div>{dok.zeitraum}</div>
          {dok.wertKonto.map(z => <div key={z.zielId}>{z.name}: {z.vorher} → {z.jetzt} (Ziel {z.ziel})</div>)}
          {dok.quickWins.length > 0 && <div>Schnelle Erfolge: {dok.quickWins.length}</div>}
          {dok.lieferobjekte.length > 0 && <div>Geliefert: {dok.lieferobjekte.join(' · ')}</div>}
          {dok.befaehigung.length > 0 && <div>Befähigung: {dok.befaehigung.filter(b => b.erfuellt).length} von {dok.befaehigung.length} erfüllt</div>}
          <div style={{ color: C.inkLeise }}>Interne Bausteine und Onboarding-Schritte erscheinen nie im Bericht.</div>
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
        <Knopf haupt onClick={erstellen} aus={laeuft || (!!zitat.text.trim() && (!zitat.am || !zitat.wie.trim()))}>{erstellt ? 'Neu erstellen' : 'Bericht erstellen'}</Knopf>
        {erstellt?.dateiName && <a href={`/api/fulfillment/wirkung?m=${encodeURIComponent(m.id)}`} download style={{ color: C.aktiv, fontSize: TYP.bedien, alignSelf: 'center' }}>PDF herunterladen</a>}
        {erstellt?.dateiName && <Knopf onClick={perMail}>Per Mail senden …</Knopf>}
      </Leiste>
      {erstellt && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={klein}>Danach (Vorschläge — nichts passiert ohne Klick):</div>
          <Leiste>
            <Knopf leise onClick={testimonial}>Kundenstimme erbitten</Knopf>
            <Knopf leise onClick={() => fallstudie(false)}>Fallstudie als Entwurf</Knopf>
            {erstellt.zitat?.einwilligungAm && <Knopf leise onClick={() => fallstudie(true)}>Fallstudie mit Namen</Knopf>}
            <Knopf leise onClick={empfehlung}>Empfehlung erbitten (in 14 Tagen)</Knopf>
            <Link href={WEG.mandat(m.id)} style={{ color: C.aktiv, fontSize: TYP.bedien, alignSelf: 'center' }}>Nächste Stufe anbieten ›</Link>
          </Leiste>
        </div>
      )}
      {mail && <MailSenden titel="Wirkungsbericht senden" entwurf={mail} hinweis="Der Bericht hängt als PDF an." onZu={() => setMail(null)} onGesendet={() => { melde('Gesendet.'); }} />}
    </Karte>
  );
}
