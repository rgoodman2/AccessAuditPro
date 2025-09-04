import puppeteer, { Browser, Page } from "puppeteer";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { mkdir } from "fs/promises";

interface LimitedScanResult {
  violations: any[];
  screenshot: string;
  url: string;
  scanDateTime: string;
  error?: string;
}

interface ViolationWithScreenshot {
  id: string;
  description: string;
  help: string;
  helpUrl: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  nodes: any[];
  screenshot?: string;
}

// Browser configuration for different environments
const getBrowserConfig = () => {
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--window-size=1920,1080',
  ];

  // For Railway deployment
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args,
    };
  }

  return { args };
};

export async function scanSinglePageForFree(url: string): Promise<LimitedScanResult> {
  let browser: Browser | null = null;
  
  try {
    console.log(`Starting free scan for: ${url}`);
    
    // Launch browser with configuration
    browser = await puppeteer.launch(getBrowserConfig());
    const page = await browser.newPage();
    
    // Set user agent for identification
    await page.setUserAgent('IncluShieldScanner/1.0');
    
    // Set viewport and timeout
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultTimeout(25000);
    
    // Navigate to the page
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 25000 
    });
    
    // Take full page screenshot
    console.log('Taking screenshot...');
    const screenshotBuffer = await page.screenshot({
      fullPage: true,
      type: 'png'
    });
    const screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
    
    // Inject and run axe-core
    console.log('Running accessibility scan...');
    const axeResults = await page.evaluate(async () => {
      // Inject axe-core
      const axeScript = document.createElement('script');
      axeScript.src = 'https://unpkg.com/axe-core@4.8.2/axe.min.js';
      document.head.appendChild(axeScript);
      
      // Wait for axe to load
      await new Promise((resolve) => {
        axeScript.onload = resolve;
      });
      
      // Run axe with WCAG 2.1 AA rules
      return new Promise((resolve) => {
        // @ts-ignore - axe is loaded dynamically
        window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa']
          }
        }, (err: any, results: any) => {
          if (err) {
            resolve({ error: err.message });
            return;
          }
          resolve(results);
        });
      });
    });
    
    if (axeResults.error) {
      throw new Error(`Axe scan failed: ${axeResults.error}`);
    }
    
    console.log(`Scan completed. Found ${axeResults.violations.length} violations`);
    
    // Sort violations by impact (critical > serious > moderate > minor)
    const impactOrder = { critical: 4, serious: 3, moderate: 2, minor: 1 };
    const sortedViolations = axeResults.violations.sort((a: any, b: any) => {
      const aImpact = impactOrder[a.impact] || 0;
      const bImpact = impactOrder[b.impact] || 0;
      return bImpact - aImpact;
    });
    
    // Take the top 2 violations
    const limitedViolations = sortedViolations.slice(0, 2);
    
    // Take screenshots of violation elements
    const violationsWithScreenshots = await captureViolationScreenshots(page, limitedViolations);
    
    await browser.close();
    browser = null;
    
    return {
      violations: violationsWithScreenshots,
      screenshot,
      url,
      scanDateTime: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Free scan error:', error);
    
    if (browser) {
      await browser.close();
    }
    
    return {
      violations: [],
      screenshot: '',
      url,
      scanDateTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function captureViolationScreenshots(page: Page, violations: any[]): Promise<ViolationWithScreenshot[]> {
  const violationsWithScreenshots: ViolationWithScreenshot[] = [];
  
  for (const violation of violations) {
    try {
      // Try to capture screenshot of the first node with this violation
      const firstNode = violation.nodes?.[0];
      if (firstNode && firstNode.target && firstNode.target.length > 0) {
        const selector = firstNode.target[0];
        
        try {
          const element = await page.$(selector);
          if (element) {
            const screenshotBuffer = await element.screenshot({
              type: 'png'
            });
            const elementScreenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
            
            violationsWithScreenshots.push({
              ...violation,
              screenshot: elementScreenshot
            });
          } else {
            violationsWithScreenshots.push(violation);
          }
        } catch (screenshotError) {
          console.warn(`Could not capture screenshot for violation ${violation.id}:`, screenshotError);
          violationsWithScreenshots.push(violation);
        }
      } else {
        violationsWithScreenshots.push(violation);
      }
    } catch (error) {
      console.warn(`Error processing violation ${violation.id}:`, error);
      violationsWithScreenshots.push(violation);
    }
  }
  
  return violationsWithScreenshots;
}

export async function generateLimitedReport(
  scanResult: LimitedScanResult,
  scanId: string
): Promise<string> {
  console.log(`Generating limited PDF report for scan ${scanId}`);
  
  // Create the reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });
  
  // Generate filename
  const filename = `${scanId}-free.pdf`;
  const outputPath = path.join(reportsDir, filename);
  
  // Create a new PDF document
  const doc = new PDFDocument({
    size: 'letter',
    margin: 50,
    info: {
      Title: `Limited Accessibility Preview - ${scanResult.url}`,
      Author: 'IncluShield',
      Subject: 'Web Accessibility Preview Report',
      Keywords: 'accessibility, WCAG, preview, audit'
    }
  });
  
  // Pipe the PDF to a file
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);
  
  // Add header with watermark
  doc.fontSize(24)
     .fillColor('#333333')
     .text('ACCESSIBILITY PREVIEW REPORT', 50, 50);
  
  doc.fontSize(16)
     .fillColor('#FF6B6B')
     .text('DEMO - LIMITED PREVIEW', 450, 55);
  
  // Add site information
  doc.fontSize(12)
     .fillColor('#666666')
     .text(`Website: ${scanResult.url}`, 50, 100)
     .text(`Scanned: ${new Date(scanResult.scanDateTime).toLocaleString()}`, 50, 115);
  
  let yPosition = 160;
  
  if (scanResult.error) {
    doc.fontSize(14)
       .fillColor('#FF0000')
       .text('Scan Error', 50, yPosition);
    
    yPosition += 25;
    doc.fontSize(12)
       .fillColor('#333333')
       .text(scanResult.error, 50, yPosition, { width: 500 });
       
  } else if (scanResult.violations.length === 0) {
    doc.fontSize(14)
       .fillColor('#00AA00')
       .text('Great news! No accessibility issues found in this preview.', 50, yPosition);
    
    yPosition += 30;
    doc.fontSize(12)
       .fillColor('#666666')
       .text('This preview shows only the most critical issues. Get the full report to see comprehensive results across your entire website.', 50, yPosition, { width: 500 });
       
  } else {
    doc.fontSize(14)
       .fillColor('#333333')
       .text(`Preview Results: ${scanResult.violations.length} issue${scanResult.violations.length > 1 ? 's' : ''} shown`, 50, yPosition);
    
    yPosition += 30;
    
    // Add violations
    scanResult.violations.forEach((violation, index) => {
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
      
      // Violation header
      doc.fontSize(13)
         .fillColor('#FF6B6B')
         .text(`${index + 1}. ${violation.id}`, 50, yPosition);
      
      yPosition += 20;
      
      // Violation description
      doc.fontSize(11)
         .fillColor('#333333')
         .text(violation.description || violation.help || 'No description available', 50, yPosition, { width: 500 });
      
      yPosition += Math.max(30, doc.heightOfString(violation.description || violation.help || 'No description', { width: 500 }) + 10);
      
      // Impact level
      const impactColor = {
        critical: '#FF0000',
        serious: '#FF6600',
        moderate: '#FFB300',
        minor: '#FFC107'
      }[violation.impact] || '#999999';
      
      doc.fontSize(10)
         .fillColor(impactColor)
         .text(`Impact: ${violation.impact?.toUpperCase() || 'UNKNOWN'}`, 50, yPosition);
      
      yPosition += 25;
      
      // Add some spacing between violations
      yPosition += 15;
    });
  }
  
  // Add footer with CTA - start at bottom of page
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 150;
  
  // Draw a light separator line
  doc.strokeColor('#CCCCCC')
     .lineWidth(1)
     .moveTo(50, footerY - 20)
     .lineTo(550, footerY - 20)
     .stroke();
  
  doc.fontSize(12)
     .fillColor('#666666')
     .text('This is a limited preview showing up to 2 issues.', 50, footerY);
  
  doc.fontSize(13)
     .fillColor('#0066CC')
     .text('Get the full report to see all findings across your site and remediation steps.', 50, footerY + 20, { width: 500 });
  
  // Add CTA link
  doc.fontSize(14)
     .fillColor('#FF6B6B')
     .text('📞 Get Full Report → https://inclushield.com/accessibility-audit', 50, footerY + 50);
  
  // Add main screenshot if available
  if (scanResult.screenshot) {
    try {
      doc.addPage();
      doc.fontSize(16)
         .fillColor('#333333')
         .text('Website Screenshot', 50, 50);
      
      // Convert base64 to buffer and add to PDF (simplified - in production you'd want proper image sizing)
      const imageData = scanResult.screenshot.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      // Add image with proper sizing
      doc.image(imageBuffer, 50, 80, { width: 500, fit: [500, 600] });
    } catch (imageError) {
      console.warn('Could not add screenshot to PDF:', imageError);
    }
  }
  
  // Finalize the PDF
  doc.end();
  
  // Wait for the PDF to be written
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  
  console.log(`Limited report generated: ${outputPath}`);
  return outputPath;
}