'use client';

// ─── Unternehmen › Pflichten: Kalender aus Rechtsform, Geschäftsjahr und Ereignissen (10.10.) ──────────────────────────
// Profil (Beschäftigte, Umsatz, Größenklasse …) → Pflichten (überfällig · fällig · kommend · erledigt) mit Norm, Folge, Rolle; „erledigt am“
// bzw. „trifft nicht zu“ ist der einzige gespeicherte Teil. Ereignisse (Anteilsübertragung, GF-Wechsel …) bringen ihre Pflichten mit.
// Schwellen-Wächter und der Verweis auf den Steuer-Takt (Steuer-Modul, eine Quelle). Fristen stehen auch im Kalender; Erinnerungen als Aufgabe.

import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Chip, Pillen, Schalter, Klappbar, ZeileAktionen, useRueckgaengig, eingabe, feld } from '../../ui';
import { WEG } from '@/lib/wege';
import { ROLLEN, GROESSENKLASSEN, type Groessenklasse, type EreignisArt } from '@/lib/gesellschaften/schild/typen';
import { EREIGNIS_ARTEN, PFLICHT_GRUPPEN, STEUER_TAKT, steuerImModul, ereignisDef, type PflichtEintrag } from '@/lib/gesellschaften/schild/pflichten';
import { katalogVon } from '@/lib/gesellschaften/schild/dokumente';
import type { GesellschaftLage } from '@/lib/gesellschaften/schild/ampel';
import { TextFeld, Felder, Feldzeile, centEingabe } from '../teile';
import type { SEintrag, Schreiben } from './daten';
import { AmpelChip, AMPEL_FARBE, SchildFuss, datum, klein } from './teile';

const rolle = (r: string) => ROLLEN.find(x => x.id === r)?.label ?? r;

export function Pflichten({ lage, e, sw, heute }: { lage: GesellschaftLage; e: SEintrag; sw: Schreiben; heute: string }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({ erledigt: false });
  const gruppen: { id: string; titel: string; l: PflichtEintrag[] }[] = [
    { id: 'ueberfaellig', titel: 'Überfällig', l: lage.pflichten.filter(p => p.status === 'ueberfaellig') },
    { id: 'faellig', titel: 'Fällig (im Vorlauf)', l: lage.pflichten.filter(p => p.status === 'faellig') },
    { id: 'kommend', titel: 'Kommend', l: lage.pflichten.filter(p => p.status === 'offen') },
    { id: 'erledigt', titel: 'Erledigt / trifft nicht zu', l: lage.pflichten.filter(p => p.status === 'erledigt' || p.status === 'nicht-zutreffend').reverse() },
  ];
  return (
    <>
      {!lage.kontext.rechtsform && <Hinweis art="achtung" titel="Rechtsform fehlt" aktion={<Knopf leise href={WEG.unternehmen(lage.id)}>Steckbrief öffnen</Knopf>}>Ohne Rechtsform lassen sich die Pflichten nicht rechnen.</Hinweis>}
      {!lage.kontext.aktiv && <Hinweis art="info">Diese Gesellschaft ist {lage.kontext.status === 'geplant' ? 'erst geplant' : 'aufgelöst'} — laufende Pflichten entstehen erst bzw. nicht mehr.</Hinweis>}
      {lage.kontext.status === 'gruendung' && !lage.kontext.gegruendet && <Hinweis art="info">In Gründung: der Jahreszyklus beginnt mit dem Gründungs- bzw. Eintragungsdatum im Steckbrief.</Hinweis>}
      <Profil e={e} lage={lage} sw={sw} />
      <Karte>
        <Ueberschrift>Pflichten-Kalender</Ueberschrift>
        {!lage.pflichten.length ? <Leer symbol={<CalendarCheck size={16} />}>Keine Pflichten im Zeitraum (ein Jahr zurück, gut ein Jahr voraus).</Leer> : gruppen.filter(g => g.l.length).map(g => (
          <Klappbar key={g.id} id={`pflichten-${g.id}`} titel={g.titel} zaehler={g.l.length} offen={offen[g.id] ?? true} umschalten={() => setOffen(o => ({ ...o, [g.id]: !(o[g.id] ?? true) }))}>
            <Liste>{g.l.map(p => <PflichtZeile key={p.schluessel} p={p} e={e} sw={sw} heute={heute} />)}</Liste>
          </Klappbar>
        ))}
        <div style={{ ...klein, marginTop: 8 }}>Gruppen: {PFLICHT_GRUPPEN.map(x => x.label).join(' · ')}. Die Fristen stehen auch im Kalender (Fristen-Ebene); im Vorlauf entsteht je Pflicht eine Aufgabe.</div>
        <SchildFuss />
      </Karte>
      <Ereignisse e={e} sw={sw} heute={heute} lage={lage} />
      <Schwellen lage={lage} sw={sw} />
      <Karte>
        <Ueberschrift>Steuer-Takt</Ueberschrift>
        <div style={{ ...klein, color: C.ink }}>{steuerImModul(lage.id) ? 'Die Steuer-Fristen dieser Gesellschaft rechnet das Steuer-Modul (eine Quelle) — hier nur der Verweis:' : 'Für diese Gesellschaft führt das Steuer-Modul noch keine Fristen — mit dem Steuerbüro abstimmen. Zum Takt gehören:'}</div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>{STEUER_TAKT.map(t => <li key={t}>{t}</li>)}</ul>
        {steuerImModul(lage.id) && <div style={{ marginTop: 10 }}><Knopf leise href={WEG.steuern('fristen', 'business')}>Steuer-Fristen öffnen</Knopf></div>}
      </Karte>
    </>
  );
}

