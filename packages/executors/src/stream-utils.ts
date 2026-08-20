// Streaming utilities with efficient buffer management

/**
 * FastBuffer: Efficient byte buffer that minimizes allocations
 */
export class FastBuffer {
    private buffer: Uint8Array;
    private offset: number = 0;
    private capacity: number;

    constructor(initialCapacity: number = 1024) {
        this.buffer = new Uint8Array(initialCapacity);
        this.capacity = initialCapacity;
    }

    /**
     * Append bytes without immediate allocation
     */
    append(value: Uint8Array): void {
        const required = this.offset + value.length;

        // Grow only when necessary
        if (required > this.capacity) {
            this.grow(Math.max(required, this.capacity * 2));
        }

        this.buffer.set(value, this.offset);
        this.offset += value.length;
    }

    /**
     * Get readable portion as new Uint8Array
     */
    slice(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }

    /**
     * Consume n bytes from buffer
     */
    consume(n: number): Uint8Array {
        const result = this.buffer.subarray(this.offset, this.offset + n);
        this.offset += n;
        return result;
    }

    /**
     * Reset buffer for reuse
     */
    clear(): void {
        this.offset = 0;
    }

    /**
     * Grow buffer capacity with exponential strategy
     */
    private grow(newCapacity: number): void {
        const newBuffer = new Uint8Array(newCapacity);
        newBuffer.set(this.buffer.subarray(0, this.offset));
        this.buffer = newBuffer;
        this.capacity = newCapacity;
    }

    /**
     * Current readable length
     */
    get length(): number {
        return this.offset;
    }

    /**
     * Whether buffer has space for more data
     */
    get isFull(): boolean {
        return this.offset >= this.capacity;
    }

    /**
     * Get internal buffer reference for DataView access
     */
    get internalBuffer(): Uint8Array {
        return this.buffer;
    }
}

/**
 * String builder pattern for efficient string accumulation
 */
export class StringBuilder {
    private chunks: string[] = [];
    private currentLength: number = 0;

    append(str: string): void {
        this.chunks.push(str);
        this.currentLength += str.length;
    }

    toString(): string {
        return this.chunks.join("");
    }

    clear(): void {
        this.chunks = [];
        this.currentLength = 0;
    }
}

/**
 * Stream reader with pre-allocated buffers
 */
export async function streamFrames(
    body: ReadableStream<Uint8Array>,
    onFrame: (frame: Uint8Array) => void
): Promise<void> {
    const reader = body.getReader();

    // Pre-allocate single buffer that grows as needed
    const buffer = new FastBuffer(4 * 1024); // Start with 4KB

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            if (value?.length) {
                buffer.append(value);
            }

            // Process complete frames from buffer
            let offset = 0;
            while (buffer.length - offset >= 12) {
                // Peek at frame length without consuming
                const view = new DataView(
                    buffer.internalBuffer.buffer,
                    buffer.internalBuffer.byteOffset + offset,
                    buffer.length - offset
                );

                const totalLength = view.getUint32(0, false);

                if (totalLength < 16 || totalLength > 24 * 1024 * 1024) {
                    throw new Error("Invalid AWS EventStream frame bounds");
                }

                if (buffer.length - offset < totalLength) {
                    break; // Wait for more data
                }

                // Extract and process frame
                const frame = buffer.consume(totalLength);
                onFrame(frame);
            }
        }

        // Check for truncated data
        if (buffer.length !== 0) {
            throw new Error("Stream ended with incomplete frame");
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Line stream processor with StringBuilder
 */
export async function* streamLines(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");

    // Use StringBuilder instead of string concatenation
    const pendingText = new StringBuilder();

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            if (value?.length) {
                // Convert to string once per chunk
                const chunkStr = decoder.decode(value, { stream: true });
                pendingText.append(chunkStr);
            }

            // Split into lines using StringBuilder's internal representation
            const fullText = pendingText.toString();
            const lines = fullText.split("\n");

            // Keep last incomplete line
            if (lines.length > 0) {
                const lastLine = lines.pop() ?? "";
                pendingText.clear();
                pendingText.append(lastLine);
            } else {
                pendingText.clear();
            }

            // Yield non-empty trimmed lines
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed) {
                    yield trimmed;
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Stream line processor for CommandCode NDJSON streams
 */
export async function* streamCommandCodeLines(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, void> {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");

    // Pre-allocate buffer for string building
    const lineBuffer = new StringBuilder();

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                // Flush any remaining content
                const finalText = lineBuffer.toString().trim();
                if (finalText) {
                    yield finalText;
                }
                break;
            }

            if (value?.length) {
                const decoded = decoder.decode(value, { stream: true });
                lineBuffer.append(decoded);
            }

            // Find all complete lines in one pass
            const text = lineBuffer.toString();
            const newlineIndex = text.indexOf("\n");

            if (newlineIndex === -1) {
                // No complete line yet
                continue;
            }

            // Extract complete line and keep remainder
            const completeLine = text.substring(0, newlineIndex);
            const remainder = text.substring(newlineIndex + 1);

            lineBuffer.clear();
            lineBuffer.append(remainder);

            const trimmed = completeLine.trim();
            if (trimmed) {
                yield trimmed;
            }
        }
    } finally {
        reader.releaseLock();
    }
}
