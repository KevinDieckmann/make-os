'use client';

// ─── Vertrieb › Angebote › Verträge (01.11.) ─────────────────────────────────────────────────────────────────────────
// Kevin: „Vertrag als eigene Maske, dass wir die Verträge sofort sauber erstellen können wie so ein Angebot.“
// Adresse `?s=angebot&a=vertraege` (lib/crm/adresse.ts `vertragLink`): ohne `k` die Liste (mit Vorbelegung aus `angebot`/`deal`/`mandat`/
// `kontakt`/`firma` der Dialog „Vertrag erstellen“), mit `k` der Entwurf (Maske) bzw. der fertige Vertrag (Ansicht).
// Schritte der Maske: Vorlage → Gesellschaft (Absender, nur Business) → Vertragspartner (Firma/Kontakt aus dem CRM, neu anlegen möglich) → Felder →
// Paragraphen an/ab und anpassen (Abweichung markiert) → PDF-Vorschau → Fertigstellen (Nummer, PDF als Beleg). Versendet wird nur per Klick in „Vertrag senden“ (02.11.).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FileSignature } from 'lucide-react';
import type { CrmApi } from '../crm/daten';
import { Wahl } from '../crm/Wahl';
import { Karte, Ueberschrift, Knopf, Hinweis, Leerzustand, Leer, Liste, Zeile, Chip, Feldzeile, eingabe, Pillen, useRueckfrage } from '../ui';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { vertragLink, angebotLink } from '@/lib/crm/adresse';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { gesellschaftLabel } from '@/lib/crm/angebote';
import { mailtoLink } from '@/lib/crm/angebote';
import {
  STANDARD_FELDER, VERTRAG_HINWEIS, STATUS_WEITER, artLabel, statusLabel, paragraphAbweichend, paragraphAktiv, fertigstellenFehlt, platzhalterIn,
  type VertragStatus, type VorlageFeld,
} from '@/lib/vertraege/modell';
import { senden, unterschriftHochladen, useVertraege, useVorlagen, type VertragMitStand } from './daten';
import { DarlehenVorschau, FinanzenKarte, SendenKarte, TextMitTabelle } from './VertragExtras';

export interface VertraegeStartProps {
  api: CrmApi;
  vertragId?: string | null;
  angebotId?: string | null;
  dealId?: string | null;
  mandatId?: string | null;
  kontaktId?: string | null;
  firmaId?: string | null;
  /** Die Reiterzeile „Angebote | Verträge“ (von der Seite). */
  reiter: ReactNode;
}

const STATUS_FARBE: Record<VertragStatus, string> = { entwurf: C.inkDim, fertig: LEUCHT.business, versendet: C.aktiv, unterschrieben: LEUCHT.gut, aktiv: LEUCHT.gut, beendet: C.inkLeise, gekuendigt: C.inkLeise };
const klein = { fontSize: TYP.bedien, color: C.inkDim } as const;
/** PDF laden (Download — die Antwort ist `attachment`). */
const pdfLaden = (id: string) => { window.location.assign(`/api/vertraege?pdf=${encodeURIComponent(id)}`); };