function PflichtZeile({ p, e, sw, heute }: { p: PflichtEintrag; e: SEintrag; sw: Schreiben; heute: string }) {
  const [auf, setAuf] = useState(false);
  const [am, setAm] = useState(heute);
  const [beleg, setBeleg] = useState('');
  const belege = (e.dokumente ?? []).filter(d => !d.geloeschtAm && (!p.belegArt || d.art === p.belegArt));
  const vermerken = (status: 'erledigt' | 'nicht-zutreffend' | null) => sw.schreibe({ vermerk: { regelId: p.regelId, periode: p.periode, status, ...(status === 'erledigt' ? { am, ...(beleg ? { belegDokId: beleg } : {}) } : {}) } }).then(r => { if (r.ok) setAuf(false); });
  const farbe = p.status === 'ueberfaellig' ? AMPEL_FARBE.rot : p.status === 'faellig' ? AMPEL_FARBE.gelb : p.status === 'erledigt' ? AMPEL_FARBE.gruen : C.inkDim;
  const fertig = p.status === 'erledigt' || p.status === 'nicht-zutreffend';
  return (
    <div style={{ display: 'grid', gap: 6, padding: '4px 0' }}>
      <Zeile umbrechen titel={<>{p.titel} <span style={{ color: C.inkDim, fontWeight: 400 }}>· {p.periodeLabel}</span></>}
        unter={`${fertig ? (p.status === 'erledigt' ? `erledigt am ${datum(p.vermerk?.am)}` : 'trifft nicht zu') : `${p.status === 'ueberfaellig' ? 'überfällig seit' : 'bis'} ${datum(p.frist)}`} · ${p.norm} · ${rolle(p.verantwortlich)}`}
        rechts={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{p.eskalation && <Chip farbe={LEUCHT.kritisch}>Kanzlei</Chip>}<span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: farbe }} /></span>}
        onClick={() => setAuf(x => !x)} />
      {auf && (
        <div style={{ display: 'grid', gap: 8, padding: '4px 4px 10px', borderLeft: `2px solid ${farbe}`, paddingLeft: 12 }}>
          {p.hinweis && <div style={{ ...klein, color: C.ink }}>{p.hinweis}</div>}
          {p.folge && <div style={klein}>Folge bei Versäumnis: {p.folge}</div>}
          <div style={klein}>Quelle: {p.quelle}{p.annahme ? ' · Annahme (Frist als Vorschlag)' : ''}</div>
          {!fertig ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={am} max={heute} onChange={x => setAm(x.target.value)} aria-label="Erledigt am" style={{ ...eingabe, width: 'auto' }} />
              {belege.length > 0 && (
                <select value={beleg} onChange={x => setBeleg(x.target.value)} aria-label="Beleg" style={{ ...feld, width: 'auto' }}>
                  <option value="">ohne Beleg</option>
                  {belege.map(d => <option key={d.id} value={d.id}>{d.titel || katalogVon(d.art)?.titel || 'Dokument'}{d.fassungVom ? ` (${datum(d.fassungVom)})` : ''}</option>)}
                </select>
              )}
              <Knopf onClick={() => vermerken('erledigt')}>Erledigt</Knopf>
              <Knopf leise onClick={() => vermerken('nicht-zutreffend')}>Trifft nicht zu</Knopf>
            </div>
          ) : <div><Knopf leise onClick={() => vermerken(null)}>Vermerk zurücknehmen</Knopf></div>}
        </div>
      )}
    </div>
  );
}

