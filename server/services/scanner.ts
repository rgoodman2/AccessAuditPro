import { JSDOM } from "jsdom";
import axe from "axe-core";
import PDFDocument from "pdfkit";
import fs from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import fetch from "node-fetch";
// Using Node's built-in setTimeout
import { createCanvas, Image, loadImage } from "canvas";
import puppeteer from "puppeteer";

interface ScanResult {
  violations: any[];
  passes: any[];
  incomplete: any[];
  screenshot?: string; // Base64 encoded screenshot
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
      
      browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process'
        ]
      });
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
    // Ensure URL has a protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    console.log('Scanning real website:', url);
    
    // Launch screenshot capture in parallel with the scan
    // Using Promise.all might block if one fails, so we'll use separate promises
    const screenshotPromise = captureScreenshot(url);

    // Fetch the website content
    let htmlContent;
    try {
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AccessScan/1.0 Web Accessibility Checker',
          'Accept': 'text/html'
        },
        signal: controller.signal
      });
      
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId as any);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
      }
      
      htmlContent = await response.text();
      console.log(`Successfully fetched ${url}, content length: ${htmlContent.length} bytes`);
    } catch (error) {
      console.error('Error fetching website:', error);
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' ? 'Request timed out' : error.message) 
        : String(error);
      throw new Error(`Failed to fetch website: ${errorMessage}`);
    }

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
    
    // Wait for both the scan and screenshot to complete
    // Use allSettled to prevent one promise from causing the entire operation to fail
    const results = await Promise.allSettled([
      scanResultPromise,
      screenshotPromise
    ]);
    
    // Extract results, handling potential rejections
    let scanResult: ScanResult | null = null;
    let screenshot: string | null = null;
    
    if (results[0].status === 'fulfilled') {
      scanResult = results[0].value;
    } else {
      console.error('Scan failed:', results[0].reason);
      throw new Error('Accessibility scan failed: ' + (results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason)));
    }
    
    if (results[1].status === 'fulfilled') {
      screenshot = results[1].value;
    } else {
      console.warn('Screenshot capture failed but continuing with scan:', results[1].reason);
      // Continue without screenshot
    }
    
    // Combine the results
    return {
      ...scanResult,
      screenshot: screenshot || undefined
    };

  } catch (error) {
    console.error('Scan error:', error);
    throw new Error('Accessibility scan failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

export async function generateReport(url: string, results: ScanResult): Promise<string> {
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
        
        doc.image(`data:image/jpeg;base64,${results.screenshot}`, {
          fit: [pageWidth, height],
          align: 'center',
          valign: 'center'
        });
        
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
    
    // Add page numbers to all pages except the cover
    doc.on('pageAdded', () => {
      const totalPages = doc.bufferedPageRange().count;
      doc.switchToPage(totalPages - 1);
      doc.fontSize(10)
         .fillColor('#6B7280')
         .text(`Page ${totalPages}`, { align: 'right' });
    });
    
  } catch (error) {
    console.error('Error creating cover page:', error);
  }
  
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