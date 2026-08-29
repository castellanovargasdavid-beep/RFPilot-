import { describe, expect, it } from "vitest";

import { isPrivateIPv4, isPrivateIPv6, assertPublicHttpUrl, UnsafeUrlError } from "./ssrf";

describe("isPrivateIPv4", () => {
  it.each([
    "10.0.0.1",
    "10.255.255.255",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
  ])("%s es una IP privada/reservada", (ip) => {
    expect(isPrivateIPv4(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1"])(
    "%s es una IP pública",
    (ip) => {
      expect(isPrivateIPv4(ip)).toBe(false);
    }
  );

  it("un valor con formato inválido se trata como privado por seguridad", () => {
    expect(isPrivateIPv4("no-es-una-ip")).toBe(true);
  });
});

describe("isPrivateIPv6", () => {
  it("::1 (loopback) es privada", () => {
    expect(isPrivateIPv6("::1")).toBe(true);
  });
  it("fe80::1 (link-local) es privada", () => {
    expect(isPrivateIPv6("fe80::1")).toBe(true);
  });
  it("fc00::1 y fd12::1 (unique local) son privadas", () => {
    expect(isPrivateIPv6("fc00::1")).toBe(true);
    expect(isPrivateIPv6("fd12::1")).toBe(true);
  });
  it("una IPv4 privada mapeada a IPv6 (::ffff:10.0.0.1) se detecta como privada", () => {
    expect(isPrivateIPv6("::ffff:10.0.0.1")).toBe(true);
  });
  it("2001:4860:4860::8888 (DNS público de Google) es pública", () => {
    expect(isPrivateIPv6("2001:4860:4860::8888")).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("rechaza protocolos que no sean http/https", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("ftp://example.com/file.pdf")).rejects.toThrow(UnsafeUrlError);
  });

  it("rechaza una URL con formato inválido", async () => {
    await expect(assertPublicHttpUrl("no es una url")).rejects.toThrow(UnsafeUrlError);
  });

  it("rechaza localhost explícitamente, sin necesidad de resolución DNS", async () => {
    await expect(assertPublicHttpUrl("http://localhost/secret")).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("http://0.0.0.0/secret")).rejects.toThrow(UnsafeUrlError);
  });

  it("rechaza una IP privada literal en la URL", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:5432/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(UnsafeUrlError);
    await expect(assertPublicHttpUrl("http://10.0.0.5/internal")).rejects.toThrow(UnsafeUrlError);
  });
});
