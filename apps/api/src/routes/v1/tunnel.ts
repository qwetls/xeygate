import { Hono } from "hono";
import { TunnelController } from "@/controllers/tunnel.controller.js";

export const TunnelRouter = new Hono();

TunnelRouter.get("/tunnel/status", TunnelController.GetStatus);
TunnelRouter.get("/tunnel/events", TunnelController.GetEvents);
TunnelRouter.post("/tunnel/start", TunnelController.StartTunnel);
TunnelRouter.post("/tunnel/stop", TunnelController.StopTunnel);
TunnelRouter.put("/tunnel/config", TunnelController.UpdateConfig);
TunnelRouter.post("/tunnel/install", TunnelController.Install);
TunnelRouter.get("/tunnel/install", TunnelController.GetInstallStatus);
