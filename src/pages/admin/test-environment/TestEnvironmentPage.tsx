import { useTestSuite } from "./hooks/useTestSuite";
import { TestSummaryHeader } from "./components/TestSummaryHeader";
import { TestCategoryCard } from "./components/TestCategoryCard";

export default function TestEnvironmentPage() {
  const { testSuites, suiteStates, getTestState, runTest, runSuite, runAll, abort, reset, isRunning, runningLabel, stats } = useTestSuite();

  const handleExport = () => {
    const rows: any[] = [];
    for (const suite of testSuites) {
      for (const test of suite.tests) {
        const state = getTestState(suite.id, test.id);
        rows.push({
          suite: suite.name,
          id: test.id,
          name: test.name,
          priority: test.priority,
          status: state.status,
          duration_ms: state.duration ?? "",
          details: state.details ?? "",
          error: state.error ?? "",
        });
      }
    }
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-results-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <TestSummaryHeader
        {...stats}
        isRunning={isRunning}
        runningLabel={runningLabel}
        onRunAll={runAll}
        onAbort={abort}
        onReset={reset}
        onExport={handleExport}
      />

      <div className="space-y-3">
        {testSuites.map((suite) => (
          <TestCategoryCard
            key={suite.id}
            suite={suite}
            suiteState={suiteStates[suite.id]}
            getTestState={getTestState}
            onRunSuite={() => runSuite(suite)}
            onRunTest={(testId) => {
              const test = suite.tests.find((t) => t.id === testId);
              if (test) runTest(suite, test);
            }}
            isRunning={isRunning}
          />
        ))}
      </div>
    </div>
  );
}
