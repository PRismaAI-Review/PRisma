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
      console.error('GitHub API Response (status %d):', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Posts a simple comment on a pull request issue (general comment, not inline)
 */
async function postPullRequestIssueComment(owner, repo, prNumber, body) {
  try {
    await githubClient.post(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body }
    );
    console.log(`Posted general issue comment to PR #${prNumber}.`);
  } catch (error) {
    console.error('Error posting general PR issue comment:', error.message);
    if (error.response) {
      console.error('GitHub API Response (status %d):', error.response.status, error.response.data);
    }
    throw error;
  }
}

/**
 * Posts an inline comment on a specific line of a file in a pull request diff.
 * This is different from a general PR comment.
 */
async function postPullRequestInlineComment(owner, repo, prNumber, commitId, path, position, body) {
  try {
    await githubClient.post(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      {
        commit_id: commitId, // Needs the commit ID of the file being commented on
        path: path,
        position: position, // The line number in the diff, not the absolute file line
        body: body
      }
    );
    console.log(`Posted inline comment to PR #${prNumber} on file ${path} at position ${position}.`);
  } catch (error) {
    console.error(`Error posting inline PR comment to ${path}:${position}:`, error.message);
    if (error.response) {
      console.error('GitHub API Response (status %d):', error.response.status, error.response.data);
      if (error.response.data && error.response.data.errors) {
        console.error('GitHub API detailed errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
    }
    // Don't throw here to allow other comments to potentially post
    // If you want to stop on first error, re-enable throw.
  }
}

/**
 * Posts review comments to GitHub by posting each as a separate inline comment.
 * Falls back to general PR comment if no valid inline comments or commit ID.
 */
async function postReviewComments(owner, repo, prNumber, analysis) {
  try {
    // --- Step 1: Post Test Instructions as a separate general PR comment ---
    if (analysis.testInstructions && analysis.testInstructions.trim() !== "" && analysis.testInstructions !== "No specific test instructions provided.") {
      await postPullRequestIssueComment(
        owner,
        repo,
        prNumber,
        `**Test Instructions:**\n\n${analysis.testInstructions}`
      );
    }

    // --- Step 2: Get the latest commit_id for the PR ---
    // This is crucial for inline comments as well.
    let latestCommitId;
    try {
        const prDetailsResponse = await githubClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);
        latestCommitId = prDetailsResponse.data.head.sha;
        console.log(`Workspaceed latest commit ID for PR #${prNumber}: ${latestCommitId}`);
    } catch (prError) {
        console.error('Error fetching latest PR commit ID for inline comments:', prError.message);
        if (prError.response) {
            console.error('GitHub API Response (status %d):', prError.response.status, prError.response.data);
        }
        // If we can't get the commit ID, we can't post inline comments.
        console.warn('Could not fetch latest commit ID. Falling back to simple PR comment for review summary and skipping inline comments.');
        return await postPullRequestIssueComment(
            owner,
            repo,
            prNumber,
            `PRisma AI Review (Summary):\n${analysis.summary || 'Review could not be posted due to an internal error fetching commit details.'}`
        );
    }

    // --- Step 3: Post the overall review summary as a general PR comment ---
    const reviewSummaryBody = analysis.summary && analysis.summary.trim() !== ""
      ? `**Review Summary:**\n\n${analysis.summary}`
      : 'PRisma AI Review: No specific summary provided.';

    await postPullRequestIssueComment(owner, repo, prNumber, reviewSummaryBody);
    console.log(`Posted review summary to PR #${prNumber}.`);

    // --- Step 4: Post individual inline comments ---
    const commentsToPost = analysis.comments || [];

    if (commentsToPost.length === 0) {
      console.log('No inline comments to post.');
      return; // No inline comments, so we're done.
    }

    console.log(`Attempting to post ${commentsToPost.length} inline comments...`);

    // Use Promise.allSettled to allow some comments to fail without stopping others
    await Promise.allSettled(commentsToPost.map(async (comment) => {
      let cleanedPath = comment.file;
      // Remove common diff prefixes like 'a/' or 'b/'
      if (cleanedPath && (cleanedPath.startsWith('a/') || cleanedPath.startsWith('b/'))) {
        cleanedPath = cleanedPath.substring(2);
      }

      // Ensure position is a number and not NaN
      const position = typeof comment.position === 'number' && !isNaN(comment.position)
        ? comment.position
        : null;

      // Only attempt to post if path, position, and body are valid
      if (cleanedPath && position !== null && comment.body && comment.body.trim() !== '') {
        await postPullRequestInlineComment(
          owner,
          repo,
          prNumber,
          latestCommitId, // Use the dynamically fetched commit ID
          cleanedPath,
          position,
          comment.body
        );
      } else {
        console.warn(`Skipping invalid inline comment: path=${cleanedPath}, position=${position}, body=${comment.body}`);
      }
    }));

    console.log(`Finished attempting to post inline comments for PR #${prNumber}.`);

  } catch (error) {
    console.error('General error in postReviewComments (outside of specific API calls):', error.message);
  }
}

module.exports = {
  fetchPullRequestDiff,
  postReviewComments, // This function now handles posting both general and inline comments
  postPullRequestIssueComment // Renamed for clarity, can still be used directly
};