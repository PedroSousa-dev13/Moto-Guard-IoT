"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_service_1 = require("./prisma.service");
(0, vitest_1.describe)('PrismaService', () => {
    (0, vitest_1.it)('should export a prisma client instance', () => {
        (0, vitest_1.expect)(prisma_service_1.prisma).toBeDefined();
        (0, vitest_1.expect)(prisma_service_1.prisma.$connect).toBeDefined();
    });
    (0, vitest_1.it)('should export a pg pool instance', () => {
        (0, vitest_1.expect)(prisma_service_1.pool).toBeDefined();
        (0, vitest_1.expect)(prisma_service_1.pool.on).toBeDefined();
    });
});
//# sourceMappingURL=prisma.service.test.js.map