'use client';

// ─── Angebots-Tool · Entwurf auf EINER Seite (28.09.) ────────────────────────
// Kevin: „Im Call muss es extrem schnell gehen: alles klickbar zusammenstellen, kurz
// manuell anpassen, am Ende ‚Mail versenden‘.“
//   1 Für wen   Kontakt suchen (Schnellsuche, suchNorm) oder vorbelegt — Firma und offener
//               Deal kommen automatisch, Gesellschaft aus dem Deal, sonst zuletzt genutzt.
//   2 Was       Produktkatalog als Karten (ein Klick = eine Position) + freie Position.
//   3 Rahmen    Einleitung/Schluss aus der Vorlage (Sie/Du aus dem Kontakt), gültig bis,
//               Zahlungsziel — alles vorbelegt, nur anpassen.
// Unten die feste Summenleiste (einmalig · monatlich · jährlich · Gesamtwert) mit
// „Mail versenden“. Der Entwurf speichert von selbst (Stand/409, nacheinander).
// Seit 29.09. (A4/A5): beim Verlassen der Seite sofort (keepalive) und mit Warnung, solange etwas offen ist; scheitert
// das Speichern vorübergehend (Netz, 5xx), versucht es ein Timer erneut; bei 409 wird die eigene Eingabe nicht
// weggeworfen — sie bleibt als „Deine Fassung“ (übernehmen/kopieren), gezeigt wird der gespeicherte Stand.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Angebot, AngebotPosition, Chance, Firma } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, feld } from '../../schlank';
import { Wahl, type WahlEintrag } from '../Wahl';
import { type CrmApi } from '../daten';
import { suchPasst } from '@/lib/text/such-norm';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { KERN_EINHEITEN } from '@/lib/einheiten';
import { kanalStatus } from '@/lib/crm/recht';
import {
  angebotSummen, angebotVorlage, mailVorlage, euroCent, plusTage, werktagePlus, produktAngebotFehlt, positionAusProdukt, istGesellschaft,
  NACHFASSEN_WERKTAGE,
} from '@/lib/crm/angebote';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { absenderAus, empfaengerAus, angebotDokument } from '@/lib/crm/angebot-dokument';
import { angebotPost, letzteGesellschaft, merkeGesellschaft, pdfLaden, type AngebotDaten, type AngebotMitStand } from './angebot-daten';
import { Katalog, PositionZeile, freiePosition } from './Positionen';
import { Vorschau, NUMMER_PLATZHALTER, type MailEntwurf } from './Vorschau';
import { mailtoLink } from '@/lib/crm/angebote';

type Form = Pick<Angebot, 'gesellschaft' | 'kontaktId' | 'firmaId' | 'dealId' | 'mandatId' | 'titel' | 'positionen' | 'einleitung' | 'schluss' | 'gueltigBis' | 'zahlungszielTage'>;
type VonHand = { titel: boolean; einleitung: boolean; schluss: boolean };
export interface Vorbelegung { kontaktId?: string | null; firmaId?: string | null; dealId?: string | null }
export interface Gestellt { angebot: AngebotMitStand; pdf: { id: string; name: string }; mailto: string; hinweise: string[]; dealId?: string }

const GES_WAHL: WahlEintrag<Gesellschaftskennung>[] = KERN_EINHEITEN.map(e => ({ id: e.id, label: e.label }));
const kopf = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim } as const;
const klein = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;
const nurForm = (a: Angebot): Form => ({ gesellschaft: a.gesellschaft, kontaktId: a.kontaktId, firmaId: a.firmaId, dealId: a.dealId, mandatId: a.mandatId, titel: a.titel, positionen: a.positionen, einleitung: a.einleitung, schluss: a.schluss, gueltigBis: a.gueltigBis, zahlungszielTage: a.zahlungszielTage });

