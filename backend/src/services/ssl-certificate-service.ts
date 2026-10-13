import tls from 'tls';
import { isIP } from 'net';
import { domainToASCII } from 'url';

const CERTIFICATE_PORT = 443;
const CONNECTION_TIMEOUT_MS = 10_000;
const TLS_INSPECTION_ISSUER_PATTERN = /zscaler|blue\s*coat|forcepoint|netskope|fortinet|sophos|cisco\s+umbrella|palo\s+alto\s+networks/i;
const TLS_INSPECTION_ERROR_PREFIX = 'TLS inspection detected:';

export interface SslCertificateInfo {
  hostname: string;
  expiryDate: string;
  checkedAt: string;
}


export class TlsInspectionError extends Error {
  constructor(issuer: string) {
    super(`${TLS_INSPECTION_ERROR_PREFIX} the certificate was issued by ${issuer}. The origin certificate expiry cannot be verified from this network; bypass TLS inspection for this domain.`);
    this.name = 'TlsInspectionError';
  }
}

export function isTlsInspectionErrorMessage(message?: string | null): boolean {
  return Boolean(message?.startsWith(TLS_INSPECTION_ERROR_PREFIX));
}
export function normalizeCertificateHostname(input: string): string {
  const hostname = domainToASCII(input.trim().replace(/\.$/, '').toLowerCase());
  const labelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!hostname || hostname.length > 253 || isIP(hostname) || hostname === 'localhost') {
    throw new Error('Enter a valid domain name, not an IP address or localhost.');
  }

  const labels = hostname.split('.');
  if (labels.some(label => !labelPattern.test(label))) {
    throw new Error('Enter a valid domain name.');
  }

  return hostname;
}

export function getSslCertificateInfo(input: string): Promise<SslCertificateInfo> {
  const hostname = normalizeCertificateHostname(input);

  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: hostname,
      port: CERTIFICATE_PORT,
      servername: hostname,
      rejectUnauthorized: false
    });
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(CONNECTION_TIMEOUT_MS, () => {
      fail(new Error('TLS connection timed out.'));
    });

    socket.once('error', error => {
      fail(new Error(`Could not retrieve the TLS certificate: ${error.message}`));
    });

    socket.once('secureConnect', () => {
      const certificate = socket.getPeerCertificate();
      const issuer = certificate?.issuer ? Object.values(certificate.issuer).join(' ') : '';

      if (TLS_INSPECTION_ISSUER_PATTERN.test(issuer)) {
        fail(new TlsInspectionError(issuer));
        return;
      }

      const expiry = certificate?.valid_to ? new Date(certificate.valid_to) : null;

      if (!expiry || Number.isNaN(expiry.getTime())) {
        fail(new Error('The TLS endpoint did not provide a usable certificate expiry date.'));
        return;
      }

      settled = true;
      socket.end();
      resolve({
        hostname,
        expiryDate: expiry.toISOString(),
        checkedAt: new Date().toISOString()
      });
    });
  });
}