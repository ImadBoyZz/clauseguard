import * as React from "react";
import { Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components";
import { DocumentSearchRegular, CheckmarkCircleFilled } from "@fluentui/react-icons";
import { Issue, Severity, SEVERITY_LABEL } from "../core/types";
import { cg } from "../theme";
import IssueCard from "./IssueCard";

interface IssueListProps {
  issues: Issue[];
  scanning: boolean;
  onAccept: (issue: Issue) => void;
  onDismiss: (issue: Issue) => void;
  onLocate: (issue: Issue) => void;
}

const useStyles = makeStyles({
  root: {
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalXL}`,
  },
  // --- Empty state ---
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalL}`,
  },
  emptyIcon: {
    fontSize: "40px",
    color: tokens.colorNeutralForeground4,
    marginBottom: tokens.spacingVerticalM,
  },
  emptyTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  emptyBody: {
    margin: `${tokens.spacingVerticalXS} 0 ${tokens.spacingVerticalL}`,
    maxWidth: "30ch",
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground3,
  },
  legend: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    width: "100%",
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  legendRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalS,
    textAlign: "left",
  },
  legendDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
    marginTop: "5px",
  },
  legendLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  legendDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  // --- Loading skeleton ---
  skeletonList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalM,
  },
  skeletonCard: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  skeletonMeta: { width: "45%" },
  skeletonDiff: { height: "44px", borderRadius: tokens.borderRadiusMedium },
  skeletonLineFull: { width: "100%" },
  skeletonLineShort: { width: "70%" },
  scanningNote: {
    display: "flex",
    justifyContent: "center",
    paddingTop: tokens.spacingVerticalM,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  // --- All-resolved banner ---
  resolvedBanner: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    backgroundColor: cg.diff.addBg,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  resolvedText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  // --- Severity groups ---
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  groupDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  groupLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  groupCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
  },
});

/** Volgorde van de severity-groepen in de lijst (zwaarste eerst). */
const SEVERITY_ORDER: Severity[] = ["critical", "advisory", "spelling"];

/** Korte omschrijving per tier voor de onboarding-legenda. */
const SEVERITY_DESC: Record<Severity, string> = {
  critical: "Juridisch risico, zoals inconsistente gedefinieerde termen.",
  advisory: "Grammatica, stijl, tegenstrijdigheden en mogelijke feitfouten (AI-laag).",
  spelling: "Spelfouten in Nederlands en Engels.",
};

const IssueList: React.FC<IssueListProps> = ({
  issues,
  scanning,
  onAccept,
  onDismiss,
  onLocate,
}) => {
  const styles = useStyles();

  // Loading: skeleton-kaarten i.p.v. een losse spinner.
  if (scanning) {
    return (
      <div className={styles.root}>
        <Skeleton aria-label="Document scannen">
          <div className={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeletonCard}>
                <SkeletonItem size={12} className={styles.skeletonMeta} />
                <SkeletonItem size={40} className={styles.skeletonDiff} />
                <SkeletonItem size={8} className={styles.skeletonLineFull} />
                <SkeletonItem size={8} className={styles.skeletonLineShort} />
              </div>
            ))}
          </div>
        </Skeleton>
        <div className={styles.scanningNote}>Document scannen…</div>
      </div>
    );
  }

  // Empty: leert de interface + toont de severity-legenda.
  if (issues.length === 0) {
    return (
      <div className={styles.empty}>
        <DocumentSearchRegular className={styles.emptyIcon} aria-hidden />
        <h2 className={styles.emptyTitle}>Klaar om te controleren</h2>
        <p className={styles.emptyBody}>
          Scan het document op spelling, stijl en inconsistente definities. Elke bevinding krijgt
          een suggestie en het waarom.
        </p>
        <div className={styles.legend}>
          {SEVERITY_ORDER.map((sev) => (
            <div key={sev} className={styles.legendRow}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: cg.sev[sev].fg }}
                aria-hidden
              />
              <span>
                <span className={styles.legendLabel}>{SEVERITY_LABEL[sev]}</span>
                <span className={styles.legendDesc}> — {SEVERITY_DESC[sev]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Groepeer per severity.
  const grouped = SEVERITY_ORDER.reduce<Record<Severity, Issue[]>>(
    (acc, sev) => {
      acc[sev] = issues.filter((i) => i.severity === sev);
      return acc;
    },
    { critical: [], advisory: [], spelling: [] }
  );

  const allResolved = issues.every((i) => i.status !== "pending");
  const appliedCount = issues.filter((i) => i.status === "accepted").length;
  const dismissedCount = issues.filter((i) => i.status === "rejected").length;
  const resolvedSummary = [
    appliedCount > 0 ? `${appliedCount} toegepast` : null,
    dismissedCount > 0 ? `${dismissedCount} genegeerd` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={styles.root}>
      {allResolved && (
        <div className={styles.resolvedBanner} role="status">
          <CheckmarkCircleFilled fontSize={18} style={{ color: cg.diff.add }} aria-hidden />
          <span className={styles.resolvedText}>Alles nagekeken · {resolvedSummary}.</span>
        </div>
      )}

      {SEVERITY_ORDER.map((sev) => {
        const group = grouped[sev];
        if (group.length === 0) return null;
        return (
          <section key={sev}>
            <div className={styles.groupHeader}>
              <span
                className={styles.groupDot}
                style={{ backgroundColor: cg.sev[sev].fg }}
                aria-hidden
              />
              <span className={styles.groupLabel} style={{ color: cg.sev[sev].fg }}>
                {SEVERITY_LABEL[sev]}
              </span>
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            {group.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onAccept={onAccept}
                onDismiss={onDismiss}
                onLocate={onLocate}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
};

export default IssueList;
