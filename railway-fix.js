// Temporary fix for Railway deployment
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

console.log('Current working directory:', process.cwd());
console.log('Environment:', process.env.NODE_ENV);

// Start the actual server
const serverProcess = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

serverProcess.on('error', (err) => {
  console.error('Server process error:', err);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});