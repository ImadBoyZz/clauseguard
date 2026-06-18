// ClauseGuard — Fluent v9 merk-theme.
// Eén bron van waarheid voor kleur: het Fluent-theme (createLightTheme op een eigen
// indigo-azuur merk-ramp) dekt acties/selectie/neutralen; de `cg`-constanten dekken de
// paar dingen die Fluent niet kent (donkere header-band, signature-geel, severity-palet,
// redline-diff). Schrijf in componenten geen losse hex: gebruik een Fluent-token of `cg`.
// Waarden zijn vastgelegd in DESIGN.md.

import { BrandVariants, createLightTheme, Theme } from "@fluentui/react-components";

/**
 * Merk-ramp (donker -> licht, 10..160). `createLightTheme` mapt 80 naar de primaire
 * knop (`colorBrandBackground`), 70/60 naar hover/pressed, 150/160 naar subtiele
 * merk-achtergronden. Diep, vertrouwd ink-blauw — een knipoog naar LegalFly's
 * hyperlink-blauw, getemperd zodat het op klein UI-werk premium blijft i.p.v. fel.
 */
const clauseGuardBrand: BrandVariants = {
  10: "#060A24",
  20: "#0C1238",
  30: "#121B52",
  40: "#18236B",
  50: "#1E2D86",
  60: "#2438A1",
  70: "#2B44BD",
  80: "#3450D6",
  90: "#4C66DE",
  100: "#667DE5",
  110: "#8194EB",
  120: "#9EAEF0",
  130: "#BBC6F4",
  140: "#D4DBF8",
  150: "#E7EBFB",
  160: "#F2F4FD",
};

/**
 * Het actieve task-pane-theme. We tinten het paneel-wit een fractie koel (de gedeelde
 * design-wet: nooit puur #fff); alle overige neutralen erven van Fluent's lichte theme.
 */
export const clauseGuardLightTheme: Theme = {
  ...createLightTheme(clauseGuardBrand),
  colorNeutralBackground1: "#FCFCFE",
};

/** Eén severity-tier visueel: voorgrond (dot/tekst), zachte chip-achtergrond, border. */
export interface SeverityVisual {
  fg: string;
  bg: string;
  border: string;
}

/**
 * Merk-constanten voor wat buiten Fluent's token-set valt. AA-gecontroleerd op wit
 * (severity-fg) resp. op `ink` (header-tekst).
 */
export const cg = {
  /** Donkere header-band. */
  ink: "#0B1030",
  /** Subtiel lichtere ink (hairline / verdieping op de band). */
  inkRaised: "#161C40",
  /** Off-white wordmerk op de band. */
  inkText: "#F4F6FB",
  /** Gedempte tagline/secundaire tekst op de band (indigo-getint). */
  inkMuted: "#AAB3D8",
  /** Hairline-border binnen de donkere band. */
  inkBorder: "#262D54",
  /** Signature-geel. Alleen de logo-spark en de "AI aan"-indicator. Nooit als vlak. */
  spark: "#EBF24B",
  /** Severity-palet: ernst = kleur + label + volgorde (kleurenblind-veilig). */
  sev: {
    critical: { fg: "#B42318", bg: "#FDF2F1", border: "#F3C9C4" },
    advisory: { fg: "#8A5A00", bg: "#FBF4E6", border: "#EDD9A6" },
    spelling: { fg: "#3D5570", bg: "#EEF2F7", border: "#D2DEE9" },
  } satisfies Record<"critical" | "advisory" | "spelling", SeverityVisual>,
  /** Redline-diff: weggehaald (doorgehaald) en voorgesteld (ingevoegd). */
  diff: {
    remove: "#B42318",
    add: "#1F7A4D",
    addBg: "#EFF7F2",
  },
} as const;
