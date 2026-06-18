// Ambient module declarations voor Hunspell-woordenboekbestanden.
// Webpack laadt deze via de "asset/source" rule (type: "asset/source")
// zodat ze als raw strings beschikbaar zijn — zonder Node's fs-loader.

declare module "*.aff" {
  const s: string;
  export default s;
}

declare module "*.dic" {
  const s: string;
  export default s;
}

// Webpack-alias modules voor de vier Hunspell-bestanden (zie webpack.config.js).
// dictionary-en v4 en dictionary-nl v2 sluiten subpad-imports uit via hun `exports`
// field; de aliassen omzeilen dat door te wijzen naar de absolute bestandspaden.
declare module "dict-en-aff" {
  const s: string;
  export default s;
}
declare module "dict-en-dic" {
  const s: string;
  export default s;
}
declare module "dict-nl-aff" {
  const s: string;
  export default s;
}
declare module "dict-nl-dic" {
  const s: string;
  export default s;
}
