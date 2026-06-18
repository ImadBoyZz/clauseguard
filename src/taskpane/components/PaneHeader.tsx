import * as React from "react";
import { Text, makeStyles, tokens } from "@fluentui/react-components";
import { ShieldRegular } from "@fluentui/react-icons";
import { cg } from "../theme";

/**
 * Gebrande kop van de task-pane: een donkere ink-band met het ClauseGuard-schild,
 * het wordmerk en een tagline. De band ankert het paneel en geeft contrast met het
 * witte Word-document. Het schild draagt de enige signature-spark (geel).
 */
const useStyles = makeStyles({
  band: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: cg.ink,
    borderBottom: `1px solid ${cg.inkBorder}`,
  },
  mark: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: cg.inkRaised,
    border: `1px solid ${cg.inkBorder}`,
    color: cg.inkText,
  },
  spark: {
    position: "absolute",
    top: "-3px",
    right: "-3px",
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: cg.spark,
    border: `2px solid ${cg.ink}`,
  },
  lockup: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  wordmark: {
    color: cg.inkText,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
    letterSpacing: "-0.01em",
  },
  tagline: {
    color: cg.inkMuted,
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase200,
    letterSpacing: "0.01em",
  },
});

const PaneHeader: React.FC = () => {
  const styles = useStyles();
  return (
    <header className={styles.band}>
      <div className={styles.mark} aria-hidden>
        <ShieldRegular fontSize={20} />
        <span className={styles.spark} />
      </div>
      <div className={styles.lockup}>
        <Text as="h1" className={styles.wordmark}>
          ClauseGuard
        </Text>
        <span className={styles.tagline}>Contractcontrole · NL / EN</span>
      </div>
    </header>
  );
};

export default PaneHeader;
