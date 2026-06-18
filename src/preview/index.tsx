// Dev-only design-preview. Rendert de ECHTE task-pane-componenten (PaneHeader,
// PrivacyNote, Toolbar, IssueList, IssueCard) met mock-data in een 360px-frame, zodat
// het design op de smalle Word-viewport te verifiëren is zonder Word-host.
// Niet gerefereerd door het manifest; valt buiten productie-builds (zie webpack.config.js).

import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  FluentProvider,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { clauseGuardLightTheme } from "../taskpane/theme";
import PaneHeader from "../taskpane/components/PaneHeader";
import PrivacyNote from "../taskpane/components/PrivacyNote";
import Toolbar from "../taskpane/components/Toolbar";
import IssueList from "../taskpane/components/IssueList";
import { Issue } from "../taskpane/core/types";

type Status = "idle" | "scanning" | "applying" | "ready";

/** Verse set mock-issues die de demo benadert: 6 spelling + 4 kritiek (term) + 2 advies. */
function mockIssues(): Issue[] {
  return [
    // --- Kritiek: inconsistente gedefinieerde termen ---
    {
      id: "term-1",
      category: "term",
      severity: "critical",
      original: "de dienstverlener",
      suggestion: "de Dienstverlener",
      explanation:
        '"Dienstverlener" is in artikel 1 als gedefinieerde term vastgelegd (met hoofdletter). Hier staat de kleine-letter-variant, wat de juridische verwijzing dubbelzinnig maakt.',
      language: "nl",
      paragraphIndex: 4,
      occurrence: 0,
      status: "pending",
      source: "definedTerms",
    },
    {
      id: "term-2",
      category: "term",
      severity: "critical",
      original: "Service Provider",
      suggestion: "Dienstverlener",
      explanation:
        "Het contract definieert deze partij als “Dienstverlener”. De Engelse variant introduceert een tweede term voor dezelfde partij; gebruik consequent één gedefinieerde term.",
      language: "en",
      paragraphIndex: 7,
      occurrence: 0,
      status: "pending",
      source: "definedTerms",
    },
    {
      id: "term-3",
      category: "term",
      severity: "critical",
      original: "de overeenkomst",
      suggestion: "deze Overeenkomst",
      explanation:
        '"Overeenkomst" is een gedefinieerde term. De niet-gedefinieerde verwijzing kan onbedoeld naar een andere overeenkomst wijzen.',
      language: "nl",
      paragraphIndex: 9,
      occurrence: 1,
      status: "pending",
      source: "definedTerms",
    },
    {
      id: "term-4",
      category: "term",
      severity: "critical",
      original: "klant",
      suggestion: "Opdrachtgever",
      explanation:
        'De wederpartij is gedefinieerd als "Opdrachtgever". "Klant" is een synoniem dat hier juridische onduidelijkheid schept.',
      language: "nl",
      paragraphIndex: 11,
      occurrence: 0,
      status: "pending",
      source: "definedTerms",
    },
    // --- Advies: stijl/grammatica (LLM) ---
    {
      id: "style-1",
      category: "style",
      severity: "advisory",
      original: "will provide the Services",
      suggestion: "shall provide the Services",
      explanation:
        'In bindende verplichtingen verdient "shall" de voorkeur boven "will": het drukt een afdwingbare plicht uit in plaats van een toekomstige intentie.',
      confidence: 0.82,
      language: "en",
      paragraphIndex: 7,
      occurrence: 0,
      status: "pending",
      source: "llm",
    },
    {
      id: "grammar-1",
      category: "grammar",
      severity: "advisory",
      original: "naar redelijkheid",
      explanation:
        'Vage maatstaf. "Naar redelijkheid" is moeilijk afdwingbaar; overweeg een concrete termijn of objectief criterium.',
      confidence: 0.61,
      language: "nl",
      paragraphIndex: 12,
      occurrence: 0,
      status: "pending",
      source: "llm",
    },
    // --- Spelling (NL + EN) ---
    {
      id: "sp-1",
      category: "spelling",
      severity: "spelling",
      original: "overheidsopdarcht",
      suggestion: "overheidsopdracht",
      explanation:
        "Onbekend woord in het Nederlandse woordenboek. Bedoelde je “overheidsopdracht”?",
      language: "nl",
      paragraphIndex: 2,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
    {
      id: "sp-2",
      category: "spelling",
      severity: "spelling",
      original: "agreemnet",
      suggestion: "agreement",
      explanation: "Onbekend woord in het Engelse woordenboek. Bedoelde je “agreement”?",
      language: "en",
      paragraphIndex: 3,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
    {
      id: "sp-3",
      category: "spelling",
      severity: "spelling",
      original: "verplichtignen",
      suggestion: "verplichtingen",
      explanation: "Onbekend woord in het Nederlandse woordenboek. Bedoelde je “verplichtingen”?",
      language: "nl",
      paragraphIndex: 5,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
    {
      id: "sp-4",
      category: "spelling",
      severity: "spelling",
      original: "liabilty",
      suggestion: "liability",
      explanation: "Onbekend woord in het Engelse woordenboek. Bedoelde je “liability”?",
      language: "en",
      paragraphIndex: 8,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
    {
      id: "sp-5",
      category: "spelling",
      severity: "spelling",
      original: "betlaing",
      suggestion: "betaling",
      explanation: "Onbekend woord in het Nederlandse woordenboek. Bedoelde je “betaling”?",
      language: "nl",
      paragraphIndex: 10,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
    {
      id: "sp-6",
      category: "spelling",
      severity: "spelling",
      original: "terminaton",
      suggestion: "termination",
      explanation: "Onbekend woord in het Engelse woordenboek. Bedoelde je “termination”?",
      language: "en",
      paragraphIndex: 13,
      occurrence: 0,
      status: "pending",
      source: "nspell",
    },
  ];
}

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "20px 0 60px",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "6px",
    maxWidth: "520px",
  },
  controlBtn: {
    appearance: "none",
    border: "1px solid #c7c9d1",
    background: "#fff",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  controlBtnActive: {
    background: "#0b1030",
    color: "#fff",
    border: "1px solid #0b1030",
  },
  frameLabel: {
    fontSize: "11px",
    color: "#5a5c66",
    letterSpacing: "0.04em",
  },
  frame: {
    width: "360px",
    height: "720px",
    maxHeight: "calc(100vh - 120px)",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    border: "1px solid #c7c9d1",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(11, 16, 48, 0.16)",
  },
  notice: {
    margin: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL} 0`,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  },
});

type Scenario = "empty" | "scanning" | "results" | "resolved" | "error";

const SCENARIOS: { key: Scenario; label: string }[] = [
  { key: "empty", label: "Leeg" },
  { key: "scanning", label: "Scannen" },
  { key: "results", label: "Resultaten" },
  { key: "resolved", label: "Alles opgelost" },
  { key: "error", label: "Fout" },
];

const Preview: React.FC = () => {
  const styles = useStyles();
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [status, setStatus] = React.useState<Status>("idle");
  const [useLlm, setUseLlm] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [scenario, setScenario] = React.useState<Scenario>("empty");

  const applyScenario = (next: Scenario) => {
    setScenario(next);
    setError(undefined);
    switch (next) {
      case "empty":
        setIssues([]);
        setStatus("idle");
        break;
      case "scanning":
        setIssues([]);
        setStatus("scanning");
        break;
      case "results":
        setIssues(mockIssues());
        setStatus("ready");
        break;
      case "resolved":
        setIssues(
          mockIssues().map((i) => ({ ...i, status: i.suggestion ? "accepted" : "rejected" }))
        );
        setStatus("ready");
        break;
      case "error":
        setIssues(mockIssues());
        setStatus("ready");
        setError("Kon het document niet lezen: geen actief Word-document gevonden.");
        break;
    }
  };

  const onScan = () => {
    setError(undefined);
    setStatus("scanning");
    window.setTimeout(() => {
      setIssues(mockIssues());
      setStatus("ready");
      setScenario("results");
    }, 1100);
  };

  const onAccept = (issue: Issue) =>
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: "accepted" } : i)));
  const onDismiss = (issue: Issue) =>
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, status: "rejected" } : i)));
  const onApplyAll = () =>
    setIssues((prev) =>
      prev.map((i) => (i.status === "pending" && i.suggestion ? { ...i, status: "accepted" } : i))
    );

  const scanning = status === "scanning";

  return (
    <FluentProvider theme={clauseGuardLightTheme}>
      <div className={styles.page}>
        <div className={styles.controls}>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              className={`${styles.controlBtn} ${scenario === s.key ? styles.controlBtnActive : ""}`}
              onClick={() => applyScenario(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className={styles.frameLabel}>360 × 720 — Word task-pane</span>

        <div className={styles.frame}>
          <PaneHeader />
          <PrivacyNote />
          {error && (
            <MessageBar intent="error" className={styles.notice}>
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
          <Toolbar
            issues={issues}
            status={status}
            useLlm={useLlm}
            aiStatus={null}
            onScan={onScan}
            onApplyAll={onApplyAll}
            onAcceptAll={() => undefined}
            onRejectAll={() => undefined}
            onSetUseLlm={setUseLlm}
          />
          <div className={styles.content}>
            <IssueList
              issues={issues}
              scanning={scanning}
              onAccept={onAccept}
              onDismiss={onDismiss}
              onLocate={() => undefined}
            />
          </div>
        </div>
      </div>
    </FluentProvider>
  );
};

const el = document.getElementById("preview-root");
if (el) {
  createRoot(el).render(<Preview />);
}
