import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { generateCertificates } from "./generate-dev-cert.mjs";

const cert = path.join(process.cwd(), ".cert", "dev-cert.pem");
const key = path.join(process.cwd(), ".cert", "dev-key.pem");

if (!existsSync(cert) || !existsSync(key)) await generateCertificates();

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [
  nextBin,
  "dev",
  "--port",
  "7500",
  "--experimental-https",
  "--experimental-https-key",
  key,
  "--experimental-https-cert",
  cert,
], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
