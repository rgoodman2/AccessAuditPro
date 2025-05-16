import { JSDOM } from "jsdom";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import fetch from "node-fetch";
// Using Node's built-in setTimeout
import { createCanvas, Image, loadImage } from "canvas";
import puppeteer from "puppeteer";

/**
 * Scans a local test page instead of fetching an external website
 * This is used for testing when external network access is restricted
 */
async function scanTestPage(testPagePath: string): Promise<ScanResult> {
  try {
    console.log(`Loading test page: ${testPagePath}`);
    
    // Get the absolute path to the test page
    const fullPath = path.join(process.cwd(), 'server', testPagePath.replace(/^\//, ''));
    console.log(`Full path: ${fullPath}`);
    
    // Read the HTML content
    const htmlContent = await readFile(fullPath, 'utf-8');
    console.log(`Test page loaded: ${htmlContent.length} bytes`);
    
    // Create a virtual DOM with the fetched content
    const dom = new JSDOM(htmlContent, {
      url: `file://${fullPath}`,
      runScripts: "outside-only",
      resources: "usable",
      pretendToBeVisual: true
    });
    
    const { window } = dom;
    const { document } = window;
    
    console.log('Test page loaded in virtual DOM');
    
    // Configure axe-core
    // @ts-ignore - Ignoring typing issue with axe configuration
    const axeConfig = {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'best-practice']
      }
    };
    
    // Run axe-core for accessibility testing
    return new Promise<ScanResult>((resolve, reject) => {
      try {
        axe.run(document.documentElement, axeConfig, (err, results) => {
          if (err) {
            console.error('Axe-core error:', err);
            reject(new Error('Failed to run accessibility scan: ' + err.message));
            return;
          }
          
          console.log('Test page scan completed with', 
            results.violations.length, 'violations,',
            results.passes.length, 'passes, and',
            results.incomplete.length, 'incomplete tests');
          
          // Create a static test screenshot
          const testScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAIAAAD2HxkiAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QTFCN0Y1OTZCMjUzMTFFQTlDN0JDMjI3NzkwMkM4RDQiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QTFCN0Y1OTdCMjUzMTFFQTlDN0JDMjI3NzkwMkM4RDQiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpBMUI3RjU5NEIyNTMxMUVBOUM3QkMyMjc3OTAyQzhENCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpBMUI3RjU5NUIyNTMxMUVBOUM3QkMyMjc3OTAyQzhENCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ppjt6T0AAAAGYktHRAD/AP8A/6C9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';
          
          resolve({
            violations: results.violations || [],
            passes: results.passes || [],
            incomplete: results.incomplete || [],
            screenshot: testScreenshot
          });
        });
      } catch (error) {
        console.error('Test page scan error:', error);
        reject(new Error('Failed to execute accessibility scan on test page'));
      }
    });
  } catch (error) {
    console.error('Error scanning test page:', error);
    throw new Error(`Test page scan failed: ${error.message}`);
  }
}

interface ScanResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  screenshot?: string; // Base64 encoded screenshot
}

// Fallback function to generate a basic report when the scan fails
export async function generateBasicReport(url: string): Promise<string> {
  console.log(`Creating fallback basic report for ${url}`);
  
  // Create the reports directory if it doesn't exist
  const reportsDir = path.join(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });
  
  // Generate filename
  const timestamp = Date.now();
  const filename = `basic_report_${timestamp}.pdf`;
  const outputPath = path.join(reportsDir, filename);
  
  // Create a new PDF document
  const doc = new PDFDocument({
    size: 'letter',
    margin: 50,
    info: {
      Title: `Basic Accessibility Report for ${url}`,
      Author: 'AccessScan',
      Subject: 'Web Accessibility Audit',
      Keywords: 'accessibility, WCAG, audit, web'
    }
  });
  
  // Pipe the PDF to a file
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);
  
  // Cover page
  doc.fontSize(30)
     .fillColor('#2563EB')
     .text('AccessScan', { align: 'center' });
  
  doc.moveDown(1);
  
  doc.fontSize(24)
     .fillColor('#000000')
     .text('Basic Accessibility Report', { align: 'center' });
  
  doc.moveDown(1);
  
  doc.fontSize(16)
     .fillColor('#444444')
     .text(`URL: ${url}`, { align: 'center' });
  
  doc.fontSize(12)
     .fillColor('#6B7280')
     .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
  
  doc.moveDown(3);
  
  doc.fontSize(14)
     .fillColor('#111111')
     .text('Limited Report Information', { align: 'center' });
  
  doc.moveDown(1);
  
  // Explanation message
  doc.fontSize(12)
     .fillColor('#333333')
     .text(
       'This is a limited report generated because the full accessibility scan could not be completed. ' +
       'This may be due to network restrictions, issues with the scanning engine, or problems accessing the website.',
       { align: 'left', width: 450 }
     );
  
  doc.moveDown(1);
  
  doc.text(
    'For testing the scanner functionality in restricted environments, please use these special test URLs:',
    { align: 'left', width: 450 }
  );
  
  doc.moveDown(0.5);
  
  doc.text('• test-sample - Page with various accessibility issues', { indent: 20 });
  doc.text('• test-accessible - Page with better accessibility implementation', { indent: 20 });
  
  doc.moveDown(1);
  
  doc.text(
    'These test pages are designed to work even in environments with network restrictions and will ' +
    'allow you to test the full functionality of the scanner.',
    { align: 'left', width: 450 }
  );
  
  // Finalize the PDF
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      console.log(`Basic report created at: ${outputPath}`);
      resolve(outputPath);
    });
    
    writeStream.on('error', (error) => {
      console.error('Error creating basic report:', error);
      reject(error);
    });
  });
}