/** Offene Deals einer Person bzw. ihrer Firma — jüngste zuerst. */
function offeneDeals(chancen: Chance[], k: Kontakt | undefined, firmaId: string | undefined): Chance[] {
  return chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && ((k && c.kontaktIds.includes(k.id)) || (!!firmaId && c.firmaId === firmaId))).sort((a, b) => b.geaendert.localeCompare(a.geaendert));
}

export function Editor({ api, daten, id, start, vorbelegung, onGespeichert, onGestellt, onListe }: {
  api: CrmApi; daten: AngebotDaten; id: string; start: AngebotMitStand | null; vorbelegung: Vorbelegung;
  onGespeichert: (id: string) => void; onGestellt: (g: Gestellt) => void; onListe: () => void;
}) {
  const crm = api.crm!;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const heute = crm.heute;
  const gesellschaftVon = useCallback((g: Gesellschaftskennung) => daten.gesellschaften.find(x => x.id === g) ?? { id: g, stand: '', luecken: [] }, [daten.gesellschaften]);

  // ── Anfangszustand: bestehender Entwurf oder neu aus der Vorbelegung ──
  const [form, setForm] = useState<Form>(() => {
    if (start) return nurForm(start);
    const deal = vorbelegung.dealId ? crm.stand.chancen.find(c => c.id === vorbelegung.dealId) : undefined;
    const kId = vorbelegung.kontaktId ?? deal?.kontaktIds[0];
    const k = kId ? kontakte.find(x => x.id === kId) : undefined;
    const firmaId = vorbelegung.firmaId ?? k?.firmaId ?? deal?.firmaId;
    const d = deal ?? offeneDeals(crm.stand.chancen, k, firmaId)[0];
    const merk = letzteGesellschaft();
    const g: Gesellschaftskennung = d && istGesellschaft(d.gesellschaft) ? d.gesellschaft : istGesellschaft(merk) ? merk : 'kdc';
    const v = mitVorgaben(gesellschaftVon(g));
    const firma = firmaId ? crm.stand.firmen.find(f => f.id === firmaId) : undefined;
    const ziel = firma?.zahlung?.zielTage ?? k?.zahlung?.zielTage ?? v.zahlungszielTage;
    const produkt = d?.leistungId ? crm.stand.leistungen.find(l => l.id === d.leistungId && l.status === 'aktiv') : undefined;
    const titel = d?.titel ?? '';
    const gueltigBis = plusTage(heute, v.gueltigkeitTage);
    const texte = angebotVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel, gueltigBis });
    return {
      gesellschaft: g, ...(k ? { kontaktId: k.id } : {}), ...(firmaId ? { firmaId } : {}), ...(d ? { dealId: d.id } : {}), titel,
      positionen: produkt ? [positionAusProdukt(produkt, 'p-1', { kleinunternehmer: !!v.kleinunternehmer })] : [],
      ...texte, gueltigBis, zahlungszielTage: ziel,
    };
  });
  const [vonHand, setVonHand] = useState<VonHand>(() => ({ titel: !!start?.titel, einleitung: !!start, schluss: !!start }));
  const [status, setStatus] = useState<'ruhig' | 'wartet' | 'speichert' | 'gespeichert' | 'fehler'>(start ? 'gespeichert' : 'ruhig');
  const [meldung, setMeldung] = useState<string | null>(null);
  /** Die eigene Fassung nach einem 409 — nie weggeworfen, bis sie übernommen oder verworfen ist. */
  const [meine, setMeine] = useState<Form | null>(null);
  const versuch = useRef(0);
  const [ansicht, setAnsicht] = useState<'bearbeiten' | 'vorschau'>('bearbeiten');
  const [mail, setMail] = useState<MailEntwurf>({ an: '', betreff: '', text: '' });
  const [nachfassen, setNachfassen] = useState(() => werktagePlus(heute, NACHFASSEN_WERKTAGE));

  // ── Automatisch speichern: nacheinander, mit dem Stand der letzten Antwort ──
  const formRef = useRef(form); formRef.current = form;
  const standRef = useRef<string | undefined>(start?.stand);
  const gespeichert = useRef(!!start);
  const kette = useRef<Promise<void>>(Promise.resolve());
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offen = useRef(false);
  // Aufrufer-Werte über Refs — sonst entstünde `speichernJetzt` bei jedem Zeichnen neu (und das Aufräumen liefe mit).
  const datenRef = useRef(daten); datenRef.current = daten;
  const gespeichertMeldung = useRef(onGespeichert); gespeichertMeldung.current = onGespeichert;
  const speichernJetzt = useCallback((opt: { keepalive?: boolean } = {}) => {
    if (uhr.current) { clearTimeout(uhr.current); uhr.current = null; }
    if (!offen.current) return kette.current;
    offen.current = false;
    kette.current = kette.current.then(async () => {
      setStatus('speichert');
      const gesendet = formRef.current;
      const r = await angebotPost({ aktion: 'speichern', id, felder: gesendet, ...(standRef.current ? { stand: standRef.current } : {}) }, opt);
      if (r.ok && r.angebot) {
        versuch.current = 0;
        standRef.current = r.angebot.stand; datenRef.current.uebernehmen(r.angebot); setStatus(offen.current ? 'wartet' : 'gespeichert'); setMeldung(null);
        if (!gespeichert.current) { gespeichert.current = true; gespeichertMeldung.current(id); }
      } else if (r.status === 409 && r.aktuell) {
        // Die eigene Eingabe bleibt als „Deine Fassung“ — angezeigt wird der gespeicherte Stand (A4).
        const eigene = formRef.current;
        standRef.current = r.aktuell.stand; datenRef.current.uebernehmen(r.aktuell); setForm(nurForm(r.aktuell)); setStatus('fehler');
        if (JSON.stringify(eigene) !== JSON.stringify(nurForm(r.aktuell))) setMeine(eigene);
        setMeldung(r.aktuell.status === 'entwurf' ? 'Jemand hat diesen Entwurf inzwischen geändert — sein Stand ist geladen. Deine Fassung ist nicht verloren: übernehmen oder kopieren.' : 'Dieses Angebot ist inzwischen gestellt — Änderungen nur als neue Version. Deine Fassung kannst du kopieren.');
      } else {
        // Nicht gespeichert: offen bleiben. Vorübergehend (Netz, 5xx, abgelaufene Sitzung) → erneuter Versuch per Timer.
        offen.current = true; setStatus('fehler');
        const nochmal = r.status === 0 || r.status >= 500 || r.status === 429 || r.status === 401;
        if (nochmal) {
          const ms = Math.min(60_000, 2_000 * 2 ** Math.min(versuch.current++, 10));
          setMeldung(`${r.fehler ?? 'Nicht gespeichert.'} Neuer Versuch in ${Math.round(ms / 1000)} s — die Eingabe bleibt.`);
          if (uhr.current) clearTimeout(uhr.current);
          uhr.current = setTimeout(() => { void speichernJetzt(); }, ms);
        } else setMeldung(`${r.fehler ?? 'Nicht gespeichert.'} Die Eingabe bleibt — bitte anpassen, dann geht sie erneut raus.`);
      }
    });
    return kette.current;
  }, [id]);
  // Seite verlassen (Unmount): was offen ist, geht jetzt raus — auch nach einem Fehler (vorher nur bei laufendem Timer).
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); if (offen.current) void speichernJetzt({ keepalive: true }); }, [speichernJetzt]);
  // Tab weg/geschlossen: sofort mit keepalive; Warnung, solange etwas offen ist (A5).
  useEffect(() => {
    const raus = () => { if (offen.current) void speichernJetzt({ keepalive: true }); };
    const verdeckt = () => { if (document.visibilityState === 'hidden') raus(); };
    const warnen = (e: BeforeUnloadEvent) => { if (!offen.current) return; raus(); e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('pagehide', raus);
    window.addEventListener('beforeunload', warnen);
    document.addEventListener('visibilitychange', verdeckt);
    return () => { window.removeEventListener('pagehide', raus); window.removeEventListener('beforeunload', warnen); document.removeEventListener('visibilitychange', verdeckt); };
  }, [speichernJetzt]);
  const aendern = useCallback((teil: Partial<Form>) => {
    setForm(f => ({ ...f, ...teil }));
    offen.current = true; setStatus('wartet');
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = setTimeout(() => { void speichernJetzt(); }, 700);
  }, [speichernJetzt]);

  // ── Abgeleitet ──
  const k = form.kontaktId ? kontakte.find(x => x.id === form.kontaktId) : undefined;
  const firma: Firma | undefined = form.firmaId ? crm.stand.firmen.find(f => f.id === form.firmaId) : undefined;
  const deals = offeneDeals(crm.stand.chancen, k, form.firmaId);
  const deal = form.dealId ? crm.stand.chancen.find(c => c.id === form.dealId) : undefined;
  const g = gesellschaftVon(form.gesellschaft);
  const v = mitVorgaben(g);
  const ku = !!v.kleinunternehmer;
  const s = angebotSummen(form, { kleinunternehmer: ku });
  const logoUrl = g.logoDateiId ? `/api/crm/dateien?id=${encodeURIComponent(g.logoDateiId)}` : null;

  // Vorlage nachziehen, solange die Texte nicht von Hand geändert wurden (Anrede, Name, Titel, gültig bis).
  useEffect(() => {
    if (vonHand.einleitung && vonHand.schluss) return;
    const t = angebotVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: form.titel, gueltigBis: form.gueltigBis });
    const teil: Partial<Form> = {};
    if (!vonHand.einleitung && t.einleitung !== formRef.current.einleitung) teil.einleitung = t.einleitung;
    if (!vonHand.schluss && t.schluss !== formRef.current.schluss) teil.schluss = t.schluss;
    if (Object.keys(teil).length) { setForm(f => ({ ...f, ...teil })); offen.current = true; } // gespeichert mit der nächsten Änderung bzw. vor der Vorschau
  }, [k?.anrede, k?.vorname, k?.nachname, form.titel, form.gueltigBis, vonHand.einleitung, vonHand.schluss]);

  function kontaktWaehlen(neu: Kontakt | null) {
    if (!neu) { aendern({ kontaktId: undefined, firmaId: undefined, dealId: undefined }); return; }
    const d = offeneDeals(crm.stand.chancen, neu, neu.firmaId)[0];
    const f = neu.firmaId ? crm.stand.firmen.find(x => x.id === neu.firmaId) : undefined;
    const teil: Partial<Form> = { kontaktId: neu.id, firmaId: neu.firmaId, dealId: d?.id, ...(f?.zahlung?.zielTage != null ? { zahlungszielTage: f.zahlung.zielTage } : neu.zahlung?.zielTage != null ? { zahlungszielTage: neu.zahlung.zielTage } : {}) };
    if (d && istGesellschaft(d.gesellschaft)) teil.gesellschaft = d.gesellschaft;
    if (!vonHand.titel && d?.titel) teil.titel = d.titel;
    aendern(teil);
  }
  const positionen = form.positionen;
  const setzePos = (l: AngebotPosition[]) => aendern({ positionen: l });
  // Erstes Produkt einer anderen Gesellschaft: der Absender folgt dem Produkt (sonst ginge ein KD-Ventures-Produkt
  // unter der Selbstständigkeit raus). Stehen schon Positionen drin, bleibt die Gesellschaft — Hinweis statt Wechsel.
  const [mischHinweis, setMischHinweis] = useState<string | null>(null);
  const dazu = (p: AngebotPosition, von: Gesellschaftskennung | null) => {
    const teil: Partial<Form> = { positionen: [...positionen, p] };
    if (!form.titel.trim() && !vonHand.titel) teil.titel = p.titel;
    if (von && von !== form.gesellschaft) {
      if (!positionen.length) { teil.gesellschaft = von; merkeGesellschaft(von); setMischHinweis(null); }
      else setMischHinweis(`„${p.titel}“ gehört zu ${GES_WAHL.find(x => x.id === von)?.label ?? von} — Absender bleibt ${GES_WAHL.find(x => x.id === form.gesellschaft)?.label ?? form.gesellschaft}. Getrennte Angebote je Gesellschaft sind sauberer.`);
    }
    aendern(teil);
  };

  // ── Vorschau ──
  const empf = empfaengerAus(k, firma);
  const dokEntwurf = angebotDokument({ ...form, id, status: 'entwurf', version: start?.version ?? 1, angelegt: '', geaendert: '' } as Angebot, absenderAus(g), empf, heute);
  const ampel = useMemo(() => {
    if (!k) return { hinweise: ['Kein Empfänger gewählt.'] };
    const ctx = { hatMandat: crm.stand.mandate.some(m => m.status === 'aktiv' && m.kontaktIds.includes(k.id)), hatChance: crm.stand.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && c.kontaktIds.includes(k.id)) };
    if (k.eingeschraenkt || k.werbesperre) return { sperre: kanalStatus(k, 'mail', ctx).grund, hinweise: [] };
    const st = kanalStatus(k, 'mail', ctx);
    if (st.grund === 'keine Adresse') return { hinweise: ['Keine E-Mail-Adresse am Kontakt — das PDF entsteht trotzdem; bitte auf anderem Weg senden.'] };
    return { hinweise: st.farbe === 'gruen' ? [] : [`Kanal-Ampel ${st.farbe}: ${st.grund}. Ein angefragtes Angebot ist Vertragsanbahnung (Art. 6 Abs. 1 lit. b DSGVO) — nur senden, wenn es angefragt wurde, ohne Werbung.`] };
  }, [k, crm.stand.mandate, crm.stand.chancen]);
  const fehlt = [!k ? 'Empfänger' : '', !positionen.length ? 'mindestens eine Position' : '', !form.titel.trim() ? 'Titel' : '', form.gueltigBis < heute ? '„gültig bis“ in der Zukunft' : ''].filter(Boolean);

  async function zurVorschau() {
    offen.current = true; // auch ein unveränderter, vorbelegter Entwurf wird vor der Vorschau gespeichert
    await speichernJetzt();
    const m = mailVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: form.titel, nummer: NUMMER_PLATZHALTER, gueltigBis: form.gueltigBis, absender: v.name });
    setMail({ an: k?.email ?? '', ...m });
    setMeldung(null);
    setAnsicht('vorschau');
  }
  async function senden() {
    await speichernJetzt();
    if (!standRef.current) { setMeldung('Der Entwurf ist noch nicht gespeichert — bitte kurz warten und noch einmal.'); return; }
    const r = await angebotPost({ aktion: 'stellen', id, stand: standRef.current, nachfassenAm: nachfassen });
    if (!r.ok || !r.angebot) {
      if (r.status === 409 && r.aktuell) { standRef.current = r.aktuell.stand; daten.uebernehmen(r.aktuell); }
      setMeldung(r.fehler ?? 'Nicht gesendet.');
      return;
    }
    const nr = r.angebot.nummer ?? '';
    const ein = (t: string) => t.split(NUMMER_PLATZHALTER).join(nr);
    const pdf = r.pdf as { id: string; name: string };
    const link = mailtoLink(mail.an.trim() || undefined, ein(mail.betreff), ein(mail.text));
    daten.uebernehmen(r.angebot);
    merkeGesellschaft(form.gesellschaft);
    pdfLaden(pdf.id, pdf.name);
    setTimeout(() => { window.location.href = link; }, 500);
    void api.laden(true);
    onGestellt({ angebot: r.angebot, pdf, mailto: link, hinweise: (r.hinweise as string[] | undefined) ?? [], ...(typeof r.dealId === 'string' ? { dealId: r.dealId } : {}) });
  }

  if (ansicht === 'vorschau') {
    return <Vorschau dok={dokEntwurf} logoUrl={logoUrl} mail={mail} setMail={setMail} ampel={ampel} luecken={g.luecken ?? []} nachfassen={nachfassen} setNachfassen={setNachfassen} onZurueck={() => setAnsicht('bearbeiten')} onSenden={senden} meldung={meldung} />;
  }

  const statusText = { ruhig: 'noch nicht gespeichert', wartet: 'Änderung …', speichert: 'speichert …', gespeichert: 'Entwurf gespeichert', fehler: 'nicht gespeichert' }[status];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, paddingBottom: 8, minWidth: 0 }}>
      {meldung && <Karte i={0} akzent={LEUCHT.achtung}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: TYP.bedien, color: C.inkDim }}><span>{meldung}</span><button onClick={() => setMeldung(null)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer' }}>ok</button></div></Karte>}
      {meine && (
        <Karte i={0} akzent={LEUCHT.achtung}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
            <span style={{ flex: 1, minWidth: 200 }}>Deine Fassung („{meine.titel || 'ohne Titel'}“, {meine.positionen.length} Position{meine.positionen.length === 1 ? '' : 'en'}) ist gemerkt.</span>
            <button onClick={() => { void navigator.clipboard?.writeText([meine.titel, meine.einleitung, ...meine.positionen.map(p => `${p.titel}${p.text ? ` — ${p.text}` : ''}`), meine.schluss].filter(Boolean).join('\n\n')).catch(() => {}); }} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer' }}>kopieren</button>
            <button onClick={() => { setMeine(null); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>verwerfen</button>
            <Knopf onClick={() => { const f = meine; setMeine(null); setMeldung(null); aendern(f); }}>Deine Fassung übernehmen</Knopf>
          </div>
        </Karte>
      )}

      <Karte i={0}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={kopf}>1 · Für wen</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: status === 'fehler' ? LEUCHT.kritisch : C.inkLeise }}>{start?.version && start.version > 1 ? `Version ${start.version} · ` : ''}{statusText}</span>
            <button onClick={onListe} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5 }}>alle Angebote ›</button>
          </span>
        </div>
        <KontaktSuche kontakte={kontakte} gewaehlt={k} firma={firma} onWahl={kontaktWaehlen} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <Wahl<Gesellschaftskennung> label="Gesellschaft" liste={GES_WAHL} wert={form.gesellschaft} onWahl={x => { merkeGesellschaft(x); aendern({ gesellschaft: x }); }} />
          {(deals.length > 0 || deal) && (
            <Wahl<string> label="Deal" leer="+ Deal" liste={[...(deal && !deals.some(d => d.id === deal.id) ? [deal] : []), ...deals].map(d => ({ id: d.id, label: d.titel, hinweis: crm.stufen.find(x => x.id === d.stufe)?.label }))}
              wert={form.dealId ?? null} onWahl={x => aendern({ dealId: x })} onLeeren={() => aendern({ dealId: undefined })} leerenLabel="ohne Deal (beim Senden neu)" />
          )}
          {!deals.length && !deal && k && <span style={klein}>Kein offener Deal — beim Senden entsteht einer in Stufe „Angebot“.</span>}
          {(g.luecken ?? []).length > 0 && <Chip farbe={LEUCHT.achtung}>Absender: {(g.luecken ?? []).join(', ')} fehlt</Chip>}
        </div>
      </Karte>

      <Karte i={1}>
        <div style={{ ...kopf, marginBottom: 10 }}>2 · Was</div>
        <Katalog leistungen={crm.stand.leistungen} gesellschaft={form.gesellschaft} kleinunternehmer={x => !!mitVorgaben(gesellschaftVon(x)).kleinunternehmer} onDazu={dazu} />
        {mischHinweis && <div style={{ fontSize: 12.5, color: LEUCHT.business, marginTop: 8 }}>{mischHinweis}</div>}
        <div style={{ marginTop: 14 }}>
          <input value={form.titel} onChange={e => { setVonHand(h => ({ ...h, titel: true })); aendern({ titel: e.target.value }); }} placeholder="Titel des Angebots (z. B. Retainer Strategie 2027)" aria-label="Titel des Angebots"
            style={{ ...feld, fontSize: TYP.body, fontWeight: 700, padding: '10px 13px' }} />
        </div>
        <div style={{ marginTop: 6 }}>
          {positionen.map((p, i) => (
            <PositionZeile key={p.id} p={p} nr={i + 1} kleinunternehmer={ku}
              textFehlt={!!p.leistungId && produktAngebotFehlt(crm.stand.leistungen.find(l => l.id === p.leistungId) ?? {}).length > 0}
              onAendern={teil => setzePos(positionen.map(x => (x.id === p.id ? { ...x, ...teil } : x)))}
              onWeg={() => setzePos(positionen.filter(x => x.id !== p.id))}
              onHoch={i > 0 ? () => { const n = [...positionen]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setzePos(n); } : undefined} />
          ))}
          {!positionen.length && <div style={{ ...klein, padding: '10px 0' }}>Produkt oben anklicken — oder eine freie Position.</div>}
          <button onClick={() => setzePos([...positionen, freiePosition(ku)])} style={{ marginTop: 8, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 13, padding: 0 }}>+ freie Position</button>
        </div>
      </Karte>

      <Karte i={2}>
        <div style={{ ...kopf, marginBottom: 10 }}>3 · Rahmen</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>gültig bis
            <input type="date" value={form.gueltigBis} min={heute} onChange={e => e.target.value && aendern({ gueltigBis: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', width: 160 }} /></label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>Zahlungsziel
            <input inputMode="numeric" value={String(form.zahlungszielTage)} onChange={e => { const n = Math.round(Number(e.target.value)); if (e.target.value === '' || (Number.isFinite(n) && n >= 0 && n <= 180)) aendern({ zahlungszielTage: e.target.value === '' ? 0 : n }); }} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', width: 70, textAlign: 'right' }} aria-label="Zahlungsziel in Tagen" /> Tage</label>
          {ku && <Chip farbe={C.inkDim}>Kleinunternehmer · ohne USt</Chip>}
        </div>
        <TextFeld label="Einleitung" wert={form.einleitung} vonHand={vonHand.einleitung} onAendern={t => { setVonHand(h => ({ ...h, einleitung: true })); aendern({ einleitung: t }); }}
          onVorlage={() => { setVonHand(h => ({ ...h, einleitung: false })); aendern({ einleitung: angebotVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: form.titel, gueltigBis: form.gueltigBis }).einleitung }); }} />
        <TextFeld label="Schluss" wert={form.schluss} vonHand={vonHand.schluss} onAendern={t => { setVonHand(h => ({ ...h, schluss: true })); aendern({ schluss: t }); }}
          onVorlage={() => { setVonHand(h => ({ ...h, schluss: false })); aendern({ schluss: angebotVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: form.titel, gueltigBis: form.gueltigBis }).schluss }); }} />
      </Karte>

      {/* Feste Summenleiste */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, background: 'rgba(11,14,16,.94)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,.08)', padding: '12px 4px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Summe label="einmalig" netto={s.einmalig.netto} brutto={s.einmalig.brutto} ku={ku} />
        <Summe label="monatlich" netto={s.monat.netto} brutto={s.monat.brutto} ku={ku} />
        <Summe label="jährlich" netto={s.jahr.netto} brutto={s.jahr.brutto} ku={ku} />
        <Summe label="Gesamtwert" netto={s.gesamt.netto} brutto={s.gesamt.brutto} ku={ku} stark />
        <span style={{ flex: 1 }} />
        {fehlt.length > 0 && <span style={{ fontSize: 12, color: C.inkLeise }}>fehlt: {fehlt.join(', ')}</span>}
        <Knopf farbe={LEUCHT.gut} aus={fehlt.length > 0} onClick={zurVorschau}>Mail versenden ›</Knopf>
      </div>
    </div>
  );
}

