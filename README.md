# PhabPrint

Physical Kanban board printer for Phabricator tasks. Automatically prints task tickets on a thermal printer during sprint planning ceremonies.

## Overview

PhabPrint bridges your digital Phabricator board with a physical Kanban board by:

1. Polling Phabricator for tasks assigned to you
2. Filtering tasks that are in sprint columns (configurable)
3. Printing task tickets on a thermal receipt printer
4. Tracking printed tasks to avoid duplicates

## Hardware Requirements

### Thermal Printer

Recommended models (ESC/POS compatible):

| Model | Paper Width | Connection | Price Range |
|-------|-------------|------------|-------------|
| **HOIN HOP-H58** | 58mm | USB | ~$25-30 |
| **MUNBYN ITPP047** | 80mm | USB/Bluetooth | ~$40-50 |
| **Epson TM-T20III** | 80mm | USB/Network | ~$200+ |
| **GOOJPRT PT-210** | 58mm | Bluetooth | ~$30 |

**Recommendation**: Start with a cheap 58mm USB printer (like HOIN HOP-H58) for testing. The 58mm width is perfect for small task tickets.

### Physical Board

Materials for your physical Kanban board:

- **Whiteboard or corkboard**: 60x90cm or larger
- **Magnetic strips or pins**: To attach tickets
- **Colored tape**: To create swim lanes
- **Small magnets**: To move tickets between columns

### Suggested Layout

```
┌─────────────────────────────────────────────────────┐
│  BACKLOG  │   TO DO   │   DOING   │     DONE       │
├───────────┼───────────┼───────────┼────────────────┤
│           │  [T1234]  │  [T5678]  │   [T9012]      │
│           │  [T1235]  │           │   [T9013]      │
│           │           │           │   [T9014]      │
└─────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Node.js 18+
- A Phabricator account with API access
- A thermal printer (USB or network)

### Setup

1. Clone and install dependencies:

```bash
cd PhabPrint
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - Your Phabricator API token
   - Your user PHID
   - Sprint column names (optional)

### Getting Your Phabricator Credentials

#### API Token

1. Go to your Phabricator instance
2. Navigate to **Settings** > **Conduit API Tokens**
3. Click **Generate Token**
4. Copy the token (format: `api-xxxxxxxxxxxxx`)

#### User PHID

1. Go to **People** in Phabricator
2. Click on your profile
3. Look at the URL: `https://phabricator.example.com/p/username/`
4. Use the Conduit console to call `user.whoami` to get your PHID

Or use this curl command:

```bash
curl https://phabricator.example.com/api/user.whoami \
  -d api.token=YOUR_TOKEN
```

## Usage

### Test Printer Connection

```bash
npm run test-printer
```

This will scan for USB printers and print a test ticket.

### Start Polling

```bash
npm start
```

This starts the polling loop (default: every 15 minutes).

### One-Shot Mode

Print all current sprint tasks once and exit:

```bash
npm run print-once
```

### Clear Cache

If you want to reprint all tasks (e.g., new sprint):

```bash
node src/index.js --clear-cache
```

## Configuration

All configuration is done via environment variables in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PHAB_URL` | Phabricator API URL |
| `PHAB_API_TOKEN` | Your API token | (required) |
| `YOUR_USER_PHID` | Your user PHID | (required) |
| `POLL_INTERVAL_MS` | Polling interval | `900000` (15 min) |
| `SPRINT_COLUMNS` | Column names to match | `sprint,to do,in progress,doing` |
| `PRINTER_TYPE` | `usb` or `network` | `usb` |
| `PAPER_WIDTH` | Paper width (58 or 80 mm) | `58` |

## Ticket Format

Each printed ticket includes:

```
        T12345
────────────────────────────────
Fix login button alignment

Priority: High
Points:   3
Status:   Open

Column: Sprint Backlog

────────────────────────────────
  phabricator.example.com/T12345
```

## Workflow

### Sprint Planning Ceremony

1. Start PhabPrint before the meeting: `npm start`
2. As tasks are moved to sprint columns in Phabricator, they auto-print
3. Place printed tickets on your physical board
4. Move tickets as you work on them

### Daily Use

1. Keep PhabPrint running in the background
2. New tasks added to sprint columns will print automatically
3. Move physical tickets to match your progress
4. Archive completed tickets at sprint end

## Troubleshooting

### Printer Not Found

```
No USB printers found.
```

**Solutions:**
- Ensure printer is connected and powered on
- On macOS: `brew install libusb`
- On Linux: Add udev rules for your printer
- Try a different USB port

### Permission Denied (Linux)

```bash
# Add udev rule for your printer
sudo nano /etc/udev/rules.d/99-usb-printer.rules

# Add this line (adjust vendor/product IDs):
SUBSYSTEM=="usb", ATTR{idVendor}=="0416", ATTR{idProduct}=="5011", MODE="0666"

# Reload rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### API Errors

```
Phabricator API error: ...
```

**Solutions:**
- Verify your API token is valid
- Check your user PHID is correct
- Ensure you have permissions to access the projects

## Project Structure

```
PhabPrint/
├── src/
│   ├── config/
│   │   └── index.js       # Configuration loader
│   ├── services/
│   │   ├── phabricator.js # Phabricator API client
│   │   └── printer.js     # Thermal printer service
│   ├── index.js           # Main entry point
│   └── test-printer.js    # Printer test utility
├── .env.example           # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Future Ideas

- [ ] QR code on tickets linking to task URL
- [ ] Color-coded printing by priority
- [ ] Web dashboard to trigger manual prints
- [ ] Slack/Discord integration for print notifications
- [ ] Support for multiple team members
- [ ] Barcode / QR code scanning to mark tasks complete

