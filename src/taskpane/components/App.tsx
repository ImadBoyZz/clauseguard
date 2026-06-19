import * as React from "react";
import { MessageBar, MessageBarBody, makeStyles, tokens } from "@fluentui/react-components";
import { useClauseGuard } from "../hooks/useClauseGuard";
import PaneHeader from "./PaneHeader";
import Toolbar from "./Toolbar";
import IssueList from "./IssueList";
import { isTrackChangesSupported } from "../core/trackChanges";
import { cg } from "../theme";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    // Het hele paneel is één scroll-zone: zo werkt het muiswiel overal, ook boven de
    // header/toolbar, i.p.v. alleen boven het onderste content-blok.
    height: "100vh",
    overflowY: "auto",
    color: tokens.colorNeutralForeground1,
    // Warme near-black canvas met een coral-gloed bovenin (de "glass" leeft hierop).
    backgroundColor: cg.base,
    backgroundImage: `radial-gradient(120% 60% at 50% -8%, ${cg.glowCoral} 0%, rgba(255,92,45,0) 55%), radial-gradient(90% 50% at 100% 0%, ${cg.glowCoralSoft} 0%, rgba(255,122,71,0) 50%), linear-gradient(180deg, ${cg.base} 0%, ${cg.baseDeep} 100%)`,
    backgroundAttachment: "fixed",
  },
  // Header + privacy-strip + toolbar als één blok bovenaan vastgepind tijdens scrollen.
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 5,
  },
  notice: {
    margin: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL} 0`,
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
    lang,
    langStale,
    runScan,
    setLang,
    applyOne,
    applyAll,
    dismissOne,
    locate,
    acceptAllChanges,
    rejectAllChanges,
  } = useClauseGuard();

  const scanning = status === "scanning";

  return (
    <div className={styles.root}>
      {/* Vastgepinde chrome: scrollt mee-blokkerend bovenaan, content schuift eronder door */}
      <div className={styles.topbar}>
        <PaneHeader />

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
          lang={lang}
          langStale={langStale}
          onScan={runScan}
          onLangChange={setLang}
          onApplyAll={applyAll}
          onAcceptAll={acceptAllChanges}
          onRejectAll={rejectAllChanges}
        />
      </div>

      <IssueList
        issues={issues}
        scanning={scanning}
        onAccept={applyOne}
        onDismiss={dismissOne}
        onLocate={locate}
      />
    </div>
  );
};

export default App;
