import { JSDOM } from "jsdom";
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

// Get the test page content
const TEST_PAGE = fs.readFileSync(path.join(process.cwd(), 'server/test-pages/index.html'), 'utf8');

export async function scanWebsite(url: string): Promise<ScanResult> {
  try {
    console.log('Scanning test page for URL:', url);

    // Create a virtual DOM with our test page
    let dom;
    try {
      dom = new JSDOM(TEST_PAGE, {
        url: "https://localhost/test-page", // Provide a base URL to help with relative paths
        runScripts: "outside-only", // Don't run scripts for safety
        resources: "usable" // Allow loading resources
      });
    } catch (error) {
      console.error('Error creating JSDOM:', error);
      throw new Error('Failed to create virtual DOM for scanning');
    }

    const { window } = dom;
    const { document } = window;

    console.log('Test page loaded in virtual DOM successfully');

    // Configure axe-core
    const axeConfig = {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'best-practice']
      }
    };

    // Run axe-core
    return new Promise((resolve, reject) => {
      try {
        axe.run(document.documentElement, axeConfig, (err, results) => {
          if (err) {
            console.error('Axe-core error:', err);
            reject(new Error('Failed to run accessibility scan: ' + err.message));
            return;
          }

          console.log('Scan completed successfully with', 
            results.violations.length, 'violations,',
            results.passes.length, 'passes, and',
            results.incomplete.length, 'incomplete tests');
            
          resolve({
            violations: results.violations || [],
            passes: results.passes || [],
            incomplete: results.incomplete || []
          });
        });
      } catch (error) {
        console.error('Axe-core exception:', error);
        reject(new Error('Failed to execute accessibility scan'));
      }
    });

  } catch (error) {
    console.error('Scan error:', error);
    throw new Error('Accessibility scan failed: ' + (error instanceof Error ? error.message : String(error)));
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