export function VertraegeStart({ api, vertragId, angebotId, dealId, mandatId, kontaktId, firmaId, reiter }: VertraegeStartProps) {
  const router = useRouter();
  const daten = useVertraege();
  const vorlagen = useVorlagen();
  const vorbelegt = !vertragId && (angebotId || dealId || mandatId || kontaktId || firmaId);
  const [neu, setNeu] = useState(!!vorbelegt);
  useEffect(() => { if (vorbelegt) setNeu(true); }, [vorbelegt]);
  const oeffnen = useCallback((id: string) => router.push(vertragLink({ vertragId: id })), [router]);
  const zurListe = useCallback(() => router.push(vertragLink()), [router]);

  if (daten.gesperrt) return <Karte><Leer>Verträge gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.</Leer></Karte>;
  if (daten.vertraege === null) return <>{reiter}<Karte><Leer>{daten.fehler ?? 'Verträge laden …'}</Leer></Karte></>;
  const v = vertragId ? daten.vertraege.find(x => x.id === vertragId) : undefined;
  if (vertragId && !v) return <>{reiter}<Karte><Leer>Diesen Vertrag gibt es nicht (mehr).</Leer><div style={{ marginTop: 8 }}><Knopf leise onClick={zurListe}>Zu allen Verträgen</Knopf></div></Karte></>;
  if (v) {
    return (
      <>
        {reiter}
        {v.status === 'entwurf'
          ? <Maske key={v.id} v={v} api={api} daten={daten} vorlagen={vorlagen.stand?.vorlagen ?? []} onListe={zurListe} />
          : <Ansicht key={v.id} v={v} daten={daten} onOeffnen={oeffnen} onListe={zurListe} />}
      </>
    );
  }
  return (
    <>
      {reiter}
      {neu && <Erstellen api={api} vorlagen={vorlagen} vorbelegung={{ angebotId, dealId, mandatId, kontaktId, firmaId }} onAbbrechen={() => { setNeu(false); if (vorbelegt) router.replace(vertragLink()); }}
        onAngelegt={x => { daten.uebernehmen(x); router.replace(vertragLink({ vertragId: x.id })); }} />}
      <Karte>
        <Ueberschrift rechts={!neu && <Knopf haupt onClick={() => setNeu(true)}>+ Vertrag</Knopf>}>Verträge</Ueberschrift>
        {!daten.vertraege.length ? (
          <Leerzustand symbol={<FileSignature size={22} />} titel="Noch kein Vertrag" aktion={<Knopf leise href="/os/unternehmen?s=vertraege&a=vorlagen">Vorlagen pflegen</Knopf>}>
            Verträge entstehen aus Vorlagen (Unternehmen › Verträge › Vorlagen) — auch direkt aus einem angenommenen Angebot, einem Deal oder einem Mandat.
          </Leerzustand>
        ) : (
          <Liste>
            {[...daten.vertraege].sort((a, b) => b.geaendert.localeCompare(a.geaendert)).map(x => (
              <Zeile key={x.id} onClick={() => oeffnen(x.id)} titel={`${x.titel}${x.nummer ? ` · ${x.nummer}` : ''}`} unter={`${gesellschaftLabel(x.gesellschaft)}${x.partner?.name ? ` · ${x.partner.name}` : ''}${x.version > 1 ? ` · Version ${x.version}` : ''}`}
                rechts={<Chip farbe={STATUS_FARBE[x.status]}>{statusLabel(x.status)}</Chip>} />
            ))}
          </Liste>
        )}
      </Karte>
    </>
  );
}

