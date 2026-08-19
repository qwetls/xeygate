import assert from "node:assert/strict";
import { test } from "node:test";
import { CircuitBreaker } from "../src/circuitBreaker.js";

test("CircuitBreaker initial state is healthy and available", () => {
    const cb = new CircuitBreaker(1000);
    assert.equal(cb.isAvailable("p1"), true);
    const health = cb.getHealth("p1");
    assert.equal(health.state, "healthy");
    assert.equal(health.consecutiveFailures, 0);
});

test("CircuitBreaker transitions to cooldown on rate limit error", () => {
    const cb = new CircuitBreaker(1000);
    cb.recordFailure("p1", new Error("Rate limit exceeded 429"), 500);

    assert.equal(cb.isAvailable("p1"), false);
    const health = cb.getHealth("p1");
    assert.equal(health.state, "cooldown");
    assert.equal(health.consecutiveFailures, 1);
    assert.ok(health.cooldownUntil && health.cooldownUntil > Date.now());
});

test("CircuitBreaker transitions to exhausted after 5 non-rate-limit consecutive failures", () => {
    const cb = new CircuitBreaker(1000);
    for (let i = 1; i <= 5; i++) {
        cb.recordFailure("p2", new Error("Internal Server Error 500"));
    }

    assert.equal(cb.isAvailable("p2"), false);
    const health = cb.getHealth("p2");
    assert.equal(health.state, "exhausted");
    assert.equal(health.consecutiveFailures, 5);
});

test("CircuitBreaker recovers to healthy on recordSuccess or reset", () => {
    const cb = new CircuitBreaker(1000);
    cb.recordFailure("p3", new Error("Rate limit"));
    assert.equal(cb.isAvailable("p3"), false);

    cb.recordSuccess("p3");
    assert.equal(cb.isAvailable("p3"), true);
    assert.equal(cb.getHealth("p3").state, "healthy");
    assert.equal(cb.getHealth("p3").consecutiveFailures, 0);

    cb.recordFailure("p3", new Error("Fail"));
    cb.reset("p3");
    assert.equal(cb.isAvailable("p3"), true);
});

test("CircuitBreaker sorts candidates by health prioritizing healthy providers", () => {
    const cb = new CircuitBreaker(1000);
    const candidates = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];

    cb.recordFailure("p1", new Error("Rate limit"), 2000);
    cb.recordFailure("p2", new Error("Rate limit"), 500);

    // p3 is healthy, should be returned first
    const sorted = cb.sortCandidatesByHealth(candidates);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0]?.id, "p3");

    // When all are in cooldown, returns shortest cooldown first (p2 before p1)
    cb.recordFailure("p3", new Error("Rate limit"), 10000);
    const allCooldownSorted = cb.sortCandidatesByHealth(candidates);
    assert.equal(allCooldownSorted.length, 3);
    assert.equal(allCooldownSorted[0]?.id, "p2");
    assert.equal(allCooldownSorted[1]?.id, "p1");
    assert.equal(allCooldownSorted[2]?.id, "p3");
});
