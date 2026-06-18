# ClauseGuard LLM Backend

Een lichtgewicht Express-server die als proxy fungeert tussen de Word-taskpane en OpenRouter. Hij ontvangt documentparagrafen (een contract óf algemene tekst), stuurt ze in één batch naar een LLM, en geeft gestructureerde issues terug: **grammatica, stijl, interne tegenstrijdigheden** en **mogelijke feitfouten** (zachte vlag — alleen markeren, geen autocorrectie).

## Wat doet het

- **POST `/api/legal-style`** — ontvangt paragrafen, roept het LLM aan, valideert de JSON-response en geeft een genormaliseerde lijst van `Issue`-objecten terug (categorieën `grammar` · `style` · `consistency` · `factual`; `factual` komt zonder suggestie).
- **GET `/api/health`** — heartbeat; geeft `{ ok: true, model: "<naam>", hasKey: <bool> }` terug. `hasKey` laat de add-in onderscheiden tussen *"draait én geconfigureerd"* en *"draait maar zonder key"* (waarbij elke scan structureel leeg blijft).
- **Offline mode** — als `OPENROUTER_API_KEY` niet ingesteld is of `useLlm: false` meegegeven wordt, antwoordt de server direct met `{ issues: [] }`. De add-in degradeert daardoor gracefully naar offline-only modus zonder te crashen.

## Opstarten

```bash
# 1. Kopieer het voorbeeld-env-bestand en vul je key in
cp .env.example .env

# 2. Open .env en zet OPENROUTER_API_KEY= op je eigen OpenRouter-sleutel
#    (maak een account aan op https://openrouter.ai en genereer een API key)

# 3. Installeer afhankelijkheden
npm install

# 4. Start de server
npm start          # productie
npm run dev        # development (herstart automatisch bij wijzigingen, vereist Node 18+)
```

De server luistert standaard op `http://localhost:3001`.

## Verbinding met de Word-taskpane

De taskpane-webpack-devserver proxyt `/api` naar `:3001`, zodat de browser-fetch naar `/api/legal-style` via dezelfde origin gaat en er geen mixed-content- of CORS-problemen zijn.

Voeg het volgende toe aan `webpack.config.js` in de `devServer`-sectie:

```js
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
  },
},
```

In productie zet je de backend achter een reverse proxy (nginx, Caddy, Vercel Functions, etc.) op hetzelfde domein als de gehostede taskpane, of je gebruikt een eigen CORS-origin.

## Van model of provider wisselen

Stel `OPENROUTER_MODEL` in `.env` in op een willekeurig model dat via OpenRouter beschikbaar is:

| Provider | Model-ID |
|---|---|
| Anthropic | `anthropic/claude-haiku-4.5` (**standaard**, sterke NL/EN-proeflezer) |
| Google | `google/gemini-2.5-flash` (goedkoper/sneller alternatief) |
| Google | `google/gemini-2.5-flash-lite` (goedkoopst, zwakste recall) |
| DeepSeek | `deepseek/deepseek-chat` |

Elk model dat `response_format: { type: "json_object" }` ondersteunt werkt zonder code-aanpassingen. Voor modellen die dat niet ondersteunen valt de parser terug op markdown-fence-stripping. De prompt forceert sowieso pure JSON, en `reasoning: { enabled: false }` (OpenRouter's unified veld) houdt de JSON uit eventuele reasoning-tokens. Bij een upstream-fout (bv. een onbekende model-slug) degradeert de server naar `{ issues: [], error }`; de add-in logt die `error` in de console zodat een stille leegte herleidbaar is.