/** „Vertrag erstellen“: Vorlage und Gesellschaft wählen (Vorbelegung aus Angebot/Deal/Mandat/Kontakt/Firma kommt aus der Adresse). */
function Erstellen({ api, vorlagen, vorbelegung, onAbbrechen, onAngelegt }: {
  api: CrmApi; vorlagen: ReturnType<typeof useVorlagen>; vorbelegung: Record<string, string | null | undefined>; onAbbrechen: () => void; onAngelegt: (v: VertragMitStand) => void;
}) {
  const liste = (vorlagen.stand?.vorlagen ?? []).filter(v => !v.archiviert);
  const [vorlageId, setVorlageId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const arten = vorlagen.stand?.arten ?? [];
  const herkunft = vorbelegung.angebotId ? 'aus dem Angebot' : vorbelegung.mandatId ? 'aus dem Mandat' : vorbelegung.dealId ? 'aus dem Deal' : vorbelegung.firmaId || vorbelegung.kontaktId ? 'für den Vertragspartner' : '';
  // Absender gleich hier (03.11.): ohne Angebot/Deal/Mandat kennt der Server die Gesellschaft nur, wenn es genau eine operative gibt —
  // sonst lehnte „Entwurf anlegen“ ab, ohne dass der Dialog eine Wahl bot. Aus Angebot/Deal/Mandat bleibt deren Gesellschaft die Vorgabe.
  const gesellschaften = (['kdc', 'kdv', 'ug'] as const).filter(istBusinessGesellschaft);
  const [gesellschaft, setGesellschaft] = useState<string | null>(gesellschaften.length === 1 ? gesellschaften[0] : null);
  const absenderFehlt = !gesellschaft && !vorbelegung.angebotId && !vorbelegung.mandatId && !vorbelegung.dealId;
  void api;
  return (
    <Karte>
      <Ueberschrift>Vertrag erstellen{herkunft ? ` ${herkunft}` : ''}</Ueberschrift>
      <Hinweis art="info">{VERTRAG_HINWEIS}</Hinweis>
      {!liste.length ? <Leer>Noch keine Vorlage — unter Unternehmen › Verträge › Vorlagen anlegen oder importieren.</Leer> : (
        <Feldzeile label="Vorlage">
          <Wahl label="Vorlage" wert={vorlageId} onWahl={setVorlageId} liste={liste.map(v => ({ id: v.id, label: v.titel, hinweis: `${artLabel(v.art, arten as never)} · ${v.ampel.ampel === 'gruen' ? 'geprüft' : 'ungeprüft'}` }))} />
        </Feldzeile>
      )}
      {gesellschaften.length > 1 && (
        <Feldzeile label="Absender (Gesellschaft)">
          <Pillen liste={gesellschaften.map(g => ({ id: g, label: gesellschaftLabel(g) }))} aktiv={gesellschaft as typeof gesellschaften[number] | null} onWahl={g => setGesellschaft(g)} />
        </Feldzeile>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Knopf haupt aus={!vorlageId || absenderFehlt} onClick={async () => {
          const vb = Object.fromEntries(Object.entries(vorbelegung).filter(([, x]) => !!x));
          const r = await senden<{ vertrag: VertragMitStand }>('/api/vertraege', { aktion: 'anlegen', vorlageId, ...(gesellschaft ? { gesellschaft } : {}), vorbelegung: vb });
          if (r.ok) onAngelegt(r.d.vertrag); else setFehler(r.d.fehler ?? 'Nicht angelegt.');
        }}>Entwurf anlegen</Knopf>
        <Knopf leise onClick={onAbbrechen}>Abbrechen</Knopf>
      </div>
    </Karte>
  );
}

/** Die Maske eines Entwurfs: Absender, Vertragspartner, Felder, Paragraphen, Vorschau, Fertigstellen. */
function Maske({ v, api, daten, vorlagen, onListe }: { v: VertragMitStand; api: CrmApi; daten: ReturnType<typeof useVertraege>; vorlagen: { id: string; ampel: { ampel: string; satz: string } }[]; onListe: () => void }) {
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'achtung' | 'gut'; text: string } | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const r = useRueckfrage();
  const gesellschaften = (['kdc', 'kdv', 'ug'] as const).filter(istBusinessGesellschaft);
  const firmen = useMemo(() => (api.crm?.stand.firmen ?? []).map(f => ({ id: f.id, label: f.name })), [api.crm]);
  const kontakte = useMemo(() => (api.kontakte ?? []).filter(k => !v.firmaId || k.firmaId === v.firmaId).map(k => ({ id: k.id, label: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() || k.email || k.id })), [api.kontakte, v.firmaId]);
  const ampel = vorlagen.find(x => x.id === v.vorlageId)?.ampel;
  // Schreiben nacheinander, Stand immer aus der letzten Server-Antwort (03.11.): zwei Felder kurz hintereinander verlassen schickte sonst beide mit
  // demselben alten Stand — das zweite kam mit 409 „Nichts gespeichert“ zurück, obwohl der Text im Feld stehen blieb.
  const standRef = useRef(v.stand);
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => { standRef.current = v.stand; }, [v.stand]);
  const nacheinander = <T,>(fn: () => Promise<T>): Promise<T> => { const p = kette.current.then(fn, fn); kette.current = p.catch(() => undefined); return p; };
  const aendern = (felder: Record<string, unknown>) => nacheinander(async () => {
    const a = await senden<{ vertrag: VertragMitStand; aktuell?: VertragMitStand }>('/api/vertraege', { aktion: 'speichern', id: v.id, stand: standRef.current, felder });
    if (a.ok) { standRef.current = a.d.vertrag.stand; daten.uebernehmen(a.d.vertrag); setMeldung(null); return true; }
    if (a.status === 409 && a.d.aktuell) { standRef.current = (a.d.aktuell as VertragMitStand).stand; daten.uebernehmen(a.d.aktuell as VertragMitStand); }
    setMeldung({ art: 'kritisch', text: `${a.d.fehler ?? 'Nicht gespeichert.'} Nichts gespeichert.` });
    return false;
  });
  const fertigstellen = async (trotzdem = false) => {
    await nacheinander(async () => undefined); // erst alles Offene speichern
    const a = await senden<{ vertrag: VertragMitStand }>('/api/vertraege', { aktion: 'fertigstellen', id: v.id, stand: standRef.current, trotzdem });
    if (a.ok) { daten.uebernehmen(a.d.vertrag); return; }
    if (a.status === 409 && a.d.warnungen?.length) {
      if (await r.bestaetigen({ titel: 'Trotzdem fertigstellen?', text: `${a.d.warnungen.join('\n')}\n\n${VERTRAG_HINWEIS}`, ja: 'Trotzdem fertigstellen' })) await fertigstellen(true);
      return;
    }
    setMeldung({ art: 'kritisch', text: a.d.fehler ?? 'Nicht fertiggestellt.' });
  };
  const felder: VorlageFeld[] = [...STANDARD_FELDER.filter(f => v.paragraphen.some(p => platzhalterIn(`${p.titel}\n${p.text}`).includes(f.schluessel)) || v.werte[f.schluessel] || ['beginn', 'kuendigen_bis', 'erinnerung_tage', 'ort', 'datum'].includes(f.schluessel)), ...v.felder];
  // Vorschau der Sperre (Server prüft dasselbe mit Absender/Partner aus Register und Kartei).
  const fehlt = fertigstellenFehlt(v, { absender: { firmierung: 'x', zeilen: [] }, partner: { name: 'x', zeilen: [] }, leistung: { titel: v.leistungId ? 'x' : '', beschreibung: v.leistungId ? 'x' : '' } })
    .filter(t => !/Absender|Vertragspartner: Name|Vertragspartner: Anschrift|Ansprechpartner/.test(t));

  return (
    <>
      {r.dialog}
      <Karte>
        <Ueberschrift rechts={<Knopf leise onClick={onListe}>Alle Verträge</Knopf>}>Entwurf</Ueberschrift>
        <Hinweis art={ampel?.ampel === 'gruen' ? 'info' : 'achtung'}>{ampel?.satz ?? 'Vorlage nicht gefunden.'} {VERTRAG_HINWEIS}</Hinweis>
        {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
        <Feldzeile label="Titel"><input aria-label="Titel" style={eingabe} defaultValue={v.titel} onBlur={e => { if (e.target.value.trim() !== v.titel) void aendern({ titel: e.target.value }); }} /></Feldzeile>
        <Feldzeile label="Absender (Gesellschaft)">
          <Pillen liste={gesellschaften.map(g => ({ id: g, label: gesellschaftLabel(g) }))} aktiv={v.gesellschaft} onWahl={g => void aendern({ gesellschaft: g })} />
        </Feldzeile>
        <Feldzeile label="Vertragspartner: Firma">
          <Wahl label="Firma" wert={v.firmaId ?? null} liste={firmen} onWahl={id => void aendern({ firmaId: id })} onLeeren={() => void aendern({ firmaId: null })} />
        </Feldzeile>
        <Feldzeile label="Vertragspartner: Person">
          <Wahl label="Person" wert={v.kontaktId ?? null} liste={kontakte} onWahl={id => void aendern({ kontaktId: id })} onLeeren={() => void aendern({ kontaktId: null })}
            onNeu={async text => {
              const [vorname, ...rest] = text.split(' ');
              const a = await api.personAnlegen('schnell', { vorname, nachname: rest.join(' '), ...(v.firmaId ? { firmaId: v.firmaId } : {}) });
              if (!a.ok || !a.kontaktId) throw new Error(a.fehler ?? 'Nicht angelegt.');
              await aendern({ kontaktId: a.kontaktId });
              return a.kontaktId;
            }} />
        </Feldzeile>
      </Karte>
      <Karte>
        <Ueberschrift>Felder</Ueberschrift>
        {felder.map(f => (
          <Feldzeile key={f.schluessel} label={`${f.label}${f.pflicht ? ' *' : ''}`}>
            {f.typ === 'auswahl' && f.optionen ? (
              <Pillen liste={f.optionen.map(o => ({ id: o, label: o }))} aktiv={v.werte[f.schluessel] ?? null} onWahl={o => void aendern({ werte: { [f.schluessel]: o } })} />
            ) : (
              <input aria-label={f.label} style={eingabe} type={f.typ === 'datum' ? 'date' : 'text'} inputMode={f.typ === 'zahl' ? 'numeric' : undefined} defaultValue={v.werte[f.schluessel] ?? ''}
                onBlur={e => { if ((v.werte[f.schluessel] ?? '') !== e.target.value) void aendern({ werte: { [f.schluessel]: e.target.value || null } }); }} />
            )}
          </Feldzeile>
        ))}
      </Karte>
      <Karte>
        <Ueberschrift>Paragraphen</Ueberschrift>
        <Liste>
          {v.paragraphen.map(p => {
            const aktiv = paragraphAktiv(p, v.werte);
            const ab = paragraphAbweichend(p);
            return (
              <div key={p.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.linie}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ color: aktiv ? C.ink : C.inkLeise, fontSize: TYP.bedien }}>{[p.nr, p.titel].filter(Boolean).join(' ') || 'Paragraph'}</b>
                  {ab && <Chip farbe={LEUCHT.business}>weicht von der Vorlage ab</Chip>}
                  {p.bedingung && <Chip farbe={C.inkDim}>{`nur mit „${p.bedingung}“`}</Chip>}
                  <span style={{ flex: 1 }} />
                  {(p.optional || p.bedingung) && <Knopf leise onClick={() => void aendern({ paragraphen: [{ id: p.id, aus: !p.aus }] })}>{p.aus ? 'Aufnehmen' : 'Weglassen'}</Knopf>}
                  <Knopf leise onClick={() => setOffen(offen === p.id ? null : p.id)}>{offen === p.id ? 'Fertig' : 'Anpassen'}</Knopf>
                  {ab && p.original && <Knopf leise onClick={() => void aendern({ paragraphen: [{ id: p.id, titel: p.original!.titel, text: p.original!.text }] })}>Wie Vorlage</Knopf>}
                </div>
                {offen === p.id ? (
                  <textarea aria-label={`Text ${p.nr}`} style={{ ...eingabe, minHeight: 140, marginTop: 6 }} defaultValue={p.text} onBlur={e => { if (e.target.value !== p.text) void aendern({ paragraphen: [{ id: p.id, text: e.target.value }] }); }} />
                ) : aktiv && <div style={{ ...klein, whiteSpace: 'pre-wrap', marginTop: 4 }}>{p.text || 'Noch kein Text.'}</div>}
              </div>
            );
          })}
        </Liste>
      </Karte>
      <DarlehenVorschau v={v} />
      <Karte>
        <Ueberschrift>Fertigstellen</Ueberschrift>
        {fehlt.length > 0 && <Hinweis art="achtung" titel="Noch nicht fertig">{fehlt.join(' ')}</Hinweis>}
        <div style={klein}>Beim Fertigstellen bekommt der Vertrag seine Nummer, das PDF wird mit Prüfsumme festgeschrieben — danach nur noch als neue Version änderbar.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Knopf haupt aus={daten.nurEntwuerfe || fehlt.length > 0} onClick={() => fertigstellen()}>Fertigstellen</Knopf>
          <Knopf leise onClick={() => pdfLaden(v.id)}>PDF-Vorschau</Knopf>
          <Knopf leise onClick={async () => {
            if (!(await r.bestaetigen({ titel: 'Entwurf löschen?', text: 'Der Entwurf wird entfernt. Fertige Verträge bleiben immer erhalten.', ja: 'Löschen', gefahr: true }))) return;
            await nacheinander(async () => undefined);
            const a = await senden('/api/vertraege', { aktion: 'loeschen', id: v.id, stand: standRef.current });
            if (a.ok) { daten.entfernen(v.id); onListe(); } else setMeldung({ art: 'kritisch', text: a.d.fehler ?? 'Nicht gelöscht.' });
          }}>Entwurf löschen</Knopf>
        </div>
      </Karte>
    </>
  );
}

