import { useState } from "react";
import { ChevronDown, ChevronRight, Play } from "lucide-react";
import { TestSuite, TestStatus } from "../tests/types";
import { TestCaseResult } from "./TestCaseResult";
import { Progress } from "@/components/ui/progress";
import { SuiteState } from "../hooks/useTestSuite";

interface Props {
  suite: TestSuite;
  suiteState?: SuiteState;
  getTestState: (suiteId: string, testId: string) => { status: TestStatus; duration?: number; error?: string; details?: string };
  onRunSuite: () => void;
  onRunTest: (testId: string) => void;
  isRunning: boolean;
}

export function TestCategoryCard({ suite, getTestState, onRunSuite, onRunTest, isRunning }: Props) {
  const [expanded, setExpanded] = useState(false);

  const stats = suite.tests.reduce(
    (acc, t) => {
      const s = getTestState(suite.id, t.id).status;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = suite.tests.length;
  const passed = stats.passed || 0;
  const failed = stats.failed || 0;
  const completed = passed + failed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="border rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="text-lg">{suite.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{suite.name}</div>
          <div className="text-xs text-muted-foreground">{suite.description}</div>
        </div>
        <div className="flex items-center gap-3">
          {passed > 0 && <span className="text-xs text-green-600 font-medium">{passed}✓</span>}
          {failed > 0 && <span className="text-xs text-destructive font-medium">{failed}✗</span>}
          <span className="text-xs text-muted-foreground">{total} tests</span>
          <Progress value={pct} className="w-20 h-2" />
          <button
            onClick={(e) => { e.stopPropagation(); onRunSuite(); }}
            disabled={isRunning}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3 w-3" /> Run
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1">
          {suite.tests.map((test) => {
            const state = getTestState(suite.id, test.id);
            return (
              <TestCaseResult
                key={test.id}
                id={test.id}
                name={test.name}
                status={state.status}
                priority={test.priority}
                duration={state.duration}
                error={state.error}
                details={state.details}
                onRun={() => onRunTest(test.id)}
                isRunning={isRunning}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
