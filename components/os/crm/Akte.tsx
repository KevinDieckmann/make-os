'use client';

// ─── Markttraktion · Kontaktakte ────────────────────────────────────────────
// Kevin 25.09.: rechts oben in der Karteikarte ein Knopf, dahinter „die ganze
// Matrix“ zur Person — alle Daten, die Aktivitäten, alles auf einem Bild, und
// ein Zurück auf die Kartei. Aufbau wie eine Akte im Schrank:
//   Kopf       Zurück · Name, Rolle, Firma · Kanäle · sechs Kennzahlen
//              (letzter Kontakt, nächster Schritt, Takt, Verlauf, Deals, Vollständigkeit)
//   Spalten    Stammdaten (die Matrix) · Aktivitäten (ganzer Verlauf) ·
//              Sales (nächster Schritt, Lead, Deals, Entwurf), Beziehung,
//              Verbindungen (Events, Kampagnen, Beiträge, Power Hour, Kollegen), Recht
// Breit drei Spalten, mittel zwei, am Handy untereinander (Sales zuerst).
// Adresse: /os/markttraktion?s=kontakte&a=akte&k=<id>. Zurück (Knopf, Esc oder
// Browser) führt in die Kartei mit derselben Person. Die Bausteine teilt die
// Akte mit der Karteikarte (kontakt-teile.tsx), die Regeln stehen in lib/crm/akte.ts.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Chip, Punkt, Fortschritt, LEUCHT, SPALTEN_AB } from '../schlank';
import { anzeigename, STUFE_LABEL, type Kontakt } from '@/lib/make-one/crm';
import { ampel as kanalAmpel } from '@/lib/crm/recht';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { vollstaendigkeit, verbindungen, takt, verlaufZahlen, TEILNAHME_LABEL, KAMPAGNEN_ERGEBNIS_LABEL } from '@/lib/crm/akte';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { type CrmApi, datum, euro } from './daten';
import { KanalAmpel, Grund } from './teile';
import { Person, AuchHier } from './team';
import { LeadBlock } from './Leads';
import { phaseFarbe, phaseLabel, Hinweise, NaechsterSchrittTeil, BeziehungTeil, DealsTeil, EntwurfTeil, VerlaufTeil, RechtTeil, Matrix } from './kontakt-teile';

/** Drei Spalten ab 1440 px Fenster, zwei ab SPALTEN_AB, sonst eine. */
function useSpalten(): 1 | 2 | 3 {
  const [n, setN] = useState<1 | 2 | 3>(1);
  useEffect(() => {
    const zwei = window.matchMedia(`(min-width: ${SPALTEN_AB}px)`);
    const drei = window.matchMedia('(min-width: 1440px)');
    const an = () => setN(drei.matches ? 3 : zwei.matches ? 2 : 1);
    an(); zwei.addEventListener('change', an); drei.addEventListener('change', an);
    return () => { zwei.removeEventListener('change', an); drei.removeEventListener('change', an); };
  }, []);
  return n;
}

function KartenKopf({ titel, unter, rechts }: { titel: string; unter?: ReactNode; rechts?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', margin: 0 }}>{titel}</h2>
        {unter && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 3 }}>{unter}</div>}
      </div>
      {rechts}
    </div>
  );
}

/** Eine Kennzahl im Kopf: kleine Überschrift, Wert, eine Zeile Erklärung. */
function Kennzahl({ label, wert, unter, farbe }: { label: string; wert: ReactNode; unter?: ReactNode; farbe?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.035)', minWidth: 0, display: 'grid', gap: 4, alignContent: 'start' }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: farbe ?? C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{wert}</span>
      {unter && <span style={{ fontSize: 12, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unter}</span>}
    </div>
  );
}

