import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertScanSchema } from "@shared/schema";
import { z } from "zod";
import { createReport } from "pdfkit";
import axe from "axe-core";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post("/api/scans", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const data = insertScanSchema.parse(req.body);
      const scan = await storage.createScan(req.user!.id, data);

      // Process scan immediately instead of using setTimeout
      try {
        // In a real implementation, we would:
        // 1. Use a headless browser to load the page
        // 2. Run axe-core scan
        // 3. Generate PDF report
        // 4. Store report URL

        // Simulate a quick scan for now
        await new Promise(resolve => setTimeout(resolve, 2000));
        await storage.updateScanStatus(scan.id, "completed", "report.pdf");
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