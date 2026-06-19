import * as React from "react";
import { Skeleton, SkeletonItem, makeStyles, tokens } from "@fluentui/react-components";
import { DocumentSearchRegular, CheckmarkCircleFilled } from "@fluentui/react-icons";
import { Issue } from "../core/types";
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
    margin: `${tokens.spacingVerticalXS} 0 0`,
    maxWidth: "32ch",
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
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
    padding: tokens.spacingVerticalL,
    backgroundColor: cg.glass.fill,
    border: `1px solid ${cg.glass.stroke}`,
    borderRadius: cg.radius,
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
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    backgroundColor: cg.diff.addBg,
    border: `1px solid ${cg.glass.stroke}`,
    borderRadius: cg.radius,
  },
  resolvedText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  // --- List ---
  listHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingBottom: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalL,
    marginBottom: tokens.spacingVerticalS,
    borderBottom: `1px solid ${cg.glass.stroke}`,
  },
  listDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  listLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  listCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontVariantNumeric: "tabular-nums",
  },
});

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

  // Empty: korte onboarding.
  if (issues.length === 0) {
    return (
      <div className={styles.empty}>
        <DocumentSearchRegular className={styles.emptyIcon} aria-hidden />
        <h2 className={styles.emptyTitle}>Klaar om te controleren</h2>
        <p className={styles.emptyBody}>
          Scan het document op spelfouten in het Nederlands en Engels. Kies de taal in de balk
          hierboven; elke fout krijgt een suggestie en het waarom.
        </p>
      </div>
    );
  }

  const allResolved = issues.every((i) => i.status !== "pending");
  const appliedCount = issues.filter((i) => i.status === "accepted").length;
  const dismissedCount = issues.filter((i) => i.status === "rejected").length;
  const resolvedSummary = [
    appliedCount > 0 ? `${appliedCount} toegepast` : null,
    dismissedCount > 0 ? `${dismissedCount} genegeerd` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Toon in documentvolgorde (paragraaf, dan voorkomen). De carry-over-logica in de hook kan
  // verwerkte issues vooraan zetten; sorteren geeft een stabiele leesvolgorde.
  const ordered = [...issues].sort((a, b) =>
    a.paragraphIndex !== b.paragraphIndex
      ? a.paragraphIndex - b.paragraphIndex
      : a.occurrence - b.occurrence
  );

  return (
    <div className={styles.root}>
      {allResolved && (
        <div className={styles.resolvedBanner} role="status">
          <CheckmarkCircleFilled fontSize={18} style={{ color: cg.diff.add }} aria-hidden />
          <span className={styles.resolvedText}>Alles nagekeken · {resolvedSummary}.</span>
        </div>
      )}

      <div className={styles.listHeader}>
        <span
          className={styles.listDot}
          style={{ backgroundColor: cg.spelling.fg }}
          aria-hidden
        />
        <span className={styles.listLabel} style={{ color: cg.spelling.fg }}>
          Spelling
        </span>
        <span className={styles.listCount}>{ordered.length}</span>
      </div>

      {ordered.map((issue) => (
        <IssueCard
          key={issue.id}
          issue={issue}
          onAccept={onAccept}
          onDismiss={onDismiss}
          onLocate={onLocate}
        />
      ))}
    </div>
  );
};

export default IssueList;
