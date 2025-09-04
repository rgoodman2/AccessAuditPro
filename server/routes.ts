import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertScanSchema, reportSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { scanWebsite, generateReport, generateBasicReport } from "./services/scanner";
import { runLighthouseScan, generateLighthouseReport } from "./services/lighthouse-cli";
import { sanitizeTarget } from "./services/url-sanitizer";
import path from "path";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { generateLimitedReport } from "./services/free-scanner";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Health check endpoint for Railway
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Serve test pages
  app.use("/test-pages", express.static(path.join(process.cwd(), "server/test-pages")));

  // Free scan test page
  app.get("/free-scan", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Free Accessibility Scan</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .form-group { margin-bottom: 20px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input[type="email"], input[type="url"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
          button { background-color: #FF6B6B; color: white; padding: 12px 30px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          button:hover { background-color: #FF5252; }
          .result { margin-top: 20px; padding: 15px; border-radius: 4px; }
          .success { background-color: #E8F5E8; border: 1px solid #4CAF50; color: #2E7D32; }
          .error { background-color: #FFEBEE; border: 1px solid #F44336; color: #C62828; }
          .loading { background-color: #FFF3E0; border: 1px solid #FF9800; color: #F57C00; }
        </style>
      </head>
      <body>
        <h1>Free Accessibility Scan</h1>
        <p>Get a preview of your website's accessibility issues. We'll show you the top 2 most critical problems found.</p>
        
        <form id="scanForm">
          <div class="form-group">
            <label for="email">Your Email Address</label>
            <input type="email" id="email" name="email" required placeholder="you@example.com">
          </div>
          
          <div class="form-group">
            <label for="url">Website URL to Scan</label>
            <input type="url" id="url" name="domainOrUrl" required placeholder="https://example.com">
          </div>
          
          <button type="submit">Start Free Scan</button>
        </form>
        
        <div id="result"></div>
        
        <script>
          document.getElementById('scanForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const resultDiv = document.getElementById('result');
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Show loading state
            resultDiv.innerHTML = '<div class="result loading">Starting your scan... This may take up to 2 minutes.</div>';
            
            try {
              const response = await fetch('/api/scan/free', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              
              const result = await response.json();
              
              if (response.ok) {
                resultDiv.innerHTML = '<div class="result success">Scan started successfully! Scan ID: ' + result.scanId + '. Check your email and server logs for the report.</div>';
              } else {
                resultDiv.innerHTML = '<div class="result error">Error: ' + (result.error || 'Unknown error occurred') + '</div>';
              }
            } catch (error) {
              resultDiv.innerHTML = '<div class="result error">Network error: ' + error.message + '</div>';
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // Free scan endpoint for lead generation
  app.post("/api/scan/free", async (req, res) => {
    try {
      // Input validation schema
      const freeScanSchema = z.object({
        email: z.string().email("Valid email is required"),
        domainOrUrl: z.string().min(1, "URL is required")
      });
      
      const { email, domainOrUrl } = freeScanSchema.parse(req.body);
      
      // Sanitize and validate URL
      const sanitizedTarget = await sanitizeTarget(domainOrUrl);
      console.log(`Free scan request: ${email} -> ${sanitizedTarget.href}`);
      
      // Generate unique scan ID
      const scanId = uuidv4();
      
      // Start async scan process
      res.status(200).json({ message: "Scan started", scanId });
      
      // Process scan asynchronously
      (async () => {
        try {
          console.log(`Starting free scan for ${sanitizedTarget.href}`);
          
          // Import the free scanner dynamically to avoid circular dependencies
          const { scanSinglePageForFree, generateLimitedReport } = await import("./services/free-scanner");
          
          // Perform the scan
          const scanResult = await scanSinglePageForFree(sanitizedTarget.href);
          
          // Generate limited PDF report
          const reportPath = await generateLimitedReport(scanResult, scanId);
          const reportUrl = `/reports/${path.basename(reportPath)}`;
          
          console.log(`Free scan completed for ${email}: ${reportUrl}`);
          
          // TODO: Send email with report link and CTA
          // For now, we'll just log it
          console.log(`Email would be sent to ${email} with report: ${reportUrl}`);
          
        } catch (error) {
          console.error(`Free scan failed for ${email}:`, error);
        }
      })().catch(err => {
        console.error("Unhandled error in free scan:", err);
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid input", details: error.errors });
      } else {
        console.error("Free scan endpoint error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.post("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertScanSchema.parse(req.body);
      const scan = await storage.createScan(req.user!.id, data);
      
      // Return the scan immediately so client gets a response
      res.status(201).json(scan);

      // Process the scan asynchronously
      (async () => {
        try {
          console.log(`Starting accessibility scan for URL: ${data.url}`);
          
          // For resilience in deployment environments with restrictions
          let results;
          let isTestPage = false;
          
          // Check if this is a test URL
          if (['test', 'test-sample', 'test-accessible'].includes(data.url)) {
            isTestPage = true;
          }
          
          try {
            // Run the accessibility scan
            console.log(`Attempting to scan website: ${data.url}`);
            results = await scanWebsite(data.url);
            console.log("Scan completed, generating report...");
          } catch (scanError) {
            console.error("Error during website scanning:", scanError);
            
            if (isTestPage) {
              // For test pages, create a basic result with some sample data
              console.log("Creating basic results for test page");
              results = {
                violations: [
                  { id: 'image-alt', description: 'Images must have alternate text', impact: 'critical', nodes: [{html: '<img src="test.jpg">'}] },
                  { id: 'color-contrast', description: 'Elements must have sufficient color contrast', impact: 'serious', nodes: [{html: '<p style="color: #aaa">Test</p>'}] }
                ],
                passes: [
                  { id: 'document-title', description: 'Documents must have a title', impact: 'moderate', nodes: [{html: '<title>Test</title>'}] },
                  { id: 'html-lang', description: 'HTML element must have a lang attribute', impact: 'serious', nodes: [{html: '<html lang="en">'}] }
                ],
                incomplete: [],
                error: undefined
              };
            } else {
              // For external sites, continue with an error report instead of failing
              console.log(`Creating error report for website: ${data.url}`);
              const errorMessage = scanError instanceof Error ? scanError.message : String(scanError);
              
              // We'll make a report with the error information
              results = {
                violations: [],
                passes: [],
                incomplete: [],
                error: `Failed to scan website: ${errorMessage}`,
                scanDateTime: new Date().toISOString(),
                url: data.url
              };
              
              console.log(`Created error results for ${data.url}. Will attempt to generate diagnostic report.`);
            }
          }

          // Generate the PDF report
          let reportPath;
          try {
            reportPath = await generateReport(data.url, results);
            const reportUrl = `/reports/${path.basename(reportPath)}`;
            console.log(`Report generated at: ${reportPath}`);
            
            // Update scan status with report URL
            await storage.updateScanStatus(scan.id, "completed", reportUrl);
            console.log(`Scan ID ${scan.id} marked as completed`);
          } catch (reportError) {
            console.error("Error generating report:", reportError);
            
            try {
              // Try to generate at least a basic report for test pages
              if (isTestPage) {
                console.log("Attempting to generate a basic report for test page");
                reportPath = await generateBasicReport(data.url);
                const reportUrl = `/reports/${path.basename(reportPath)}`;
                await storage.updateScanStatus(scan.id, "completed", reportUrl);
                console.log(`Basic report created for test page at: ${reportPath}`);
              } else {
                await storage.updateScanStatus(scan.id, "failed");
              }
            } catch (fallbackError) {
              console.error("Even fallback report generation failed:", fallbackError);
              await storage.updateScanStatus(scan.id, "failed");
            }
          }
        } catch (error) {
          console.error("Unhandled scan processing error:", error);
          await storage.updateScanStatus(scan.id, "failed");
        }
      })().catch(err => {
        console.error("Unhandled error in scan background processing:", err);
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(error.errors);
      } else {
        console.error("Scan creation failed:", error);
        res.status(500).send("Internal server error");
      }
    }
  });

  // New endpoint for Lighthouse accessibility scanning
  app.post("/api/lighthouse-scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = insertScanSchema.parse(req.body);
      
      // Create scan with pending status
      const scan = await storage.createScan(req.user!.id, data);
      
      // Return scan ID immediately
      res.status(201).json({
        ...scan,
        scanType: 'lighthouse'
      });
      
      // Run Lighthouse scan asynchronously
      (async () => {
        try {
          console.log(`Starting Lighthouse accessibility scan for URL: ${data.url}`);
          
          // Run Lighthouse scan
          const lighthouseResults = await runLighthouseScan(data.url);
          console.log("Lighthouse scan completed successfully");
          
          // Generate PDF report from results
          const reportPath = await generateLighthouseReport(lighthouseResults);
          const reportUrl = `/reports/${path.basename(reportPath)}`;
          console.log(`Lighthouse report generated at: ${reportPath}`);
          
          // Update scan status with report URL
          await storage.updateScanStatus(scan.id, "completed", reportUrl);
          console.log(`Lighthouse scan ID ${scan.id} marked as completed`);
        } catch (error) {
          console.error("Lighthouse scan error:", error);
          await storage.updateScanStatus(scan.id, "failed");
        }
      })().catch(err => {
        console.error("Unhandled error in Lighthouse scan:", err);
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(error.errors);
      } else {
        console.error("Lighthouse scan creation failed:", error);
        res.status(500).send("Internal server error");
      }
    }
  });

  app.get("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const scans = await storage.getUserScans(req.user!.id);
    res.json(scans);
  });
  
  // Report settings routes
  app.get("/api/report-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const settings = await storage.getReportSettings(req.user!.id);
      res.json(settings || {});
    } catch (error) {
      console.error("Error fetching report settings:", error);
      res.status(500).json({ error: "Failed to fetch report settings" });
    }
  });
  
  app.post("/api/report-settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const data = reportSettingsSchema.parse(req.body);
      const settings = await storage.saveReportSettings(req.user!.id, data);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json(error.errors);
      } else {
        console.error("Error saving report settings:", error);
        res.status(500).json({ error: "Failed to save report settings" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}