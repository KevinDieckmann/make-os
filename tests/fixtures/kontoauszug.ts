// ─── Erfundene Kontoauszüge für Tests (09.10.) ─────────────────────────────────────────────────────────────────────────────────────────
// Keine echten Daten: Namen wie „Beispiel GmbH“, „Anna Beispiel“, Beträge erfunden. IBANs werden zur Laufzeit mit gültiger Prüfziffer gebaut
// (tests/repo-sauber.test.ts meldet sonst jede gültige IBAN im Repo).

/** Deutsche IBAN aus BLZ + Kontonummer mit gültiger Prüfziffer (ISO 13616). */
export function testIban(blz: string, konto: string): string {
  const bban = blz + konto.padStart(10, '0');
  let rest = 0;
  for (const z of `${bban}131400`) rest = (rest * 10 + Number(z)) % 97;
  return `DE${String(98 - rest).padStart(2, '0')}${bban}`;
}

export interface CamtPosten { betrag: string; dbit?: boolean; datum: string; status?: string; name?: string; iban?: string; zweck?: string[]; ref?: string; ccy?: string; neu?: boolean }

/** CAMT.053 bauen — `fassung` 02 (Status als Text, Name unter Nm) oder 08 (Status unter Cd, Name unter Pty/Nm). */
export function camt(o: { iban: string; fassung?: '02' | '08'; ccy?: string; anfang?: { betrag: string; datum: string; dbit?: boolean }; ende?: { betrag: string; datum: string; dbit?: boolean }; posten: CamtPosten[]; stmts?: number }): string {
  const v = o.fassung ?? '02';
  const ccy = o.ccy ?? 'EUR';
  const bal = (cd: string, b: { betrag: string; datum: string; dbit?: boolean }) =>
    `<Bal><Tp><CdOrPrtry><Cd>${cd}</Cd></CdOrPrtry></Tp><Amt Ccy="${ccy}">${b.betrag}</Amt><CdtDbtInd>${b.dbit ? 'DBIT' : 'CRDT'}</CdtDbtInd><Dt><Dt>${b.datum}</Dt></Dt></Bal>`;
  const name = (n: string) => (v === '08' ? `<Pty><Nm>${n}</Nm></Pty>` : `<Nm>${n}</Nm>`);
  const ntry = (p: CamtPosten) => {
    const status = v === '08' ? `<Sts><Cd>${p.status ?? 'BOOK'}</Cd></Sts>` : `<Sts>${p.status ?? 'BOOK'}</Sts>`;
    const partei = p.name ? (p.dbit ? `<Cdtr>${name(p.name)}</Cdtr>${p.iban ? `<CdtrAcct><Id><IBAN>${p.iban}</IBAN></Id></CdtrAcct>` : ''}` : `<Dbtr>${name(p.name)}</Dbtr>${p.iban ? `<DbtrAcct><Id><IBAN>${p.iban}</IBAN></Id></DbtrAcct>` : ''}`) : '';
    return `<Ntry>${p.ref ? `<NtryRef>${p.ref}</NtryRef>` : ''}<Amt Ccy="${p.ccy ?? ccy}">${p.betrag}</Amt><CdtDbtInd>${p.dbit ? 'DBIT' : 'CRDT'}</CdtDbtInd>${status}`
      + `<BookgDt><Dt>${p.datum}</Dt></BookgDt><ValDt><Dt>${p.datum}</Dt></ValDt>${p.ref ? `<AcctSvcrRef>${p.ref}</AcctSvcrRef>` : ''}`
      + `<NtryDtls><TxDtls><RltdPties>${partei}</RltdPties>${p.zweck ? `<RmtInf>${p.zweck.map(z => `<Ustrd>${z}</Ustrd>`).join('')}</RmtInf>` : ''}</TxDtls></NtryDtls></Ntry>`;
  };
  const stmt = `<Stmt><Id>STMT-1</Id><Acct><Id><IBAN>${o.iban}</IBAN></Id><Ccy>${ccy}</Ccy></Acct>${o.anfang ? bal('PRCD', o.anfang) : ''}${o.ende ? bal('CLBD', o.ende) : ''}${o.posten.map(ntry).join('')}</Stmt>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.${v}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><BkToCstmrStmt><GrpHdr><MsgId>TEST</MsgId></GrpHdr>${stmt}</BkToCstmrStmt></Document>`;
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
/** Text als Windows-1252 (für Umlaute und „€“ in Excel-CSV). */
export function cp1252(s: string): Uint8Array {
  const oben = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
  return new Uint8Array(Array.from(s).map(c => { const i = oben.indexOf(c); return i >= 0 ? 0x80 + i : c.charCodeAt(0) & 0xff; }));
}
