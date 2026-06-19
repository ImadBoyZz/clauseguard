# Demo-contract — verwachte ClauseGuard-resultaten

> Antwoordsleutel voor `demo-contract.docx`. Standalone geverifieerd tegen `nspell` + de echte
> NL/EN-woordenboeken. Paragraaf-indices zijn 0-based zoals `readParagraphs()` ze nummert.
>
> **Sinds de terugschaling naar twee check-lagen (spelling + LLM grammatica/stijl)** vangt de
> offline engine alleen nog de spelfouten. De defined-term- en clause-/kruisverwijzing-secties
> hieronder zijn **vervallen**: het document bevat die fouten nog wel, maar ze worden niet meer geflagd.

## Spelling (severity: Spelling, blauw) — 6 stuks

| Par. | Fout | Verwachte suggestie | Engine |
|---|---|---|---|
| p3 | `overeenkmst` | overeenkomst | NL |
| p5 | `Verplichtignen` | verplichtingen | NL |
| p8 | `betalign` | betaling | NL |
| p10 | `agreemnt` | agreement | EN |
| p13 | `recieve` | receive | EN |
| p14 | `oblgations` | obligations | EN |

De taal wordt **per paragraaf** gedetecteerd (p0–p9 + p15–p19 → NL-engine, p10–p14 → EN-engine).

## ~~Defined-term inconsistenties~~ — VERVALLEN sinds de terugschaling

> De offline term-engine (`definedTerms.ts`) is verwijderd. De onderstaande 4 varianten zitten nog
> in het document maar worden niet meer geflagd. Bewaard als historische referentie.

| Par. | Geflagde variant | Canonieke term | Definitie staat in |
|---|---|---|---|
| ~~p5~~ | ~~`dienstverlener`~~ | ~~**Dienstverlener**~~ | ~~p3 ("Dienstverlener betekent …")~~ |
| ~~p6~~ | ~~`dienstverlener`~~ | ~~**Dienstverlener**~~ | ~~p3~~ |
| ~~p7~~ | ~~`vertrouwelijke informatie`~~ | ~~**Vertrouwelijke Informatie**~~ | ~~p4 ("Vertrouwelijke Informatie betekent …")~~ |
| ~~p13~~ | ~~`confidential information`~~ | ~~**Confidential Information**~~ | ~~p10 ("Confidential Information means …")~~ |

## ~~Clause-integriteit & term-dekking~~ — VERVALLEN sinds de terugschaling

> De offline structuur-/term-dekking-engines (`clauseChecks.ts` + de undefined/unused-term-checks)
> zijn verwijderd. Deze 3 flag-only catches in p15–p19 worden niet meer geproduceerd. Bewaard als
> historische referentie.

| Par. | Geflagd | Soort | Waarom (historisch) |
|---|---|---|---|
| ~~p16~~ | ~~`Artikel 7`~~ | ~~Gebroken kruisverwijzing~~ | ~~Het document nummert artikelen (1, 2, 4) maar Artikel 7 bestaat niet.~~ |
| ~~p18~~ | ~~`Onderliggende Overeenkomst`~~ | ~~Ongedefinieerde term~~ | ~~Title-Case-frase die ≥2× mét lidwoord gebruikt wordt maar nergens gedefinieerd is.~~ |
| ~~p17~~ | ~~`Overmacht`~~ | ~~Dode definitie~~ | ~~Formeel gedefinieerd maar nergens anders in het document gebruikt.~~ |

## LLM grammatica/stijl (severity: Advies, geel) — alleen met backend

Verschijnt **alleen** als `server/` draait én `OPENROUTER_API_KEY` in `server/.env` staat.
Zonder key degradeert de add-in netjes (geen stijl-issues). Verwachte signalen:

- **p11** — `shall`/`will` door elkaar in één zin; vage termen "reasonable", "promptly".
- **p12** — passieve obligatie "shall be delivered" (verbergt wie levert); vaag "as soon as possible".

Exacte LLM-output varieert per run (het is een taalmodel); bovenstaande zijn de doel-issues.

## Samengevat

- **Offline run (geen backend):** 6 spelling = **6 issues**, 0 false positives. (De vroegere term- en
  clause-/kruisverwijzing-catches zijn vervallen sinds de terugschaling naar twee check-lagen.)
- **Met LLM-backend:** + enkele gele grammatica/stijl-issues op p11/p12.