function Profil({ e, lage, sw }: { e: SEintrag; lage: GesellschaftLage; sw: Schreiben }) {
  const p = e.profil ?? {};
  const setze = (felder: Record<string, unknown>) => void sw.schreibe({ profil: felder });
  return (
    <Karte>
      <Ueberschrift>Profil</Ueberschrift>
      <div style={{ display: 'grid', gap: 14 }}>
        <Felder>
          <Feldzeile label="Beschäftigte (Personen)"><TextFeld label="Beschäftigte" wert={p.beschaeftigte !== undefined ? String(p.beschaeftigte) : ''} platzhalter="z. B. 4" onFertig={t => setze({ beschaeftigte: t === '' ? null : Number(t.replace(/\D/g, '')) })} /></Feldzeile>
          <Feldzeile label="Umsatz Vorjahr (€)"><TextFeld label="Umsatz Vorjahr in Euro" wert={centEingabe(p.umsatzVorjahrCent)} platzhalter="z. B. 450.000" onFertig={t => setze({ umsatzVorjahrCent: t || null })} /></Feldzeile>
          <Feldzeile label="Bilanzsumme (€)"><TextFeld label="Bilanzsumme in Euro" wert={centEingabe(p.bilanzsummeCent)} onFertig={t => setze({ bilanzsummeCent: t || null })} /></Feldzeile>
          {lage.kontext.einzel && <Feldzeile label="Gewinn Vorjahr (€)"><TextFeld label="Gewinn Vorjahr in Euro" wert={centEingabe(p.gewinnVorjahrCent)} onFertig={t => setze({ gewinnVorjahrCent: t || null })} /></Feldzeile>}
        </Felder>
        {lage.kontext.hgbKapital && <Feldzeile label="Größenklasse (§ 267 HGB)"><Pillen liste={GROESSENKLASSEN.map(g => ({ id: g.id, label: g.label }))} aktiv={p.groessenklasse ?? null} onWahl={(g: Groessenklasse) => setze({ groessenklasse: g })} /></Feldzeile>}
        {lage.kontext.holding && p.groessenklasse === 'kleinst' && <Hinweis art="achtung">Eine reine Beteiligungs-Holding ist nie Kleinstkapitalgesellschaft (§ 267a Abs. 3 Nr. 3 HGB).</Hinweis>}
        <div style={{ display: 'grid', gap: 8 }}>
          <Schalter karte an={!!p.beraten} onChange={v => setze({ beraten: v })} beschreibung="Längere Erklärungsfrist (§ 149 Abs. 3 AO).">Erklärungen macht ein Steuerbüro</Schalter>
          <Schalter karte an={!!p.kreativeHonorare} onChange={v => setze({ kreativeHonorare: v })} beschreibung="Künstlersozialabgabe (§§ 24 ff. KSVG).">Regelmäßig Aufträge an selbständige Kreative</Schalter>
        </div>
      </div>
      <div style={{ ...klein, marginTop: 8 }}>Die Angaben steuern Fristen (Größenklasse) und die Schwellen-Wächter. Beträge in Euro, gespeichert in Cent.</div>
    </Karte>
  );
}

