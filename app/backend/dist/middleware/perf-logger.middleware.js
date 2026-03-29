"use strict";
// =============================================================================
// MotoGuard — Performance Logger Middleware
// Logs slow requests (>500ms) and all errors to help identify bottlenecks
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfLogger = perfLogger;
const SLOW_THRESHOLD_MS = 500;
function perfLogger(req, res, next) {
    const start = Date.now();
    const { method, url } = req;
    res.on("finish", () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        // Always log errors
        if (status >= 400) {
            console.warn(`[PERF] ${method} ${url} → ${status} (${duration}ms)`);
            return;
        }
        // Log slow requests
        if (duration > SLOW_THRESHOLD_MS) {
            console.warn(`[PERF SLOW] ${method} ${url} → ${status} (${duration}ms) ⚠️`);
            return;
        }
        // Debug log for all requests (only in development)
        if (process.env.NODE_ENV !== "production") {
            console.log(`[PERF] ${method} ${url} → ${status} (${duration}ms)`);
        }
    });
    next();
}
//# sourceMappingURL=perf-logger.middleware.js.map