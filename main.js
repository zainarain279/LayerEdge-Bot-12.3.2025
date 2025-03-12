import fs from "fs/promises";
import log from "./utils/logger.js";
import { readFile, delay, readJson } from "./utils/helper.js";
import banner from "./utils/banner.js";
import LayerEdge from "./utils/socket.js";
import readline from "readline";
import chalk from "chalk";
import { config } from "./config.js";
// Function to read wallets
async function readWallets() {
  try {
    await fs.access("wallets.json");

    const data = await fs.readFile("wallets.json", "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      log.info("No wallets found in wallets.json");
      return [];
    }
    throw err;
  }
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function run() {
  log.info(chalk.yellow(banner));
  await delay(3);

  const proxies = await readFile("proxy.txt");
  let wallets = await readWallets();
  const localStorage = await readJson("localStorage.json");
  const tasks = await readJson("tasks.json", []);

  let useProxy = await askQuestion("Use Proxy or Not (y/n): ");
  useProxy = useProxy.toLowerCase() === "y";
  if (useProxy && proxies.length < wallets.length) {
    log.error(`Proxy and Wallets not equal | Proxy: ${proxies.length} - Wallets: ${wallets.length}`);
    return;
  }

  if (proxies.length === 0) log.warn("No proxies found in proxy.txt - running without proxies");
  if (wallets.length === 0) {
    log.info('No Wallets found, creating new Wallets first "npm run autoref"');
    return;
  }

  log.info("Starting run Program with all Wallets:", wallets.length);

  while (true) {
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      const proxy = useProxy ? proxies[i % proxies.length] || null : null;
      const { address, privateKey } = wallet;
      try {
        const socket = new LayerEdge(proxy, privateKey, config.ref_code, localStorage, tasks);
        log.info(`Processing Wallet Address: ${address} with proxy:`, proxy);
        log.info(`Checking Node Status for: ${address}`);
        const isRunning = await socket.checkNodeStatus();

        if (isRunning) {
          log.info(`Wallet ${address} is running - trying to claim node points...`);
          await socket.stopNode();
        }

        log.info(`Trying to reconnect node for Wallet: ${address}`);
        await socket.connectNode();

        log.info(`Checking Node Points for Wallet: ${address}`);
        await socket.checkNodePoints();

        log.info(`Checking tasks for Wallet: ${address}`);
        await socket.handleTasks();
      } catch (error) {
        log.error(`Error Processing wallet:`, error.message);
      }
    }
    log.warn(`All Wallets have been processed, waiting 20 hours before next run...`);
    await delay(20 * 60 * 60);
  }
}

run();
