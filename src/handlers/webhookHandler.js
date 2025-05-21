const { processPullRequest } = require('../services/pullRequestService');
const crypto = require('crypto');

function webhookHandler(req, res) {

  try {
    const event = req.headers['x-github-event'];
    
    // Verify webhook signature if secret is configured
    if (process.env.WEBHOOK_SECRET) {
      const signature = req.headers['x-hub-signature-256'];
      const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
      
      if (signature !== digest) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
    
    // Handle pull request events
    if (event === 'pull_request' && 
        (req.body.action === 'opened' || req.body.action === 'synchronize')) {
      processPullRequest(req.body)
        .then(() => {
          console.log('Pull request processed successfully');
        })
        .catch(error => {
          console.error('Error processing pull request:', error);
        });
    }
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = webhookHandler;
