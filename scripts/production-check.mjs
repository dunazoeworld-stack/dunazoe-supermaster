const baseUrl = process.env.PRODUCTION_CHECK_URL || "http://127.0.0.1:5000";
const checks = [
  ["/api/products", response => response.ok],
  ["/p/dc-solar-bulb-e6b55aef1b", response => response.ok],
];

let failed = false;
for (const [path, predicate] of checks) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(10000) });
    const passed = predicate(response);
    console.log(`${passed ? "PASS" : "FAIL"} ${response.status} ${path}`);
    if (!passed) failed = true;
  } catch (error) {
    console.log(`FAIL ${path} ${error.message}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;