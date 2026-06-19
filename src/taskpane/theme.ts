// ClauseGuard — Fluent v9 merk-theme (dark glass).
// Eén bron van waarheid voor kleur: het Fluent-theme (createDarkTheme op een eigen
// coral-ramp) dekt acties/selectie/neutralen; de `cg`-constanten dekken de dingen die
// Fluent niet kent (glass-surfaces, de warme canvas-glow, het severity-palet op donker,
// de redline-diff). Schrijf in componenten geen losse hex: gebruik een Fluent-token of `cg`.
// Waarden zijn vastgelegd in DESIGN.md.

import { BrandVariants, createDarkTheme, Theme } from "@fluentui/react-components";

/**
 * Merk-ramp (donker -> licht, 10..160), een warme coral. `createDarkTheme` mapt ~100 naar
 * de primaire knop (`colorBrandBackground`), met 110/90 als hover/pressed en de lichte
 * stops als merk-voorgrond op donker. De coral is de signature-accent (acties, selectie,
 * de spark) — geleend van de dashboard-referentie, getemperd zodat tekst leesbaar blijft.
 */
const clauseGuardBrand: BrandVariants = {
  10: "#260A02",
  20: "#3A0F04",
  30: "#501405",
  40: "#661907",
  50: "#7E1F08",
  60: "#97260A",
  70: "#B6300E",
  80: "#D43C14",
  90: "#EE4A1C",
  100: "#FF5C2D",
  110: "#FF744B",
  120: "#FF8E6C",
  130: "#FFA88D",
  140: "#FFC3AE",
  150: "#FFDDD0",
  160: "#FFF1EB",
};

/**
 * Het actieve task-pane-theme. Donker, gebouwd op de coral-ramp. We tinten de
 * basis-neutralen een fractie warm (de gedeelde design-wet: nooit puur #000) zodat de
 * glass-surfaces en de coral-glow op een warme near-black liggen i.p.v. op Fluent-grijs.
 */
export const clauseGuardDarkTheme: Theme = {
  ...createDarkTheme(clauseGuardBrand),
  colorNeutralBackground1: "#0C0B0E",
  colorNeutralBackground2: "#131217",
  colorNeutralBackground3: "#1A1820",
};

/** Behoud van de oude export-naam zodat bestaande imports niet breken. */
export const clauseGuardLightTheme = clauseGuardDarkTheme;

/** Eén severity-tier visueel: voorgrond (dot/tekst), zachte chip-achtergrond, border. */
export interface SeverityVisual {
  fg: string;
  bg: string;
  border: string;
}

/**
 * Merk-constanten voor wat buiten Fluent's token-set valt. De glass-waarden zijn
 * translucent (rgba) zodat ze de canvas-glow doorlaten; severity-fg is helder genoeg om
 * AA te halen op de donkere glass-fill.
 */
export const cg = {
  /** Warme near-black canvas-basis (root-gradient in App). */
  base: "#0A090C",
  /** Diepere variant onderaan de canvas-gradient. */
  baseDeep: "#060507",
  /** Coral-glow tinten voor de ambient achtergrond (radiale gloed bovenin). */
  glowCoral: "rgba(255, 92, 45, 0.20)",
  glowCoralSoft: "rgba(255, 122, 71, 0.10)",

  /** Glass-surfaces: translucent wit over de donkere canvas, met blur. */
  glass: {
    /** Kaart-/paneelvulling. */
    fill: "rgba(255, 255, 255, 0.045)",
    /** Hover / lichte verdieping. */
    fillRaised: "rgba(255, 255, 255, 0.075)",
    /** Inset-blokken (diff, skeleton). */
    fillInset: "rgba(255, 255, 255, 0.03)",
    /** Hairline-border op glass. */
    stroke: "rgba(255, 255, 255, 0.09)",
    /** Sterkere border (hover / nadruk). */
    strokeStrong: "rgba(255, 255, 255, 0.18)",
    /** Backdrop-blur voor grote chrome (header, toolbar). */
    blur: "blur(22px) saturate(160%)",
    /** Lichtere blur voor kaarten (minder GPU-druk bij veel kaarten). */
    blurSoft: "blur(14px) saturate(140%)",
    /** Zachte slagschaduw onder glass-panelen. */
    shadow: "0 10px 30px -12px rgba(0, 0, 0, 0.7)",
  },

  /** Off-white wordmerk/tekst op donkere surfaces. */
  inkText: "#F6F4F2",
  /** Gedempte tagline/secundaire tekst op donker. */
  inkMuted: "rgba(246, 244, 242, 0.60)",

  /** Coral signature-accent (acties, selectie, logo-mark). */
  accent: "#FF5C2D",
  /** Zachte coral-tint (achtergrond van actieve/accent-vlakken). */
  accentSoft: "rgba(255, 92, 45, 0.16)",
  /** Coral-glow rond de primaire actie. */
  accentGlow: "0 8px 26px -8px rgba(255, 92, 45, 0.65)",
  /** Warme spark op het schild (vervangt het oude geel). */
  spark: "#FF8A5C",

  /** Ronde, moderne radii (los van Fluent's kleine token-schaal). */
  radius: "14px",
  radiusSm: "10px",

  /** Severity-palet op glass: ernst = kleur + label + volgorde (kleurenblind-veilig). */
  sev: {
    advisory: { fg: "#F2C14E", bg: "rgba(242, 193, 78, 0.13)", border: "rgba(242, 193, 78, 0.30)" },
    spelling: { fg: "#8FB3DE", bg: "rgba(143, 179, 222, 0.13)", border: "rgba(143, 179, 222, 0.28)" },
  } satisfies Record<"advisory" | "spelling", SeverityVisual>,

  /** Redline-diff op donker: weggehaald (doorgehaald) en voorgesteld (ingevoegd). */
  diff: {
    remove: "#FF8A80",
    add: "#5FE3A1",
    addBg: "rgba(95, 227, 161, 0.11)",
  },

  /**
   * Redline-rood voor het VERBETERDE woord in het Word-document zelf (op wit papier).
   * Bewust een verzadigd, donker genoeg rood — niet de pastel `diff.remove`, die op de
   * donkere UI is afgestemd. Wordt als font.color op de ingevoegde correctie gezet, zodat
   * een gecorrigeerd woord altijd rood opvalt — ook in 'Eenvoudige markeringen' en nadat
   * de tracked change geaccepteerd is.
   */
  docRedline: "#D13438",
} as const;
