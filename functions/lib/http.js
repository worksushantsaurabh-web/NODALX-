const crypto = require("node:crypto");
const {AsyncLocalStorage} = require("node:async_hooks");
const requestStore = new AsyncLocalStorage();

const logFailure = (event) => {
  console.error(JSON.stringify({event, requestId: requestStore.getStore()?.requestId}));
};

const ERROR_CODES = {
  400: "INVALID_REQUEST",
  401: "UNAUTHENTICATED",
  402: "PLAN_REQUIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  410: "ENDPOINT_RETIRED",
  413: "PAYLOAD_TOO_LARGE",
  429: "LIMIT_EXCEEDED",
  502: "UPSTREAM_UNAVAILABLE",
  503: "SERVICE_UNAVAILABLE",
};

const requestContext = (req, res, next) => {
  const started = Date.now();
  req.requestId = crypto.randomUUID();
  res.set("X-Request-ID", req.requestId);
  res.set("Cache-Control", "private, no-store");
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && typeof body?.error === "string") {
      body = {...body, code: ERROR_CODES[res.statusCode] || "INTERNAL_ERROR", requestId: req.requestId};
      if (res.statusCode === 429) res.set("Retry-After", "60");
    }
    return json(body);
  };
  res.on("finish", () => {
    console.info(JSON.stringify({
      event: "api_request",
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path || "unmatched",
      status: res.statusCode,
      durationMs: Date.now() - started,
    }));
  });
  requestStore.run({requestId: req.requestId}, next);
};

const healthRoutes = (app, db, timeoutMs = 3000) => {
  app.get("/api/health/live", (req, res) => res.json({status: "ok"}));
  const ready = async (req, res) => {
    let timer;
    try {
      await Promise.race([
        db.collection("inquiries").limit(1).select().get(),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Health timeout")), timeoutMs);
        }),
      ]);
      res.json({status: "ok", components: {database: "ok"}});
    } catch {
      res.status(503).json({error: "Database is unavailable.", components: {database: "unavailable"}});
    } finally {
      clearTimeout(timer);
    }
  };
  app.get("/api/health/ready", ready);
  app.get("/api/health", ready);
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({error: "The request is too large."});
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({error: "Invalid JSON. Send a valid JSON object."});
  }
  console.error(JSON.stringify({event: "api_error", requestId: req.requestId, code: "INTERNAL_ERROR"}));
  return res.status(500).json({error: "The request could not be completed."});
};

const notFound = (req, res) => res.status(404).json({error: "Endpoint not found."});

module.exports = {requestContext, healthRoutes, errorHandler, notFound, logFailure};
