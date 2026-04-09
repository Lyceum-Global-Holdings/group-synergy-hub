export type TestStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
export type TestPriority = 'critical' | 'high' | 'medium';

export interface TestCase {
  id: string;
  name: string;
  category: string;
  priority: TestPriority;
  description: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  details?: string;
  run: () => Promise<TestResult>;
}

export interface TestResult {
  passed: boolean;
  details?: string;
  error?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  icon: string;
  tests: TestCase[];
}
