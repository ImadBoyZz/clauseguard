# Verwachte resultaten — demo-essay

Antwoordsleutel voor `demo-essay.docx` (gegenereerd uit `demo-essay.paragraphs.json`).
Een Nederlands schoolopstel vol opzettelijke fouten, bedoeld als **regressietest voor
de AI-proeflezer**. Vier paragrafen, indices `0..3`.

> **Sinds de terugschaling naar twee check-lagen (spelling + LLM grammatica/stijl)** levert de
> AI-proeflezer alleen nog `grammar` en `style`. De `consistency`- en `factual`-secties hieronder zijn
> **vervallen**: het opstel bevat die fouten nog, maar ze worden niet meer geproduceerd.

De actieve catches zijn gespreid over drie categorieën:

| Categorie | Engine | Autocorrectie? |
|---|---|---|
| `spelling` | offline nspell (NL+EN dictionary) | ja (suggestie) |
| `grammar` | LLM | ja (suggestie) |
| `style` | LLM (incl. zinsbouw + woordkeuze) | nee (markeren) |

---

## spelling — offline nspell (NL+EN), 3 catches

Niet-woorden die de dictionary vangt. Suggestie waar betrouwbaar mogelijk.

| Par. | Fragment | Suggestie |
|---|---|---|
| 0 | `Tegenwoordigh` | Tegenwoordig |
| 0 | `smarphone` | smartphone |
| 1 | `poolijsberen` | *(geen betrouwbare suggestie — samenstelling)* |

> `toetsten` staat bewust **niet** hier: het is een geldige NL-vervoeging (verleden tijd van
> `toetsen`), dus nspell vangt het niet. Het is een **real-word-fout** → zie grammar.

---

## grammar — LLM (congruentie, d/t, woordvolgorde, real-word), 7 catches

| Par. | Fragment | Suggestie | Uitleg |
|---|---|---|---|
| 0 | `technologie hebben` | technologie **heeft** | Onderwerp-werkwoord-congruentie: `technologie` is enkelvoud. |
| 0 | `bijna alle` | bijna **alles** | Verkeerde/onvolledige vorm; bedoeld is `alles`. |
| 1 | `klimaat veranderd` | klimaat **verandert** | d/t-fout: tegenwoordige tijd, 3e p. enkelvoud → stam + t. |
| 1 | `zoals Nederland ... probeert` | **proberen** | Congruentie: onderwerp is `Sommige landen` (meervoud). |
| 1 | `meer zwemmen kunnen` | meer **kunnen zwemmen** | Woordvolgorde: hulpwerkwoord vóór hoofdwerkwoord. |
| 2 | `presteren op toetsten` | presteren op **toetsen** | Real-word-fout: `toetsten` (werkwoord) i.p.v. zelfstandig naamwoord `toetsen` — nspell mist dit, de LLM niet. |
| 3 | `We moet` | We **moeten** | Onderwerp-werkwoord-congruentie: `We` is meervoud. |

---

## style — LLM (vaag/omslachtig/dubbelop/onhelder), 5 catches

| Par. | Fragment | Uitleg |
|---|---|---|
| 0 | `en planten eveneens ook` | Dubbelop: `eveneens` en `ook` betekenen hetzelfde — kies er één. |
| 1 | `wat experts "een beetje warm" noemen` | Vaag understatement dat geen concrete bewering doet. |
| 2 | `maar ook niet echt want sommige mensen vinden het wel oké eigenlijk` | Zwabberende formulering zonder standpunt (`niet echt`, `wel oké`, `eigenlijk`). |
| 2 | `het exact tegenovergestelde hebben bewezen tegelijkertijd` | Overbodig en onhelder: `tegelijkertijd` voegt niets toe. |
| 3 | `afhankelijk van hoe je er naar kijkt of niet` | Loze toevoeging `of niet` maakt de bewering betekenisloos. |

---

## ~~consistency~~ — VERVALLEN sinds de terugschaling

> De AI-proeflezer levert geen `consistency`-categorie meer. Deze 4 catches worden niet meer
> geproduceerd. Bewaard als historische referentie.

| Par. | Fragment | Uitleg (historisch) |
|---|---|---|
| ~~1~~ | ~~`uitstoot van zuurstof door auto's en fabrieken`~~ | ~~Onlogisch: verbranding stoot CO2 uit, niet zuurstof.~~ |
| ~~1~~ | ~~`De poolijsberen zijn hier heel blij mee, omdat ze nu meer zwemmen kunnen`~~ | ~~Onlogische gevolgtrekking t.o.v. de opwarming/schade in dezelfde paragraaf.~~ |
| ~~3~~ | ~~`zowel goed als slecht is, afhankelijk van hoe je er naar kijkt of niet`~~ | ~~Loze tegenstelling: bevestigt en ontkent tegelijk.~~ |
| ~~3~~ | ~~`Als iedereen dit doet of niet doet, wordt de wereld mogelijks beter of slechter`~~ | ~~Betekenisloos: dekt elke uitkomst af en stelt dus niets.~~ |

---

## ~~factual~~ — VERVALLEN sinds de terugschaling

> De AI-proeflezer levert geen `factual`-categorie (zachte feit-vlag) meer. Deze 8 catches worden niet
> meer geproduceerd. Bewaard als historische referentie.

| Par. | Fragment | Uitleg (historisch) |
|---|---|---|
| ~~0~~ | ~~`In 2005 is de iPhone uitgevonden`~~ | ~~De eerste iPhone verscheen in 2007, niet 2005.~~ |
| ~~0~~ | ~~`uitgevonden door Bill Gates`~~ | ~~De iPhone komt van Apple (Steve Jobs c.s.), niet Bill Gates.~~ |
| ~~0~~ | ~~`die ook de oprichter was van Apple`~~ | ~~Bill Gates is geen oprichter van Apple (Jobs/Wozniak).~~ |
| ~~0~~ | ~~`Microsoft heeft gestart in zijn kelder in Parijs`~~ | ~~Microsoft werd opgericht in Albuquerque (VS), niet een kelder in Parijs.~~ |
| ~~1~~ | ~~`Nederland dat in Zuid-Amerika ligt`~~ | ~~Nederland ligt in Europa, niet Zuid-Amerika.~~ |
| ~~1~~ | ~~`gestegen met wel 47 graden de afgelopen tien jaar`~~ | ~~De opwarming is ~1,1 °C sinds pre-industrieel, geen 47 graden in tien jaar.~~ |
| ~~2~~ | ~~`Albert Einstein, die in de 14de eeuw leefde`~~ | ~~Einstein leefde 1879–1955, niet in de 14de eeuw.~~ |
| ~~2~~ | ~~`"Educatie is de sleutel tot niets."`~~ | ~~Verzonnen/onjuist toegeschreven citaat — niet van Einstein.~~ |

---

## Totaal verwachte catches

| Categorie | Aantal |
|---|---|
| spelling | 3 |
| grammar | 7 |
| style | 5 |
| **Totaal** | **15** |

> ~~consistency (4)~~ en ~~factual (8)~~ zijn vervallen sinds de terugschaling naar twee check-lagen;
> het oude totaal was 27.
