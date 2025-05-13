const crypto = require('crypto');

/**
 * Verifies the GitHub webhook signature
 */
function verifyWebhookSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.log('No signature found in request headers');
    return false;
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log("test...");
    console.error('WEBHOOK_SECRET environment variable is not set');
    return false;
  }

  try {
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

module.exports = {
  verifyWebhookSignature
};
