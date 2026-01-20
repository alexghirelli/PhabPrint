#!/usr/bin/env node

/**
 * Test script to verify printer connection and functionality
 * Run with: npm run test-printer
 */

const escpos = require('escpos');
escpos.USB = require('escpos-usb');

console.log('PhabPrint - Printer Test');
console.log('========================\n');

// List available USB printers
console.log('Scanning for USB printers...\n');

try {
  const devices = escpos.USB.findPrinter();

  if (devices.length === 0) {
    console.log('No USB printers found.');
    console.log('\nTroubleshooting tips:');
    console.log('  1. Make sure the printer is connected and powered on');
    console.log('  2. On macOS, you may need to install libusb: brew install libusb');
    console.log('  3. On Linux, you may need to add udev rules for your printer');
    console.log('  4. Try unplugging and reconnecting the printer');
    process.exit(1);
  }

  console.log(`Found ${devices.length} USB printer(s):\n`);
  devices.forEach((device, index) => {
    console.log(`  [${index}] Vendor: 0x${device.deviceDescriptor.idVendor.toString(16)}`);
    console.log(`      Product: 0x${device.deviceDescriptor.idProduct.toString(16)}`);
    console.log('');
  });

  // Try to print a test page
  console.log('Attempting to print test page...\n');

  const device = new escpos.USB();
  const printer = new escpos.Printer(device, { encoding: 'UTF-8' });

  device.open(err => {
    if (err) {
      console.error('Failed to open printer:', err.message);
      console.log('\nIf you see permission errors, try running with sudo (Linux)');
      console.log('or check System Preferences > Security & Privacy (macOS)');
      process.exit(1);
    }

    printer
      .font('a')
      .align('ct')
      .size(2, 2)
      .style('b')
      .text('PhabPrint')
      .size(1, 1)
      .style('normal')
      .text('────────────────────────────────')
      .text('')
      .align('lt')
      .text('Printer test successful!')
      .text('')
      .text('Your thermal printer is ready')
      .text('to print Phabricator tasks.')
      .text('')
      .text('────────────────────────────────')
      .align('ct')
      .text(new Date().toLocaleString())
      .feed(4)
      .cut()
      .close();

    console.log('Test page printed successfully!');
    console.log('Your printer is ready to use with PhabPrint.');
  });
} catch (err) {
  console.error('Error:', err.message);
  console.log('\nMake sure the escpos and escpos-usb packages are installed:');
  console.log('  npm install');
  process.exit(1);
}
