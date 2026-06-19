# Showcase-testdocument — verwachte ClauseGuard-resultaten

> Antwoordsleutel voor `demo-showcase.docx`. Dit document raakt beide ClauseGuard-lagen.
> De offline-catches zijn standalone geverifieerd tegen `nspell` + de echte NL/EN-woordenboeken —
> **5 spelling-catches, 0 false positives**. Paragraaf-indices zijn 0-based zoals `readParagraphs()` ze nummert.
>
> **Sinds de terugschaling naar twee check-lagen (spelling + LLM grammatica/stijl)** vangt de offline
> engine alleen nog de spelfouten. De defined-term- en kruisverwijzing-secties hieronder zijn **vervallen**:
> het document bevat die fouten nog, maar ze worden niet meer geflagd.

## A. Offline (altijd — geen backend nodig)

### Spelling (severity: Spelling, blauw) — 5 stuks

| Par. | Fout | Verwachte suggestie | Engine |
|---|---|---|---|
| p3 | `overeenkmst` | overeenkomst | NL |
| p11 | `betalign` | betaling | NL |
| p13 | `agreemnt` | agreement | EN |
| p14 | `recieve` | receive | EN |
| p16 | `oblgations` | obligations | EN |

> Taal wordt **per paragraaf** gedetecteerd (NL-deel p0–p11, EN-deel p12–p17). Het EN-woordenboek is
> **en-US**: een Britse spelling (bijv. *favour*, *colour*) zou óók als fout gelden — vandaar `favor` in p16.

### ~~Gedefinieerde-term inconsistenties~~ — VERVALLEN sinds de terugschaling

> De offline term-engine (`definedTerms.ts`) is verwijderd. De onderstaande 3 varianten zitten nog in
> het document maar worden niet meer geflagd. Bewaard als historische referentie.

| Par. | Geflagde variant | Canonieke term | Definitie in |
|---|---|---|---|
| ~~p6~~ | ~~`leverancier`~~ | ~~**Leverancier**~~ | ~~p3 ("Leverancier betekent …")~~ |
| ~~p7~~ | ~~`leverancier`~~ | ~~**Leverancier**~~ | ~~p3~~ |
| ~~p16~~ | ~~`confidential data`~~ | ~~**Confidential Data**~~ | ~~p13 ("Confidential Data means …")~~ |

### ~~Clause-integriteit & term-dekking~~ — VERVALLEN sinds de terugschaling

> De offline structuur-/term-dekking-engines (`clauseChecks.ts` + undefined/unused-term-checks) zijn
> verwijderd. Deze 3 flag-only catches worden niet meer geproduceerd. Bewaard als historische referentie.

| Par. | Geflagd | Soort | Waarom (historisch) |
|---|---|---|---|
| ~~p8~~ | ~~`Artikel 9`~~ | ~~Gebroken kruisverwijzing~~ | ~~Document nummert Artikel 1, 2 en 3 — Artikel 9 bestaat niet.~~ |
| ~~p15~~ | ~~`Master Services Agreement`~~ | ~~Ongedefinieerde term~~ | ~~Title-Case-frase, ≥2× met lidwoord gebruikt maar nergens gedefinieerd.~~ |
| ~~p5~~ | ~~`Overmacht`~~ | ~~Dode definitie~~ | ~~Formeel gedefinieerd maar nergens anders gebruikt.~~ |

**Offline-totaal: 5 catches, 0 false positives** (term- en clause-catches vervallen).

## B. AI-proeflezer (severity: Advies, geel) — alleen met backend + `OPENROUTER_API_KEY`

Verschijnt **alleen** als `server/` draait (`npm run dev:all`) én een key is gezet. Doel-signalen
(exacte LLM-output varieert per run):

| Par. | Soort | Doel-signaal |
|---|---|---|
| p7 | Grammatica (d/t) | `word geacht` → **`wordt geacht`** (real-word fout: `word` is geldig NL, dus nspell mist het — de LLM-laag vangt het). |
| p7 | Stijl | Vage maatstaven: *"naar redelijkheid"*, *"binnen een redelijke termijn"*. |
| p14 | Stijl | `will` en `shall` door elkaar in één zin (intentie vs. afdwingbare plicht). |
| p16 | Stijl | Passieve verplichting *"shall be resolved"* (verbergt wie handelt). |

> De backend is afgeschaald tot **grammatica + stijl**. De vroegere consistentie- (betaaltermijn dertig
> vs. zestig dagen, p10↔p11) en feitelijke (driehonderdvijftig dagen, p17) doel-signalen zijn **vervallen**.

## Samengevat

- **Offline run (geen backend):** 5 spelling = **5 issues**, 0 false positives. (De vroegere term- en
  clause-/kruisverwijzing-catches zijn vervallen sinds de terugschaling naar twee check-lagen.)
- **Met LLM-backend (+ key):** + grammatica (d/t), stijl (shall/will, vaagheid, passief).
- **Lagen geraakt:** spelling · AI-proeflezer (grammatica/stijl). Eén document, beide controles.
