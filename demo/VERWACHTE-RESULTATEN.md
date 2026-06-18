# Demo-contract — verwachte ClauseGuard-resultaten

> Antwoordsleutel voor `demo-contract.docx`. Standalone geverifieerd tegen de echte
> `definedTerms.ts` (gecompileerd) en `nspell` + de echte NL/EN-woordenboeken.
> Paragraaf-indices zijn 0-based zoals `readParagraphs()` ze nummert.

## Spelling (severity: Spelling, blauw) — 6 stuks

| Par. | Fout | Verwachte suggestie | Engine |
|---|---|---|---|
| p3 | `overeenkmst` | overeenkomst | NL |
| p5 | `Verplichtignen` | verplichtingen | NL |
| p8 | `betalign` | betaling | NL |
| p10 | `agreemnt` | agreement | EN |
| p13 | `recieve` | receive | EN |
| p14 | `oblgations` | obligations | EN |

De taal wordt **per paragraaf** gedetecteerd (p0–p9 → NL-engine, p10–p14 → EN-engine).

## Defined-term inconsistenties (severity: Kritiek, rood) — 4 stuks

| Par. | Geflagde variant | Canonieke term | Definitie staat in |
|---|---|---|---|
| p5 | `dienstverlener` | **Dienstverlener** | p3 ("Dienstverlener betekent …") |
| p6 | `dienstverlener` | **Dienstverlener** | p3 |
| p7 | `vertrouwelijke informatie` | **Vertrouwelijke Informatie** | p4 ("Vertrouwelijke Informatie betekent …") |
| p13 | `confidential information` | **Confidential Information** | p10 ("Confidential Information means …") |

> Let op p5: de inconsistentie zit in een **kopje** ("Artikel 2 — Verplichtignen van de
> dienstverlener"). Dat dit gevonden wordt, is dankzij de per-paragraaf fix in
> `definedTerms.ts` — vóór de fix vervuilde het kopje de term-extractie.

## LLM legal-style (severity: Stijl, geel) — alleen met backend

Verschijnt **alleen** als `server/` draait én `OPENROUTER_API_KEY` in `server/.env` staat.
Zonder key degradeert de add-in netjes (geen stijl-issues). Verwachte signalen:

- **p11** — `shall`/`will` door elkaar in één zin; vage termen "reasonable", "promptly".
- **p12** — passieve obligatie "shall be delivered" (verbergt wie levert); vaag "as soon as possible".

Exacte LLM-output varieert per run (het is een taalmodel); bovenstaande zijn de doel-issues.

## Samengevat

- **Offline run (geen backend):** 6 spelling + 4 kritiek = **10 issues**, 0 false positives.
- **Met LLM-backend:** + enkele gele stijl-issues op p11/p12.
