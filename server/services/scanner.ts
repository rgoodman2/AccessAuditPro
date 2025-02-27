import puppeteer from "puppeteer";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs/promises";
import path from "path";

interface ScanResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
}

export async function scanWebsite(url: string): Promise<ScanResult> {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(30000); // 30 second timeout

    // Add http:// if not present
    if (!url.startsWith('http')) {
      url = 'http://' + url;
    }

    await page.goto(url, { waitUntil: "networkidle0" });

    // Inject and run axe-core
    await page.evaluate(axe.source);
    const results = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        axe.run((err: Error, results: any) => {
          if (err) throw err;
          resolve(results);
        });
      });
    });

    return {
      violations: results.violations || [],
      passes: results.passes || [],
      incomplete: results.incomplete || []
    };
  } finally {
    await browser.close();
  }
}

export async function generateReport(url: string, results: ScanResult): Promise<string> {
  const doc = new PDFDocument();
  const reportsDir = path.join(process.cwd(), "reports");
  const reportPath = path.join(reportsDir, `scan_${Date.now()}.pdf`);

  // Ensure reports directory exists
  await fs.mkdir(reportsDir, { recursive: true });

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

  // Add recommendations
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