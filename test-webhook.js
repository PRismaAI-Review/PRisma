require('dotenv').config({ path: './config.env' });
const axios = require('axios');
const crypto = require('crypto');

async function testWebhook() {
  try {
    // Replace with your server URL
    const webhookUrl = 'http://localhost:3000/webhook';
    
    // Sample pull request payload
    const payload = {
      action: 'opened',
      pull_request: {
        number: 1, // Replace with actual PR number
        title: 'Test PR for PRisma Bot',
        body: 'This is a test pull request to verify PRisma Bot functionality',
        head: {
          sha: 'abc123', // This is a placeholder, will be ignored in test
          ref: 'feature-branch'
        }
      },
      repository: {
        name: 'PRisma',
        owner: {
          login: 'misstry'
        }
      }
    };
    
    // Create signature using webhook secret
    const secret = process.env.WEBHOOK_SECRET;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    console.log('Sending test webhook payload to:', webhookUrl);
    
    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'X-GitHub-Event': 'pull_request',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'X-Hub-Signature-256': `sha256=${signature}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Webhook test successful!');
    console.log('Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    
    return true;
  } catch (error) {
    console.error('Webhook test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

testWebhook();
