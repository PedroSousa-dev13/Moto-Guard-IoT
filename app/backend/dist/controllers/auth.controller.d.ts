import { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
export declare function register(req: Request, res: Response): Promise<void>;
export declare function login(req: Request, res: Response): Promise<void>;
export declare function me(req: AuthRequest, res: Response): Promise<void>;
export declare function updateProfile(req: AuthRequest, res: Response): Promise<void>;
export declare function changePassword(req: AuthRequest, res: Response): Promise<void>;
export declare function saveResendApiKey(req: AuthRequest, res: Response): Promise<void>;
export declare function getResendApiKeyStatus(req: AuthRequest, res: Response): Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map