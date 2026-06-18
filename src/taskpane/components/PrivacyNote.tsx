import * as React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { LockClosedRegular } from "@fluentui/react-icons";

/**
 * Slanke privacy-strip onder de header. Maakt expliciet dat verwerking lokaal gebeurt
 * en de LLM-laag opt-in is — een vertrouwenssignaal dat past bij LegalFly's privacy-first
 * positionering, rustig gehouden zodat het de scan-actie niet overschreeuwt.
 */
const useStyles = makeStyles({
  strip: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground3,
  },
  icon: {
    flexShrink: 0,
    fontSize: "14px",
    color: tokens.colorNeutralForeground3,
  },
  text: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  strong: {
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightMedium,
  },
});

const PrivacyNote: React.FC = () => {
  const styles = useStyles();
  return (
    <div className={styles.strip}>
      <LockClosedRegular className={styles.icon} aria-hidden />
      <span className={styles.text}>
        <span className={styles.strong}>Lokaal verwerkt.</span> AI-controle stuurt fragmenten naar
        de AI-proeflezer, alleen als je die aanzet.
      </span>
    </div>
  );
};

export default PrivacyNote;
