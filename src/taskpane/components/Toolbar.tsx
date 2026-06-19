import * as React from "react";
import { Button, Radio, RadioGroup, makeStyles, tokens } from "@fluentui/react-components";
import {
  DocumentSearchRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ArrowSyncRegular,
  InfoRegular,
} from "@fluentui/react-icons";
import { Issue, LangMode, hasSuggestion } from "../core/types";
import { isReviewSupported } from "../core/trackChanges";
import { cg } from "../theme";

interface ToolbarProps {
  issues: Issue[];
  status: "idle" | "scanning" | "applying" | "ready";
  /** Gekozen controle-taalstand. */
  lang: LangMode;
  /** Taalstand gewijzigd sinds de laatste scan (toont een "scan opnieuw"-hint). */
  langStale: boolean;
  onScan: () => void;
  /** Wisselt de controle-taalstand (persistente voorkeur, zie de hook). */
  onLangChange: (mode: LangMode) => void;
  onApplyAll: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${cg.glass.stroke}`,
    backgroundColor: cg.glass.fill,
    backdropFilter: cg.glass.blur,
    WebkitBackdropFilter: cg.glass.blur,
  },
  scanButton: {
    width: "100%",
    borderRadius: cg.radiusSm,
    boxShadow: cg.accentGlow,
  },
  spin: {
    display: "inline-flex",
    animationName: {
      "0%": { transform: "rotate(0deg)" },
      "100%": { transform: "rotate(360deg)" },
    },
    animationDuration: "900ms",
    animationIterationCount: "infinite",
    animationTimingFunction: "linear",
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  langRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  langLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
  },
  staleHint: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    fontSize: tokens.fontSizeBase200,
    color: cg.spark,
  },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  applyButton: {
    flexShrink: 0,
  },
  summary: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    marginLeft: "auto",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  reviewButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
  },
});

/** Bovenste actiebalk: scan, taalkiezer, bulktoepassing en (indien beschikbaar) de review-knoppen. */
const Toolbar: React.FC<ToolbarProps> = ({
  issues,
  status,
  lang,
  langStale,
  onScan,
  onLangChange,
  onApplyAll,
  onAcceptAll,
  onRejectAll,
}) => {
  const styles = useStyles();
  const isScanning = status === "scanning";
  const isApplying = status === "applying";
  const isBusy = isScanning || isApplying;
  const reviewSupported = isReviewSupported();

  const hasIssues = issues.length > 0;
  const pendingCount = issues.filter((i) => i.status === "pending").length;
  const hasApplicable = issues.some((i) => i.status === "pending" && hasSuggestion(i));

  return (
    <div className={styles.root}>
      {/* Primaire actie: scannen */}
      <Button
        className={styles.scanButton}
        appearance="primary"
        size="medium"
        icon={
          isScanning ? (
            <span className={styles.spin}>
              <ArrowSyncRegular />
            </span>
          ) : (
            <DocumentSearchRegular />
          )
        }
        onClick={onScan}
        disabled={isBusy}
      >
        {isScanning ? "Document scannen…" : hasIssues ? "Opnieuw scannen" : "Scan document"}
      </Button>

      {/* Taalkiezer: bepaalt waartegen gespeld wordt. "Auto" = per-paragraaf detectie (soepel);
          "NL"/"EN" = forceer die taal, strikt (anderstalige woorden worden als spelfout geflagd). */}
      <div className={styles.langRow}>
        <span className={styles.langLabel}>Taal</span>
        <RadioGroup
          layout="horizontal"
          value={lang}
          disabled={isBusy}
          onChange={(_ev, data) => onLangChange(data.value as LangMode)}
        >
          <Radio value="auto" label="Auto" />
          <Radio value="nl" label="NL" />
          <Radio value="en" label="EN" />
        </RadioGroup>
      </div>

      {/* De wissel werkt pas door bij de volgende scan. */}
      {langStale && (
        <span className={styles.staleHint}>
          <InfoRegular fontSize={14} aria-hidden />
          Taal gewijzigd — scan opnieuw.
        </span>
      )}

      {/* Bulktoepassing + samenvatting (zodra er issues zijn) */}
      {hasIssues && (
        <div className={styles.actionRow}>
          <Button
            className={styles.applyButton}
            appearance="secondary"
            size="small"
            icon={<CheckmarkCircleRegular />}
            disabled={isBusy || !hasApplicable}
            onClick={onApplyAll}
          >
            Pas alles toe
          </Button>
          <span className={styles.summary}>
            <span>{pendingCount} open</span>
          </span>
        </div>
      )}

      {/* Documentbrede review (alleen bij WordApi 1.6) */}
      {reviewSupported && hasIssues && (
        <div className={styles.reviewButtons}>
          <Button
            size="small"
            appearance="subtle"
            icon={<CheckmarkCircleRegular />}
            onClick={onAcceptAll}
            disabled={isBusy}
          >
            Accepteer alle
          </Button>
          <Button
            size="small"
            appearance="subtle"
            icon={<DismissCircleRegular />}
            onClick={onRejectAll}
            disabled={isBusy}
          >
            Wijs alle af
          </Button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
