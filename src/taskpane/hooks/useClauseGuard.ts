import { useState, useCallback, useEffect } from "react";
import { Issue, hasSuggestion, AiStatus } from "../core/types";
import { runFullScan } from "../core/runChecks";
import { checkAiHealth } from "../core/legalStyle";
import {
  applyCorrections,
  selectIssueRange,
  acceptAllTrackedChanges,
  rejectAllTrackedChanges,
  isReviewSupported,
} from "../core/trackChanges";

/* global localStorage */

/** UI-status van de task-pane. */
type PaneStatus = "idle" | "scanning" | "applying" | "ready";

export interface ClauseGuardState {
  issues: Issue[];
  status: PaneStatus;
  error?: string;
  useLlm: boolean;
  /**
   * Status van de AI-backend. `null` = nog niet gecontroleerd / AI-laag uit.
   * "offline" of "nokey" met useLlm aan → de UI toont de bijbehorende melding.
   */
  aiStatus: AiStatus | null;
}

export interface ClauseGuardActions {
  /** Start een volledige documentscan. */
  runScan(): Promise<void>;
  /** Pas één issue toe als tracked change en markeer als 'accepted'. */
  applyOne(issue: Issue): Promise<void>;
  /** Pas alle pending issues met een suggestie toe als tracked changes. */
  applyAll(): Promise<void>;
  /** Wijs één issue af (geen documentwijziging). */
  dismissOne(issue: Issue): void;
  /** Selecteer het Word-bereik van het issue (navigeer ernaar toe). */
  locate(issue: Issue): Promise<void>;
  /** Accepteer alle tracked changes in het document (vereist WordApi 1.6). */
  acceptAllChanges(): Promise<void>;
  /** Wijs alle tracked changes af in het document (vereist WordApi 1.6). */
  rejectAllChanges(): Promise<void>;
  /** Schakel de LLM-legal-style check aan of uit. */
  setUseLlm(value: boolean): void;
}

/**
 * Stabiele signatuur om hetzelfde issue over scans heen te herkennen.
 * Wordt gebruikt om reeds verwerkte issues (toegepast/genegeerd) bij een nieuwe scan
 * niet opnieuw als 'open' te tonen.
 *
 * BEWUST ZONDER `occurrence`: dat veld wordt ELKE scan opnieuw berekend uit de actuele
 * tekstposities (runChecks.assignOccurrences). Na een edit kan hetzelfde issue dus een ander
 * occurrence-getal krijgen, waardoor de signatuur niet meer matcht en de carry-over hapert
 * (verdwijnende of dubbele kaarten). Identiteit = (source, paraIndex, category, original, suggestion).
 */
function issueSignature(issue: Issue): string {
  return [
    issue.source,
    issue.paragraphIndex,
    issue.category,
    issue.original,
    issue.suggestion ?? "",
  ].join("|");
}

/** localStorage-sleutel voor de AI-laag-voorkeur (overleeft het sluiten/heropenen van het document). */
const USE_LLM_KEY = "clauseguard.useLlm";

