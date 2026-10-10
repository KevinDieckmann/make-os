'use client';

// ─── Unternehmen › Marken & Versicherungen: Laufzeiten, Verlängerung, Kündigung (10.10.) ──────────────────────────────
// Marken (Schutzende, Verlängerungsfenster, Nachfrist, Benutzungsschonfrist), Domains (Ablauf, Inhaber = Gesellschaft, zweiter Faktor — nie
// Zugangsdaten) und Versicherungen („kündigen bis“, stillschweigende Verlängerung, Sonderkündigung nach drei Jahren). Gerechnet in
// lib/gesellschaften/schild/schutz.ts; die Stichtage stehen im Kalender, im Vorlauf entsteht eine Aufgabe.

import { useState } from 'react';
import { BadgeCheck, Globe, Umbrella } from 'lucide-react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Schalter, ZeileAktionen, useRueckgaengig, eingabe, feld } from '../../ui';
import { MARKEN_AEMTER, MARKEN_FORMEN, VERSICHERUNG_ARTEN, type Marke, type Domain, type Versicherung, type MarkenAmt, type MarkenForm, type VersicherungArt, type SchildListe } from '@/lib/gesellschaften/schild/typen';
import { markeFristen, domainZustand, policeFristen, artLabel, VORGABE_KUENDIGUNGSFRIST_MONATE, VORGABE_VERLAENGERUNG_MONATE } from '@/lib/gesellschaften/schild/schutz';
import { euroText } from '@/lib/gesellschaften/modell';
import { Felder, Feldzeile, centEingabe } from '../teile';
import type { SEintrag, Schreiben } from './daten';
import { AmpelChip, SchildFuss, datum, klein } from './teile';

type Was = 'marken' | 'domains' | 'versicherungen';

