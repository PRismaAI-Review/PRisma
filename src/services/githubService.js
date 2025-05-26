const axios = require('axios');

// GitHub API client
const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json'
  }
});

/**
 * Fetches the diff for a pull request
 */
async function fetchPullRequestDiff(owner, repo, prNumber) {
  try {
    const response = await githubClient.get(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.diff'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching PR diff:', error);
    throw error;
  }
}

/**
 * Posts a simple comment on a pull request
 */
async function postPullRequestComment(owner, repo, prNumber, body) {
  try {
    await githubClient.post(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body }
    );
  } catch (error) {
    console.error('Error posting PR comment:', error);
    throw error;
  }
}

/**
 * Posts review comments to GitHub
 */
async function postReviewComments(owner, repo, prNumber, analysis) {
  try {
    // First, post the test instructions as a separate comment if they exist
    if (analysis.testInstructions) {
      await postPullRequestComment(
        owner,
        repo,
        prNumber,
        `**Test Instructions:**\n\n${analysis.testInstructions}`
      );
    }

    if (!analysis.testInstructions) {
      analysis.testInstructions = "No specific test instructions provided.";
    }
    
    // If there are no valid comments, post a simple PR comment instead
    if (!analysis.comments || analysis.comments.length === 0) {
      return await postPullRequestComment(
        owner, 
        repo, 
        prNumber, 
        analysis.summary || 'PRisma AI Review'
      );
    }
    
    // Ensure all comments have valid positions
    const validComments = analysis.comments.filter(comment => 
      comment.file && 
      typeof comment.position === 'number' && 
      !isNaN(comment.position)
    );
    
    // If no valid comments remain, post a simple PR comment
    if (validComments.length === 0) {
      return await postPullRequestComment(
        owner, 
        repo, 
        prNumber, 
        analysis.summary || 'PRisma AI Review'
      );
    }
    
    // Create a new review with valid comments
    const review = {
      commit_id: analysis.commitId,
      body: analysis.summary || 'PRisma AI Review',
      event: 'COMMENT',
      comments: validComments.map(comment => ({
        path: comment.file,
        position: comment.position,
        body: comment.body
      }))
    };
    
    await githubClient.post(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      review
    );
  } catch (error) {
    console.error('Error posting review comments:', error);
    if (error.response.data && error.response.data.errors) {
      console.error('GitHub API detailed errors:', JSON.stringify(error.response.data.errors, null, 2));
    }
    throw error;
  }
}


module.exports = {
  fetchPullRequestDiff,
  postReviewComments,
  postPullRequestComment
};
