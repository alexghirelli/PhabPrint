const axios = require('axios');
const { config } = require('../config');

class PhabricatorService {
  constructor() {
    this.baseUrl = config.phabricator.baseUrl;
    this.apiToken = config.phabricator.apiToken;
    this.userPhid = config.phabricator.userPhid;
  }

  /**
   * Make a Conduit API call to Phabricator
   */
  async conduitCall(method, params = {}) {
    const formData = new URLSearchParams();
    formData.append('api.token', this.apiToken);

    // Flatten params for form encoding
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    }

    const response = await axios.post(`${this.baseUrl}/${method}`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.data.error_code) {
      throw new Error(`Phabricator API error: ${response.data.error_info}`);
    }

    return response.data.result;
  }

  /**
   * Get all projects where the user is a member
   */
  async getMyProjects() {
    const result = await this.conduitCall('project.search', {
      constraints: {
        members: [this.userPhid],
      },
      limit: 100,
    });

    return result.data;
  }

  /**
   * Get tasks assigned to the user in specified projects
   */
  async getMyTasks(projectPhids) {
    const result = await this.conduitCall('maniphest.search', {
      constraints: {
        assigned: [this.userPhid],
        statuses: config.filters.statuses,
        projects: projectPhids,
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
   * Get column information for a project board
   */
  async getProjectColumns(projectPhid) {
    const result = await this.conduitCall('project.column.search', {
      constraints: {
        projects: [projectPhid],
      },
    });

    return result.data;
  }

  /**
   * Get tasks that are currently in sprint columns
   */
  async getSprintTasks() {
    // 1. Get user's projects
    const projects = await this.getMyProjects();
    const projectPhids = projects.map(p => p.phid);

    if (projectPhids.length === 0) {
      console.log('No projects found for user');
      return [];
    }

    // 2. Get tasks in those projects
    const tasks = await this.getMyTasks(projectPhids);

    // 3. Filter tasks in sprint columns
    const sprintTasks = this.filterSprintTasks(tasks);

    return sprintTasks;
  }

  /**
   * Filter tasks that are in sprint-related columns
   */
  filterSprintTasks(tasks) {
    const sprintKeywords = config.filters.sprintColumns;

    return tasks.filter(task => {
      const columnsData = task.attachments?.columns?.boards;
      if (!columnsData) return false;

      // Check if task is in any sprint-related column
      return Object.values(columnsData).some(board =>
        board.columns.some(col =>
          sprintKeywords.some(keyword =>
            col.name.toLowerCase().includes(keyword)
          )
        )
      );
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