// Get the test page content
const TEST_PAGE = fs.readFileSync(path.join(process.cwd(), 'server/test-pages/index.html'), 'utf8');

// Function to capture screenshot using Puppeteer
async function captureScreenshot(url: string): Promise<string | null> {
  let browser = null;
  try {
    console.log('Launching browser for screenshot...');
    
    // Check if we're in a production environment where we can launch a browser
    // In some environments, this might fail due to restrictions
    try {
      // Try to detect if we're in a Replit environment with limitations
      const isReplitDev = process.env.REPL_ID && !process.env.REPL_SLUG;
      
      if (isReplitDev) {
        console.log('Detected Replit development environment - skipping screenshot for compatibility');
        return null;
      }
      
      // Use the environment variable for Chromium if available
      const launchOptions: any = { 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process'
        ]
      };
      
      // If we have a specific path to Chromium/Chrome, use it
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        console.log(`Using Chromium at: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      
      browser = await puppeteer.launch(launchOptions);
    } catch (launchError) {
      console.error('Failed to launch browser for screenshot:', launchError);
      // Continue with the scan, just without screenshots
      return null;
    }
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a reasonable timeout
    page.setDefaultNavigationTimeout(30000);
    
    console.log(`Navigating to ${url} for screenshot...`);
    
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
      
      // Wait a moment for any final rendering
      await new Promise<void>(resolve => {
        setTimeout(resolve, 2000);
      });
      
      // Take the screenshot
      console.log('Taking screenshot...');
      const screenshot = await page.screenshot({ 
        type: 'jpeg',
        quality: 80,
        fullPage: false
      });
      
      // Convert to base64
      const base64Screenshot = Buffer.from(screenshot).toString('base64');
      console.log('Screenshot captured successfully');
      return base64Screenshot;
    } catch (navigationError) {
      console.error('Navigation error during screenshot:', navigationError);
      return null;
    }
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    // Don't fail the entire scan if screenshot fails
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

export async function scanWebsite(url: string): Promise<ScanResult> {
  try {
    // Special case for test pages
    // This allows us to test the scanner without external network access
    if (url === 'test-sample' || url === 'test') {
      console.log('Using test sample page instead of external website');
      return scanTestPage('/test-pages/sample.html');
    } else if (url === 'test-accessible') {
      console.log('Using accessible test page instead of external website');
      return scanTestPage('/test-pages/accessible.html');
    }
    
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log('Scanning real website:', url);
    
    // Try multiple approaches to fetch the website
    let htmlContent;
    let fetchAttempts = 0;
    const maxFetchAttempts = 3;
    
    while (fetchAttempts < maxFetchAttempts) {
      try {
        console.log(`Fetch attempt ${fetchAttempts + 1} for ${url}`);
        
        // Add cache-busting parameter to avoid cached responses
        const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
        
        // Use different fetch options on each attempt
        const fetchOptions = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout: 15000, // 15 seconds timeout
          follow: 5,      // Follow up to 5 redirects
        };
        
        const response = await fetch(fetchUrl, fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        htmlContent = await response.text();
        
        if (htmlContent && htmlContent.length > 0) {
          console.log(`Successfully fetched ${url} (${htmlContent.length} bytes)`);
          break; // Success, exit the loop
        } else {
          throw new Error('Received empty response');
        }
      } catch (fetchError) {
        fetchAttempts++;
        console.error(`Fetch attempt ${fetchAttempts} failed:`, fetchError);
        
        if (fetchAttempts >= maxFetchAttempts) {
          throw new Error(`Failed to fetch ${url} after ${maxFetchAttempts} attempts: ${fetchError.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Launch screenshot capture in parallel with the scan
    const screenshotPromise = captureScreenshot(url);

    // Create a virtual DOM with the fetched content
    let dom;
    try {
      dom = new JSDOM(htmlContent, {
        url: url, // Use the actual URL for relative paths
        runScripts: "outside-only", // Don't run scripts for safety
        resources: "usable", // Allow loading resources
        pretendToBeVisual: true // This helps with some visual-specific tests
      });
    } catch (error) {
      console.error('Error creating JSDOM:', error);
      throw new Error('Failed to parse website HTML: ' + 
        (error instanceof Error ? error.message : String(error)));
    }

    const { window } = dom;
    const { document } = window;

    console.log('Website loaded in virtual DOM successfully');

    // Configure axe-core with correct type
    // @ts-ignore - Ignoring typing issue with axe configuration
    const axeConfig = {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'best-practice']
      }
    };

    // Run axe-core
    const scanResultPromise = new Promise<ScanResult>((resolve, reject) => {
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
    
    // Run the scan first, then try to get the screenshot if available
    // This prevents issues with Promise.allSettled causing timing problems
    try {
      // First make sure we have a valid scan result
      const scanResult = await scanResultPromise;
      
      // Then try to get the screenshot, but don't fail if we can't
      let screenshot: string | null = null;
      try {
        screenshot = await screenshotPromise;
      } catch (screenshotError) {
        console.warn('Screenshot capture failed but continuing with scan:', screenshotError);
        // Continue without screenshot
      }
      
      // Return the combined result
      return {
        ...scanResult,
        screenshot: screenshot || undefined
      };
    } catch (scanError) {
      console.error('Scan failed:', scanError);
      throw new Error('Accessibility scan failed: ' + (scanError instanceof Error ? scanError.message : String(scanError)));
    }
    
    // This code is never reached, but kept for reference
    /* 
    return {
      ...scanResult,
      screenshot: screenshot || undefined
    };
    */

  } catch (error) {
    console.error('Scan error:', error);
    throw new Error('Accessibility scan failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function generateReport(url: string, results: ScanResult): Promise<string> {
  // Ensure we have valid results
  if (!results || !results.violations || !results.passes) {
    console.log("Creating basic report due to missing scan results data");
    return generateBasicReport(url);
  }

  // Create document with slightly larger pages for better readability
  const doc = new PDFDocument({
    size: 'letter',
    margin: 50,
    info: {
      Title: `Accessibility Report for ${url}`,
      Author: 'AccessScan',
      Subject: 'Web Accessibility Audit',
      Keywords: 'accessibility, WCAG, audit, web'
    }
  });
  
  const reportsDir = path.join(process.cwd(), "reports");
  const reportPath = path.join(reportsDir, `scan_${Date.now()}.pdf`);

  // Ensure reports directory exists
  await mkdir(reportsDir, { recursive: true });

  const writeStream = fs.createWriteStream(reportPath);
  doc.pipe(writeStream);

  // Helper functions for consistent styling
  const addHeading = (text, options = {}) => {
    doc.fontSize(24)
       .fillColor('#1E40AF') // Blue heading color
       .text(text, { underline: false, ...options });
    doc.moveDown();
  };
  
  const addSubheading = (text, options = {}) => {
    doc.fontSize(18)
       .fillColor('#1F2937') // Dark gray text
       .text(text, { ...options });
    doc.moveDown();
  };
  
  const addParagraph = (text, options = {}) => {
    doc.fontSize(12)
       .fillColor('#374151') // Gray text
       .text(text, { ...options });
    doc.moveDown(0.5);
  };

  // Cover page with branding elements
  try {
    // This is a placeholder for a company logo
    // In a real implementation, this would be configurable
    doc.fontSize(32)
       .fillColor('#2563EB')
       .text('AccessScan', { align: 'center' });
       
    doc.fontSize(16)
       .fillColor('#6B7280')
       .text('Web Accessibility Audit Report', { align: 'center' });
       
    doc.moveDown(2);
    
    // URL and date information
    doc.fontSize(14)
       .fillColor('#000000')
       .text(`Website: ${url}`, { align: 'center' });
    
    doc.fontSize(12)
       .fillColor('#6B7280')
       .text(`Scan Date: ${new Date().toLocaleString()}`, { align: 'center' });
    
    // Add website screenshot if available
    if (results.screenshot) {
      try {
        doc.moveDown(1);
        
        // Center the screenshot with some margin
        const pageWidth = doc.page.width - 100; // 50px margin on each side
        const height = 300; // Fixed height for consistency
        
        // We'll skip the screenshot if it causes errors
        if (results.screenshot && results.screenshot.startsWith('data:image/')) {
          // The screenshot is already a data URL
          doc.image(results.screenshot, {
            fit: [pageWidth, height],
            align: 'center',
            valign: 'center'
          });
        } else if (results.screenshot) {
          // Just raw base64 data
          try {
            doc.image(`data:image/png;base64,${results.screenshot}`, {
              fit: [pageWidth, height],
              align: 'center',
              valign: 'center'
            });
          } catch (err) {
            console.log('Could not parse screenshot as PNG, skipping');
          }
        }
        
        // Add caption
        doc.moveDown(0.5);
        doc.fontSize(10)
           .fillColor('#6B7280')
           .text('Website Screenshot', { align: 'center' });
           
      } catch (screenshotError) {
        console.error('Error adding screenshot to PDF:', screenshotError);
      }
    }
    
    doc.moveDown(2);
    
    // Add WCAG compliance explanation
    doc.fontSize(12)
       .fillColor('#4B5563')
       .text('This report evaluates website compliance with Web Content Accessibility Guidelines (WCAG) 2.1. The assessment includes automated tests that identify potential barriers for users with disabilities.', {
         align: 'center',
         width: 400
       });
    
    // Add page numbers after we finish generating the report
    // This avoids page range errors
    let pageNumbers = false;
    
    doc.on('pageAdded', () => {
      if (pageNumbers) {
        const pages = doc.bufferedPageRange().count;
        // We start with page 2 after cover page
        doc.switchToPage(pages - 1);
        doc.fontSize(10)
           .fillColor('#6B7280')
           .text(`Page ${pages}`, 0.5 * (doc.page.width - 100), doc.page.height - 50, {
             width: 100,
             align: 'center'
           });
      }
    });
    
  } catch (error) {
    console.error('Error creating cover page:', error);
  }
  
  // Enable page numbering now that we're past the cover page
  let pageNumbers = true;
  
  // Executive Summary page
  doc.addPage();
  addHeading('Executive Summary', { align: 'left' });
  
  // Calculate compliance metrics
  const totalIssues = results.violations.length;
  const criticalIssues = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
  const moderateIssues = results.violations.filter(v => v.impact === 'moderate').length;
  const minorIssues = results.violations.filter(v => v.impact === 'minor').length;
  
  // Display metrics
  addParagraph(`Total accessibility issues detected: ${totalIssues}`);
  addParagraph(`Critical issues: ${criticalIssues}`);
  addParagraph(`Moderate issues: ${moderateIssues}`);
  addParagraph(`Minor issues: ${minorIssues}`);
  
  // Add risk level assessment
  let complianceLevel = 'High';
  let complianceColor = '#10B981'; // Green
  
  if (criticalIssues > 0 || totalIssues > 10) {
    complianceLevel = 'Low';
    complianceColor = '#EF4444'; // Red
  } else if (moderateIssues > 5 || totalIssues > 5) {
    complianceLevel = 'Medium';
    complianceColor = '#F59E0B'; // Amber
  }
  
  doc.moveDown();
  doc.fontSize(14)
     .fillColor(complianceColor)
     .text(`Compliance Risk Level: ${complianceLevel}`, { align: 'left' });
  
  doc.moveDown();
  addParagraph('This report contains actionable recommendations to improve the accessibility of your website and ensure compliance with WCAG 2.1 standards.');

  // Detailed Issues Page
  doc.addPage();
  addHeading('Accessibility Issues', { align: 'left' });
  
  if (results.violations.length === 0) {
    addParagraph('No accessibility issues were found. Congratulations!');
  } else {
    // Group violations by impact for better organization
    const impactOrder = ['critical', 'serious', 'moderate', 'minor'];
    const groupedViolations = {};
    
    impactOrder.forEach(impact => {
      const violationsWithImpact = results.violations.filter(v => v.impact === impact);
      if (violationsWithImpact.length > 0) {
        groupedViolations[impact] = violationsWithImpact;
      }
    });
    
    // Display grouped violations
    Object.entries(groupedViolations).forEach(([impact, violations]) => {
      doc.moveDown();
      doc.fontSize(16)
         .fillColor(impact === 'critical' || impact === 'serious' ? '#DC2626' : impact === 'moderate' ? '#F59E0B' : '#6B7280')
         .text(`${impact.charAt(0).toUpperCase() + impact.slice(1)} Impact Issues`, { underline: true });
      doc.moveDown();
      
      violations.forEach((violation, index) => {
        // Issue title and metadata
        doc.fontSize(14)
           .fillColor('#000000')
           .text(`${index + 1}. ${violation.help}`);
        
        // WCAG reference
        const wcagCriteria = violation.tags
          .filter(tag => tag.startsWith('wcag'))
          .map(tag => tag.toUpperCase())
          .join(', ');
        
        doc.fontSize(12)
           .fillColor('#4B5563')
           .text(`WCAG Criteria: ${wcagCriteria || 'Not specified'}`);
        
        // Problem description
        doc.moveDown(0.5);
        doc.fontSize(12)
           .fillColor('#000000')
           .text('Problem:');
        
        doc.fontSize(12)
           .fillColor('#4B5563')
           .text(violation.description, { indent: 20 });
        
        // Solution section with actionable advice
        doc.moveDown(0.5);
        doc.fontSize(12)
           .fillColor('#000000')
           .text('How to fix:');
        
        doc.fontSize(12)
           .fillColor('#4B5563')
           .text(violation.helpUrl, { indent: 20, link: violation.helpUrl });
        
        // If nodes are available, show a specific example
        if (violation.nodes && violation.nodes.length > 0) {
          const node = violation.nodes[0];
          if (node.html) {
            doc.moveDown(0.5);
            doc.fontSize(12)
               .fillColor('#000000')
               .text('Example HTML:');
            
            doc.fontSize(10)
               .fillColor('#6B7280')
               .text(node.html.substring(0, 150) + (node.html.length > 150 ? '...' : ''), 
                 { indent: 20 });
          }
        }
        
        doc.moveDown(1);
      });
    });
  }

  // Passing Tests Section
  if (results.passes.length > 0) {
    doc.addPage();
    addHeading('Passing Accessibility Tests', { align: 'left' });
    addParagraph(`Your website successfully passed ${results.passes.length} accessibility tests, including:`);
    doc.moveDown();
    
    // Group passes by category
    const categories = {};
    results.passes.forEach(pass => {
      const category = pass.tags.find(tag => tag.startsWith('cat.')) || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(pass);
    });
    
    // Display grouped passes
    Object.entries(categories).forEach(([category, passes]) => {
      const categoryName = category.replace('cat.', '').replace(/\b\w/g, c => c.toUpperCase());
      doc.fontSize(14)
         .fillColor('#10B981') // Green for passing tests
         .text(`${categoryName}`);
      
      doc.moveDown(0.5);
      passes.forEach(pass => {
        doc.fontSize(12)
           .fillColor('#374151')
           .text(`✓ ${pass.help}`, { indent: 10 });
      });
      doc.moveDown();
    });
  }

  // Recommendations section
  if (results.incomplete.length > 0) {
    doc.addPage();
    addHeading('Additional Recommendations', { align: 'left' });
    addParagraph('These items require manual verification to ensure full accessibility compliance:');
    doc.moveDown();
    
    results.incomplete.forEach((item, index) => {
      doc.fontSize(14)
         .fillColor('#6B7280')
         .text(`${index + 1}. ${item.help}`);
      
      doc.fontSize(12)
         .fillColor('#4B5563')
         .text(item.description, { indent: 10 });
      
      doc.moveDown();
    });
  }

  // Contact information (placeholder)
  doc.addPage();
  addHeading('Next Steps', { align: 'center' });
  doc.moveDown(2);
  
  addParagraph('To improve your website\'s accessibility:');
  addParagraph('1. Address the critical issues identified in this report first', { indent: 20 });
  addParagraph('2. Implement the recommended fixes for each issue', { indent: 20 });
  addParagraph('3. Conduct regular accessibility audits', { indent: 20 });
  addParagraph('4. Test with real users with disabilities', { indent: 20 });
  
  doc.moveDown(2);
  
  // Contact info (customizable placeholder)
  doc.fontSize(14)
     .fillColor('#2563EB')
     .text('AccessScan Support', { align: 'center' });
  
  doc.fontSize(12)
     .fillColor('#6B7280')
     .text('contact@accessscan.example.com', { align: 'center' });
  
  doc.moveDown();
  doc.fontSize(12)
     .fillColor('#6B7280')
     .text('For questions or assistance with implementing these recommendations', { align: 'center' });
  
  doc.end();

  await new Promise((resolve) => writeStream.on('finish', resolve));
  return reportPath;
}