export function Schutz({ e, sw, heute }: { e: SEintrag; sw: Schreiben; heute: string }) {
  const { melden, hinweis } = useRueckgaengig();
  const [form, setForm] = useState<{ was: Was; id?: string } | null>(null);
  const weg = async (l: SchildListe, id: string, titel: string) => { const r = await sw.schreibe({ liste: l, eintragId: id, aktion: 'loeschen' }); if (r.ok) melden(`„${titel}“ im Papierkorb`, () => void sw.schreibe({ liste: l, eintragId: id, aktion: 'wiederherstellen' })); };
  const marken = (e.marken ?? []).filter(x => !x.geloeschtAm), domains = (e.domains ?? []).filter(x => !x.geloeschtAm), policen = (e.versicherungen ?? []).filter(x => !x.geloeschtAm);
  const zu = () => setForm(null);
  return (
    <>
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={() => setForm({ was: 'marken' })}>+ Marke</Knopf>}>Marken</Ueberschrift>
        {form?.was === 'marken' && <MarkeForm m={marken.find(x => x.id === form.id)} sw={sw} fertig={zu} heute={heute} />}
        {!marken.length ? <Leer symbol={<BadgeCheck size={16} />}>Keine Marke erfasst.</Leer> : (
          <Liste>{marken.map(m => {
            const f = markeFristen(m, heute);
            const a = f.zustand === 'abgelaufen' || f.zustand === 'nachfrist' ? 'rot' : f.zustand === 'verlaengern' || f.zustand === 'unbekannt' || m.inhaberIstGesellschaft === false ? 'gelb' : 'gruen';
            return (
              <ZeileAktionen key={m.id} titel={m.bezeichnung} onLoeschen={() => weg('marken', m.id, m.bezeichnung)}>
                <Zeile umbrechen titel={m.bezeichnung} onClick={() => setForm({ was: 'marken', id: m.id })} rechts={<AmpelChip a={a} text={f.zustand === 'verlaengern' ? 'verlängern' : f.zustand === 'nachfrist' ? 'Nachfrist' : f.zustand === 'abgelaufen' ? 'abgelaufen' : f.zustand === 'unbekannt' ? 'Anmeldetag fehlt' : 'geschützt'} />}
                  unter={[MARKEN_AEMTER.find(x => x.id === m.amt)?.label, m.registerNr ? `Nr. ${m.registerNr}` : undefined, m.klassen?.length ? `Klassen ${m.klassen.join(', ')}` : undefined, f.schutzEnde ? `Schutz bis ${datum(f.schutzEnde)}` : undefined, f.verlaengerungAb ? `verlängern ab ${datum(f.verlaengerungAb)}` : undefined, f.schonfristEnde ? `Schonfrist bis ${datum(f.schonfristEnde)}${f.schonfristGeschaetzt ? ' (geschätzt)' : ''}` : undefined, m.inhaberIstGesellschaft === false ? 'Inhaber ist nicht die Gesellschaft' : undefined].filter(Boolean).join(' · ')} />
              </ZeileAktionen>
            );
          })}</Liste>
        )}
        <SchildFuss>Schutz 10 Jahre ab Anmeldetag (§ 47 MarkenG, Art. 53 UMV), Verlängerung 6 Monate vorher, Nachfrist 6 Monate; Benutzung nach 5 Jahren nachweisen (§ 26 MarkenG).</SchildFuss>
      </Karte>
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={() => setForm({ was: 'domains' })}>+ Domain</Knopf>}>Domains</Ueberschrift>
        {form?.was === 'domains' && <DomainForm d={domains.find(x => x.id === form.id)} marken={marken} sw={sw} fertig={zu} />}
        {!domains.length ? <Leer symbol={<Globe size={16} />}>Keine Domain erfasst.</Leer> : (
          <Liste>{domains.map(d => {
            const z = domainZustand(d, heute);
            return (
              <ZeileAktionen key={d.id} titel={d.domain} onLoeschen={() => weg('domains', d.id, d.domain)}>
                <Zeile umbrechen titel={d.domain} onClick={() => setForm({ was: 'domains', id: d.id })} rechts={<AmpelChip a={z === 'abgelaufen' ? 'rot' : z === 'bald' || z === 'unbekannt' || d.inhaberIstGesellschaft === false ? 'gelb' : 'gruen'} text={z === 'abgelaufen' ? 'abgelaufen' : z === 'bald' ? 'läuft bald ab' : z === 'unbekannt' ? 'Ablauf fehlt' : 'aktiv'} />}
                  unter={[d.registrar, d.laeuftBis ? `bis ${datum(d.laeuftBis)}` : undefined, d.autoVerlaengerung ? 'verlängert sich automatisch' : undefined, d.zweiFaktor ? 'zweiter Faktor an' : d.zweiFaktor === false ? 'ohne zweiten Faktor' : undefined, d.inhaberIstGesellschaft === false ? 'Inhaber ist nicht die Gesellschaft' : undefined].filter(Boolean).join(' · ')} />
              </ZeileAktionen>
            );
          })}</Liste>
        )}
        <SchildFuss>Nie Passwörter oder Zugangskennungen hier — nur, ob und wo der Zugang hinterlegt ist.</SchildFuss>
      </Karte>
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={() => setForm({ was: 'versicherungen' })}>+ Versicherung</Knopf>}>Versicherungen</Ueberschrift>
        {form?.was === 'versicherungen' && <VersicherungForm v={policen.find(x => x.id === form.id)} sw={sw} fertig={zu} />}
        {!policen.length ? <Leer symbol={<Umbrella size={16} />}>Keine Versicherung erfasst — Betriebshaftpflicht, Vermögensschaden, D&O und Cyber prüfen.</Leer> : (
          <Liste>{policen.map(v => {
            const f = policeFristen(v, heute);
            return (
              <ZeileAktionen key={v.id} titel={artLabel(v.art)} onLoeschen={() => weg('versicherungen', v.id, artLabel(v.art))}>
                <Zeile umbrechen titel={`${artLabel(v.art)}${v.versicherer ? ` · ${v.versicherer}` : ''}`} onClick={() => setForm({ was: 'versicherungen', id: v.id })}
                  rechts={<AmpelChip a={f.zustand === 'kuendigen-bald' || f.zustand === 'unbekannt' ? 'gelb' : f.zustand === 'abgelaufen' ? 'gelb' : 'gruen'} text={f.zustand === 'kuendigen-bald' ? 'entscheiden' : f.zustand === 'gekuendigt' ? 'gekündigt' : f.zustand === 'abgelaufen' ? 'beendet' : f.zustand === 'unbekannt' ? 'Ablauf fehlt' : 'läuft'} />}
                  unter={[v.deckungFallCent !== undefined ? `Deckung ${euroText(v.deckungFallCent)}` : undefined, f.periodeEnde ? `Periode bis ${datum(f.periodeEnde)}` : undefined, f.kuendigenBis && f.zustand !== 'gekuendigt' ? `kündigen bis ${datum(f.kuendigenBis)}` : undefined, f.sonderkuendigung ? '§ 11 Abs. 4 VVG' : undefined].filter(Boolean).join(' · ')} />
              </ZeileAktionen>
            );
          })}</Liste>
        )}
        <SchildFuss>Stillschweigende Verlängerung höchstens ein Jahr, Kündigungsfrist ein bis drei Monate (§ 11 VVG); länger als drei Jahre: Sonderkündigung zum Ende des dritten Jahres.</SchildFuss>
      </Karte>
      {hinweis}
    </>
  );
}

