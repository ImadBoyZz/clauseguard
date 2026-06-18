import * as React from "react";
import { MessageBar, MessageBarBody, makeStyles, tokens } from "@fluentui/react-components";
import { useClauseGuard } from "../hooks/useClauseGuard";
import PaneHeader from "./PaneHeader";
import PrivacyNote from "./PrivacyNote";
import Toolbar from "./Toolbar";
import IssueList from "./IssueList";
import { isTrackChangesSupported } from "../core/trackChanges";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
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

/** Hoofdcomponent van de ClauseGuard Word task-pane. */
const App: React.FC<AppProps> = () => {
  const styles = useStyles();
  const trackChangesOk = isTrackChangesSupported();

  const {
    issues,
    status,
    error,
    useLlm,
    aiStatus,
    runScan,
    applyOne,
    applyAll,
    dismissOne,
    locate,
    acceptAllChanges,
    rejectAllChanges,
    setUseLlm,
  } = useClauseGuard();

  const scanning = status === "scanning";

  return (
    <div className={styles.root}>
      <PaneHeader />
      <PrivacyNote />

      {/* Waarschuwing als WordApi 1.4 ontbreekt */}
      {!trackChangesOk && (
        <MessageBar intent="warning" className={styles.notice}>
          <MessageBarBody>
            Deze Word-versie ondersteunt geen tracked changes (WordApi 1.4 vereist). Werk bij naar
            Microsoft 365 voor volledige functionaliteit.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Foutbericht van de hook */}
      {error && (
        <MessageBar intent="error" className={styles.notice}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <Toolbar
        issues={issues}
        status={status}
        useLlm={useLlm}
        aiStatus={aiStatus}
        onScan={runScan}
        onApplyAll={applyAll}
        onAcceptAll={acceptAllChanges}
        onRejectAll={rejectAllChanges}
        onSetUseLlm={setUseLlm}
      />

      <div className={styles.content}>
        <IssueList
          issues={issues}
          scanning={scanning}
          onAccept={applyOne}
          onDismiss={dismissOne}
          onLocate={locate}
        />
      </div>
    </div>
  );
};

export default App;
