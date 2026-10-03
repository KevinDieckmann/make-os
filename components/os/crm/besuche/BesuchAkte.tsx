'use client';

// ─── Events · Event-Akte — ein besuchtes Event von der Planung bis zur Wirkung (03.10.) ───
// Kopf (Anmeldestand, Wann & wo, Link, für wen, wer geht, Kosten, Kalender) · Ziel und Zielpersonen („wen wollen wir treffen“,
// beim Event abhaken) · erfasste Personen aus „Netzwerken“ (mit Sprüngen zu Person, Termin, Deal, Follow-up) · Wirkung · bei
// einem Kunden die Übergabe der Kontakte. Hauptaktion: „Jetzt erfassen“ (→ Netzwerken mit diesem Event). Abendbericht und
// Danke-Mail-Entwürfe liegen weiter in Netzwerken, hängen aber an diesem Event und sind von hier erreichbar.
// Geschrieben wird nur, was sich ändert (`eventSetzen`); Regeln und Säuberung prüft der Server.

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Raster, Zahl, Haken, Zeile, Leer, LEUCHT } from '../../ui';
import { ANMELDUNGEN, anmeldungVon, anmeldungPatch, fuerVon, zielSchluessel, zielpersonGesperrt, linkNormal, LINK_FEHLER } from '@/lib/crm/besuche-form';
import { besuchWirkung, besuchUrteil, zielGetroffen, FOLLOWUP_QUOTE_DEFINITION, type BesuchKontext } from '@/lib/crm/besuche';
import { UEBERGABE_HINWEIS, ROLLE_HINWEIS } from '@/lib/crm/netzwerken-recht';
import { budgetSumme } from '@/lib/crm/eventplanung';
import { berichtAus, EVENT_ZIEL } from '@/lib/crm/netzwerken';
import { STUFEN, gesamtwert } from '@/lib/crm/pipeline';
import { TEAM } from '@/lib/crm/team';
import { markttraktion } from '@/lib/crm/adresse';
import type { Event, EventAnmeldung, EventZielperson } from '@/lib/crm/typen';
import { WEG } from '@/lib/wege';
import { datum, euro } from '../daten';
import { Feld } from '../teile';
import { Wahl, WahlMehrfach } from '../Wahl';
import { Kalender } from '../events/Kalender';
import { Liquiplan } from '../events/Budget';
import { Notizfeld, Leise, eventLoeschen } from '../events/gemeinsam';
import { LinkChips, type LinkChip } from '../../netzwerken/bausteine';
import { FuerWahl, ZielSuche, AvvHinweis, BFeld, zielName, eventSetzen, zielAenderung, type BesuchProps } from './gemeinsam';
import { UebergabeDialog } from './Uebergabe';

const URTEIL_FARBE = { lohnt: LEUCHT.gut, laeuft: LEUCHT.achtung, frueh: C.inkDim, ohne: LEUCHT.kritisch } as const;

