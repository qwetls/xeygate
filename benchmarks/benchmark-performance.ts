#!/usr/bin/env node
/**
 * Performance Benchmark for SRouter Optimizations
 * Compares original vs optimized implementations
 */

import { performance, PerformanceObserver } from 'perf_hooks';
import { FastBuffer, StringBuilder } from './packages/executors/src/optimized-stream.js';

// Memory tracking helper
const getMemoryUsage = () => {
    const usage = process.memoryUsage();
    return {
        heapUsedMB: (usage.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (usage.heapTotal / 1024 / 1024).toFixed(2),
        externalMB: (usage.external / 1024 / 1024).toFixed(2)
    };
};

// Test 1: Buffer Allocation Performance
function testBufferAllocations() {
    console.log("\n=== TEST 1: Buffer Allocation Efficiency ===");
    
    // Original pattern (O(n²))
    function originalPattern(numChunks: number): void {
        let buffer = new Uint8Array(0);
        
        for (let i = 0; i < numChunks; i++) {
            const chunk = new Uint8Array(1024);
            const combined = new Uint8Array(buffer.length + chunk.length);
            combined.set(buffer);
            combined.set(chunk, buffer.length);
            buffer = combined;
        }
    }
    
    // Optimized pattern (O(n))
    function optimizedPattern(numChunks: number): void {
        const buffer = new FastBuffer(1024);
        
        for (let i = 0; i < numChunks; i++) {
            const chunk = new Uint8Array(1024);
            buffer.append(chunk);
        }
    }
    
    const numChunks = 1000;
    const iterations = 10;
    
    console.log(`Testing with ${numChunks} chunks of 1KB each...`);
    console.log(`Running ${iterations} iterations...\n`);
    
    // Test original
    performance.mark('original-start');
    for (let i = 0; i < iterations; i++) {
        originalPattern(numChunks);
    }
    performance.mark('original-end');
    const originalTime = performance.measure('original', 'original-start', 'original-end').duration;
    
    // Test optimized
    performance.mark('optimized-start');
    for (let i = 0; i < iterations; i++) {
        optimizedPattern(numChunks);
    }
    performance.mark('optimized-end');
    const optimizedTime = performance.measure('optimized', 'optimized-start', 'optimized-end').duration;
    
    console.log("Results:");
    console.log(`Original implementation: ${originalTime.toFixed(2)}ms`);
    console.log(`Optimized implementation: ${optimizedTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(originalTime / optimizedTime).toFixed(2)}x`);
    console.log(`Improvement: ${((1 - optimizedTime / originalTime) * 100).toFixed(2)}% faster`);
    
    performance.clearMeasurements();
}

// Test 2: String Concatenation Performance
function testStringConcatenation() {
    console.log("\n=== TEST 2: String Concatenation Efficiency ===");
    
    // Original pattern
    function originalPattern(numLines: number): string {
        let buffer = "";
        
        for (let i = 0; i < numLines; i++) {
            buffer += "This is line " + i + " with some content to make it longer.\n";
        }
        
        return buffer;
    }
    
    // Optimized pattern
    function optimizedPattern(numLines: number): string {
        const builder = new StringBuilder();
        
        for (let i = 0; i < numLines; i++) {
            builder.append("This is line " + i + " with some content to make it longer.\n");
        }
        
        return builder.toString();
    }
    
    const numLines = 5000;
    const iterations = 5;
    
    console.log(`Testing with ${numLines} lines of text...`);
    console.log(`Running ${iterations} iterations...\n`);
    
    // Test original
    performance.mark('str-original-start');
    for (let i = 0; i < iterations; i++) {
        originalPattern(numLines);
    }
    performance.mark('str-original-end');
    const strOriginalTime = performance.measure('str-original', 'str-original-start', 'str-original-end').duration;
    
    // Test optimized
    performance.mark('str-optimized-start');
    for (let i = 0; i < iterations; i++) {
        optimizedPattern(numLines);
    }
    performance.mark('str-optimized-end');
    const strOptimizedTime = performance.measure('str-optimized', 'str-optimized-start', 'str-optimized-end').duration;
    
    console.log("Results:");
    console.log(`Original implementation: ${strOriginalTime.toFixed(2)}ms`);
    console.log(`Optimized implementation: ${strOptimizedTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(strOriginalTime / strOptimizedTime).toFixed(2)}x`);
    console.log(`Improvement: ${((1 - strOptimizedTime / strOriginalTime) * 100).toFixed(2)}% faster`);
    
    performance.clearMeasurements();
}

// Test 3: Memory Churn Test
function testMemoryChurn(numIterations: number = 100): void {
    console.log("\n=== TEST 3: Memory Churn Analysis ===");
    
    const memorySamples: Record<string, number> = {};
    
    for (let iter = 0; iter < numIterations; iter++) {
        // Simulate stream processing
        const buffer = new FastBuffer(4 * 1024);
        
        for (let chunkIdx = 0; chunkIdx < 100; chunkIdx++) {
            const chunk = new Uint8Array(Math.random() * 1024 + 256);
            buffer.append(chunk);
            
            // Clear buffer after each "frame" simulation
            if (chunkIdx % 10 === 0) {
                buffer.clear();
            }
        }
    }
    
    const finalMemory = getMemoryUsage();
    console.log(`After ${numIterations} iterations of stream simulation:`);
    console.log(`Final heap used: ${finalMemory.heapUsedMB} MB`);
    console.log(`Expected heap churn: Low (buffer reuse)`);
}

// Test 4: CRC32 Lookup Table Performance
function testCrc32Performance(iterations: number = 10000): void {
    console.log("\n=== TEST 4: CRC32 Calculation Performance ===");
    
    // Simple CRC32 (original)
    function crc32Simple(data: Uint8Array): number {
        let crc = 0xffffffff;
        for (const byte of data) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) {
                crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
            }
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    
    // Pre-computed table CRC32 (optimized)
    class Crc32Optimized {
        private static table: Uint32Array | null = null;
        
        private static initTable(): void {
            if (Crc32Optimized.table) return;
            
            const table = new Uint32Array(256);
            for (let i = 0; i < 256; i++) {
                let crc = i << 24;
                for (let j = 0; j < 8; j++) {
                    crc = (crc & 0x80000000) 
                        ? ((crc << 1) ^ 0x04c11db7)
                        : (crc << 1);
                }
                table[i] = crc >>> 0;
            }
            Crc32Optimized.table = table;
        }

        static calculate(data: Uint8Array): number {
            Crc32Optimized.initTable();
            
            let crc = 0xffffffff;
            const table = Crc32Optimized.table!;
            
            for (let i = 0; i < data.length; i++) {
                const byte = data[i];
                const index = ((crc >>> 24) ^ byte) & 0xff;
                crc = (crc << 8) ^ table[index];
            }
            
            return (crc ^ 0xffffffff) >>> 0;
        }
    }
    
    const testData = new Uint8Array(1024);
    for (let i = 0; i < testData.length; i++) {
        testData[i] = Math.floor(Math.random() * 256);
    }
    
    console.log(`Calculating CRC32 ${iterations} times on 1KB data...\n`);
    
    // Test simple CRC32
    performance.mark('crc-simple-start');
    for (let i = 0; i < iterations; i++) {
        crc32Simple(testData);
    }
    performance.mark('crc-simple-end');
    const simpleTime = performance.measure('crc-simple', 'crc-simple-start', 'crc-simple-end').duration;
    
    // Test optimized CRC32
    performance.mark('crc-optimized-start');
    for (let i = 0; i < iterations; i++) {
        Crc32Optimized.calculate(testData);
    }
    performance.mark('crc-optimized-end');
    const optimizedTime = performance.measure('crc-optimized', 'crc-optimized-start', 'crc-optimized-end').duration;
    
    console.log("Results:");
    console.log(`Simple CRC32: ${simpleTime.toFixed(2)}ms`);
    console.log(`Optimized CRC32: ${optimizedTime.toFixed(2)}ms`);
    console.log(`Speedup: ${(simpleTime / optimizedTime).toFixed(2)}x`);
    console.log(`Improvement: ${((1 - optimizedTime / simpleTime) * 100).toFixed(2)}% faster`);
    
    performance.clearMeasurements();
}

// Main execution
async function runBenchmarks(): Promise<void> {
    console.log("=" .repeat(60));
    console.log("SROUTER PERFORMANCE BENCHMARK SUITE");
    console.log("=" .repeat(60));
    
    const memoryBefore = getMemoryUsage();
    console.log(`\nInitial memory state: ${memoryBefore.heapUsedMB} MB heap used`);
    
    try {
        testBufferAllocations();
        testStringConcatenation();
        testCrc32Performance(5000);
        testMemoryChurn(200);
        
        const memoryAfter = getMemoryUsage();
        console.log("\n" + "=".repeat(60));
        console.log("FINAL MEMORY STATE");
        console.log("=".repeat(60));
        console.log(`Final heap used: ${memoryAfter.heapUsedMB} MB`);
        console.log(`Δ Heap: ${((parseFloat(memoryAfter.heapUsedMB) - parseFloat(memoryBefore.heapUsedMB)).toFixed(2)} MB`);
        console.log("Memory leak detection: If Δ Heap > 10MB, investigate potential leaks");
        
    } catch (error) {
        console.error("Benchmark error:", error);
        process.exit(1);
    }
}

runBenchmarks().catch(console.error);
