import puppeteer, { Browser, Page } from "puppeteer";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { mkdir } from "fs/promises";
import os from "os";

// Simple PNG/JPEG format detection fallback
function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  console.log(`[DEBUG] detectImageType: buffer length=${buffer.length}`);
  
  if (buffer.length === 0) {
    console.log(`[DEBUG] detectImageType: empty buffer`);
    return null;
  }
  
  // Log first 16 bytes for debugging
  const firstBytes = Array.from(buffer.slice(0, 16)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
  console.log(`[DEBUG] detectImageType: first 16 bytes: ${firstBytes}`);
  
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    console.log(`[DEBUG] detectImageType: detected PNG`);
    return { ext: "png", mime: "image/png" };
  }
  
  // JPEG signature: FF D8
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    console.log(`[DEBUG] detectImageType: detected JPEG`);
    return { ext: "jpg", mime: "image/jpeg" };
  }
  
  console.log(`[DEBUG] detectImageType: unknown format`);
  return null;
}

interface LimitedScanResult {
  violations: any[];
  fullB64: string;
  shots: Array<{ruleId: string; sel: string; b64: string | null}>;
  url: string;
  scanDateTime: string;
  error?: string;
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
    
    // Sort by impact: ['critical','serious','moderate','minor']
    const impactOrder = ['critical', 'serious', 'moderate', 'minor'];
    const sortedViolations = axeResults.violations.sort((a: any, b: any) => {
      const aIndex = impactOrder.indexOf(a.impact);
      const bIndex = impactOrder.indexOf(b.impact);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
    
    // Take exactly 2 violations (enforce the "2 issues" promise)
    const selected = sortedViolations.slice(0, 2);
    
    // Always capture a full-page screenshot
    console.log('Taking full page screenshot...');
    const fullBuf = await page.screenshot({ fullPage: true, type: 'png' }); // force PNG
    const fullB64 = fullBuf.toString('base64');
    
    // Take per-violation element screenshots
    const shots = [];
    
    for (const violation of selected) {
      const sel = violation.nodes?.[0]?.target?.[0];
      if (sel) {
        try {
          const handle = await page.$(sel);
          let elB64: string | null = null;
          if (handle) {
            const box = await handle.boundingBox();
            if (box && box.width > 2 && box.height > 2) {
              await page.evaluate(s => {
                const el = document.querySelector(s);
                if (el instanceof HTMLElement) {
                  el.style.outline = '3px solid #ef4444';
                  el.style.outlineOffset = '2px';
                  el.scrollIntoView({ block:'center', inline:'center' });
                }
              }, sel);
              const elBuf = await handle.screenshot({ type: 'png', captureBeyondViewport: false });
              elB64 = elBuf.toString('base64');
            }
          }

          shots.push({ ruleId: violation.id, sel, b64: elB64 });
        } catch (error) {
          console.warn(`Could not capture screenshot for violation ${violation.id}:`, error);
          shots.push({
            ruleId: violation.id,
            sel,
            b64: null
          });
        }
      }
    }
    
    // Debug log per scan
    console.info(`violations_found=${axeResults.violations.length} selected=${selected.length} element_shots=${shots.filter(s=>!!s.b64).length}`);
    
    await browser.close();
    browser = null;
    
    return {
      violations: selected,
      fullB64,
      shots,
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
      fullB64: '',
      shots: [],
      url,
      scanDateTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}


async function toPngBuffer(input?: string | Buffer | null, context = 'image') {
  console.log(`[DEBUG] toPngBuffer called for ${context}, input type: ${typeof input}, length: ${input?.length || 'null'}`);
  
  if (!input) return null;
  const buf = Buffer.isBuffer(input)
    ? input
    : (() => {
        const b64 = input.replace(/^data:image\/\w+;base64,/, '');
        console.log(`[DEBUG] ${context}: processing base64 string, original length: ${input.length}, cleaned length: ${b64.length}`);
        return Buffer.from(b64, 'base64');
      })();

  console.log(`[DEBUG] ${context}: final buffer length: ${buf.length}`);

  if (buf.length === 0) {
    console.warn(`Skipping ${context}: decoded image buffer is empty`);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const tmp = path.join(os.tmpdir(), `empty-image-${Date.now()}.png`);
        fs.writeFileSync(tmp, buf);
        console.warn(`Wrote empty image buffer to ${tmp}`);
      } catch {}
    }
    return null;
  }

  // Try using the image-type package first
  let type: { ext: string; mime: string } | null = null;
  try {
    const imageType = (await import("image-type")).default;
    type = imageType(buf);
    console.log(`[DEBUG] image-type package result for ${context}: ${JSON.stringify(type)}`);
  } catch (error) {
    console.log(`[DEBUG] image-type package failed for ${context}: ${error.message}`);
  }

  // Fallback to manual detection if package failed
  if (!type) {
    console.log(`[DEBUG] Using fallback detection for ${context}`);
    type = detectImageType(buf);
  }

  if (!type || (type.mime !== 'image/png' && type.mime !== 'image/jpeg')) {
    console.warn(`Skipping ${context}: unsupported or unrecognized image type (${type?.mime || 'unknown'})`);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const tmp = path.join(os.tmpdir(), `invalid-image-${Date.now()}`);
        fs.writeFileSync(tmp, buf);
        console.warn(`Wrote invalid image buffer to ${tmp}`);
      } catch {}
    }
    return null;
  }

  console.log(`[DEBUG] ${context}: valid ${type.mime} detected`);
  return buf;
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
       .text('Preview Results: 2 issues shown', 50, yPosition);
    
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
  
  // Add full page screenshot if available
  if (scanResult.fullB64) {
    try {
      doc.addPage();
      doc.fontSize(16)
         .fillColor('#333333')
         .text('Website Screenshot', 50, 50);
      
      const fullBuf = await toPngBuffer(scanResult.fullB64, 'full page screenshot');
      if (fullBuf) doc.image(fullBuf, 50, 80, { width: 520 });
    } catch (imageError) {
      console.warn('Could not add full page screenshot to PDF:', imageError);
    }
  }
  
  // Add violation element screenshots
  if (scanResult.shots && scanResult.shots.length > 0) {
    const shotsWithImages = scanResult.shots.filter(s => s.b64);
    if (shotsWithImages.length > 0) {
      doc.addPage();
      doc.fontSize(16)
         .fillColor('#333333')
         .text('Violation Screenshots', 50, 50);
      
      let yPos = 80;
      
      for (const s of shotsWithImages) {
        if (!s.b64) continue;
        try {
          if (yPos > 600) {
            doc.addPage();
            yPos = 50;
          }
          
          doc.fontSize(12)
             .fillColor('#555555')
             .text(`Selector: ${s.sel}`, 50, yPos);
          
          yPos += 20;
          
          const buf = await toPngBuffer(s.b64, `violation ${s.ruleId}`);
          if (buf) doc.image(buf, 50, yPos, { width: 520 });
          
          yPos += 220;
        } catch (imageError) {
          console.warn(`Could not add violation screenshot ${s.ruleId} to PDF:`, imageError);
        }
      }
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