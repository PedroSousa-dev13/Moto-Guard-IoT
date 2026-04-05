interface CrashEmailPayload {
    toEmail: string;
    riderName: string;
    timestamp: string;
    latitude?: number | null;
    longitude?: number | null;
    tripId?: string | null;
    deviceId: string;
    /** API key Resend já desencriptada do utilizador */
    resendApiKey?: string | null;
}
export declare function sendCrashAlert(payload: CrashEmailPayload): Promise<void>;
export {};
//# sourceMappingURL=email.service.d.ts.map