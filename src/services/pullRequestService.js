const { fetchPullRequestDiff, postReviewComments, postPullRequestComment } = require('./githubService');
const { analyzeCodeWithGemini } = require('./aiService');

/**
 * Processes a pull request by fetching the diff,
 * analyzing it with AI, and posting review comments
 */
async function processPullRequest(payload) {
  try {
    const prNumber = payload.pull_request.number;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    
    console.log(`Processing PR #${prNumber} for ${repoOwner}/${repoName}`);
    
    // Step 1: Fetch PR diff and metadata
    const diff = await fetchPullRequestDiff(repoOwner, repoName, prNumber);
    
    try {
      // Step 2: Analyze with AI
      const aiAnalysis = await analyzeCodeWithGemini(diff, payload.pull_request);
      
      // Step 3: Post review comments
      await postReviewComments(repoOwner, repoName, prNumber, aiAnalysis);
      
      console.log(`Successfully processed PR #${prNumber}`);
    } catch (error) {
      if (error.message && error.message.includes('rate limit')) {
        console.log('Rate limit reached, posting fallback comment');
        await postPullRequestComment(
          repoOwner,
          repoName,
          prNumber,
          '⚠️ **Rate Limit Notice**: PRisma is currently rate limited by the Gemini API. Your PR will be analyzed when capacity becomes available. Thank you for your patience!'
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error processing pull request:', error);
    throw error;
  }
}

module.exports = {
  processPullRequest
};