function Fehler({ t }: { t: string | null }) { return t ? <Hinweis art="kritisch" rolle="alert">{t}</Hinweis> : null; }
function Fuss({ fertig, aus }: { fertig: () => void; aus?: boolean }) { return <div style={{ display: 'flex', gap: 8 }}><Knopf typ="submit" aus={aus}>Speichern</Knopf><Knopf leise onClick={fertig}>Abbrechen</Knopf></div>; }
const formStil = { display: 'grid', gap: 12, margin: '6px 0 14px' } as const;

function MarkeForm({ m, sw, fertig, heute }: { m?: Marke; sw: Schreiben; fertig: () => void; heute: string }) {
  const [w, setW] = useState({ bezeichnung: m?.bezeichnung ?? '', form: (m?.form ?? 'wort') as MarkenForm, amt: (m?.amt ?? 'dpma') as MarkenAmt, registerNr: m?.registerNr ?? '', anmeldetag: m?.anmeldetag ?? '', eintragungstag: m?.eintragungstag ?? '', widerspruchsEnde: m?.widerspruchsEnde ?? '', schutzBis: m?.schutzBis ?? '', klassen: (m?.klassen ?? []).join(', '), inhaber: m?.inhaberIstGesellschaft ?? true, notiz: m?.notiz ?? '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const s = (k: keyof typeof w, v: string | boolean) => setW(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    const eintrag = { bezeichnung: w.bezeichnung, form: w.form, amt: w.amt, registerNr: w.registerNr || null, anmeldetag: w.anmeldetag || null, eintragungstag: w.eintragungstag || null, widerspruchsEnde: w.widerspruchsEnde || null, schutzBis: w.schutzBis || null, klassen: w.klassen, inhaberIstGesellschaft: w.inhaber, notiz: w.notiz || null };
    const r = await sw.schreibe({ liste: 'marken', eintrag, ...(m ? { eintragId: m.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={formStil}>
      <Feldzeile label="Bezeichnung"><input value={w.bezeichnung} onChange={x => s('bezeichnung', x.target.value)} aria-label="Bezeichnung der Marke" style={eingabe} /></Feldzeile>
      <Feldzeile label="Amt"><Pillen liste={MARKEN_AEMTER.map(a => ({ id: a.id, label: a.label }))} aktiv={w.amt} onWahl={(a: MarkenAmt) => s('amt', a)} /></Feldzeile>
      <Feldzeile label="Form"><Pillen liste={MARKEN_FORMEN.map(a => ({ id: a.id, label: a.label }))} aktiv={w.form} onWahl={(a: MarkenForm) => s('form', a)} /></Feldzeile>
      <Felder>
        <Feldzeile label="Register-Nr."><input value={w.registerNr} onChange={x => s('registerNr', x.target.value)} aria-label="Registernummer" style={eingabe} /></Feldzeile>
        <Feldzeile label="Anmeldetag"><input type="date" max={heute} value={w.anmeldetag} onChange={x => s('anmeldetag', x.target.value)} aria-label="Anmeldetag" style={eingabe} /></Feldzeile>
        <Feldzeile label="Eintragungstag"><input type="date" value={w.eintragungstag} onChange={x => s('eintragungstag', x.target.value)} aria-label="Eintragungstag" style={eingabe} /></Feldzeile>
        <Feldzeile label="Ende Widerspruchsfrist"><input type="date" value={w.widerspruchsEnde} onChange={x => s('widerspruchsEnde', x.target.value)} aria-label="Ende der Widerspruchsfrist" style={eingabe} /></Feldzeile>
        <Feldzeile label="Schutz bis (nach Verlängerung)"><input type="date" value={w.schutzBis} onChange={x => s('schutzBis', x.target.value)} aria-label="Schutz bis" style={eingabe} /></Feldzeile>
        <Feldzeile label="Klassen (Nizza)"><input value={w.klassen} onChange={x => s('klassen', x.target.value)} aria-label="Klassen" placeholder="z. B. 9, 35, 42" style={eingabe} /></Feldzeile>
      </Felder>
      <Schalter karte an={w.inhaber} onChange={v => s('inhaber', v)} beschreibung="Marke und Domain gehören auf die Gesellschaft (Praxis).">Inhaber ist die Gesellschaft</Schalter>
      <Feldzeile label="Notiz"><input value={w.notiz} onChange={x => s('notiz', x.target.value)} aria-label="Notiz" style={eingabe} /></Feldzeile>
      <Fehler t={fehler} />
      <Fuss fertig={fertig} aus={!w.bezeichnung.trim()} />
    </form>
  );
}

function DomainForm({ d, marken, sw, fertig }: { d?: Domain; marken: Marke[]; sw: Schreiben; fertig: () => void }) {
  const [w, setW] = useState({ domain: d?.domain ?? '', registrar: d?.registrar ?? '', laeuftBis: d?.laeuftBis ?? '', auto: d?.autoVerlaengerung ?? true, zweiFaktor: d?.zweiFaktor ?? false, zugang: d?.zugangHinterlegt ?? false, zugangWo: d?.zugangWo ?? '', inhaber: d?.inhaberIstGesellschaft ?? true, markeId: d?.markeId ?? '', notiz: d?.notiz ?? '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const s = (k: keyof typeof w, v: string | boolean) => setW(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    const eintrag = { domain: w.domain, registrar: w.registrar || null, laeuftBis: w.laeuftBis || null, autoVerlaengerung: w.auto, zweiFaktor: w.zweiFaktor, zugangHinterlegt: w.zugang, zugangWo: w.zugangWo || null, inhaberIstGesellschaft: w.inhaber, markeId: w.markeId || null, notiz: w.notiz || null };
    const r = await sw.schreibe({ liste: 'domains', eintrag, ...(d ? { eintragId: d.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={formStil}>
      <Felder>
        <Feldzeile label="Domain"><input value={w.domain} onChange={x => s('domain', x.target.value)} aria-label="Domain" placeholder="beispiel.de" style={eingabe} /></Feldzeile>
        <Feldzeile label="Registrar"><input value={w.registrar} onChange={x => s('registrar', x.target.value)} aria-label="Registrar" style={eingabe} /></Feldzeile>
        <Feldzeile label="Läuft bis"><input type="date" value={w.laeuftBis} onChange={x => s('laeuftBis', x.target.value)} aria-label="Läuft bis" style={eingabe} /></Feldzeile>
        <Feldzeile label="Zugang hinterlegt wo (ohne Passwort)"><input value={w.zugangWo} onChange={x => s('zugangWo', x.target.value)} aria-label="Wo der Zugang hinterlegt ist" placeholder="z. B. Passwort-Tresor der Firma" style={eingabe} /></Feldzeile>
        {marken.length > 0 && <Feldzeile label="Zur Marke">
          <select value={w.markeId} onChange={x => s('markeId', x.target.value)} aria-label="Zugehörige Marke" style={{ ...feld, width: '100%' }}><option value="">—</option>{marken.map(m => <option key={m.id} value={m.id}>{m.bezeichnung}</option>)}</select>
        </Feldzeile>}
      </Felder>
      <div style={{ display: 'grid', gap: 8 }}>
        <Schalter karte an={w.auto} onChange={v => s('auto', v)}>Verlängert sich automatisch</Schalter>
        <Schalter karte an={w.zweiFaktor} onChange={v => s('zweiFaktor', v)}>Zweiter Faktor beim Registrar</Schalter>
        <Schalter karte an={w.zugang} onChange={v => s('zugang', v)}>Zugang ist für den Notfall hinterlegt</Schalter>
        <Schalter karte an={w.inhaber} onChange={v => s('inhaber', v)}>Inhaber ist die Gesellschaft</Schalter>
      </div>
      <Feldzeile label="Notiz"><input value={w.notiz} onChange={x => s('notiz', x.target.value)} aria-label="Notiz" style={eingabe} /></Feldzeile>
      <Fehler t={fehler} />
      <Fuss fertig={fertig} aus={!w.domain.trim()} />
    </form>
  );
}

function VersicherungForm({ v, sw, fertig }: { v?: Versicherung; sw: Schreiben; fertig: () => void }) {
  const [w, setW] = useState({ art: (v?.art ?? 'betriebshaftpflicht') as VersicherungArt, versicherer: v?.versicherer ?? '', vertragsNr: v?.vertragsNr ?? '', deckung: centEingabe(v?.deckungFallCent), selbstbehalt: centEingabe(v?.selbstbehaltCent), praemie: centEingabe(v?.praemieJahrCent), beginn: v?.beginn ?? '', ablauf: v?.ablauf ?? '', verl: String(v?.verlaengerungMonate ?? VORGABE_VERLAENGERUNG_MONATE), frist: String(v?.kuendigungsfristMonate ?? VORGABE_KUENDIGUNGSFRIST_MONATE), nachmelde: v?.nachmeldefristMonate !== undefined ? String(v.nachmeldefristMonate) : '', gekuendigt: v?.gekuendigtZum ?? '', obliegenheiten: v?.obliegenheiten ?? '', notiz: v?.notiz ?? '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const s = (k: keyof typeof w, x: string) => setW(y => ({ ...y, [k]: x }));
  const speichern = async () => {
    const eintrag = { art: w.art, versicherer: w.versicherer || null, vertragsNr: w.vertragsNr || null, deckungFallCent: w.deckung || null, selbstbehaltCent: w.selbstbehalt || null, praemieJahrCent: w.praemie || null, beginn: w.beginn || null, ablauf: w.ablauf || null, verlaengerungMonate: Number(w.verl) || null, kuendigungsfristMonate: Number(w.frist) || null, nachmeldefristMonate: w.nachmelde === '' ? null : Number(w.nachmelde), gekuendigtZum: w.gekuendigt || null, obliegenheiten: w.obliegenheiten || null, notiz: w.notiz || null };
    const r = await sw.schreibe({ liste: 'versicherungen', eintrag, ...(v ? { eintragId: v.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <form onSubmit={x => { x.preventDefault(); void speichern(); }} style={formStil}>
      <Feldzeile label="Art">
        <select value={w.art} onChange={x => s('art', x.target.value)} aria-label="Art der Versicherung" style={{ ...feld, width: '100%' }}>{VERSICHERUNG_ARTEN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      </Feldzeile>
      <Felder>
        <Feldzeile label="Versicherer"><input value={w.versicherer} onChange={x => s('versicherer', x.target.value)} aria-label="Versicherer" style={eingabe} /></Feldzeile>
        <Feldzeile label="Vertrags-Nr."><input value={w.vertragsNr} onChange={x => s('vertragsNr', x.target.value)} aria-label="Vertragsnummer" style={eingabe} /></Feldzeile>
        <Feldzeile label="Deckung je Fall (€)"><input value={w.deckung} onChange={x => s('deckung', x.target.value)} aria-label="Deckung je Fall in Euro" style={eingabe} /></Feldzeile>
        <Feldzeile label="Selbstbehalt (€)"><input value={w.selbstbehalt} onChange={x => s('selbstbehalt', x.target.value)} aria-label="Selbstbehalt in Euro" style={eingabe} /></Feldzeile>
        <Feldzeile label="Prämie je Jahr (€)"><input value={w.praemie} onChange={x => s('praemie', x.target.value)} aria-label="Prämie je Jahr in Euro" style={eingabe} /></Feldzeile>
        <Feldzeile label="Beginn"><input type="date" value={w.beginn} onChange={x => s('beginn', x.target.value)} aria-label="Beginn" style={eingabe} /></Feldzeile>
        <Feldzeile label="Ablauf (Hauptfälligkeit)"><input type="date" value={w.ablauf} onChange={x => s('ablauf', x.target.value)} aria-label="Ablauf" style={eingabe} /></Feldzeile>
        <Feldzeile label="Verlängerung (Monate, ≤ 12)"><input inputMode="numeric" value={w.verl} onChange={x => s('verl', x.target.value.replace(/\D/g, ''))} aria-label="Verlängerung in Monaten" style={eingabe} /></Feldzeile>
        <Feldzeile label="Kündigungsfrist (Monate, 1–3)"><input inputMode="numeric" value={w.frist} onChange={x => s('frist', x.target.value.replace(/\D/g, ''))} aria-label="Kündigungsfrist in Monaten" style={eingabe} /></Feldzeile>
        {w.art === 'do' && <Feldzeile label="Nachmeldefrist (Monate)"><input inputMode="numeric" value={w.nachmelde} onChange={x => s('nachmelde', x.target.value.replace(/\D/g, ''))} aria-label="Nachmeldefrist in Monaten" style={eingabe} /></Feldzeile>}
        <Feldzeile label="Gekündigt zum"><input type="date" value={w.gekuendigt} onChange={x => s('gekuendigt', x.target.value)} aria-label="Gekündigt zum" style={eingabe} /></Feldzeile>
      </Felder>
      <Feldzeile label="Obliegenheiten (z. B. Cyber: Backups, Updates, Berechtigungen)"><input value={w.obliegenheiten} onChange={x => s('obliegenheiten', x.target.value)} aria-label="Obliegenheiten" style={eingabe} /></Feldzeile>
      <Feldzeile label="Notiz"><input value={w.notiz} onChange={x => s('notiz', x.target.value)} aria-label="Notiz" style={eingabe} /></Feldzeile>
      <span style={{ ...klein, color: C.inkDim }}>Beträge in Euro, z. B. 1.000.000 — gespeichert in Cent.</span>
      <Fehler t={fehler} />
      <Fuss fertig={fertig} />
    </form>
  );
}
