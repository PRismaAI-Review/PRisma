const { fetchPullRequestDiff, postReviewComments, postPullRequestComment } = require('./githubService');
const { analyzeCodeWithGemini } = require('./aiService');

async function processPullRequest(payload) {
  try {
    const prNumber = payload.pull_request.number;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    const diff = await fetchPullRequestDiff(repoOwner, repoName, prNumber);
    
    try {
      const aiAnalysis = await analyzeCodeWithGemini(diff, payload.pull_request);
      await postReviewComments(repoOwner, repoName, prNumber, aiAnalysis);
    } catch (error) {
      console.error('Error in AI analysis or posting comments:', error);
      if (error.message && error.message.includes('rate limit')) {
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

