require('dotenv').config();

const config = {
  phabricator: {
    baseUrl: process.env.PHAB_URL,
    apiToken: process.env.PHAB_API_TOKEN,
    userPhid: process.env.YOUR_USER_PHID,
  },

  polling: {
    intervalMs: parseInt(process.env.POLL_INTERVAL_MS, 10) || 15 * 60 * 1000, // 15 minutes
    delayBetweenPrintsMs: parseInt(process.env.PRINT_DELAY_MS, 10) || 1000,
  },

  printer: {
    type: process.env.PRINTER_TYPE || 'usb', // 'usb' or 'network'
    networkHost: process.env.PRINTER_HOST,
    networkPort: parseInt(process.env.PRINTER_PORT, 10) || 9100,
    paperWidth: parseInt(process.env.PAPER_WIDTH, 10) || 58, // mm (58 or 80 common)
  },

  filters: {
    // Column names to match for sprint tasks (case-insensitive)
    sprintColumns: (process.env.SPRINT_COLUMNS || 'sprint,to do,in progress,doing')
      .split(',')
      .map(s => s.trim().toLowerCase()),

    // Only open tasks by default
    statuses: (process.env.TASK_STATUSES || 'open').split(',').map(s => s.trim()),
  },
};

// Validation
function validateConfig() {
  const errors = [];

  if (!config.phabricator.apiToken) {
    errors.push('PHAB_API_TOKEN is required');
  }

  if (!config.phabricator.userPhid) {
    errors.push('YOUR_USER_PHID is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nPlease check your .env file');
    process.exit(1);
  }
}

module.exports = { config, validateConfig };