function Ereignisse({ e, sw, heute, lage }: { e: SEintrag; sw: Schreiben; heute: string; lage: GesellschaftLage }) {
  const { melden, hinweis } = useRueckgaengig();
  const moeglich = EREIGNIS_ARTEN.filter(d => d.gilt(lage.kontext));
  const [art, setArt] = useState<EreignisArt | ''>('');
  const [tag, setTag] = useState(heute);
  const [notiz, setNotiz] = useState('');
  const liste = (e.ereignisse ?? []).filter(x => !x.geloeschtAm).sort((a, b) => b.datum.localeCompare(a.datum));
  const anlegen = async () => { if (!art) return; const r = await sw.schreibe({ liste: 'ereignisse', eintrag: { art, datum: tag, ...(notiz ? { notiz } : {}) } }); if (r.ok) { setArt(''); setNotiz(''); } };
  const weg = async (id: string, titel: string) => { const r = await sw.schreibe({ liste: 'ereignisse', eintragId: id, aktion: 'loeschen' }); if (r.ok) melden(`„${titel}“ im Papierkorb`, () => void sw.schreibe({ liste: 'ereignisse', eintragId: id, aktion: 'wiederherstellen' })); };
  return (
    <Karte>
      <Ueberschrift>Ereignisse</Ueberschrift>
      <div style={{ ...klein, marginBottom: 8 }}>Ein Ereignis bringt seine Pflichten mit (Register, Behörden, Fristen ab dem Tag) und stößt die Neubewertung der Risiken an.</div>
      <form onSubmit={x => { x.preventDefault(); void anlegen(); }} style={{ display: 'grid', gap: 10 }}>
        <Felder>
          <Feldzeile label="Was ist passiert?">
            <select value={art} onChange={x => setArt(x.target.value as EreignisArt | '')} aria-label="Ereignis" style={{ ...feld, width: '100%' }}>
              <option value="">Ereignis wählen …</option>
              {moeglich.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Feldzeile>
          <Feldzeile label="Wann?"><input type="date" value={tag} onChange={x => setTag(x.target.value)} aria-label="Datum des Ereignisses" style={eingabe} /></Feldzeile>
        </Felder>
        <input value={notiz} onChange={x => setNotiz(x.target.value)} aria-label="Notiz" placeholder="Notiz (optional)" style={eingabe} />
        {art && <div style={klein}>Pflichten: {ereignisDef(art)?.pflichten.map(p => p.titel).join(' · ')}</div>}
        <div><Knopf typ="submit" aus={!art || !tag}>Ereignis erfassen</Knopf></div>
      </form>
      {liste.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Liste>{liste.map(x => {
            const titel = ereignisDef(x.art)?.label ?? x.art;
            return (
              <ZeileAktionen key={x.id} titel={titel} onLoeschen={() => weg(x.id, titel)}>
                <Zeile titel={titel} unter={[datum(x.datum), x.notiz].filter(Boolean).join(' · ')} />
              </ZeileAktionen>
            );
          })}</Liste>
        </div>
      )}
      {hinweis}
    </Karte>
  );
}

function Schwellen({ lage, sw }: { lage: GesellschaftLage; sw: Schreiben }) {
  const umsetzen = (id: string, an: boolean) => void sw.schreibe({ vermerk: { regelId: `schwelle:${id}`, periode: 'laufend', status: an ? 'erledigt' : null } });
  return (
    <Karte>
      <Ueberschrift>Schwellen-Wächter</Ueberschrift>
      <Liste>
        {lage.schwellen.map(z => (
          <Zeile key={z.def.id} umbrechen titel={z.def.titel} unter={`${z.def.pflicht} · ${z.def.norm}${z.def.annahme ? ' · Annahme' : ''}`}
            rechts={z.stand === 'erreicht'
              ? (z.umgesetzt ? <Knopf leise onClick={() => umsetzen(z.def.id, false)}>umgesetzt ✓</Knopf> : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><AmpelChip a="gelb" text="erreicht" /><Knopf leise onClick={() => umsetzen(z.def.id, true)}>umgesetzt</Knopf></span>)
              : <AmpelChip a={z.stand === 'unbekannt' ? 'offen' : 'gruen'} text={z.stand === 'unbekannt' ? 'Profil fehlt' : 'nicht erreicht'} />} />
        ))}
      </Liste>
      <SchildFuss>Grundlage sind die Angaben im Profil oben.</SchildFuss>
    </Karte>
  );
}
