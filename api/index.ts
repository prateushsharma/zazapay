import "dotenv/config";
import express from "express";
import intentsRouter  from "./routes/intents";
import agentsRouter   from "./routes/agents";
import receiptsRouter from "./routes/receipts";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] [API] ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/v1/payment-intents", intentsRouter);
app.use("/v1/agents",          agentsRouter);
app.use("/v1/receipts",        receiptsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] [API] ZaZaPay REST API listening on port ${PORT}`);
});

export default app;
