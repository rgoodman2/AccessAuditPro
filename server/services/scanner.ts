import { JSDOM } from "jsdom";
import fetch from "node-fetch";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs";
import { mkdir } from "fs/promises";
import path from "path";

interface ScanResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
}

// List of websites that we can reliably scan
const ALLOWED_DOMAINS = [
  'example.com',
  'mozilla.org',
  'w3.org',
  'wikipedia.org',
  'nodejs.org'
];

export async function scanWebsite(url: string): Promise<ScanResult> {
  try {
    // Add http:// if not present
    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }

    // Parse and validate URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    // Check if domain is in allowed list
    if (!ALLOWED_DOMAINS.some(allowed => domain.endsWith(allowed))) {
      throw new Error(`Domain ${domain} is not in the allowed list. Please try one of: ${ALLOWED_DOMAINS.join(', ')}`);
    }

    console.log('Scanning URL:', url);

    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Create a virtual DOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    console.log('Page loaded successfully in virtual DOM');

    // Run axe
    return new Promise((resolve, reject) => {
      axe.run(document, (err: Error | null, results: any) => {
        if (err) {
          console.error('Axe-core error:', err);
          reject(err);
          return;
        }

        console.log('Scan completed successfully');
        resolve({
          violations: results.violations || [],
          passes: results.passes || [],
          incomplete: results.incomplete || []
        });
      });
    });
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
  }
}

export async function generateReport(url: string, results: ScanResult): Promise<string> {
  const doc = new PDFDocument();
  const reportsDir = path.join(process.cwd(), "reports");
  const reportPath = path.join(reportsDir, `scan_${Date.now()}.pdf`);

  // Ensure reports directory exists
  await mkdir(reportsDir, { recursive: true });

  const writeStream = fs.createWriteStream(reportPath);
  doc.pipe(writeStream);

  // Add report header
  doc.fontSize(24).text('Web Accessibility Scan Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`URL: ${url}`);
  doc.moveDown();
  doc.text(`Scan Date: ${new Date().toLocaleString()}`);
  doc.moveDown().moveDown();

  // Add violations section
  doc.fontSize(18).text('Accessibility Issues', { underline: true });
  doc.moveDown();

  if (results.violations.length === 0) {
    doc.fontSize(12).text('No accessibility issues were found.');
  } else {
    results.violations.forEach((violation, index) => {
      doc.fontSize(14).text(`${index + 1}. ${violation.help}`);
      doc.fontSize(12).text(`Impact: ${violation.impact}`);
      doc.fontSize(12).text(`WCAG Criteria: ${violation.tags.join(', ')}`);
      doc.fontSize(12).text('How to fix:');
      doc.fontSize(10).text(violation.description);
      doc.moveDown();
    });
  }

  // Add passing tests section
  doc.addPage();
  doc.fontSize(18).text('Passing Accessibility Tests', { underline: true });
  doc.moveDown();

  results.passes.forEach((pass, index) => {
    doc.fontSize(12).text(`${index + 1}. ${pass.help}`);
    doc.moveDown();
  });

  // Add recommendations for incomplete tests
  if (results.incomplete.length > 0) {
    doc.addPage();
    doc.fontSize(18).text('Additional Recommendations', { underline: true });
    doc.moveDown();

    results.incomplete.forEach((item, index) => {
      doc.fontSize(12).text(`${index + 1}. ${item.help}`);
      doc.fontSize(10).text(item.description);
      doc.moveDown();
    });
  }

  doc.end();

  await new Promise((resolve) => writeStream.on('finish', resolve));
  return reportPath;
}