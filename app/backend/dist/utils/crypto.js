"use strict";
// =============================================================================
// MotoGuard IoT — Utilitário: Encriptação AES-256-GCM
// =============================================================================
// Usado para guardar a Resend API key do utilizador de forma segura na BD.
// A chave de encriptação vem de JWT_SECRET (nunca exposta ao frontend).
// =============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = require("crypto");
const ALGO = "aes-256-gcm";
function getKey(secret) {
    // Deriva 32 bytes a partir do JWT_SECRET via SHA-256
    return (0, crypto_1.createHash)("sha256").update(secret).digest();
}
function encrypt(plaintext, secret) {
    const key = getKey(secret);
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: iv(12):tag(16):ciphertext — tudo em hex
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}
function decrypt(ciphertext, secret) {
    const [ivHex, tagHex, dataHex] = ciphertext.split(":");
    if (!ivHex || !tagHex || !dataHex)
        throw new Error("Formato de ciphertext inválido");
    const key = getKey(secret);
    const decipher = (0, crypto_1.createDecipheriv)(ALGO, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
}
//# sourceMappingURL=crypto.js.map