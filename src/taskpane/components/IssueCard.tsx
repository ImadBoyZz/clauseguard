import * as React from "react";
import { Button, makeStyles, tokens } from "@fluentui/react-components";
import {
  CheckmarkRegular,
  DismissRegular,
  SearchRegular,
  ArrowDownRegular,
  CheckmarkCircleFilled,
  DismissCircleFilled,
} from "@fluentui/react-icons";
import { Issue, IssueCategory } from "../core/types";
import { cg } from "../theme";

interface IssueCardProps {
  issue: Issue;
  onAccept: (issue: Issue) => void;
  onDismiss: (issue: Issue) => void;
  onLocate: (issue: Issue) => void;
}

/** Mensvriendelijk categorielabel per check (de meta-rij van de kaart). */
const CATEGORY_LABEL: Record<IssueCategory, string> = {
  spelling: "Spelfout",
  term: "Gedefinieerde term",
  grammar: "Grammatica",
  style: "Stijl",
  consistency: "Tegenstrijdigheid",
  factual: "Mogelijke feitfout",
};

const useStyles = makeStyles({
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    transitionProperty: "border-color, box-shadow",
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    animationName: {
      "0%": { opacity: 0, transform: "translateY(3px)" },
      "100%": { opacity: 1, transform: "translateY(0)" },
    },
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveDecelerateMax,
    ":hover": {
      border: `1px solid ${tokens.colorNeutralStroke1}`,
      boxShadow: tokens.shadow2,
    },
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  resolved: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  dismissed: {
    opacity: 0.55,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  dot: {
    width: "7px",
    height: "7px",
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  category: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },
  spacer: {
    flex: 1,
  },
  lang: {
    fontSize: "10px",
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: "0.04em",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `1px ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
  },
  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightMedium,
  },
  diff: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: "hidden",
  },
  diffLine: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    wordBreak: "break-word",
  },
  original: {
    color: cg.diff.remove,
    textDecorationLine: "line-through",
    textDecorationThickness: "1px",
  },
  flagged: {
    // Geflagd fragment zonder vervanging: tonen zonder doorhaling.
    color: tokens.colorNeutralForeground1,
  },
  connector: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingBlock: "1px",
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  suggestion: {
    color: cg.diff.add,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: cg.diff.addBg,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  explanation: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  confidence: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: "4px",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  confidenceTrack: {
    width: "32px",
    height: "3px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralStroke2,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: tokens.colorNeutralForeground3,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXXS,
  },
});

/** Eén issue-kaart: severity-marker, redline-diff, het "waarom" en de acties. */
const IssueCard: React.FC<IssueCardProps> = ({ issue, onAccept, onDismiss, onLocate }) => {
  const styles = useStyles();
  const isPending = issue.status === "pending";
  const isAccepted = issue.status === "accepted";
  const isDismissed = issue.status === "rejected";
  const sev = cg.sev[issue.severity];

  const cardClass = [
    styles.card,
    !isPending ? styles.resolved : "",
    isDismissed ? styles.dismissed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClass}>
      {/* Meta: severity-dot + categorie + taal/status */}
      <div className={styles.metaRow}>
        <span className={styles.dot} style={{ backgroundColor: sev.fg }} aria-hidden />
        <span className={styles.category} style={{ color: sev.fg }}>
          {CATEGORY_LABEL[issue.category]}
        </span>
        <span className={styles.spacer} />
        {isPending && issue.language && (
          <span className={styles.lang}>{issue.language.toUpperCase()}</span>
        )}
        {isAccepted && (
          <span className={styles.statusChip} style={{ color: cg.diff.add }}>
            <CheckmarkCircleFilled fontSize={14} aria-hidden />
            Toegepast
          </span>
        )}
        {isDismissed && (
          <span className={styles.statusChip} style={{ color: tokens.colorNeutralForeground3 }}>
            <DismissCircleFilled fontSize={14} aria-hidden />
            Genegeerd
          </span>
        )}
      </div>

      {/* Redline: origineel -> suggestie (of enkel het geflagde fragment) */}
      <div className={styles.diff}>
        <div
          className={`${styles.diffLine} ${issue.suggestion ? styles.original : styles.flagged}`}
        >
          {issue.original}
        </div>
        {issue.suggestion && (
          <>
            <div className={styles.connector} aria-hidden>
              <ArrowDownRegular fontSize={12} />
            </div>
            <div className={`${styles.diffLine} ${styles.suggestion}`}>{issue.suggestion}</div>
          </>
        )}
      </div>

      {/* Het "waarom" — de kern van elke flag */}
      <p className={styles.explanation}>{issue.explanation}</p>

      {/* Optioneel vertrouwen (vooral LLM-suggesties) */}
      {issue.confidence !== undefined && (
        <span className={styles.confidence}>
          <span className={styles.confidenceTrack}>
            <span
              className={styles.confidenceFill}
              style={{ width: `${Math.round(issue.confidence * 100)}%` }}
            />
          </span>
          Betrouwbaarheid {Math.round(issue.confidence * 100)}%
        </span>
      )}

      {/* Acties */}
      <div className={styles.actions}>
        {issue.suggestion && (
          <Button
            size="small"
            appearance="primary"
            icon={<CheckmarkRegular />}
            disabled={!isPending}
            onClick={() => onAccept(issue)}
            title="Pas toe als tracked change"
          >
            Accepteer
          </Button>
        )}
        <Button
          size="small"
          appearance="subtle"
          icon={<DismissRegular />}
          disabled={!isPending}
          onClick={() => onDismiss(issue)}
          title="Negeer dit issue"
        >
          Negeer
        </Button>
        <Button
          size="small"
          appearance="subtle"
          icon={<SearchRegular />}
          onClick={() => onLocate(issue)}
          title="Ga naar dit fragment in het document"
        >
          Vind
        </Button>
      </div>
    </article>
  );
};

export default IssueCard;
