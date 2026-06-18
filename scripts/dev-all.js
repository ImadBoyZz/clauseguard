/* eslint-disable no-undef */
// Gecombineerde dev-launcher: start de LLM-backend (:3001) ÉN de add-in
// (dev-server :3000 + sideload in Word) in één commando. Zero-dependency:
// spawnt twee child-processen en bundelt hun output. Ctrl+C sluit beide af.
//
// Gebruik vanuit de repo-root:  npm run dev:all
// (Vergeet niet eerst server/.env in te vullen met je OPENROUTER_API_KEY.)

const { spawn } = require("child_process");

function run(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    console.log(`[dev:all] "${name}" afgesloten (exit ${code}).`);
  });
  child.on("error", (err) => {
    console.error(`[dev:all] "${name}" kon niet starten:`, err.message);
  });
  return child;
}

console.log("[dev:all] Backend (:3001) + add-in (:3000 + sideload) starten…");
const backend = run("backend", "node", ["server/index.js"]);
const addin = run("addin", "npm", ["start"]);

function shutdown() {
  console.log("\n[dev:all] Afsluiten…");
  backend.kill();
  addin.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
