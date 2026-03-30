/**
 * P6.8: Production smoke test
 * Usage: npx tsx scripts/smoke-test.ts [base-url]
 * Default: http://localhost:3000
 */
const BASE_URL = process.argv[2] || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  status?: number;
  error?: string;
}

async function check(name: string, url: string, expectedStatus: number): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      redirect: "manual",
      headers: { "User-Agent": "SmokeTest/1.0" },
    });
    const passed = response.status === expectedStatus;
    return { name, passed, status: response.status, error: passed ? undefined : `Expected ${expectedStatus}, got ${response.status}` };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

async function checkJson(name: string, url: string): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: { "User-Agent": "SmokeTest/1.0" },
    });
    if (!response.ok) {
      return { name, passed: false, status: response.status, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { name, passed: true, status: response.status };
  } catch (error) {
    return { name, passed: false, error: String(error) };
  }
}

async function main() {
  console.log(`\nSmoke testing: ${BASE_URL}\n`);

  const results: TestResult[] = await Promise.all([
    checkJson("Health check", "/api/health"),
    check("Landing page loads", "/", 200),
    check("Login page loads", "/login", 200),
    check("Signup page loads", "/signup", 200),
    check("Dashboard redirects to login (unauthed)", "/dashboard", 307),
    check("API auth required (matches)", "/api/matches", 401),
    check("API auth required (conversations)", "/api/conversations", 401),
    check("API auth required (profile)", "/api/profile", 401),
  ]);

  let allPassed = true;
  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const status = result.status ? ` [${result.status}]` : "";
    const error = result.error ? ` — ${result.error}` : "";
    console.log(`  ${icon} ${result.name}${status}${error}`);
    if (!result.passed) allPassed = false;
  }

  console.log(`\n${allPassed ? "All checks passed!" : "Some checks failed."}\n`);
  process.exit(allPassed ? 0 : 1);
}

main();
