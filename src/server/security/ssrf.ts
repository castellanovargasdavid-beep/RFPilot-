import dns from "dns/promises";

/**
 * Guardia anti-SSRF para features que hacen un fetch server-side a una URL
 * proporcionada por el usuario (ver /api/tenders/import-url — "importar
 * pliego por URL", pensado para enlaces directos de la PLACSP/plataformas
 * autonómicas). Sin esto, un atacante podría pedirle al servidor que
 * descargue "http://169.254.169.254/..." (metadata de la nube),
 * "http://localhost:5432/..." u otro recurso interno.
 *
 * Estrategia: solo http(s), resuelve el hostname a IP y rechaza rangos
 * privados/loopback/link-local/reservados antes de hacer fetch, y el
 * fetch en sí nunca sigue redirects automáticamente (una URL pública
 * podría redirigir a una interna) — el llamador debe usar
 * `redirect: "manual"` y tratar cualquier 3xx como error.
 */
export class UnsafeUrlError extends Error {}

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // formato raro -> por seguridad, bloquear
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 0) return true; // 0.0.0.0/8
  if (a >= 224) return true; // multicast + reservado (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local fe80::/10
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/** Lanza UnsafeUrlError si la URL no es un http(s) público y seguro de descargar server-side. */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL inválida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Solo se admiten URLs http/https.");
  }
  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new UnsafeUrlError("Esa dirección no está permitida.");
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("No se pudo resolver el dominio.");
  }

  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (isPrivate) {
      throw new UnsafeUrlError("Esa dirección apunta a una red privada, no está permitida.");
    }
  }

  return url;
}
