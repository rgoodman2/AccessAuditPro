import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertScanSchema } from "@shared/schema";
import { z } from "zod";
import { scanWebsite, generateReport } from "./services/scanner";
import path from "path";
import express from "express";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Serve generated reports
  app.use("/reports", express.static(path.join(process.cwd(), "reports")));

  app.post("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertScanSchema.parse(req.body);
      const scan = await storage.createScan(req.user!.id, data);

      try {
        // Run the accessibility scan
        const results = await scanWebsite(data.url);

        // Generate the PDF report
        const reportPath = await generateReport(data.url, results);
        const reportUrl = `/reports/${path.basename(reportPath)}`;

        // Update scan status with report URL
        await storage.updateScanStatus(scan.id, "completed", reportUrl);
      } catch (error) {
        console.error("Scan failed:", error);
        await storage.updateScanStatus(scan.id, "failed");
      }

      res.status(201).json(scan);
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