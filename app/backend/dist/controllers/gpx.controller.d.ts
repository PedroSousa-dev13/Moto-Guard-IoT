import { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
type GpxImportRequest = AuthRequest & {
    file?: Express.Multer.File;
};
export declare function importGpx(req: GpxImportRequest, res: Response): Promise<void>;
export {};
//# sourceMappingURL=gpx.controller.d.ts.map