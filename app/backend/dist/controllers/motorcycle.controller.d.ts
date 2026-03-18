import { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
export declare function createMotorcycle(req: AuthRequest, res: Response): Promise<void>;
export declare function listMotorcycles(req: AuthRequest, res: Response): Promise<void>;
export declare function listProfiles(_req: AuthRequest, res: Response): Promise<void>;
export declare function updateMotorcycle(req: AuthRequest, res: Response): Promise<void>;
export declare function deleteMotorcycle(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=motorcycle.controller.d.ts.map