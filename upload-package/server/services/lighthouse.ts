import * as lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { mkdir } from 'fs/promises';

// Interface for scan results
export interface LighthouseScanResult {
  url: string;
  scanDateTime: string;
  error?: string;
  results?: any; // Raw lighthouse results
  reportUrl?: string;
}

/**
 * Run a Lighthouse scan on the specified URL
 * 
 * @param url URL to scan
 * @returns Promise with the scan result
 */
export async function runLighthouseScan(url: string): Promise<LighthouseScanResult> {
  // Ensure URL has a protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log(`Starting Lighthouse scan for: ${url}`);
  
  try {
    // Launch Chrome
    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });
    
    // Run Lighthouse
    const options = {
      logLevel: 'info' as 'info',
      output: 'json',
      onlyCategories: ['accessibility'],
      port: chrome.port,
    };
    
    console.log('Chrome launched, starting Lighthouse scan...');
    const results = await lighthouse(url, options);
    
    // Close Chrome
    await chrome.kill();
    
    console.log('Lighthouse scan completed successfully');

    return {
      url,
      scanDateTime: new Date().toISOString(),
      results: results.lhr,
    };
  } catch (error) {
    console.error('Lighthouse scan error:', error);
    return {
      url,
      scanDateTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Generate a PDF report from the Lighthouse results
 * 
 * @param scanResult The Lighthouse scan result
 * @returns Path to the generated PDF file
 */
export async function generateLighthouseReport(scanResult: LighthouseScanResult): Promise<string> {
  const reportsDir = path.join(process.cwd(), 'reports');
  
  // Ensure reports directory exists
  await mkdir(reportsDir, { recursive: true });
  
  const reportPath = path.join(reportsDir, `lighthouse_scan_${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
  // Use a writable stream to create the PDF
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    }
  });
  
  doc.pipe(fs.createWriteStream(reportPath));
  doc.pipe(stream);
  
  // Helper functions for consistent styling
  const addHeading = (text: string, options = {}) => {
    doc.fontSize(24)
       .fillColor('#1E40AF') // Blue heading color
       .text(text, { underline: false, ...options });
    doc.moveDown();
  };
  
  const addSubheading = (text: string, options = {}) => {
    doc.fontSize(18)
       .fillColor('#1F2937') // Dark gray text
       .text(text, { ...options });
    doc.moveDown();
  };
  
  const addParagraph = (text: string, options = {}) => {
    doc.fontSize(12)
       .fillColor('#374151') // Gray text
       .text(text, { ...options });
    doc.moveDown(0.5);
  };

  try {
    // Cover page
    doc.fontSize(32)
       .fillColor('#2563EB')
       .text('Lighthouse', { align: 'center' });
       
    doc.fontSize(16)
       .fillColor('#6B7280')
       .text('Accessibility Audit Report', { align: 'center' });
       
    doc.moveDown(2);
    
    // URL and date information
    doc.fontSize(14)
       .fillColor('#000000')
       .text(`Website: ${scanResult.url}`, { align: 'center' });
    
    doc.fontSize(12)
       .fillColor('#6B7280')
       .text(`Scan Date: ${new Date(scanResult.scanDateTime).toLocaleString()}`, { align: 'center' });
  
    // If there was an error, show it
    if (scanResult.error) {
      doc.moveDown(1);
      doc.fontSize(14)
         .fillColor('#DC2626')
         .text('Scan Error', { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fontSize(12)
         .fillColor('#DC2626')
         .text(`We encountered an issue while scanning this website: ${scanResult.error}`, { 
           align: 'center', 
           width: 400 
         });
         
      doc.moveDown(0.5);
      doc.fontSize(12)
         .fillColor('#6B7280')
         .text('Try scanning the website in a different environment or contact support for assistance.', { 
           align: 'center',
           width: 400
         });
         
      // Finalize and save PDF
      doc.end();
      return reportPath;
    }

    // Executive Summary page
    doc.addPage();
    addHeading('Executive Summary', { align: 'left' });
    
    if (scanResult.results) {
      const accessibilityScore = Math.round(scanResult.results.categories.accessibility.score * 100);
      const accessibilityColor = accessibilityScore >= 90 ? '#10B981' : // Green
                                 accessibilityScore >= 70 ? '#F59E0B' : // Amber 
                                                        '#EF4444';   // Red
        
      doc.fontSize(14)
         .fillColor(accessibilityColor)
         .text(`Accessibility Score: ${accessibilityScore}%`, { align: 'left' });
         
      doc.moveDown();
      
      // Add guidelines for interpreting the score
      addParagraph('Score interpretation:');
      doc.fontSize(12)
         .fillColor('#10B981')
         .text('90-100%: Good', { continued: false });
         
      doc.fontSize(12)
         .fillColor('#F59E0B')
         .text('70-89%: Needs Improvement', { continued: false });
         
      doc.fontSize(12)
         .fillColor('#EF4444')
         .text('0-69%: Poor', { continued: false });
         
      doc.moveDown();
      
      // Summary of issues
      const allAudits = scanResult.results.categories.accessibility.auditRefs;
      const failedAudits = allAudits
        .filter(ref => {
          const audit = scanResult.results.audits[ref.id];
          return audit.score !== null && audit.score < 1;
        })
        .map(ref => scanResult.results.audits[ref.id]);
      
      addParagraph(`Total issues detected: ${failedAudits.length}`);
      
      // If we have issues, show overall recommendations
      if (failedAudits.length > 0) {
        doc.moveDown();
        addSubheading('Key Recommendations');
        
        // Group failed audits by group
        const auditsByGroup = {};
        failedAudits.forEach(audit => {
          const group = audit.group || 'other';
          if (!auditsByGroup[group]) {
            auditsByGroup[group] = [];
          }
          auditsByGroup[group].push(audit);
        });
        
        // Show top issues from each group
        Object.entries(auditsByGroup).forEach(([group, audits]) => {
          if (Array.isArray(audits) && audits.length > 0) {
            const groupName = group.charAt(0).toUpperCase() + group.slice(1).replace('-', ' ');
            doc.fontSize(14)
               .fillColor('#000000')
               .text(`${groupName} Issues: ${audits.length}`, { continued: false });
               
            // Show top 3 issues from this group
            (audits as any[]).slice(0, 3).forEach(audit => {
              doc.fontSize(12)
                 .fillColor('#4B5563')
                 .text(`• ${audit.title}`, { 
                   indent: 20,
                   continued: false 
                 });
            });
            
            if (audits.length > 3) {
              doc.fontSize(10)
                 .fillColor('#6B7280')
                 .text(`...and ${audits.length - 3} more ${groupName.toLowerCase()} issues.`, {
                   indent: 20,
                   continued: false
                 });
            }
            
            doc.moveDown(0.5);
          }
        });
      }
     
      // Detailed findings section
      doc.addPage();
      addHeading('Detailed Findings', { align: 'left' });
      
      if (failedAudits.length === 0) {
        addParagraph('No accessibility issues were found. Congratulations!');
      } else {
        // Group audits by impact
        const impactOrder = ['critical', 'serious', 'moderate', 'minor'];
        const auditsByImpact = {
          critical: [],
          serious: [],
          moderate: [],
          minor: []
        };
        
        // Map Lighthouse scores to impact levels
        failedAudits.forEach(audit => {
          if (audit.score === 0) {
            auditsByImpact.critical.push(audit);
          } else if (audit.score <= 0.33) {
            auditsByImpact.serious.push(audit);
          } else if (audit.score <= 0.66) {
            auditsByImpact.moderate.push(audit);
          } else {
            auditsByImpact.minor.push(audit);
          }
        });
        
        // Display each impact group
        impactOrder.forEach(impact => {
          const audits = auditsByImpact[impact];
          if (audits.length > 0) {
            doc.moveDown();
            doc.fontSize(16)
               .fillColor(impact === 'critical' || impact === 'serious' ? '#DC2626' : 
                         impact === 'moderate' ? '#F59E0B' : '#6B7280')
               .text(`${impact.charAt(0).toUpperCase() + impact.slice(1)} Impact Issues`, 
                 { underline: true });
            doc.moveDown();
            
            // List each audit in this impact group
            audits.forEach((audit, index) => {
              // Issue title
              doc.fontSize(14)
                 .fillColor('#000000')
                 .text(`${index + 1}. ${audit.title}`);
              
              // Issue description
              doc.moveDown(0.5);
              doc.fontSize(12)
                 .fillColor('#4B5563')
                 .text(audit.description);
              
              // Failure details if available
              if (audit.details && audit.details.items && audit.details.items.length > 0) {
                doc.moveDown(0.5);
                doc.fontSize(12)
                   .fillColor('#000000')
                   .text('Examples:');
                
                // Show up to 3 examples
                audit.details.items.slice(0, 3).forEach((item, itemIndex) => {
                  let itemText = '';
                  
                  // Format varies by audit type
                  if (item.node && item.node.selector) {
                    itemText = `Element: ${item.node.selector}`;
                  } else if (item.selector) {
                    itemText = `Element: ${item.selector}`;
                  } else if (item.element) {
                    itemText = `Element: ${item.element}`;
                  } else {
                    // Create a string representation of whatever properties are available
                    itemText = Object.entries(item)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ');
                  }
                  
                  doc.fontSize(11)
                     .fillColor('#4B5563')
                     .text(`Example ${itemIndex + 1}: ${itemText}`, { indent: 20 });
                });
                
                // Note if there are more examples
                if (audit.details.items.length > 3) {
                  doc.fontSize(10)
                     .fillColor('#6B7280')
                     .text(`...and ${audit.details.items.length - 3} more examples.`, { indent: 20 });
                }
              }
              
              // How to fix
              doc.moveDown(0.5);
              doc.fontSize(12)
                 .fillColor('#000000')
                 .text('How to fix:');
              
              doc.fontSize(12)
                 .fillColor('#4B5563')
                 .text(audit.helpText || 'Follow WCAG guidelines to address this issue.', { indent: 20 });
              
              doc.moveDown(1);
            });
          }
        });
      }
      
      // Passing tests section
      const passingAudits = allAudits
        .filter(ref => {
          const audit = scanResult.results.audits[ref.id];
          return audit.score === 1;
        })
        .map(ref => scanResult.results.audits[ref.id]);
      
      if (passingAudits.length > 0) {
        doc.addPage();
        addHeading('Passing Accessibility Tests', { align: 'left' });
        addParagraph(`Your website successfully passed ${passingAudits.length} accessibility tests, including:`);
        
        // Group passing audits by group
        const passingByGroup = {};
        passingAudits.forEach(audit => {
          const group = audit.group || 'other';
          if (!passingByGroup[group]) {
            passingByGroup[group] = [];
          }
          passingByGroup[group].push(audit);
        });
        
        // Show passing tests by group
        Object.entries(passingByGroup).forEach(([group, audits]) => {
          if (Array.isArray(audits) && audits.length > 0) {
            const groupName = group.charAt(0).toUpperCase() + group.slice(1).replace('-', ' ');
            doc.fontSize(14)
               .fillColor('#10B981') // Green for passing
               .text(`${groupName}: ${audits.length} passed`, { continued: false });
            
            doc.moveDown(0.5);
          }
        });
      }
    } else {
      addParagraph('No scan results available.');
    }
    
    // Resources page
    doc.addPage();
    addHeading('Resources', { align: 'left' });
    
    addParagraph('Web Content Accessibility Guidelines (WCAG) 2.1: https://www.w3.org/TR/WCAG21/');
    addParagraph('WebAIM: https://webaim.org/');
    addParagraph('A11Y Project: https://www.a11yproject.com/');
    
    // Finalize PDF
    doc.end();
    return reportPath;
  } catch (error) {
    console.error('Error creating Lighthouse report:', error);
    
    // Create a simple error report
    doc.addPage();
    addHeading('Error Creating Report', { align: 'left' });
    addParagraph(`An error occurred while generating this report: ${error instanceof Error ? error.message : String(error)}`);
    
    doc.end();
    return reportPath;
  }
}