/** Ein fertiger Vertrag: PDF, Mail-Entwurf, Status, unterschriebenes PDF, neue Version. */
function Ansicht({ v, daten, onOeffnen, onListe }: { v: VertragMitStand; daten: ReturnType<typeof useVertraege>; onOeffnen: (id: string) => void; onListe: () => void }) {
  const [meldung, setMeldung] = useState<{ art: 'kritisch' | 'gut'; text: string } | null>(null);
  const status = async (s: VertragStatus) => {
    const a = await senden<{ vertrag: VertragMitStand }>('/api/vertraege', { aktion: 'status', id: v.id, stand: v.stand, status: s });
    if (a.ok) daten.uebernehmen(a.d.vertrag); else setMeldung({ art: 'kritisch', text: a.d.fehler ?? 'Nicht geändert.' });
  };
  const betreff = `${v.titel} ${v.nummer ?? ''}`.trim();
  const text = `${v.anrede === 'Du' ? 'Hallo' : 'Guten Tag'},\n\nanbei ${v.anrede === 'Du' ? 'dein' : 'Ihr'} Vertrag ${v.nummer ?? ''} zur Unterschrift.\n\nViele Grüße\n${v.absender?.firmierung ?? ''}`;
  return (
    <>
    <Karte>
      <Ueberschrift rechts={<Knopf leise onClick={onListe}>Alle Verträge</Knopf>}>{`${v.titel} · ${v.nummer ?? ''}`}</Ueberschrift>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip farbe={STATUS_FARBE[v.status]}>{statusLabel(v.status)}</Chip>
        <span style={klein}>{gesellschaftLabel(v.gesellschaft)} · {v.partner?.name ?? '—'}{v.version > 1 ? ` · Version ${v.version}` : ''}</span>
      </div>
      {v.ampelBeimFertig && v.ampelBeimFertig !== 'geprueft' && <Hinweis art="achtung">Beim Fertigstellen war die Vorlage {v.ampelBeimFertig === 'geaendert' ? 'seit der Prüfung geändert' : 'nicht anwaltlich geprüft'}{v.abweichendBeimFertig ? ` · ${v.abweichendBeimFertig} Paragraph(en) abweichend` : ''}. {VERTRAG_HINWEIS}</Hinweis>}
      {meldung && <Hinweis art={meldung.art} rolle="alert">{meldung.text}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Knopf leise onClick={() => pdfLaden(v.id)}>PDF</Knopf>
        {v.status === 'fertig' && <Knopf leise href={mailtoLink(undefined, betreff, text)}>Mail-Entwurf (eigenes Programm)</Knopf>}
        {(STATUS_WEITER[v.status] ?? []).map(s => <Knopf key={s} leise onClick={() => status(s)}>{s === 'versendet' ? 'Ist versendet' : s === 'aktiv' ? 'Aktiv setzen' : s === 'beendet' ? 'Beendet' : 'Gekündigt'}</Knopf>)}
        {!daten.nurEntwuerfe && <Knopf leise onClick={async () => {
          const a = await senden<{ vertrag: VertragMitStand }>('/api/vertraege', { aktion: 'version', id: v.id });
          if (a.ok) { daten.uebernehmen(a.d.vertrag); onOeffnen(a.d.vertrag.id); } else setMeldung({ art: 'kritisch', text: a.d.fehler ?? 'Keine neue Version.' });
        }}>Neue Version</Knopf>}
      </div>
      {(v.status === 'fertig' || v.status === 'versendet') && (
        <Feldzeile label="Unterschriebenes PDF hochladen">
          <input aria-label="Unterschriebenes PDF" type="file" accept="application/pdf,.pdf" style={eingabe} onChange={async e => {
            const f = e.target.files?.[0];
            if (!f) return;
            const a = await unterschriftHochladen(v, f);
            if (a.ok) { daten.uebernehmen(a.vertrag); setMeldung({ art: 'gut', text: `Unterschrieben — im Register vermerkt, Fristen stehen im Kalender.${a.hinweise.length ? ` ${a.hinweise.join(' ')}` : ''}` }); }
            else setMeldung({ art: 'kritisch', text: a.fehler });
          }} />
        </Feldzeile>
      )}
      {v.fassung && (
        <div style={{ marginTop: 12 }}>
          {v.fassung.map((p, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <b style={{ fontSize: TYP.bedien, color: C.ink }}>{[p.nr, p.titel].filter(Boolean).join(' ')}</b>
              <TextMitTabelle text={p.text} stil={klein} />
            </div>
          ))}
        </div>
      )}
      {v.angebotId && <div style={{ ...klein, marginTop: 8 }}><Knopf leise href={angebotLink({ angebotId: v.angebotId })}>Zum Angebot</Knopf></div>}
    </Karte>
    {!daten.nurEntwuerfe && <SendenKarte v={v} onVertrag={daten.uebernehmen} />}
    {!daten.nurEntwuerfe && <FinanzenKarte v={v} onVertrag={daten.uebernehmen} />}
    </>
  );
}
