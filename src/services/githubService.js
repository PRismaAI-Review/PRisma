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
    console.error('Error fetching PR diff:', error.message);
    if (error.response) {
      console.error('GitHub API Response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Posts a simple comment on a pull request issue
 */
async function postPullRequestComment(owner, repo, prNumber, body) {
  try {
    await githubClient.post(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body }
    );
    console.log(`Posted general comment to PR #${prNumber}.`);
  } catch (error) {
    console.error('Error posting PR comment:', error.message);
    if (error.response) {
      console.error('GitHub API Response:', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Posts review comments to GitHub
 * This function handles review summary and individual file comments.
 */
async function postReviewComments(owner, repo, prNumber, analysis) {
  try {
    // --- Step 1: Post Test Instructions as a separate general PR comment ---
    // This is often a good practice to separate general instructions from inline comments.
    if (analysis.testInstructions && analysis.testInstructions.trim() !== "" && analysis.testInstructions !== "No specific test instructions provided.") {
      await postPullRequestComment(
        owner,
        repo,
        prNumber,
        `**Test Instructions:**\n\n${analysis.testInstructions}`
      );
    }

    // --- Step 2: Get the latest commit_id for the PR ---
    // This is crucial to avoid 422 errors due to stale commit SHAs.
    const prDetailsResponse = await githubClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);
    const latestCommitId = prDetailsResponse.data.head.sha;
    console.log(`Workspaceed latest commit ID for PR #${prNumber}: ${latestCommitId}`);

    // --- Step 3: Process and filter comments for the review ---
    const commentsForReview = analysis.comments || [];

    const validComments = commentsForReview.map(comment => {
      let cleanedPath = comment.file;
      // Remove common diff prefixes like 'a/' or 'b/'
      if (cleanedPath && (cleanedPath.startsWith('a/') || cleanedPath.startsWith('b/'))) {
        cleanedPath = cleanedPath.substring(2);
      }

      // Ensure position is a number and not NaN
      const position = typeof comment.position === 'number' && !isNaN(comment.position)
        ? comment.position
        : null; // Set to null if invalid, will be filtered out

      return {
        path: cleanedPath,
        position: position,
        body: comment.body
      };
    }).filter(comment =>
      // Filter out comments if path, position, or body are invalid
      comment.path &&
      comment.position !== null && // Position must be a valid number
      comment.body && comment.body.trim() !== ''
    );

    // --- Step 4: Construct and post the review payload ---
    const reviewBody = analysis.summary && analysis.summary.trim() !== ""
      ? analysis.summary
      : 'PRisma AI Review';

    // If there are no valid inline comments, just post the summary as a regular PR comment
    if (validComments.length === 0) {
      console.log('No valid inline comments found for review. Posting summary as general PR comment.');
      return await postPullRequestComment(
        owner,
        repo,
        prNumber,
        reviewBody
      );
    }

    // Construct the review payload
    const review = {
      commit_id: latestCommitId, // Use the dynamically fetched commit_id
      body: reviewBody,
      event: 'PENDING', // Use 'PENDING' for a draft review with comments
      comments: validComments
    };

    console.log('Attempting to post review:', JSON.stringify(review, null, 2)); // Detailed logging of payload

    await githubClient.post(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      review
    );
    console.log(`Successfully posted PR review to #${prNumber}.`);

  } catch (error) {
    console.error('Error posting review comments:', error.message);
    if (error.response) {
      // Log the full GitHub API error response for detailed debugging
      console.error('GitHub API Response (status %d):', error.response.status, error.response.data);
    }
    throw error;
  }
}


module.exports = {
  fetchPullRequestDiff,
  postReviewComments,
  postPullRequestComment
};