function Summe({ label, netto, brutto, ku, stark }: { label: string; netto: number; brutto: number; ku: boolean; stark?: boolean }) {
  if (!netto && !stark) return null;
  return (
    <span style={{ display: 'grid', gap: 1 }}>
      <span style={{ fontSize: 11, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: stark ? 17 : 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: stark ? LEUCHT.gut : C.ink }}>{euroCent(netto)}{ku ? '' : <span style={{ fontSize: 11.5, color: C.inkLeise, fontWeight: 500 }}> netto · {euroCent(brutto)} brutto</span>}</span>
    </span>
  );
}

function TextFeld({ label, wert, vonHand, onAendern, onVorlage }: { label: string; wert: string; vonHand: boolean; onAendern: (t: string) => void; onVorlage: () => void }) {
  return (
    <label style={{ display: 'grid', gap: 4, marginTop: 8 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkLeise }}>{label}{vonHand && <button type="button" onClick={onVorlage} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12, padding: 0 }}>Vorlage wiederherstellen</button>}</span>
      <textarea value={wert} onChange={e => onAendern(e.target.value)} rows={Math.min(10, Math.max(3, wert.split('\n').length + 1))} aria-label={label} style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, padding: '9px 12px', resize: 'vertical' }} />
    </label>
  );
}

