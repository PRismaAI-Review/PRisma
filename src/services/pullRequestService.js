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
    console.log('Fetching PR diff...');
    const diff = await fetchPullRequestDiff(repoOwner, repoName, prNumber);
    console.log('Diff fetched successfully, length:', diff.length);
    
    try {
      // Step 2: Analyze with AI
      console.log('Analyzing code with Gemini...');
      const aiAnalysis = await analyzeCodeWithGemini(diff, payload.pull_request);
      console.log('AI analysis complete:', JSON.stringify(aiAnalysis).substring(0, 200) + '...');
      
      // Step 3: Post review comments
      console.log('Posting review comments...');
      await postReviewComments(repoOwner, repoName, prNumber, aiAnalysis);
      
      console.log(`Successfully processed PR #${prNumber}`);
    } catch (error) {
      console.error('Error in AI processing or comment posting:', error);
      if (error.message && error.message.includes('rate limit')) {
        console.log('Rate limit reached, posting fallback comment');
        await postPullRequestComment(
          repoOwner,
          repoName,
          prNumber,
          '⚠️ **PRisma bot:** Rate Limit Notice - PRisma is currently rate limited by the Gemini API. Your PR will be analyzed when capacity becomes available. Thank you for your patience!'
        );
      } else {
        // Post a generic error comment
        await postPullRequestComment(
          repoOwner,
          repoName,
          prNumber,
          '⚠️ **PRisma bot:** An error occurred while analyzing this PR. Please check the server logs for more details.'
        );
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
