#!/usr/bin/env node

/*
 * Project: DecentraFile
 * Author: Thor Thor
 * Contact: codethor@gmail.com
 * LinkedIn: https://www.linkedin.com/in/thor-thor0
 */

/**
 * Security Audit Script
 * Runs various security checks on the codebase
 */

const { execSync } = require("child_process");

console.log("Starting Security Audit...\n");

const checks = [
    {
        name: "npm audit",
        command: "npm audit --audit-level=high",
        description: "Checking for known vulnerabilities in dependencies",
        allowUnfixable: true
    },
    {
        name: "ESLint",
        command: "npm run lint:js",
        description: "Running JavaScript linting"
    },
    {
        name: "Solhint",
        command: "npm run lint:sol",
        description: "Running Solidity linting"
    },
    {
        name: "Test Coverage",
        command: "npm run test:coverage",
        description: "Checking test coverage"
    }
];

let passed = 0;
let failed = 0;

checks.forEach((check, index) => {
    console.log(`[${index + 1}/${checks.length}] ${check.name}: ${check.description}`);

    try {
        execSync(check.command, { stdio: "inherit" });
        console.log(`[PASS] ${check.name} passed\n`);
        passed++;
    } catch (error) {
        // For npm audit, check if failures are due to unfixable vulnerabilities
        if (check.name === "npm audit" && check.allowUnfixable) {
            try {
                // npm audit --json exits with code 1 when vulnerabilities exist, but still outputs JSON
                let auditOutput;
                try {
                    auditOutput = execSync("npm audit --json", { encoding: "utf8", stdio: "pipe" });
                } catch (auditError) {
                    // npm audit --json still exits with code 1, but outputs JSON to stderr or stdout
                    auditOutput = auditError.stdout || auditError.stderr || "";
                }
                const auditJson = JSON.parse(auditOutput);
                const highVulns = Object.values(auditJson.vulnerabilities || {}).filter(
                    vuln => vuln.severity === "high"
                );
                // Check if any high severity vulnerabilities are fixable without breaking changes
                const hasFixableHigh = highVulns.some(
                    vuln => vuln.fixAvailable && vuln.fixAvailable !== false && !vuln.fixAvailable.isSemVerMajor
                );
                if (!hasFixableHigh && highVulns.length > 0) {
                    console.log(`[WARN] ${check.name} found ${highVulns.length} high severity vulnerabilities, but all require breaking changes or have no fix available\n`);
                    passed++;
                } else if (hasFixableHigh) {
                    console.log(`[FAIL] ${check.name} failed (fixable high severity vulnerabilities found)\n`);
                    failed++;
                } else {
                    console.log(`[WARN] ${check.name} found vulnerabilities but none are high severity\n`);
                    passed++;
                }
            } catch (parseError) {
                console.log(`[FAIL] ${check.name} failed (could not parse audit results: ${parseError.message})\n`);
                failed++;
            }
        } else {
            console.log(`[FAIL] ${check.name} failed\n`);
            failed++;
        }
    }
});

console.log("\n" + "=".repeat(50));
console.log("Security Audit Summary:");
console.log(`[PASS] Passed: ${passed}`);
console.log(`[FAIL] Failed: ${failed}`);
console.log("=".repeat(50));

if (failed > 0) {
    console.log("\n[WARN] Some security checks failed. Please review and fix issues before deployment.");
    process.exit(1);
} else {
    console.log("\n[PASS] All security checks passed!");
    process.exit(0);
}