export function BesuchAkte({ api, crm, e, zuKontakt, zuFirma, onZurueck }: BesuchProps & { e: Event; onZurueck: () => void }) {
  const router = useRouter();
  const heute = crm.heute;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const kontaktMap = useMemo(() => new Map(kontakte.map(k => [k.id, k])), [kontakte]);
  const firmenMap = useMemo(() => new Map(crm.stand.firmen.map(f => [f.id, f])), [crm.stand.firmen]);
  const ctx: BesuchKontext = useMemo(() => ({ teilnahmen: crm.stand.teilnahmen, kontakte, chancen: crm.stand.chancen, heute }), [crm.stand.teilnahmen, kontakte, crm.stand.chancen, heute]);
  const w = useMemo(() => besuchWirkung(e, ctx), [e, ctx]);
  const urteil = besuchUrteil(e, w, heute);
  const bericht = useMemo(() => berichtAus({ event: e, teilnahmen: crm.stand.teilnahmen, kontakte, followups: crm.stand.followups, heute }), [e, crm.stand.teilnahmen, kontakte, crm.stand.followups, heute]);
  const setze = (teil: Partial<Event>) => eventSetzen(api, e, teil);
  const a = anmeldungVon(e);
  const fuer = fuerVon(e);
  const [uebergabeOffen, setUebergabeOffen] = useState(false);

  const deals = crm.stand.chancen.filter(c => w.dealIds.includes(c.id));
  const offeneFu = (crm.stand.followups ?? []).filter(f => f.bezug.art === 'event' && f.bezug.id === e.id && f.status === 'offen').length;
  const zielText = e.ziel === EVENT_ZIEL ? '' : e.ziel;
  const ziele = e.zielpersonen ?? [];
  // Getroffen = von Hand abgehakt oder über „Netzwerken“ erfasst (Person über die Kennung, Zielfirma über jede erfasste Person der Firma) — eine Regel für Akte und Wirkung (`zielGetroffen`).
  const zielStand = useMemo(() => zielGetroffen(e, crm.stand.teilnahmen, kontakte), [e, crm.stand.teilnahmen, kontakte]);
  const getroffen = (z: EventZielperson) => zielStand.getroffen.has(zielSchluessel(z));
  const kundenName = fuer.art === 'kunde' ? (firmenMap.get(fuer.firmaId)?.name ?? 'dem Kunden') : null;

  const ANMELDE = ANMELDUNGEN.map(x => ({ id: x.id, label: x.label }));
  const hat = (b: boolean, farbe: string) => (b ? farbe : undefined);

  return (
    <div className="bes-akte" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={onZurueck} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', minHeight: 44, fontSize: TYP.bedien, fontWeight: 600, padding: 0 }}>‹ Kalender</button>
        <span style={{ flex: 1 }} />
        <Knopf onClick={() => router.push(WEG.netzwerken({ event: e.id }))}>Jetzt erfassen</Knopf>
      </div>

      <Karte i={1} ton={LEUCHT.beziehung}>
        <Ueberschrift rechts={<span title={urteil.grund} style={{ cursor: 'help' }}><Chip farbe={urteil.art === 'frueh' ? C.inkDim : URTEIL_FARBE[urteil.art]}>{urteil.label}</Chip></span>}>{e.titel}</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, margin: '-4px 0 6px' }}>{urteil.art === 'frueh' ? `„${urteil.label}“: ${urteil.grund}` : urteil.grund}</div>
        <BFeld label="Titel"><Feld wert={e.titel} onFertig={t => t.trim() && void setze({ titel: t.trim() })} /></BFeld>
        <BFeld label="Anmeldung">
          <Wahl<EventAnmeldung> label="Anmeldung" liste={ANMELDE} wert={a} onWahl={x => void setze(anmeldungPatch(x))} farbe={a === 'besucht' ? LEUCHT.gut : a === 'abgesagt' ? C.inkLeise : C.aktiv} />
        </BFeld>
        <BFeld label="Wann & wo">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Feld typ="date" wert={e.datum} breite={160} platzhalter="Datum" onFertig={d => d && void setze({ datum: d })} />
            <Feld typ="date" wert={e.bisDatum} breite={160} platzhalter="bis (mehrtägig)" onFertig={d => void setze({ bisDatum: d && d > e.datum ? d : undefined })} />
            <Feld typ="time" wert={e.uhrzeit} breite={120} platzhalter="Uhrzeit" onFertig={u => void setze({ uhrzeit: u || undefined })} />
            <div style={{ flex: 1, minWidth: 160 }}><Feld wert={e.ort} platzhalter="Ort" onFertig={o => void setze({ ort: o || undefined })} /></div>
          </div>
        </BFeld>
        <BFeld label="Link"><Feld wert={e.link} platzhalter="https://… (Anmeldung, Programm)" onFertig={l => { const t = l.trim(); if (t && !linkNormal(t)) { api.setFehler(LINK_FEHLER); return; } void setze({ link: t ? linkNormal(t) : undefined }); }} /></BFeld>
        <BFeld label="Für wen"><FuerWahl e={e} api={api} crm={crm} /></BFeld>
        <BFeld label="Wer geht hin">
          <WahlMehrfach label="Wer geht hin" leer="+ wer geht hin" liste={TEAM.map(m => ({ id: m.id, label: m.name }))} wert={e.wer ?? []} onWahl={x => void setze({ wer: x })} />
        </BFeld>
        <BFeld label="Kosten">
          {(e.budget ?? []).length > 0
            ? <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{euro(budgetSumme(e))} <span style={{ color: C.inkLeise }}>· aus den Budgetposten des Events</span></span>
            : <Feld typ="number" wert={e.kostenEuro ? String(e.kostenEuro) : ''} breite={150} platzhalter="Euro gesamt" onFertig={k => void setze({ kostenEuro: Number(k) > 0 ? Number(k) : undefined })} />}
        </BFeld>
        <BFeld label="Liquiplanung"><Liquiplan e={e} kosten={budgetSumme(e)} kompakt /></BFeld>
        <BFeld label="Kalender"><Kalender e={e} /></BFeld>
        {fuer.art === 'kunde' && <div style={{ marginTop: 8 }}><AvvHinweis text={`${UEBERGABE_HINWEIS} ${ROLLE_HINWEIS}`} /></div>}
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={ziele.length ? <span>{zielStand.anzahl} von {ziele.length} getroffen{w.zielQuote !== null ? ` · ${Math.round(w.zielQuote * 100)} % erreicht` : ''}</span> : undefined}>Ziel und wen wir treffen wollen</Ueberschrift>
        <Notizfeld wert={zielText} zeilen={2} gross platzhalter="Ziel des Events — was soll danach anders sein? z. B. drei Gespräche mit Inhabern aus dem Maschinenbau" onFertig={t => { if (t.trim() !== zielText) void setze({ ziel: t.trim() }); }} />
        <div style={{ marginTop: 10 }}>
          {ziele.length === 0 && <Leer>Noch niemand eingetragen — wen wollen wir dort treffen? Suche unten; beim Event wird abgehakt, und wer über „Netzwerken“ erfasst wird, gilt automatisch als getroffen.</Leer>}
          {ziele.map(z => {
            const n = zielName(z, kontaktMap, firmenMap);
            const abgeleitet = zielStand.abgeleitet.has(zielSchluessel(z));
            // Inzwischen gesperrt (Art. 18 / Werbesperre): ausgegraut, nicht abhakbar (der Server nimmt Gesperrte nie neu auf).
            const gesperrt = !!z.kontaktId && !!zielpersonGesperrt(kontaktMap.get(z.kontaktId));
            return (
              <div key={zielSchluessel(z)} style={gesperrt ? { opacity: 0.5 } : undefined} aria-disabled={gesperrt || undefined}><Zeile
                links={<Haken an={getroffen(z)} farbe={hat(getroffen(z), LEUCHT.gut)} label={n.name} onChange={() => { if (!abgeleitet && !gesperrt) void zielAenderung(api, e, { op: 'getroffen', ...(z.kontaktId ? { kontaktId: z.kontaktId } : { firmaId: z.firmaId }), wert: !z.getroffen }); }} />}
                titel={n.tot ? n.name : <button type="button" onClick={() => (z.kontaktId ? zuKontakt(z.kontaktId) : z.firmaId && zuFirma(z.firmaId))} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: 'inherit', fontWeight: 500, padding: 0, textAlign: 'left' }}>{n.name}</button>}
                unter={[n.unter, gesperrt ? 'gesperrt (Art. 18 / Werbesperre)' : '', abgeleitet ? 'über Netzwerken erfasst' : ''].filter(Boolean).join(' · ') || undefined}
                rechts={<Leise onClick={() => void zielAenderung(api, e, { op: 'weg', ...(z.kontaktId ? { kontaktId: z.kontaktId } : { firmaId: z.firmaId }) })}>entfernen</Leise>} /></div>
            );
          })}
        </div>
        <div style={{ marginTop: 8 }}><ZielSuche api={api} crm={crm} e={e} /></div>
      </Karte>

      <Karte i={3}>
        <Ueberschrift rechts={<Leise onClick={() => router.push(WEG.netzwerken({ bericht: e.id }))} farbe={C.aktiv}>Abendbericht und Danke-Mails ›</Leise>}>Erfasste Personen</Ueberschrift>
        {bericht.zeilen.length === 0 && <Leer>Noch niemand erfasst. „Jetzt erfassen“ öffnet Netzwerken mit diesem Event — Karte fotografieren, nächsten Schritt festlegen, fertig.</Leer>}
        {bericht.zeilen.map(z => (
          <div key={z.kontaktId} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => zuKontakt(z.kontaktId)} className="fassbar" style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, fontWeight: 600, padding: 0, textAlign: 'left', minHeight: 32 }}>{z.name} ›</button>
              {z.firma && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{z.firma}</span>}
              <Chip farbe={LEUCHT.beziehung}>{z.schrittText}</Chip>
              {z.offen.length > 0 && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{z.offen[0]}{z.offen.length > 1 ? ` · +${z.offen.length - 1}` : ''}</span>}
            </div>
            <LinkChips links={z.links.filter(l => l.id !== 'kontakt' && l.id !== 'event') as LinkChip[]} />
          </div>
        ))}
      </Karte>

      <Karte i={4}>
        <Ueberschrift>Wirkung</Ueberschrift>
        <Raster min={120}>
          <Zahl wert={String(w.kontakte)} label="Kontakte erfasst" />
          <Zahl wert={w.followupQuote === null ? '—' : `${Math.round(w.followupQuote * 100)} %`} label={<span title={FOLLOWUP_QUOTE_DEFINITION}>Follow-up-Quote ⓘ</span>} farbe={hat((w.followupQuote ?? 0) >= 0.8, LEUCHT.gut)} />
          <Zahl wert={String(w.termine)} label="Termine" />
          <Zahl wert={String(w.deals)} label="Deals" />
          {w.pipeline > 0 && <Zahl wert={euro(w.pipeline)} label="Pipeline" />}
          {w.umsatz > 0 && <Zahl wert={euro(w.umsatz)} label="gewonnen" farbe={LEUCHT.gut} />}
          {w.kostenJeKontakt !== null && <Zahl wert={euro(w.kostenJeKontakt)} label="Kosten je Kontakt" />}
        </Raster>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>{urteil.grund}{w.nachfassenOffen > 0 ? ` · ${w.nachfassenOffen} noch nachzufassen` : ''}</div>
        {(deals.length > 0 || offeneFu > 0) && (
          <div style={{ marginTop: 8 }}>
            {deals.map(c => (
              <Zeile key={c.id} onClick={() => router.push(WEG.deal(c.id))} titel={c.titel}
                unter={`${STUFEN.find(s => s.id === c.stufe)?.label ?? c.stufe}${gesamtwert(c) ? ` · ${euro(gesamtwert(c))}` : ''}`} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
            ))}
            {offeneFu > 0 && <Zeile onClick={() => router.push(markttraktion('followup'))} titel={`${offeneFu} ${offeneFu === 1 ? 'Follow-up' : 'Follow-ups'} offen`} unter="aus diesem Event — stehen im Follow-up" rechts={<span style={{ color: C.inkLeise }}>›</span>} />}
          </div>
        )}
      </Karte>

      {fuer.art === 'kunde' && (
        <Karte i={5} akzent={LEUCHT.business}>
          <Ueberschrift>An {kundenName} übergeben</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 10 }}>
            Die Kontakte, die an diesem Event neu angelegt wurden, als CSV — nur Felder, mit Herkunft je Zeile und dem Vermerk „keine Werbe-Einwilligung“. Bestandspersonen gehen nur mit Haken je Person. Gesperrte Personen (Art. 18, Werbesperre) gehen nie mit. Jede Übergabe steht mit Empfänger im Protokoll.
          </div>
          <Knopf onClick={() => setUebergabeOffen(true)} aus={w.kontakte === 0} farbe={LEUCHT.business}>An Kunden übergeben …</Knopf>
          {(e.uebergaben ?? []).length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 2 }}>
              {[...(e.uebergaben ?? [])].reverse().map((u, i) => (
                <div key={`${u.am}-${i}`} style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{datum(u.am.slice(0, 10), heute)} · {u.anzahl} {u.anzahl === 1 ? 'Kontakt' : 'Kontakte'} · an {(u.empfaengerFirmaId ? firmenMap.get(u.empfaengerFirmaId)?.name : undefined) ?? kundenName}{u.dateiname ? ` · ${u.dateiname}` : ''} · von {TEAM.find(m => m.id === u.von)?.name ?? u.von}</div>
              ))}
            </div>
          )}
        </Karte>
      )}
      {uebergabeOffen && <UebergabeDialog e={e} api={api} onZu={() => setUebergabeOffen(false)} />}

      <div>
        <Leise onClick={() => {
          const n = (e.uebergaben ?? []).length;
          if (!window.confirm(`„${e.titel}“ löschen? Die erfassten Personen bleiben in der Kartei, ihre Teilnahme an diesem Event wird entfernt; offene Follow-ups des Events werden abgesagt. Auch der Kalender-Termin und der Planposten in der Liquiplanung werden entfernt, Deals verlieren den Verweis auf das Event.${n ? `\n\nACHTUNG: Dieses Event hat ${n} ${n === 1 ? 'Übergabe' : 'Übergaben'} an Kunden im Protokoll. Das Protokoll bleibt als Nachweis (Auskunft Art. 15, Mitteilung Art. 19) 3 Jahre im Übergabe-Journal erhalten — aber das Event ist weg.` : ''}`)) return;
          void eventLoeschen(api, e, n ? { uebergabenBestaetigt: true } : undefined).then(onZurueck);
        }}>Event löschen</Leise>
      </div>
    </div>
  );
}
