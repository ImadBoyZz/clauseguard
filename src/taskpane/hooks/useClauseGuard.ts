import { useState, useCallback } from "react";
import { Issue, LangMode, hasSuggestion } from "../core/types";
import { runFullScan } from "../core/runChecks";
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
  /** Gekozen controle-stand: "auto" | "nl" | "en". */
  lang: LangMode;
  /**
   * True als de taalstand is gewijzigd sinds de laatste scan én er nog resultaten staan.
   * De UI toont dan een subtiele "scan opnieuw"-hint; de wissel werkt pas door bij de volgende scan.
   */
  langStale: boolean;
}

export interface ClauseGuardActions {
  /** Start een volledige documentscan in de huidige taalstand. */
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
  /** Wijzig de controle-taalstand (persistente voorkeur). */
  setLang(mode: LangMode): void;
}

/**
 * Stabiele signatuur om hetzelfde issue over scans heen te herkennen, zodat reeds verwerkte
 * issues (toegepast/genegeerd) bij een nieuwe scan niet opnieuw als 'open' verschijnen.
 *
 * BEWUST ZONDER `occurrence`: dat veld wordt elke scan opnieuw berekend uit de actuele
 * tekstposities. `language` zit er wél in: wisselt de gebruiker van taalstand, dan kan hetzelfde
 * fragment in een andere taal beoordeeld worden — dat telt als een ander issue.
 */
function issueSignature(issue: Issue): string {
  return [issue.paragraphIndex, issue.language, issue.original, issue.suggestion ?? ""].join("|");
}

/** localStorage-sleutel voor de taalstand-voorkeur (overleeft het sluiten/heropenen van het document). */
const LANG_KEY = "clauseguard.lang.v1";

/** Geldige taalstanden — defensief tegen een corrupte/oude localStorage-waarde. */
const VALID_MODES: LangMode[] = ["auto", "nl", "en"];

/** Leest de opgeslagen taalstand-voorkeur; default "auto". */
function readLangPref(): LangMode {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    return raw && (VALID_MODES as string[]).includes(raw) ? (raw as LangMode) : "auto";
  } catch {
    return "auto";
  }
}

/** Bewaart de taalstand-voorkeur (best-effort; faalt stil als localStorage niet schrijfbaar is). */
function writeLangPref(value: LangMode): void {
  try {
    localStorage.setItem(LANG_KEY, value);
  } catch {
    // localStorage niet beschikbaar: de voorkeur leeft alleen deze sessie
  }
}

/** Hook die alle UI-state en acties voor de ClauseGuard task-pane beheert. */
export function useClauseGuard(): ClauseGuardState & ClauseGuardActions {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<PaneStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [lang, setLangState] = useState<LangMode>(readLangPref);
  // Taalstand waarin de huidige resultaten gescand zijn (null = nog niet gescand).
  const [scannedLang, setScannedLang] = useState<LangMode | null>(null);

  /** Hulpfunctie: vervang één issue in de lijst op basis van id. */
  const updateIssue = useCallback((id: string, patch: Partial<Issue>) => {
    setIssues((prev) => prev.map((iss) => (iss.id === id ? { ...iss, ...patch } : iss)));
  }, []);

  const runScan = useCallback(async () => {
    setStatus("scanning");
    setError(undefined);
    try {
      const result = await runFullScan({ mode: lang });
      setIssues((prev) => {
        // Behoud reeds verwerkte issues (toegepast of genegeerd) en filter hun duplicaten uit de
        // verse scan, zodat opgeloste/genegeerde problemen niet opnieuw opduiken — maar draag een
        // verwerkt issue alléén over zolang z'n fragment NOG in de (verse) paragraaftekst staat.
        // Werkt de gebruiker die tekst weg of wijzigt 'm, dan vervalt het oude issue (anders zou de
        // lijst "bevriezen" en zou een nieuwe fout op dezelfde plek nooit verschijnen).
        const stillPresent = (iss: Issue): boolean =>
          (result.paragraphs[iss.paragraphIndex]?.text ?? "").indexOf(iss.original) !== -1;
        const resolved = prev.filter((iss) => iss.status !== "pending" && stillPresent(iss));
        const resolvedSigs = new Set(resolved.map(issueSignature));
        const fresh = result.issues.filter((iss) => !resolvedSigs.has(issueSignature(iss)));
        return [...resolved, ...fresh];
      });
      setScannedLang(lang);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("ready");
    }
  }, [lang]);

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
      // Alle tracked changes zijn teruggedraaid → onze toegepaste correcties bestaan niet meer in
      // het document. Zet die issues terug op 'pending' zodat de lijst klopt en ze opnieuw
      // toegepast kunnen worden.
      setIssues((prev) =>
        prev.map((iss) => (iss.status === "accepted" ? { ...iss, status: "pending" } : iss))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStatus("ready");
    }
  }, []);

  const setLang = useCallback((value: LangMode) => {
    setLangState(value);
    writeLangPref(value);
  }, []);

  // De wissel werkt pas door bij de volgende scan: toon een hint zolang de huidige resultaten in
  // een andere taalstand gescand zijn.
  const langStale = issues.length > 0 && scannedLang !== null && scannedLang !== lang;

  return {
    issues,
    status,
    error,
    lang,
    langStale,
    runScan,
    applyOne,
    applyAll,
    dismissOne,
    locate,
    acceptAllChanges,
    rejectAllChanges,
    setLang,
  };
}
