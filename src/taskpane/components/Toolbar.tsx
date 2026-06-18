import * as React from "react";
import { Button, Switch, Divider, makeStyles, tokens } from "@fluentui/react-components";
import {
  DocumentSearchRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ArrowSyncRegular,
  SparkleFilled,
  WarningRegular,
} from "@fluentui/react-icons";
import { Issue, hasSuggestion, AiStatus } from "../core/types";
import { isReviewSupported } from "../core/trackChanges";
import { cg } from "../theme";

interface ToolbarProps {
  issues: Issue[];
  status: "idle" | "scanning" | "applying" | "ready";
  useLlm: boolean;
  /** Backend-status; "offline"/"nokey" met useLlm aan → toon de bijbehorende melding. */
  aiStatus: AiStatus | null;
  onScan: () => void;
  onApplyAll: () => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSetUseLlm: (value: boolean) => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  scanButton: {
    width: "100%",
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
  critical: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: cg.sev.critical.fg,
    fontWeight: tokens.fontWeightSemibold,
  },
  criticalDot: {
    width: "6px",
    height: "6px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: cg.sev.critical.fg,
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  offlineNote: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: cg.sev.advisory.fg,
    backgroundColor: cg.sev.advisory.bg,
    border: `1px solid ${cg.sev.advisory.border}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  offlineNoteIcon: {
    flexShrink: 0,
    marginTop: "1px",
    fontSize: "14px",
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
  },
  spark: {
    color: cg.spark, // signature-geel: enige gele accent in de toolbar
    fontSize: "14px",
  },
  reviewCluster: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
  reviewLabel: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    letterSpacing: "0.02em",
  },
  reviewButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
  },
});

/** Bovenste actiebalk: scan, bulktoepassing, AI-switch en (indien beschikbaar) review-knoppen. */
const Toolbar: React.FC<ToolbarProps> = ({
  issues,
  status,
  useLlm,
  aiStatus,
  onScan,
  onApplyAll,
  onAcceptAll,
  onRejectAll,
  onSetUseLlm,
}) => {
  const styles = useStyles();
  const isScanning = status === "scanning";
  const isApplying = status === "applying";
  const isBusy = isScanning || isApplying;
  const reviewSupported = isReviewSupported();

  const hasIssues = issues.length > 0;
  const pendingCount = issues.filter((i) => i.status === "pending").length;
  const criticalCount = issues.filter(
    (i) => i.severity === "critical" && i.status === "pending"
  ).length;
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
            {criticalCount > 0 && (
              <span className={styles.critical}>
                <span className={styles.criticalDot} aria-hidden />
                {criticalCount} kritiek
              </span>
            )}
          </span>
        </div>
      )}

      {/* AI-laag (opt-in) */}
      <div className={styles.switchRow}>
        <Switch
          checked={useLlm}
          onChange={(_e, data) => onSetUseLlm(data.checked)}
          label="AI-proeflezer (Claude)"
          disabled={isBusy}
        />
        {useLlm && <SparkleFilled className={styles.spark} aria-hidden />}
      </div>

      {/* AI-laag aan, maar backend onbereikbaar of zonder key: expliciet maken i.p.v. stil leeg */}
      {useLlm && aiStatus === "offline" && (
        <div className={styles.offlineNote} role="status">
          <WarningRegular className={styles.offlineNoteIcon} aria-hidden />
          <span>
            AI-laag offline — de backend (:3001) draait niet. Start hem met{" "}
            <span className={styles.code}>npm run backend</span>. De scan werkt intussen offline
            door (spelling + gedefinieerde termen).
          </span>
        </div>
      )}
      {useLlm && aiStatus === "nokey" && (
        <div className={styles.offlineNote} role="status">
          <WarningRegular className={styles.offlineNoteIcon} aria-hidden />
          <span>
            AI-laag draait, maar zonder API-key blijft elke AI-scan leeg. Zet je OpenRouter-key in{" "}
            <span className={styles.code}>server/.env</span> en herstart de backend.
          </span>
        </div>
      )}

      {/* Documentbrede review (alleen bij WordApi 1.6) */}
      {reviewSupported && (
        <>
          <Divider />
          <div className={styles.reviewCluster}>
            <span className={styles.reviewLabel}>Tracked changes in het document</span>
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
          </div>
        </>
      )}
    </div>
  );
};

export default Toolbar;
