import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertScanSchema, reportSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { scanWebsite, generateReport } from "./services/scanner";
import path from "path";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Serve test pages and generated reports
  app.use("/test-pages", express.static(path.join(process.cwd(), "server/test-pages")));
  app.use("/reports", express.static(path.join(process.cwd(), "reports")));

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
          
          // Run the accessibility scan on our test page
          const results = await scanWebsite(data.url);
          console.log("Scan completed, generating report...");

          // Generate the PDF report
          const reportPath = await generateReport(data.url, results);
          const reportUrl = `/reports/${path.basename(reportPath)}`;
          console.log(`Report generated at: ${reportPath}`);

          // Update scan status with report URL
          await storage.updateScanStatus(scan.id, "completed", reportUrl);
          console.log(`Scan ID ${scan.id} marked as completed`);
        } catch (error) {
          console.error("Scan processing failed:", error);
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

  app.get("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const scans = await storage.getUserScans(req.user!.id);
    res.json(scans);
  });

  const httpServer = createServer(app);
  return httpServer;
}