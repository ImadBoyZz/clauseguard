import * as React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { LockClosedRegular } from "@fluentui/react-icons";
import { cg } from "../theme";

/**
 * Slanke privacy-strip onder de header. Maakt expliciet dat alle verwerking volledig lokaal
 * en offline gebeurt — een vertrouwenssignaal dat past bij LegalFly's privacy-first
 * positionering, rustig gehouden zodat het de scan-actie niet overschreeuwt.
 */
const useStyles = makeStyles({
  strip: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    backgroundColor: cg.glass.fillInset,
    borderBottom: `1px solid ${cg.glass.stroke}`,
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
        <span className={styles.strong}>Volledig lokaal verwerkt.</span> Niets verlaat je document.
      </span>
    </div>
  );
};

export default PrivacyNote;