/** Leest de opgeslagen AI-laag-voorkeur; default AAN als er niets staat of localStorage ontbreekt. */
function readUseLlmPref(): boolean {
  try {
    return localStorage.getItem(USE_LLM_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Bewaart de AI-laag-voorkeur (best-effort; faalt stil als localStorage niet schrijfbaar is). */
function writeUseLlmPref(value: boolean): void {
  try {
    localStorage.setItem(USE_LLM_KEY, String(value));
  } catch {
    // localStorage niet beschikbaar: de voorkeur leeft alleen deze sessie
  }
}

/** Hook die alle UI-state en acties voor de ClauseGuard task-pane beheert. */
export function useClauseGuard(): ClauseGuardState & ClauseGuardActions {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<PaneStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [useLlm, setUseLlmState] = useState<boolean>(readUseLlmPref);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  /** Pingt de backend-heartbeat als de AI-laag aan staat; reset naar null als hij uit staat. */
  const refreshAiHealth = useCallback(async (enabled: boolean) => {
    setAiStatus(enabled ? await checkAiHealth() : null);
  }, []);

  // Controleer de backend bij mount en telkens als de AI-switch wisselt. De `active`-vlag
  // voorkomt een setState-na-unmount als de fetch nog loopt bij het sluiten van het paneel.
  useEffect(() => {
    let active = true;
    void (async () => {
      const status = useLlm ? await checkAiHealth() : null;
      if (active) setAiStatus(status);
    })();
    return () => {
      active = false;
    };
  }, [useLlm]);

  /** Hulpfunctie: vervang één issue in de lijst op basis van id. */
  const updateIssue = useCallback((id: string, patch: Partial<Issue>) => {
    setIssues((prev) => prev.map((iss) => (iss.id === id ? { ...iss, ...patch } : iss)));
  }, []);

  const runScan = useCallback(async () => {
    setStatus("scanning");
    setError(undefined);
    // Herijk de backend-status: de gebruiker kan de backend net gestart hebben.
    void refreshAiHealth(useLlm);
    try {
      const result = await runFullScan({ useLlm });
      setIssues((prev) => {
        // Behoud reeds verwerkte issues (toegepast of genegeerd) en filter hun duplicaten uit de
        // verse scan, zodat opgeloste/genegeerde problemen niet opnieuw opduiken — ook op
        // Word-builds waar de reviewed-tekst-leesweg (wordDocument.ts) faalt en de ruwe tekst nog
        // tracked deletions bevat.
        //
        // MAAR: draag een verwerkt issue alléén over zolang z'n fragment NOG in de (verse)
        // paragraaftekst staat. Werkt de gebruiker die tekst weg of wijzigt 'm, dan vervalt het
        // oude issue. Zonder deze check zou de lijst "bevriezen": oude verwerkte issues blijven de
        // verse scan onderdrukken (en een nieuw geïntroduceerde fout op dezelfde plek zou nooit
        // verschijnen) — precies het gemelde gedrag "lijst verandert niet na een edit".
        const stillPresent = (iss: Issue): boolean =>
          (result.paragraphs[iss.paragraphIndex]?.text ?? "").indexOf(iss.original) !== -1;
        const resolved = prev.filter((iss) => iss.status !== "pending" && stillPresent(iss));
        const resolvedSigs = new Set(resolved.map(issueSignature));
        const fresh = result.issues.filter((iss) => !resolvedSigs.has(issueSignature(iss)));
        return [...resolved, ...fresh];
      });
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("ready");
    }
  }, [useLlm, refreshAiHealth]);

  const applyOne = useCallback(
    async (issue: Issue) => {
      setStatus("applying");
      try {
        await applyCorrections([issue]);
        updateIssue(issue.id, { status: "accepted" });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStatus("ready");
      }
    },
    [updateIssue]
  );

  const applyAll = useCallback(async () => {
    const pending = issues.filter((i) => i.status === "pending" && hasSuggestion(i));
    if (pending.length === 0) return;
    setStatus("applying");
    try {
      await applyCorrections(pending);
      setIssues((prev) =>
        prev.map((iss) =>
          iss.status === "pending" && hasSuggestion(iss) ? { ...iss, status: "accepted" } : iss
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("ready");
    }
  }, [issues]);

  const dismissOne = useCallback(
    (issue: Issue) => {
      updateIssue(issue.id, { status: "rejected" });
    },
    [updateIssue]
  );

  const locate = useCallback(async (issue: Issue) => {
    try {
      await selectIssueRange(issue);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const acceptAllChanges = useCallback(async () => {
    if (!isReviewSupported()) return;
    setStatus("applying");
    try {
      await acceptAllTrackedChanges();
      // Toegepaste correcties zijn nu definitief; ze blijven 'accepted' in de lijst.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("ready");
    }
  }, []);

  const rejectAllChanges = useCallback(async () => {
    if (!isReviewSupported()) return;
    setStatus("applying");
    try {
      await rejectAllTrackedChanges();
      // Alle tracked changes zijn teruggedraaid → onze toegepaste correcties bestaan niet
      // meer in het document. Zet die issues terug op 'pending' zodat de lijst klopt en ze
      // opnieuw toegepast kunnen worden.
      setIssues((prev) =>
        prev.map((iss) => (iss.status === "accepted" ? { ...iss, status: "pending" } : iss))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("ready");
    }
  }, []);

  const setUseLlm = useCallback((value: boolean) => {
    setUseLlmState(value);
    writeUseLlmPref(value);
  }, []);

  return {
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
  };
}
