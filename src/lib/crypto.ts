import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

/**
 * Cifrado simétrico para datos sensibles en reposo (CIF/NIF, facturación,
 * importes de contratos de referencia). AES-256-GCM: autenticado, con IV
 * aleatorio por valor para que dos cifrados del mismo dato no coincidan.
 *
 * ENCRYPTION_KEY debe ser 32 bytes en base64 (`openssl rand -base64 32`).
 * Formato almacenado: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY no está configurada");
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256)");
  }
  return buf;
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptField(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Formato de valor cifrado inválido");
  }
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/** Cifra un número (importes) reutilizando encryptField sobre su representación string. */
export function encryptAmount(amount: number): string {
  return encryptField(String(amount));
}

export function decryptAmount(stored: string): number {
  return Number(decryptField(stored));
}
