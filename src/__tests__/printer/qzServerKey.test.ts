import { generateKeyPairSync, X509Certificate } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { describePublicCertValue, getQzCertificate, normalizePem, parsePemValue } from '@/lib/printer/qzServerKey';

// Certificado de ejemplo (público, autofirmado de prueba) generado con openssl
const CERT = `-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUK5ZNfCkIz5F9U8cn45oCtbF4RrEwDQYJKoZIhvcNAQEL
BQAwGDEWMBQGA1UEAwwNUGlkZUxvTnVlc3RybzAeFw0yNjA5MjUyMDEzNDFaFw0z
NjA5MjIyMDEzNDFaMBgxFjAUBgNVBAMMDVBpZGVMb051ZXN0cm8wggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQDksEqWmZ2MYv1C39vKuDdRWogtvbbxIKe7
WSCvdBOm8Vpzu/D9fZ3NL1S0jDeONgsD6dnhJBeJUi96rItCD47tINmDF8afxyai
xzqM0UWeeEJzwjROP1LVaGOL2RVz7p+7iR0LM6InHDEhWkyiBYz4FKMGWj4t5Sdk
sirteN+ieiNgzj/hQUYc994YhahI8SQx9dR7ezbjtxld0U/dPFWSSxbron1pEAyF
y/gprj6fwPI9CFZ6oTJwfDgzbu0OV1NuF2liW4yzxrUgvQ6zSDBP9FlgZZErDzmT
dl2dWVYFxoUL2348mOLOlIQUQMwuoG/F+F1yHE4Ss3M0JJRTn0IfAgMBAAGjUzBR
MB0GA1UdDgQWBBSRS7n+wNLCGvE3NS5lpeCdgKWvYzAfBgNVHSMEGDAWgBSRS7n+
wNLCGvE3NS5lpeCdgKWvYzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQCbHLZpZWogfkMgdqFBRUdabPva5ulS/Yorpr3Zgabtg64COLoHYkujtSNT
Yuutdz4v2OQ3Pihqby2++3ftBeljhSdEdbF6hYHdrb3+FwWhGfNtDc8bOaX8GlgA
8FJLYnhtG+t8w7X0z+aEcUKea0iwomZE/T5MS8YZmiZeMOnmmRQBHDXMSRNiBimd
HFyjk9VaYKlfryuR5BR3jrU8nyFO9b1YVCPJ41rqWkduumtncS9NXCHBQx6n/5R4
/uEdNCgMkouucd1CyKFJvTKf2OSpa0pIGNAdWEGEaTvdSp47miZNksjHe9BoQpD6
+QAs4VGSsOdsVS6qqL6Ji90co8gw
-----END CERTIFICATE-----`;

const isValidCert = (pem: string | null) => {
  try {
    return !!pem && !!new X509Certificate(pem);
  } catch {
    return false;
  }
};

describe('parsePemValue — acepta cualquier forma razonable de pegar el certificado', () => {
  it('PEM con saltos de línea reales', () => {
    expect(isValidCert(parsePemValue(CERT))).toBe(true);
  });

  it('PEM en una línea con espacios en vez de saltos (lo que hace Vercel al pegar mal)', () => {
    expect(isValidCert(parsePemValue(CERT.replace(/\n/g, ' ')))).toBe(true);
  });

  it('PEM con \\n escritos y comillas', () => {
    expect(isValidCert(parsePemValue(`"${CERT.replace(/\n/g, '\\n')}"`))).toBe(true);
  });

  it('PEM con CRLF', () => {
    expect(isValidCert(parsePemValue(CERT.replace(/\n/g, '\r\n')))).toBe(true);
  });

  it('base64 del PEM completo (formato recomendado)', () => {
    expect(isValidCert(parsePemValue(Buffer.from(CERT).toString('base64')))).toBe(true);
  });

  it('base64 partido en varias líneas', () => {
    const b64 = Buffer.from(CERT).toString('base64').replace(/(.{76})/g, '$1\n');
    expect(isValidCert(parsePemValue(b64))).toBe(true);
  });

  it('texto que no es PEM ni base64 de PEM → null', () => {
    expect(parsePemValue('hola')).toBeNull();
    expect(parsePemValue('')).toBeNull();
    expect(parsePemValue(undefined)).toBeNull();
  });
});

describe('normalizePem', () => {
  it('funciona también con claves privadas', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const normalized = normalizePem(pem.replace(/\n/g, ' '));
    expect(normalized?.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true);
    expect(normalized?.endsWith('\n-----END PRIVATE KEY-----')).toBe(true);
  });
});

describe('variables de entorno', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('QZ_PUBLIC_CERT_BASE64 tiene prioridad y acepta también PEM pegado ahí', () => {
    process.env.QZ_PUBLIC_CERT_BASE64 = CERT.replace(/\n/g, ' ');
    process.env.QZ_PUBLIC_CERT = 'basura';
    const result = getQzCertificate();
    expect(result.variable).toBe('QZ_PUBLIC_CERT_BASE64');
    expect(isValidCert(result.pem)).toBe(true);
  });

  it('describePublicCertValue muestra largo, inicio y fin del valor recibido', () => {
    process.env.QZ_PUBLIC_CERT_BASE64 = 'abc';
    delete process.env.QZ_PUBLIC_CERT;
    expect(describePublicCertValue()).toEqual({ variable: 'QZ_PUBLIC_CERT_BASE64', largo: 3, inicio: 'abc', fin: 'abc' });
  });
});
