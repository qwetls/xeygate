#!/usr/bin/env node
/**
 * Database Migration Helper
 * Moves existing databases to ~/.srouter/srouter.db
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

console.log("=".repeat(60));
console.log("SRouter Database Migration Tool");
console.log("=".repeat(60));
console.log();

// Check if already in new location
const homedir = os.homedir();
const newDbPath = path.join(homedir, '.srouter', 'srouter.db');
const legacyApiPath = path.join(process.cwd(), 'apps/api/srouter.db');
const legacyRootPath = path.join(process.cwd(), 'srouter.db');

console.log("Current working directory:", process.cwd());
console.log();

// Check for existing databases
let legacyFound = false;
let dbPaths = [];

if (fs.existsSync(newDbPath)) {
    const size = fs.statSync(newDbPath).size;
    console.log(`✅ Database already exists at new location:`);
    console.log(`   ${newDbPath}`);
    console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
    console.log();
    console.log("No migration needed - you're already using the new location!");
    process.exit(0);
}

if (fs.existsSync(legacyApiPath)) {
    legacyFound = true;
    const size = fs.statSync(legacyApiPath).size;
    dbPaths.push({
        name: "Legacy (apps/api/)",
        path: legacyApiPath,
        size: size
    });
    console.log(`📁 Found database at legacy location:`);
    console.log(`   ${legacyApiPath}`);
    console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
    console.log();
}

if (fs.existsSync(legacyRootPath)) {
    legacyFound = true;
    const size = fs.statSync(legacyRootPath).size;
    dbPaths.push({
        name: "Legacy (root)",
        path: legacyRootPath,
        size: size
    });
    console.log(`📁 Found database at root location:`);
    console.log(`   ${legacyRootPath}`);
    console.log(`   Size: ${(size / 1024).toFixed(2)} KB`);
    console.log();
}

if (!legacyFound) {
    console.log("ℹ️ No existing database found.");
    console.log();
    console.log("Creating new database location...");
    
    // Create new directory
    const srouterDir = path.join(homedir, '.srouter');
    if (!fs.existsSync(srouterDir)) {
        fs.mkdirSync(srouterDir, { recursive: true, mode: 0o700 });
        console.log(`✅ Created directory: ${srouterDir}`);
    } else {
        console.log(`ℹ️ Directory already exists: ${srouterDir}`);
    }
    
    console.log();
    console.log("Your database will be created at:");
    console.log(`   ${newDbPath}`);
    console.log();
    console.log("When you start SRouter, it will automatically use this location.");
    process.exit(0);
}

// Get first database if multiple found
const sourceDb = dbPaths[0];

console.log("=" .repeat(60));
console.log("Migration Summary");
console.log("=".repeat(60));
console.log();
console.log(`Source: ${sourceDb.name}`);
console.log(`      ${sourceDb.path}`);
console.log();
console.log(`Destination: ~/.srouter/srouter.db`);
console.log();
console.log(`Size: ${(sourceDb.size / 1024).toFixed(2)} KB`);
console.log();

// Ask for confirmation
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

readline.question("Do you want to migrate this database? (y/n): ", async (answer) => {
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
        console.log();
        console.log("Migration cancelled.");
        console.log();
        console.log("To migrate later, run this script again:");
        console.log("  node scripts/migrate-db.js");
        process.exit(0);
    }
    
    try {
        console.log();
        console.log("Starting migration...");
        
        // Create destination directory
        const srouterDir = path.join(homedir, '.srouter');
        if (!fs.existsSync(srouterDir)) {
            fs.mkdirSync(srouterDir, { recursive: true, mode: 0o700 });
            console.log(`✓ Created directory: ${srouterDir}`);
        }
        
        // Copy database file
        console.log(`✓ Copying database...`);
        fs.copyFileSync(sourceDb.path, newDbPath);
        
        // Set permissions
        console.log(`✓ Setting permissions...`);
        fs.chmodSync(newDbPath, 0o600);
        fs.chmodSync(srouterDir, 0o700);
        
        console.log();
        console.log("=".repeat(60));
        console.log("Migration Complete! ✓");
        console.log("=".repeat(60));
        console.log();
        console.log(`Database moved to: ${newDbPath}`);
        console.log();
        console.log("Next steps:");
        console.log("1. Create/update .env file with: DATABASE_PATH=~/.srouter/srouter.db");
        console.log("2. Restart SRouter");
        console.log();
        console.log("Example .env:");
        echo('DATABASE_PATH=~/.srouter/srouter.db');
        console.log();
        console.log("Note: Your legacy database is still at the old location.");
        console.log("You can delete it after verifying the migration worked.");
        
    } catch (error) {
        console.error();
        console.error("❌ Migration failed!");
        console.error(error.message);
        process.exit(1);
    }
});
