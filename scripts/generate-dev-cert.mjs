import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const certDir = path.join(process.cwd(), ".cert");
const caCert = path.join(certDir, "rootCA.pem");
const caKey = path.join(certDir, "rootCA-key.pem");
const serverCert = path.join(certDir, "dev-cert.pem");
const serverKey = path.join(certDir, "dev-key.pem");
const csr = path.join(certDir, "dev.csr");
const configPath = path.join(certDir, "openssl.cnf");

function lanAddresses() {
  const addresses = new Set();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.add(entry.address);
    }
  }
  return [...addresses];
}

function run(args) {
  execFileSync("openssl", args, { stdio: "inherit" });
}

function printInfo() {
  console.log("Local HTTPS certificates are ready:");
  console.log(`  CA certificate:  ${caCert}`);
  console.log(`  Server certificate: ${serverCert}`);
  console.log("Install the CA certificate on your phone as a trusted certificate.");
  console.log("Phone URLs:");
  for (const address of lanAddresses()) console.log(`  https://${address}:7500`);
  console.log("  https://localhost:7500");
}

export async function generateCertificates(force = false) {
  if (!force && [caCert, caKey, serverCert, serverKey].every(existsSync)) {
    printInfo();
    return;
  }

  await mkdir(certDir, { recursive: true });
  const addresses = lanAddresses();
  const altNames = [
    "DNS.1 = localhost",
    "IP.1 = 127.0.0.1",
    ...addresses.map((address, index) => `IP.${index + 2} = ${address}`),
  ].join("\n");
  const config = `[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
${altNames}
`;
  await writeFile(configPath, config, "utf8");

  run([
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", caKey, "-out", caCert,
    "-days", "3650", "-subj", "/CN=IELTS Coach Local CA",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
  ]);
  run(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", serverKey, "-out", csr, "-config", configPath]);
  run([
    "x509", "-req", "-in", csr, "-CA", caCert, "-CAkey", caKey,
    "-CAcreateserial", "-out", serverCert, "-days", "825",
    "-extensions", "v3_req", "-extfile", configPath,
  ]);
  await rm(csr, { force: true });
  printInfo();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateCertificates(process.argv.includes("--force"));
}
