import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
export declare function getLatestTelemetry(_req: Request, res: Response): void;
export declare function getTripTelemetry(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=telemetry.controller.d.ts.map