/** Eine Zeile in „Verbindungen“: Punkt, Titel, Zusatz, Datum rechts. */
function VZeile({ farbe, titel, zusatz, am, heute, onClick }: { farbe: string; titel: ReactNode; zusatz?: ReactNode; am?: string; heute: string; onClick?: () => void }) {
  const inhalt = (
    <>
      <Punkt farbe={farbe} groesse={7} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ fontWeight: 600 }}>{titel}</b>{zusatz && <span style={{ color: C.inkLeise }}> · {zusatz}</span>}</span>
      {am && <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{datum(am, heute)}</span>}
    </>
  );
  const stil = { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', fontSize: TYP.bedien, color: C.ink, width: '100%', minHeight: 32 } as const;
  return onClick
    ? <button onClick={onClick} className="fassbar" style={{ ...stil, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>{inhalt}<span aria-hidden style={{ color: C.inkLeise }}>›</span></button>
    : <div style={stil}>{inhalt}</div>;
}

/** Eine Spalte der Akte: Karten untereinander. Außerhalb der Akte definiert, damit nichts bei jedem Zeichnen neu entsteht (sonst gingen Eingaben verloren). */
function Stapel({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gap: 14, minWidth: 0, alignContent: 'start' }}>{children}</div>;
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return <div><Ueberschrift>{titel}</Ueberschrift>{children}</div>;
}

export function KontaktAkte({ api, id, name, zurueck, zuFirma, zuAkte }: { api: CrmApi; id: string; name: (p: string) => string; zurueck: () => void; zuFirma: (id: string) => void; zuAkte: (id: string) => void }) {
  const spalten = useSpalten();
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const k = api.kontakte?.find(x => x.id === id) ?? null;

  // Oben anfangen — die Kartei war vielleicht weit nach unten gescrollt. Gescrollt wird in <main> der Oberfläche, nicht im Fenster.
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }); window.scrollTo({ top: 0 }); }, [id]);
  // Esc = zurück, außer beim Tippen oder wenn ein Fenster (z. B. „+ Gespräch“) offen ist.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      if (document.querySelector('[role="dialog"]')) return;
      zurueck();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [zurueck]);

  const v = useMemo(() => (k && crm ? verbindungen(k, api.kontakte ?? [], crm.stand) : null), [k, crm, api.kontakte]);

  const zurueckKnopf = (
    <button onClick={zurueck} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 11px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> Zurück zu Kontakte
    </button>
  );

  if (!api.kontakte) return <Karte i={0}>{zurueckKnopf}<Leer>Die Akte lädt …</Leer></Karte>;
  if (!k || !v) return <Karte i={0}>{zurueckKnopf}<Leer>Diese Person gibt es nicht mehr — gelöscht oder mit einer Dublette zusammengeführt.</Leer></Karte>;

  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const offeneDeals = v.deals.filter(d => !d.ueberFirma && OFFENE_STUFEN.includes(d.stufe));
  const aktivesMandat = v.mandate.some(m => m.status === 'aktiv');
  const ampel = kanalAmpel(k, { hatMandat: aktivesMandat, hatChance: offeneDeals.length > 0 });
  const mailOk = ampel.some(s => s.kanal === 'mail' && s.farbe !== 'rot');
  const setze = (teil: Partial<Kontakt>) => api.kontaktSetzen({ ...k, ...teil });
  const voll = vollstaendigkeit(k, firma);
  const t = takt(k, heute);
  const vz = verlaufZahlen(k);
  const zuletzt = k.letzterKontakt ?? vz.zuletzt;
  const termin = crm?.termine?.[k.id];
  const initialen = `${(k.vorname || '').charAt(0)}${(k.nachname || '').charAt(0)}`.toUpperCase() || '?';
  const pf = phaseFarbe(k.lebensphase);
  const dealWert = offeneDeals.reduce((s, d) => s + (d.wert.betrag || 0) * (d.wert.basis === 'monat' ? 12 : 1), 0);
  const schrittUeberfaellig = !!k.naechsterSchritt && k.naechsterSchritt.datum < heute;

  const kopf = (
    <Karte i={0} akzent={pf}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        {zurueckKnopf}
        <span style={{ fontSize: 12, color: C.inkLeise }}>Akte · geändert {datum(k.geaendertAm, heute)}{spalten > 1 ? ' · Esc schließt' : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div aria-hidden style={{ width: 58, height: 58, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: 20, fontWeight: 700, color: pf, background: `${pf}18`, border: `2px solid ${pf}88`, boxShadow: `0 0 24px -6px ${pf}` }}>{initialen}</div>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(22px, 2.4vw, 28px)', fontWeight: 700, letterSpacing: '-.02em', margin: 0, lineHeight: 1.15 }}>{anzeigename(k)}</h2>
          <div style={{ fontSize: TYP.body, color: C.inkDim, marginTop: 4 }}>
            {k.position ?? k.jobtitel ?? ''}{(k.position ?? k.jobtitel) && (firma || k.firma) ? ' · ' : ''}
            {firma ? <button onClick={() => zuFirma(firma.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.2)', fontSize: TYP.body, fontFamily: SCHRIFT.text }}>{firma.name}</button> : k.firma}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip farbe={pf}>{phaseLabel(k.lebensphase)}</Chip>{k.kreis && <Chip farbe={LEUCHT.beziehung}>Kreis {k.kreis}</Chip>}
            <Chip farbe={C.inkDim}>{STUFE_LABEL[k.stufe]}</Chip>{k.prio && <Chip farbe={C.inkDim}>Prio {k.prio}</Chip>}
            {k.werbesperre && <Chip farbe={LEUCHT.kritisch}>Werbesperre</Chip>}
            <span title={`Hält die Beziehung: ${nameVon(haeltBeziehung(k))}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkLeise, marginLeft: 4 }}><Person id={haeltBeziehung(k)} groesse={18} />{nameVon(haeltBeziehung(k))}</span>
            <AuchHier passt={p => p.includes(`k=${k.id}`)} was="bei dieser Person" />
          </div>
        </div>
        <div style={{ flex: '0 1 auto', minWidth: 0, display: 'grid', gap: 4, justifyItems: spalten > 1 ? 'end' : 'start' }}>
          <KanalAmpel ampel={ampel} ziele={{ telefon: k.telefon ?? k.sms, email: k.email, linkedin: k.linkedin }} />
          <Grund ampel={ampel} />
        </div>
      </div>
      {termin && <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: `${LEUCHT.puls}14`, fontSize: TYP.bedien }}>Nächster Termin: <b style={{ fontWeight: 600 }}>{termin.titel}</b> · {datum(termin.start.slice(0, 10), heute)} {termin.start.slice(11, 16)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 10, marginTop: 18 }}>
        <Kennzahl label="Letzter Kontakt" wert={zuletzt ? datum(zuletzt, heute) : 'noch keiner'} farbe={zuletzt ? undefined : C.inkLeise} unter={vz.eintraege ? `${vz.eintraege} Einträge im Verlauf` : 'Verlauf leer'} />
        <Kennzahl label="Nächster" wert={k.naechsterSchritt ? datum(k.naechsterSchritt.datum, heute) : 'keiner'} farbe={!k.naechsterSchritt ? LEUCHT.achtung : schrittUeberfaellig ? LEUCHT.kritisch : undefined} unter={k.naechsterSchritt?.text ?? 'Ohne Schritt verliert sich die Person'} />
        <Kennzahl label="Takt" wert={t ? (t.ueberfaellig ? 'jetzt melden' : `fällig ${datum(t.faelligAm, heute)}`) : 'kein Kreis'} farbe={t?.ueberfaellig ? LEUCHT.achtung : t ? undefined : C.inkLeise} unter={t ? `alle ${t.tage} Tage${t.seit !== null ? ` · seit ${t.seit} T still` : ''}` : 'Kreis A–D setzt den Takt'} />
        <Kennzahl label="Gespräche" wert={vz.gespraeche} unter={vz.gespraeche === 1 ? 'echtes Gespräch oder Termin' : 'echte Gespräche und Termine'} />
        <Kennzahl label="Deals" wert={offeneDeals.length ? `${offeneDeals.length} offen` : aktivesMandat ? 'Mandat aktiv' : 'kein Deal'} farbe={offeneDeals.length || aktivesMandat ? LEUCHT.gut : C.inkLeise} unter={offeneDeals.length ? (dealWert ? `${euro(dealWert)} im Jahr` : 'ohne Wert') : `${v.mandate.length} Mandat${v.mandate.length === 1 ? '' : 'e'}`} />
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.035)', display: 'grid', gap: 6, alignContent: 'start' }}>
          <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>Vollständig</span>
          <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(voll.anteil * 100)} % <span title={`${voll.gefuellt} von ${voll.gesamt} Feldern der Matrix gefüllt`} style={{ fontSize: 12, fontWeight: 500, color: C.inkLeise }}>· {voll.gefuellt}/{voll.gesamt}</span></span>
          <Fortschritt anteil={voll.anteil} farbe={voll.anteil >= 0.7 ? LEUCHT.gut : voll.anteil >= 0.4 ? LEUCHT.achtung : LEUCHT.kritisch} />
        </div>
      </div>
    </Karte>
  );

  const stamm = (
    <Karte i={1}>
      <KartenKopf titel="Stammdaten" unter="Alle Felder der Masterdatei — antippen zum Bearbeiten, Enter speichert, Esc verwirft." />
      <Matrix k={k} api={api} setze={setze} zuFirma={zuFirma} />
    </Karte>
  );

  const aktivitaeten = (
    <Karte i={2}>
      <KartenKopf titel="Aktivitäten" unter={vz.eintraege ? `${vz.eintraege} Einträge · ${vz.gespraeche} Gespräche${vz.zuletzt ? ` · zuletzt ${datum(vz.zuletzt, heute)}` : ''}` : 'Noch nichts festgehalten.'} />
      <VerlaufTeil k={k} api={api} name={name} heute={heute} max={400} />
    </Karte>
  );

  const sales = (
    <Karte i={3} akzent={offeneDeals.length ? LEUCHT.gut : undefined}>
      <KartenKopf titel="Sales" unter="Lead (Ebene 1) → Deal (Ebene 2) → Kunde (Ebene 3)" />
      <div style={{ display: 'grid', gap: 18 }}>
        <NaechsterSchrittTeil k={k} heute={heute} setze={setze} />
        <LeadBlock api={api} leadId={k.firmaId ?? k.id} />
        <DealsTeil k={k} api={api} />
        <EntwurfTeil k={k} mailOk={mailOk} />
      </div>
    </Karte>
  );

  const beziehung = <Karte i={4}><BeziehungTeil k={k} api={api} setze={setze} /></Karte>;

  const firmenDeals = v.deals.filter(d => d.ueberFirma);
  const nichtsVerbunden = !v.events.length && !v.kampagnen.length && !v.beitraege.length && !v.powerHour.length && !v.kollegen.length && !firmenDeals.length && !v.antraege.length;
  const verbunden = (
    <Karte i={5}>
      <KartenKopf titel="Verbindungen" unter="Wo die Person sonst im System vorkommt" />
      <div style={{ display: 'grid', gap: 16 }}>
        {v.kollegen.length > 0 && <Abschnitt titel={`Kollegen bei ${firma?.name ?? k.firma ?? 'der Firma'} · ${v.kollegen.length}`}>
          {v.kollegen.slice(0, 12).map(x => <VZeile key={x.id} farbe={x.werbesperre ? LEUCHT.kritisch : phaseFarbe(x.lebensphase)} titel={anzeigename(x)} zusatz={x.position ?? x.jobtitel ?? phaseLabel(x.lebensphase)} am={x.letzterKontakt} heute={heute} onClick={() => zuAkte(x.id)} />)}
          {v.kollegen.length > 12 && <div style={{ fontSize: 12, color: C.inkLeise }}>… und {v.kollegen.length - 12} weitere in der Firmenkarte.</div>}
        </Abschnitt>}
        {firmenDeals.length > 0 && <Abschnitt titel="Deals der Firma">
          {firmenDeals.map(d => <VZeile key={d.id} farbe={OFFENE_STUFEN.includes(d.stufe) ? LEUCHT.business : C.inkLeise} titel={d.titel} zusatz={`${crm?.stufen.find(s => s.id === d.stufe)?.label ?? d.stufe}${d.wert.betrag ? ` · ${euro(d.wert.betrag)}${d.wert.basis === 'monat' ? '/Monat' : ''}` : ''} · ohne diese Person`} am={d.geaendert} heute={heute} />)}
        </Abschnitt>}
        {v.events.length > 0 && <Abschnitt titel="Events">
          {v.events.map(e => <VZeile key={e.teilnahme.id} farbe={e.teilnahme.status === 'da' ? LEUCHT.gut : e.teilnahme.status === 'no_show' || e.teilnahme.status === 'abgesagt' ? C.inkLeise : LEUCHT.puls} titel={e.event.titel} zusatz={TEILNAHME_LABEL[e.teilnahme.status]} am={e.event.datum} heute={heute} />)}
        </Abschnitt>}
        {v.kampagnen.length > 0 && <Abschnitt titel="Kampagnen">
          {v.kampagnen.map(x => <VZeile key={x.kampagne.id} farbe={x.ergebnis === 'gespraech' || x.ergebnis === 'chance' ? LEUCHT.gut : x.ergebnis ? LEUCHT.puls : C.inkLeise} titel={x.kampagne.name} zusatz={x.ergebnis ? KAMPAGNEN_ERGEBNIS_LABEL[x.ergebnis] : 'noch nicht angesprochen'} am={x.am} heute={heute} />)}
        </Abschnitt>}
        {v.beitraege.length > 0 && <Abschnitt titel="Marketing-Wirkung">
          {v.beitraege.map((b, i) => <VZeile key={`${b.beitrag.id}-${i}`} farbe={LEUCHT.agenten} titel={b.beitrag.titel} zusatz={b.art} am={b.am} heute={heute} />)}
        </Abschnitt>}
        {v.powerHour.length > 0 && <Abschnitt titel="Power Hour">
          {v.powerHour.slice(0, 8).map((p, i) => <VZeile key={i} farbe={LEUCHT.puls} titel={nameVon(p.person)} zusatz={[p.ergebnis, p.notiz].filter(Boolean).join(' · ') || 'auf der Liste'} am={p.datum} heute={heute} />)}
        </Abschnitt>}
        {v.antraege.length > 0 && <Abschnitt titel="Betroffenenanträge">
          {v.antraege.map(a => <VZeile key={a.id} farbe={a.status === 'offen' ? LEUCHT.kritisch : C.inkLeise} titel={a.art} zusatz={a.status === 'offen' ? `Frist ${datum(a.frist, heute)}` : 'erledigt'} am={a.eingang} heute={heute} />)}
        </Abschnitt>}
        {nichtsVerbunden && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Noch keine Kollegen, Events, Kampagnen oder Beiträge mit dieser Person.</div>}
      </div>
    </Karte>
  );

  const recht = <Karte i={6}><KartenKopf titel="Recht" unter="DSGVO und § 7 UWG — worauf die Ansprache beruht" /><RechtTeil k={k} api={api} heute={heute} setze={setze} /></Karte>;

  return (
    <>
      {kopf}
      <Hinweise k={k} heute={heute} setze={setze} />
      {spalten === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
          <Stapel>{stamm}</Stapel>
          <Stapel>{aktivitaeten}</Stapel>
          <Stapel>{sales}{beziehung}{verbunden}{recht}</Stapel>
        </div>
      )}
      {spalten === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
          <Stapel>{stamm}{beziehung}{recht}</Stapel>
          <Stapel>{sales}{aktivitaeten}{verbunden}</Stapel>
        </div>
      )}
      {spalten === 1 && <Stapel>{sales}{aktivitaeten}{stamm}{beziehung}{verbunden}{recht}</Stapel>}
    </>
  );
}
