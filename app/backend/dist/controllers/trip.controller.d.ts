import { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
export declare function listTrips(req: AuthRequest, res: Response): Promise<void>;
export declare function getTrip(req: AuthRequest, res: Response): Promise<void>;
export declare function getTripEvaluation(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=trip.controller.d.ts.map