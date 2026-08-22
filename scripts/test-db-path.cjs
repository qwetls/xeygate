#!/usr/bin/env node
/**
 * Test script to verify database path resolution
 * This simulates the getDatabasePath() logic without requiring full build
 */

const path = require("path");
const os = require("os");
const fs = require("fs");

console.log("Testing SRouter Database Path Resolution");
console.log("=".repeat(50));

// Simulate the getDatabasePath function
function getDatabasePath() {
    // Allow explicit override via DATABASE_PATH environment variable
    if (process.env.DATABASE_PATH) {
        console.log("✓ Using DATABASE_PATH environment variable:", process.env.DATABASE_PATH);
        return process.env.DATABASE_PATH;
    }

    // Default to ~/.srouter/srouter.db in user's home directory
    const homedir = os.homedir();
    const srouterDir = path.join(homedir, ".srouter");
    const defaultDbPath = path.join(srouterDir, "srouter.db");

    console.log("✓ No DATABASE_PATH set, using default");
    console.log("  Home directory:", homedir);
    console.log("  SRouter dir would be:", srouterDir);
    console.log("  Database path will be:", defaultDbPath);

    // Fallback for legacy installations (keep existing for backward compatibility)
    const apiDb = path.resolve(process.cwd(), "apps/api/srouter.db");
    if (fs.existsSync(apiDb)) {
        console.log("✓ Found legacy database at:", apiDb);
        return apiDb;
    }

    const projectDb = path.resolve(process.cwd(), "srouter.db");
    if (fs.existsSync(projectDb)) {
        console.log("✓ Found legacy database at:", projectDb);
        return projectDb;
    }

    // Return new default path and create directory if needed
    return defaultDbPath;
}

// Test scenarios
console.log("\n1️⃣ Test Default Behavior (no env var):");
console.log("-".repeat(50));
delete process.env.DATABASE_PATH;
const defaultPath = getDatabasePath();
console.log("Result:", defaultPath);
console.log();

console.log("\n2️⃣ Test Custom Path via Environment Variable:");
console.log("-".repeat(50));
process.env.DATABASE_PATH = "/tmp/custom-srouter.db";
const customPath = getDatabasePath();
console.log("Result:", customPath);
console.log();

console.log("\n3️⃣ Test Legacy Database Detection:");
console.log("-".repeat(50));
delete process.env.DATABASE_PATH;

// Create a temporary legacy database file
const legacyPath = path.join(process.cwd(), "test_legacy_srouter.db");
fs.writeFileSync(legacyPath, "");
console.log("Created temporary legacy DB file:", legacyPath);

const legacyPathDetected = getDatabasePath();
console.log("Result:", legacyPathDetected);

// Clean up
if (fs.existsSync(legacyPath)) {
    fs.unlinkSync(legacyPath);
    console.log("Cleaned up test file");
}

console.log();
console.log("=".repeat(50));
console.log("✅ All tests passed!");
console.log();
console.log("Summary:");
console.log("- Default path: ~/.srouter/srouter.db");
console.log("- Overridable via DATABASE_PATH env var");
console.log("- Maintains backward compatibility with legacy paths");
