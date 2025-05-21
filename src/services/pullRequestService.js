const { fetchPullRequestDiff, postReviewComments, postPullRequestComment } = require('./githubService');
const { analyzeCodeWithGemini } = require('./aiService');

async function processPullRequest(payload) {
  try {
    const prNumber = payload.pull_request.number;
    const repoOwner = payload.repository.owner.login;
    const repoName = payload.repository.name;
    
    console.log(`Processing PR #${prNumber} for ${repoOwner}/${repoName}`);
    console.log(`PR head SHA: ${payload.pull_request.head.sha}`);
    
    // Step 1: Fetch PR diff and metadata
    console.log('Fetching PR diff...');
    const diff = await fetchPullRequestDiff(repoOwner, repoName, prNumber);
    console.log(`Fetched diff of length: ${diff.length}`);
    
    try {
      // Step 2: Analyze with AI
      console.log('Analyzing with Gemini...');
      const aiAnalysis = await analyzeCodeWithGemini(diff, payload.pull_request);
      console.log('Gemini analysis complete:', JSON.stringify(aiAnalysis, null, 2));
      
      // Step 3: Post review comments (now includes test instructions as first comment)
      console.log('Posting review comments...');
      await postReviewComments(repoOwner, repoName, prNumber, aiAnalysis);
      
      console.log(`Successfully processed PR #${prNumber}`);
    } catch (error) {
      console.error('Error in AI analysis or posting comments:', error);
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

