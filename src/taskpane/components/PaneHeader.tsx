import * as React from "react";
import { Text, makeStyles, tokens } from "@fluentui/react-components";
import { ShieldRegular } from "@fluentui/react-icons";
import { cg } from "../theme";

/**
 * Gebrande kop van de task-pane: een glass-band die de coral-glow van de canvas doorlaat,
 * met het ClauseGuard-schild, het wordmerk en een tagline. De band ankert het paneel
 * bovenaan (sticky) en blijft leesbaar tijdens scrollen. Het schild draagt een coral
 * mark met warme spark — de signature-accent.
 */
const useStyles = makeStyles({
  band: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    backgroundColor: cg.glass.fill,
    backdropFilter: cg.glass.blur,
    WebkitBackdropFilter: cg.glass.blur,
    borderBottom: `1px solid ${cg.glass.stroke}`,
  },
  mark: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    flexShrink: 0,
    borderRadius: cg.radiusSm,
    backgroundImage: `linear-gradient(150deg, ${cg.accent} 0%, #FF7A47 100%)`,
    boxShadow: cg.accentGlow,
    color: "#FFF6F2",
  },
  spark: {
    position: "absolute",
    top: "-3px",
    right: "-3px",
    width: "9px",
    height: "9px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: cg.spark,
    boxShadow: `0 0 8px ${cg.spark}`,
    border: `2px solid ${cg.base}`,
  },
  wordmark: {
    color: cg.inkText,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
    letterSpacing: "-0.01em",
  },
});

const PaneHeader: React.FC = () => {
  const styles = useStyles();
  return (
    <header className={styles.band}>
      <div className={styles.mark} aria-hidden>
        <ShieldRegular fontSize={16} />
        <span className={styles.spark} />
      </div>
      <Text as="h1" className={styles.wordmark}>
        ClauseGuard
      </Text>
    </header>
  );
};

export default PaneHeader;
