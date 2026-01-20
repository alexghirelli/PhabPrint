#!/usr/bin/env node

const { config, validateConfig } = require('./config');
const PhabricatorService = require('./services/phabricator');
const PrinterService = require('./services/printer');

// ASCII art banner
const banner = `
╔═══════════════════════════════════════════╗
║   📋 PhabPrint - Physical Kanban Printer  ║
║   ─────────────────────────────────────   ║
║   Phabricator → Thermal Printer           ║
╚═══════════════════════════════════════════╝
`;

class PhabPrint {
  constructor() {
    this.phabricator = new PhabricatorService();
    this.printer = new PrinterService();
    this.isRunning = false;
  }

  /**
   * Fetch and print sprint tasks
   */
  async pollAndPrint() {
    console.log('\n[POLL] Checking for new sprint tasks...');

    try {
      // Get tasks from Phabricator
      const tasks = await this.phabricator.getSprintTasks();
      console.log(`[INFO] Found ${tasks.length} tasks in sprint columns`);

      if (tasks.length === 0) {
        console.log('[INFO] No tasks to print');
        return;
      }

      // Format tasks for printing
      const formattedTasks = tasks.map(task =>
        this.phabricator.formatTaskForPrint(task)
      );

      // Print new tasks
      const printedCount = await this.printer.printTasks(
        formattedTasks,
        config.polling.delayBetweenPrintsMs
      );

      console.log(`[DONE] Printed ${printedCount} new task(s)`);
    } catch (err) {
      console.error('[ERROR] Poll failed:', err.message);
      if (process.env.DEBUG) {
        console.error(err.stack);
      }
    }
  }

  /**
   * Start the polling loop
   */
  async start() {
    console.log(banner);
    validateConfig();

    console.log('[CONFIG] Phabricator URL:', config.phabricator.baseUrl);
    console.log('[CONFIG] User PHID:', config.phabricator.userPhid);
    console.log('[CONFIG] Poll interval:', config.polling.intervalMs / 1000, 'seconds');
    console.log('[CONFIG] Sprint columns:', config.filters.sprintColumns.join(', '));
    console.log('');

    this.isRunning = true;

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    // Initial poll
    await this.pollAndPrint();

    // Check if running in one-shot mode
    if (process.argv.includes('--once')) {
      console.log('\n[INFO] One-shot mode, exiting...');
      process.exit(0);
    }

    // Start polling loop
    console.log(`\n[INFO] Starting polling loop (every ${config.polling.intervalMs / 60000} minutes)`);
    console.log('[INFO] Press Ctrl+C to stop\n');

    this.pollInterval = setInterval(
      () => this.pollAndPrint(),
      config.polling.intervalMs
    );
  }

  /**
   * Stop the polling loop
   */
  stop() {
    console.log('\n[INFO] Shutting down...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    process.exit(0);
  }

  /**
   * Clear the printed tasks cache
   */
  clearCache() {
    this.printer.clearCache();
  }
}

// CLI handling
async function main() {
  const app = new PhabPrint();

  // Handle CLI arguments
  if (process.argv.includes('--clear-cache')) {
    app.clearCache();
    console.log('Cache cleared. Run again without --clear-cache to print all tasks.');
    process.exit(0);
  }

  if (process.argv.includes('--test-printer')) {
    console.log('[TEST] Printing test ticket...');
    try {
      await app.printer.printTest();
      console.log('[TEST] Test ticket printed successfully!');
    } catch (err) {
      console.error('[TEST] Failed:', err.message);
    }
    process.exit(0);
  }

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
PhabPrint - Physical Kanban Printer for Phabricator

Usage:
  npm start              Start polling for tasks
  npm run print-once     Print once and exit
  npm run test-printer   Print a test ticket

Options:
  --once          Run once and exit (no polling)
  --clear-cache   Clear printed tasks cache (will reprint all)
  --test-printer  Print a test ticket
  --help, -h      Show this help

Environment Variables:
  PHAB_URL           Phabricator API URL
  PHAB_API_TOKEN     Your Phabricator API token (required)
  YOUR_USER_PHID     Your Phabricator user PHID (required)
  POLL_INTERVAL_MS   Polling interval in ms (default: 900000 = 15 min)
  SPRINT_COLUMNS     Comma-separated column names (default: sprint,to do,in progress,doing)
  PRINTER_TYPE       'usb' or 'network' (default: usb)
  PRINTER_HOST       Network printer hostname (if using network)
  PRINTER_PORT       Network printer port (default: 9100)
  PAPER_WIDTH        Paper width in mm: 58 or 80 (default: 58)
`);
    process.exit(0);
  }

  await app.start();
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
