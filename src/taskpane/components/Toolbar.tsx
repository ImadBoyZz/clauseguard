import * as React from "react";
import { Button, makeStyles, tokens } from "@fluentui/react-components";
import {
  DocumentSearchRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ArrowSyncRegular,
} from "@fluentui/react-icons";
import { Issue, hasSuggestion } from "../core/types";
import { isReviewSupported } from "../core/trackChanges";
import { cg } from "../theme";

interface ToolbarProps {
  issues: Issue[];
  status: "idle" | "scanning" | "applying" | "ready";
  onScan: () => void;
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

/** Bovenste actiebalk: scan, bulktoepassing en (indien beschikbaar) de review-knoppen. */
const Toolbar: React.FC<ToolbarProps> = ({
  issues,
  status,
  onScan,
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
