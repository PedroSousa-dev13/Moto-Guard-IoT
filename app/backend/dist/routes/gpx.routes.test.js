"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const index_1 = require("../index");
vitest_1.vi.mock('../controllers/gpx.controller', () => ({
    importGpx: (req, res) => res.status(200).json({ success: true }),
    parseGpxFile: (req, res) => res.status(200).json({ success: true, waypoints: [] }),
    exportTripGpx: (req, res) => res.status(200).send('GPX DATA'),
}));
vitest_1.vi.mock('../middleware/auth.middleware', () => ({
    authMiddleware: (req, res, next) => {
        req.userId = 'test-user-id';
        next();
    },
}));
(0, vitest_1.describe)('Gpx Routes', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should import GPX file', async () => {
        const response = await (0, supertest_1.default)(index_1.app)
            .post('/api/gpx/import')
            .attach('file', Buffer.from('<gpx></gpx>'), 'test.gpx');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.success).toBe(true);
    });
    (0, vitest_1.it)('should parse GPX file', async () => {
        const response = await (0, supertest_1.default)(index_1.app)
            .post('/api/gpx/parse')
            .attach('file', Buffer.from('<gpx></gpx>'), 'test.gpx');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.body.waypoints).toBeDefined();
    });
    (0, vitest_1.it)('should export GPX file', async () => {
        const response = await (0, supertest_1.default)(index_1.app).get('/api/gpx/export/t1');
        (0, vitest_1.expect)(response.status).toBe(200);
        (0, vitest_1.expect)(response.text).toBe('GPX DATA');
    });
});
//# sourceMappingURL=gpx.routes.test.js.map