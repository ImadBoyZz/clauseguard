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
import { clauseGuardLightTheme, cg } from "../taskpane/theme";
import PaneHeader from "../taskpane/components/PaneHeader";
import Toolbar from "../taskpane/components/Toolbar";
import IssueList from "../taskpane/components/IssueList";
import { Issue, LangMode } from "../taskpane/core/types";

type Status = "idle" | "scanning" | "applying" | "ready";

/** Verse set mock-issues die de demo benadert: 6 spelfouten (NL + EN). */
function mockIssues(): Issue[] {
  return [
    {
      id: "sp-1",
      original: "overheidsopdarcht",
      suggestion: "overheidsopdracht",
      explanation: 'Mogelijke spelfout — bedoelde je "overheidsopdracht"?',
      language: "nl",
      paragraphIndex: 2,
      occurrence: 0,
      status: "pending",
    },
    {
      id: "sp-2",
      original: "agreemnet",
      suggestion: "agreement",
      explanation: 'Mogelijke spelfout — bedoelde je "agreement"?',
      language: "en",
      paragraphIndex: 3,
      occurrence: 0,
      status: "pending",
    },
    {
      id: "sp-3",
      original: "verplichtignen",
      suggestion: "verplichtingen",
      explanation: 'Mogelijke spelfout — bedoelde je "verplichtingen"?',
      language: "nl",
      paragraphIndex: 5,
      occurrence: 0,
      status: "pending",
    },
    {
      id: "sp-4",
      original: "liabilty",
      suggestion: "liability",
      explanation: 'Mogelijke spelfout — bedoelde je "liability"?',
      language: "en",
      paragraphIndex: 8,
      occurrence: 0,
      status: "pending",
    },
    {
      id: "sp-5",
      original: "betlaing",
      suggestion: "betaling",
      explanation: 'Mogelijke spelfout — bedoelde je "betaling"?',
      language: "nl",
      paragraphIndex: 10,
      occurrence: 0,
      status: "pending",
    },
    {
      id: "sp-6",
      original: "terminaton",
      suggestion: "termination",
      explanation: 'Mogelijke spelfout — bedoelde je "termination"?',
      language: "en",
      paragraphIndex: 13,
      occurrence: 0,
      status: "pending",
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
    // Spiegelt App: het hele frame scrollt, zodat het muiswiel overal werkt.
    overflowY: "auto",
    backgroundColor: cg.base,
    backgroundImage: `radial-gradient(120% 60% at 50% -8%, ${cg.glowCoral} 0%, rgba(255,92,45,0) 55%), linear-gradient(180deg, ${cg.base} 0%, ${cg.baseDeep} 100%)`,
    border: `1px solid ${cg.glass.stroke}`,
    borderRadius: "12px",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  notice: {
    margin: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL} 0`,
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
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [scenario, setScenario] = React.useState<Scenario>("empty");
  const [lang, setLang] = React.useState<LangMode>("auto");

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
          <div className={styles.topbar}>
            <PaneHeader />
            {error && (
              <MessageBar intent="error" className={styles.notice}>
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
            <Toolbar
              issues={issues}
              status={status}
              lang={lang}
              langStale={false}
              onScan={onScan}
              onLangChange={setLang}
              onApplyAll={onApplyAll}
              onAcceptAll={() => undefined}
              onRejectAll={() => undefined}
            />
          </div>
          <IssueList
            issues={issues}
            scanning={scanning}
            onAccept={onAccept}
            onDismiss={onDismiss}
            onLocate={() => undefined}
          />
        </div>
      </div>
    </FluentProvider>
  );
};

const el = document.getElementById("preview-root");
if (el) {
  createRoot(el).render(<Preview />);
}
