const { config } = require('../config');

class PrinterService {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.printedTasks = new Set();
    this.loadPrintedTasks();

    // Only load escpos if not in dry-run mode
    if (!this.dryRun) {
      this.escpos = require('escpos');
      this.escpos.USB = require('escpos-usb');
    }
  }

  /**
   * Load previously printed tasks from storage
   * This prevents reprinting on restart
   */
  loadPrintedTasks() {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.join(__dirname, '../../.printed-tasks.json');

    try {
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        data.forEach(id => this.printedTasks.add(id));
        console.log(`Loaded ${this.printedTasks.size} previously printed tasks`);
      }
    } catch (err) {
      console.warn('Could not load printed tasks cache:', err.message);
    }
  }

  /**
   * Save printed tasks to storage
   */
  savePrintedTasks() {
    const fs = require('fs');
    const path = require('path');
    const cacheFile = path.join(__dirname, '../../.printed-tasks.json');

    try {
      fs.writeFileSync(cacheFile, JSON.stringify([...this.printedTasks]), 'utf8');
    } catch (err) {
      console.warn('Could not save printed tasks cache:', err.message);
    }
  }

  /**
   * Check if task was already printed
   */
  isAlreadyPrinted(taskId) {
    return this.printedTasks.has(taskId);
  }

  /**
   * Mark task as printed
   */
  markPrinted(taskId) {
    this.printedTasks.add(taskId);
    this.savePrintedTasks();
  }

  /**
   * Clear the printed tasks cache (for reprinting all)
   */
  clearCache() {
    this.printedTasks.clear();
    this.savePrintedTasks();
    console.log('Printed tasks cache cleared');
  }

  /**
   * Get printer device based on configuration
   */
  getDevice() {
    if (config.printer.type === 'network') {
      const Network = require('escpos-network');
      return new Network(config.printer.networkHost, config.printer.networkPort);
    }
    return new this.escpos.USB();
  }

  /**
   * Truncate string to max length
   */
  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
  }

  /**
   * Simulate printing a task (dry-run mode)
   */
  simulatePrint(task) {
    const maxWidth = config.printer.paperWidth === 80 ? 48 : 32;
    const separator = '─'.repeat(maxWidth);

    console.log('');
    console.log('┌' + '─'.repeat(maxWidth + 2) + '┐');
    console.log('│' + task.id.padStart((maxWidth + 2 + task.id.length) / 2).padEnd(maxWidth + 2) + '│');
    console.log('│' + separator.padStart((maxWidth + 2 + separator.length) / 2).padEnd(maxWidth + 2) + '│');
    console.log('│ ' + this.truncate(task.title, maxWidth).padEnd(maxWidth) + ' │');
    console.log('│' + ' '.repeat(maxWidth + 2) + '│');
    console.log('│ ' + `Priority: ${task.priority}`.padEnd(maxWidth) + ' │');
    console.log('│ ' + `Points:   ${task.points}`.padEnd(maxWidth) + ' │');
    console.log('│ ' + `Status:   ${task.status}`.padEnd(maxWidth) + ' │');
    console.log('│' + ' '.repeat(maxWidth + 2) + '│');
    console.log('│ ' + `Column: ${task.columns.join(', ') || 'N/A'}`.substring(0, maxWidth).padEnd(maxWidth) + ' │');
    console.log('│' + ' '.repeat(maxWidth + 2) + '│');
    // console.log('│' + separator.padStart((maxWidth + 2 + separator.length) / 2).padEnd(maxWidth + 2) + '│');
    console.log('└' + '─'.repeat(maxWidth + 2) + '┘');
    console.log('');

    return true;
  }

  /**
   * Print a single task ticket
   */
  async printTask(task) {
    if (this.isAlreadyPrinted(task.id)) {
      console.log(`[SKIP] ${task.id} already printed`);
      return false;
    }

    // Dry-run mode: simulate printing
    if (this.dryRun) {
      console.log(`[DRY-RUN] Simulating print for ${task.id}`);
      this.simulatePrint(task);
      // Don't mark as printed in dry-run mode
      return true;
    }

    const device = this.getDevice();
    const options = { encoding: 'UTF-8' };
    const printer = new this.escpos.Printer(device, options);

    return new Promise((resolve, reject) => {
      device.open(err => {
        if (err) {
          console.error(`[ERROR] Could not open printer: ${err.message}`);
          return reject(err);
        }

        try {
          const maxWidth = config.printer.paperWidth === 80 ? 48 : 32;
          const separator = '─'.repeat(maxWidth);

          printer
            // Header with Task ID
            .font('a')
            .align('ct')
            .size(2, 2)
            .style('b')
            .text(task.id)
            .size(1, 1)
            .style('normal')
            .text(separator)

            // Title
            .align('lt')
            .style('b')
            .text(this.truncate(task.title, maxWidth))
            .style('normal')
            .text('')

            // Priority and Points
            .text(`Priority: ${task.priority}`)
            .text(`Points:   ${task.points}`)
            .text(`Status:   ${task.status}`)
            .text('')

            // Column (where it is on the board)
            .text(`Column: ${task.columns.join(', ') || 'N/A'}`)
            .text('')

            // Separator
            .text(separator)

            // URL (small font)
            .align('ct')
            .font('b')
            .size(1, 1)
            .text(task.url)

            // Feed and cut
            .feed(4)
            .cut()
            .close();

          this.markPrinted(task.id);
          console.log(`[PRINT] ${task.id}: ${this.truncate(task.title, 40)}`);
          resolve(true);
        } catch (printErr) {
          console.error(`[ERROR] Print failed for ${task.id}:`, printErr.message);
          reject(printErr);
        }
      });
    });
  }

  /**
   * Print a test ticket
   */
  async printTest() {
    const testTask = {
      id: 'T00000',
      title: 'Test Ticket - PhabPrint',
      priority: 'Normal',
      points: '3',
      status: 'Open',
      columns: ['Test Column'],
      url: 'https://phabricator.example.com/T00000',
    };

    // Temporarily allow printing test task
    this.printedTasks.delete(testTask.id);

    return this.printTask(testTask);
  }

  /**
   * Print multiple tasks with delay between each
   */
  async printTasks(tasks, delayMs = 1000) {
    let printedCount = 0;

    for (const task of tasks) {
      try {
        const printed = await this.printTask(task);
        if (printed) {
          printedCount++;
          // Delay between prints to avoid overwhelming printer
          if (tasks.indexOf(task) < tasks.length - 1) {
            await this.sleep(delayMs);
          }
        }
      } catch (err) {
        console.error(`[ERROR] Failed to print ${task.id}:`, err.message);
      }
    }

    return printedCount;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PrinterService;
