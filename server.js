const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize database
require('./database/init');

// Import routes
const santriRoutes = require('./routes/santri');
const izinRoutes = require('./routes/izin');
const aksesRoutes = require('./routes/akses');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for mobile access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/santri', santriRoutes);
app.use('/api/izin', izinRoutes);
app.use('/api/akses', aksesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`API available at http://${HOST}:${PORT}/api`);
  console.log(`\nLocal access: http://localhost:${PORT}`);
  
  // Get local IP address for network access
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  console.log('\nNetwork access (use this IP for Android):');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  - http://${net.address}:${PORT}`);
      }
    }
  }
});

module.exports = app;
