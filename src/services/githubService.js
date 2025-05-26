const axios = require('axios');
const parseDiff = require('git-diff-parser');

// GitHub API client (unchanged)
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
      `/repos/<span class="math-inline">\{owner\}/</span>{repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.diff' // Request the raw diff
        }
      }
    );
    return response.data; // This will be the raw diff string
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
 * It now attempts to map AI-provided file line numbers to diff positions.
 * (This code is from Gemini)
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

    // --- Step 2: Get the latest commit_id and the full diff for the PR ---
    let latestCommitId;
    let prDiffContent;
    try {
        const prDetailsResponse = await githubClient.get(`/repos/<span class="math-inline">\{owner\}/</span>{repo}/pulls/${prNumber}`);
        latestCommitId = prDetailsResponse.data.head.sha;
        console.log(`Workspaceed latest commit ID for PR #${prNumber}: ${latestCommitId}`);

        prDiffContent = await fetchPullRequestDiff(owner, repo, prNumber);
        console.log('Fetched PR diff content.');
    } catch (prError) {
        console.error('Error fetching PR details or diff for inline comments:', prError.message);
        if (prError.response) {
            console.error('GitHub API Response (status %d):', prError.response.status, prError.response.data);
        }
        console.warn('Could not fetch PR details/diff. Falling back to simple PR comment for review summary and skipping inline comments.');
        return await postPullRequestIssueComment(
            owner,
            repo,
            prNumber,
            `PRisma AI Review (Summary):\n${analysis.summary || 'Review could not be posted due to an internal error fetching commit/diff details.'}`
        );
    }

    // Parse the diff content
    const parsedDiff = parseDiff(prDiffContent);
    console.log('Parsed diff:', JSON.stringify(parsedDiff, null, 2));


    // --- Step 3: Post the overall review summary as a general PR comment ---
    const reviewSummaryBody = analysis.summary && analysis.summary.trim() !== ""
      ? `**Review Summary:**\n\n${analysis.summary}`
      : 'PRisma AI Review: No specific summary provided.';

    await postPullRequestIssueComment(owner, repo, prNumber, reviewSummaryBody);
    console.log(`Posted review summary to PR #${prNumber}.`);

    // --- Step 4: Post individual inline comments, mapping positions ---
    const commentsToMap = analysis.comments || [];

    if (commentsToMap.length === 0) {
      console.log('No inline comments to post.');
      return;
    }

    console.log(`Attempting to post ${commentsToMap.length} inline comments...`);

    await Promise.allSettled(commentsToMap.map(async (originalComment) => {
      let cleanedPath = originalComment.file;
      if (cleanedPath && (cleanedPath.startsWith('a/') || cleanedPath.startsWith('b/'))) {
        cleanedPath = cleanedPath.substring(2);
      }

      // Find the corresponding file in the parsed diff
      const fileDiff = parsedDiff.files.find(f =>
        f.after === cleanedPath // f.after is the new path, f.before is the old path
      );

      if (!fileDiff) {
        console.warn(`Skipping comment for file ${cleanedPath}: File not found in diff or not changed.`);
        return;
      }

      // --- Crucial: Map AI's line number to diff position ---
      let diffPosition = null;

      // Iterate through hunks and lines to find the correct diff position
      let currentDiffLine = 0; // This will track the position within the diff for the current file
      for (const hunk of fileDiff.hunks) {
          for (const line of hunk.lines) {
              currentDiffLine++; // Increment for each line in the hunk
              // We assume AI comment's 'position' is the NEW file line number (after change)
              // If 'line' corresponds to the AI's intended line number (new line), use currentDiffLine
              // The 'line' object from git-diff-parser might have 'ln1' (old) and 'ln2' (new) line numbers
              if (line.ln2 === originalComment.position && line.type !== 'deleted') { // Check new line number for added/context lines
                  diffPosition = currentDiffLine;
                  break; // Found the position, exit inner loop
              } else if (line.ln1 === originalComment.position && line.type === 'deleted') { // Or old line number for deleted lines
                  // For deleted lines, commenting directly on them with position might be tricky
                  // GitHub sometimes expects comments on the line *before* a deletion, or an added line
                  // For simplicity, for now, we'll try to use the position of the deleted line in the diff
                  diffPosition = currentDiffLine;
                  break;
              }
          }
          if (diffPosition !== null) break; // Found position, exit hunk loop
      }


      if (diffPosition === null) {
        console.warn(`Skipping comment for ${cleanedPath} at original line ${originalComment.position}: Could not find corresponding diff position.`);
        return;
      }

      console.log(`Mapped ${cleanedPath}: original line ${originalComment.position} -> diff position ${diffPosition}`);


      // Only attempt to post if path, position, and body are valid after mapping
      if (cleanedPath && diffPosition !== null && originalComment.body && originalComment.body.trim() !== '') {
        await postPullRequestInlineComment(
          owner,
          repo,
          prNumber,
          latestCommitId, // Use the dynamically fetched commit ID
          cleanedPath,
          diffPosition, // Use the calculated diff position
          originalComment.body
        );
      } else {
        console.warn(`Skipping invalid inline comment (after mapping): path=<span class="math-inline">\{cleanedPath\}, position\=</span>{diffPosition}, body=${originalComment.body}`);
      }
    }));

    console.log(`Finished attempting to post inline comments for PR #${prNumber}.`);

  } catch (error) {
    console.error('General error in postReviewComments (outside of specific API calls):', error.message);
    if (error.response) {
        console.error('GitHub API Response (status %d):', error.response.status, error.response.data);
        if (error.response.data && error.response.data.errors) {
            console.error('GitHub API detailed errors:', JSON.stringify(error.response.data.errors, null, 2));
        }
    }
  }
}

module.exports = {
  fetchPullRequestDiff,
  postReviewComments,
  postPullRequestIssueComment,
};