import { useState, useCallback, useRef } from "react";
import { testSuites } from "../tests";
import { TestCase, TestStatus, TestSuite } from "../tests/types";

export interface SuiteState {
  id: string;
  tests: Record<string, { status: TestStatus; duration?: number; error?: string; details?: string }>;
}

export function useTestSuite() {
  const [suiteStates, setSuiteStates] = useState<Record<string, SuiteState>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [runningLabel, setRunningLabel] = useState("");
  const abortRef = useRef(false);

  const getTestState = (suiteId: string, testId: string) =>
    suiteStates[suiteId]?.tests[testId] || { status: "idle" as TestStatus };

  const updateTest = useCallback((suiteId: string, testId: string, patch: Partial<SuiteState["tests"][string]>) => {
    setSuiteStates((prev) => ({
      ...prev,
      [suiteId]: {
        ...prev[suiteId],
        id: suiteId,
        tests: { ...prev[suiteId]?.tests, [testId]: { ...prev[suiteId]?.tests?.[testId], status: "idle", ...patch } },
      },
    }));
  }, []);

  const runTest = useCallback(async (suite: TestSuite, test: TestCase) => {
    updateTest(suite.id, test.id, { status: "running", error: undefined, details: undefined, duration: undefined });
    const start = performance.now();
    try {
      const result = await test.run();
      const duration = Math.round(performance.now() - start);
      updateTest(suite.id, test.id, {
        status: result.passed ? "passed" : "failed",
        duration,
        error: result.error,
        details: result.details,
      });
      return result.passed;
    } catch (e: any) {
      const duration = Math.round(performance.now() - start);
      updateTest(suite.id, test.id, { status: "failed", duration, error: e.message || "Unknown error" });
      return false;
    }
  }, [updateTest]);

  const runSuite = useCallback(async (suite: TestSuite) => {
    setIsRunning(true);
    setRunningLabel(suite.name);
    abortRef.current = false;
    for (const test of suite.tests) {
      if (abortRef.current) break;
      await runTest(suite, test);
    }
    setIsRunning(false);
    setRunningLabel("");
  }, [runTest]);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setRunningLabel("All Suites");
    abortRef.current = false;
    for (const suite of testSuites) {
      if (abortRef.current) break;
      setRunningLabel(suite.name);
      for (const test of suite.tests) {
        if (abortRef.current) break;
        await runTest(suite, test);
      }
    }
    setIsRunning(false);
    setRunningLabel("");
  }, [runTest]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setSuiteStates({});
    abortRef.current = false;
    setIsRunning(false);
  }, []);

  // Summary stats
  const stats = (() => {
    let total = 0, passed = 0, failed = 0, running = 0, skipped = 0;
    for (const suite of testSuites) {
      for (const test of suite.tests) {
        total++;
        const s = getTestState(suite.id, test.id).status;
        if (s === "passed") passed++;
        else if (s === "failed") failed++;
        else if (s === "running") running++;
        else skipped++;
      }
    }
    return { total, passed, failed, running, idle: skipped };
  })();

  return { suiteStates, getTestState, runTest, runSuite, runAll, abort, reset, isRunning, runningLabel, stats, testSuites };
}
