const {test, after, before} = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const {requestContext, healthRoutes, errorHandler, notFound} = require("./http");
let server;
let origin;
let databaseState = "ok";

before(async () => {
  const app = express();
  app.use(requestContext);
  const db = {collection: () => ({limit: () => ({select: () => ({get: () => {
    if (databaseState === "timeout") return new Promise(() => {});
    if (databaseState === "failed") return Promise.reject(new Error("private database detail"));
    return Promise.resolve({});
  }})})})};
  healthRoutes(app, db, 30);
  app.use(express.json({limit: "1kb"}));
  app.post("/api/example", (req, res) => res.status(429).json({error: "Please wait."}));
  app.use(notFound);
  app.use(errorHandler);
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("malformed JSON and oversized requests return safe correlated errors", async () => {
  const cases = [
    ["{", 400, "INVALID_REQUEST"],
    [JSON.stringify({text: "x".repeat(2000)}), 413, "PAYLOAD_TOO_LARGE"],
  ];
  for (const [body, status, code] of cases) {
    const response = await fetch(`${origin}/api/example`, {
      method: "POST", headers: {"Content-Type": "application/json"}, body,
    });
    const value = await response.json();
    assert.equal(response.status, status);
    assert.equal(value.code, code);
    assert.equal(value.requestId, response.headers.get("x-request-id"));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(value.stack, undefined);
  }
});

test("limits return Retry-After and unknown routes remain JSON", async () => {
  const limited = await fetch(`${origin}/api/example`, {method: "POST"});
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  const missing = await fetch(`${origin}/api/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "NOT_FOUND");
});

test("liveness survives dependency failure and readiness fails within its timeout", async () => {
  databaseState = "ok";
  assert.equal((await fetch(`${origin}/api/health/ready`)).status, 200);
  for (const state of ["failed", "timeout"]) {
    databaseState = state;
    assert.equal((await fetch(`${origin}/api/health/live`)).status, 200);
    const response = await fetch(`${origin}/api/health/ready`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).components.database, "unavailable");
  }
});