/** Schnellsuche nach Person (Name, Firma, E-Mail) — Enter nimmt den ersten Treffer. */
function KontaktSuche({ kontakte, gewaehlt, firma, onWahl }: { kontakte: Kontakt[]; gewaehlt?: Kontakt; firma?: Firma; onWahl: (k: Kontakt | null) => void }) {
  const [q, setQ] = useState('');
  const [auf, setAuf] = useState(!gewaehlt);
  const treffer = useMemo(() => (q.trim() ? kontakte.filter(k => !k.eingeschraenkt && suchPasst([anzeigename(k), k.firma, k.email, ...(k.emails ?? []).map(e => e.adresse)], q)).slice(0, 8) : []), [kontakte, q]);
  if (gewaehlt && !auf) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: TYP.body, fontWeight: 700 }}>{anzeigename(gewaehlt)}</span>
        {firma && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{firma.name}</span>}
        {gewaehlt.email && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{gewaehlt.email}</span>}
        <Chip farbe={C.inkDim}>{gewaehlt.anrede === 'Du' ? 'Du' : 'Sie'}</Chip>
        {gewaehlt.werbesperre && <Chip farbe={LEUCHT.kritisch}>Werbesperre</Chip>}
        <button onClick={() => { setAuf(true); setQ(''); }} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5 }}>ändern</button>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Kontakt suchen — Name, Firma oder E-Mail" aria-label="Kontakt suchen"
        onKeyDown={e => { if (e.key === 'Enter' && treffer[0]) { onWahl(treffer[0]); setAuf(false); } if (e.key === 'Escape' && gewaehlt) setAuf(false); }}
        style={{ ...feld, fontSize: TYP.body, padding: '11px 14px' }} />
      {treffer.length > 0 && (
        <div role="listbox" style={{ marginTop: 6, display: 'grid', gap: 2, background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: 4 }}>
          {treffer.map(k => (
            <button key={k.id} role="option" aria-selected={false} onClick={() => { onWahl(k); setAuf(false); }} className="fassbar"
              style={{ textAlign: 'left', background: 'none', border: 'none', borderRadius: 9, padding: '8px 10px', cursor: 'pointer', color: C.ink, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: TYP.bedien }}>{anzeigename(k)}</span>
              {k.firma && <span style={{ fontSize: 12.5, color: C.inkDim }}>{k.firma}</span>}
              {k.email && <span style={{ fontSize: 12, color: C.inkLeise }}>{k.email}</span>}
              {k.werbesperre && <span style={{ fontSize: 11, color: LEUCHT.kritisch }}>Werbesperre</span>}
            </button>
          ))}
        </div>
      )}
      {q.trim() && !treffer.length && <div style={{ ...klein, marginTop: 6 }}>Niemand gefunden.</div>}
      {gewaehlt && <button onClick={() => setAuf(false)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>bei {anzeigename(gewaehlt)} bleiben</button>}
    </div>
  );
}

