require('dotenv').config({ path: './config.env' });
const express = require('express');
const bodyParser = require('body-parser');
const webhookHandler = require('./handlers/webhookHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

app.use(bodyParser.json({
  limit: '10mb'
}));
app.use(bodyParser.urlencoded({
  limit: '10mb',
  extended: true
}));

// In src/index.js
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'PRisma is running. Use /webhook endpoint for GitHub webhook events.'
  });
});


// Routes
app.post('/webhook', webhookHandler);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`PRisma server running on port ${PORT}`);
});
// Test webhook
// Test webhook
// Test comment for PRisma webhook
// Test webhook
// Test webhook
// Test webhook
