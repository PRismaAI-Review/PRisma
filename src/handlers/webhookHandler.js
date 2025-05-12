const { processPullRequest } = require('../services/pullRequestService');
const { verifyWebhookSignature } = require('../utils/security');

/**
 * Handles GitHub webhook events
 */
async function webhookHandler(req, res) {
  console.log('Webhook received:', req.headers['x-github-event']);
  console.log('Payload:', JSON.stringify(req.body, null, 2).substring(0, 500) + '...');
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Only process pull request events
    if (event === 'pull_request' && 
        (payload.action === 'opened' || payload.action === 'synchronize')) {
      
      // Process asynchronously to avoid blocking the response
      processPullRequest(payload).catch(err => {
        console.error('Error processing pull request:', err);
      });
      
      res.status(202).json({ message: 'Processing pull request' });
    } else {
      res.status(200).json({ message: 'Event ignored' });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = webhookHandler;
