import { URL } from "url";
import dns from "dns";
import { promisify } from "util";

const dnsResolve = promisify(dns.resolve4);

interface SanitizedTarget {
  href: string;
  origin: string;
  host: string;
}

// Private IP ranges to block (SSRF protection)
const PRIVATE_IP_RANGES = [
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^127\./, // 127.0.0.0/8 (localhost)
  /^169\.254\./, // 169.254.0.0/16 (link-local)
  /^224\./, // 224.0.0.0/4 (multicast)
  /^255\.255\.255\.255$/, // broadcast
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip));
}

export async function sanitizeTarget(input: string): Promise<SanitizedTarget> {
  // Basic input validation
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid URL input');
  }

  // Normalize the input - add https if no protocol specified
  let urlString = input.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch (error) {
    throw new Error('Invalid URL format');
  }

  // Require HTTPS only
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  // Check for localhost and IP addresses
  const hostname = url.hostname.toLowerCase();
  
  // Block localhost variations
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    throw new Error('Localhost access is not allowed');
  }

  // Block IPv6 localhost
  if (hostname === '::1' || hostname === '[::1]') {
    throw new Error('IPv6 localhost access is not allowed');
  }

  // Check if hostname is an IP address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error('Private IP addresses are not allowed');
    }
  }

  // Resolve DNS to check for private IPs behind domain names
  try {
    const resolvedIPs = await dnsResolve(hostname);
    for (const ip of resolvedIPs) {
      if (isPrivateIP(ip)) {
        throw new Error('Domain resolves to private IP address');
      }
    }
  } catch (dnsError) {
    // If DNS resolution fails, it's likely an invalid domain
    throw new Error('Unable to resolve domain name');
  }

  // Block common internal/private domains
  const blockedDomains = [
    'internal',
    'local',
    'localhost',
    'intranet',
    'corp',
    'home',
  ];
  
  for (const blocked of blockedDomains) {
    if (hostname.includes(blocked)) {
      throw new Error('Internal domain names are not allowed');
    }
  }

  // Return sanitized target
  return {
    href: url.href,
    origin: url.origin,
    host: url.host
  };
}