/**
 * Phabricator Conduit API Service
 *
 * IMPORTANT: This service uses curl instead of standard HTTP libraries
 * (axios, fetch, etc.) because Wikimedia blocks requests that don't come
 * from curl with a 403 error. They likely use TLS fingerprinting or other
 * bot detection techniques that identify Node.js HTTP clients.
 * Tested: axios, node-fetch, native fetch - all blocked with 403.
 * Only curl works.
 */
const { execSync } = require('child_process');
const { config } = require('../config');

class PhabricatorService {
  constructor() {
    this.baseUrl = config.phabricator.baseUrl;
    this.apiToken = config.phabricator.apiToken;
    this.userPhid = config.phabricator.userPhid;
  }

  /**
   * Flatten nested object to PHP-style form params
   * e.g., { constraints: { members: ['PHID-USER-xxx'] } }
   * becomes: { 'constraints[members][0]': 'PHID-USER-xxx' }
   */
  flattenParams(obj, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}[${key}]` : key;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.assign(result, this.flattenParams(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = item;
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.assign(result, this.flattenParams(value, newKey));
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }

  /**
   * Make a Conduit API call to Phabricator using curl
   * (Wikimedia blocks standard HTTP clients, but allows curl)
   */
  async conduitCall(method, params = {}) {
    const url = `${this.baseUrl}/${method}`;

    // Build curl arguments
    const curlArgs = ['--data-urlencode', `api.token=${this.apiToken}`];

    // Flatten nested params to PHP-style form encoding
    const flatParams = this.flattenParams(params);
    for (const [key, value] of Object.entries(flatParams)) {
      curlArgs.push('--data-urlencode', `${key}=${value}`);
    }

    // Execute curl
    const curlCmd = `curl -s -X POST ${curlArgs.map(a => `'${a}'`).join(' ')} '${url}'`;

    try {
      const output = execSync(curlCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      const data = JSON.parse(output);

      if (data.error_code) {
        throw new Error(`Phabricator API error: ${data.error_info}`);
      }

      return data.result;
    } catch (err) {
      if (err.message.includes('Phabricator API error')) {
        throw err;
      }
      throw new Error(`curl failed: ${err.message}`);
    }
  }

  /**
   * Get tasks assigned to the user
   */
  async getMyTasks() {
    const result = await this.conduitCall('maniphest.search', {
      constraints: {
        assigned: [this.userPhid],
        statuses: config.filters.statuses,
      },
      attachments: {
        projects: true,
        columns: true,
      },
      limit: 100,
    });

    return result.data;
  }

  /**
   * Get tasks that are currently in sprint columns
   */
  async getSprintTasks() {
    // 1. Get all tasks assigned to the user
    const tasks = await this.getMyTasks();

    // 2. Filter tasks in sprint columns
    return this.filterSprintTasks(tasks);
  }

  /**
   * Filter tasks that are in sprint-related columns
   */
  filterSprintTasks(tasks) {
    const sprintKeywords = config.filters.sprintColumns;

    // Pre-compile regex for faster matching
    const sprintPattern = new RegExp(sprintKeywords.join('|'), 'i');

    return tasks.filter(task => {
      const columnsData = task.attachments?.columns?.boards;
      if (!columnsData) return false;

      for (const board of Object.values(columnsData)) {
        for (const col of board.columns) {
          if (sprintPattern.test(col.name)) {
            return true;
          }
        }
      }
      return false;
    });
  }


  /**
   * Format task data for printing
   */
  formatTaskForPrint(task) {
    const taskId = `T${task.id}`;
    const title = task.fields.name || 'Untitled';
    const priority = task.fields.priority?.name || 'Unknown';
    const points = task.fields.points ?? 'N/A';
    const status = task.fields.status?.name || 'Unknown';

    // Get project names from attachments
    const projectPhids = task.attachments?.projects?.projectPHIDs || [];

    // Get column names
    const columns = [];
    const columnsData = task.attachments?.columns?.boards;
    if (columnsData) {
      Object.values(columnsData).forEach(board => {
        board.columns.forEach(col => columns.push(col.name));
      });
    }

    return {
      id: taskId,
      numericId: task.id,
      title,
      priority,
      points,
      status,
      projectPhids,
      columns,
      url: `${this.baseUrl.replace('/api', '')}/${taskId}`,
    };
  }
}

module.exports = PhabricatorService;
