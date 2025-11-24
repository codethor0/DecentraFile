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
        command: "npm audit --audit-level=moderate",
        description: "Checking for known vulnerabilities in dependencies"
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
        console.log(`[FAIL] ${check.name} failed\n`);
        failed++;
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
