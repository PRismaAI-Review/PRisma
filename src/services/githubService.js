const axios = require('axios');
const parseGitDiff = require('parse-git-diff');

// GitHub API client (unchanged)
const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json'
  }
});

/**
 * Fetches the diff for a pull request (unchanged)
 */
async function fetchPullRequestDiff(owner, repo, prNumber) {
  try {
    const response = await githubClient.get(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3.diff' // Request the raw diff content
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
 * This function now explicitly includes diff_hunk.
 */
async function postPullRequestInlineComment(owner, repo, prNumber, commitId, path, position, body, diffHunk) {
  try {
    const payload = {
      commit_id: commitId,
      path: path,
      position: position,
      body: body,
      diff_hunk: diffHunk
    };

    console.log(`Attempting to post inline comment with payload for ${path}:${position}:`, JSON.stringify(payload, null, 2));

    await githubClient.post(
      `/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      payload
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
  }
}

/**
 * Posts review comments to GitHub by posting each as a separate inline comment.
 * Falls back to general PR comment if no valid inline comments or commit ID.
 * This version uses parse-git-diff to get correct positions and diff_hunks.
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
    let parsedDiff;

    try {
        const prDetailsResponse = await githubClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);
        latestCommitId = prDetailsResponse.data.head.sha;
        console.log(`Workspaceed latest commit ID for PR #${prNumber}: ${latestCommitId}`);

        prDiffContent = await fetchPullRequestDiff(owner, repo, prNumber);
        console.log('Fetched PR diff content. Length:', prDiffContent.length);

        parsedDiff = parseGitDiff(prDiffContent); // Use parseGitDiff here
        console.log(`Parsed diff: ${parsedDiff.files.length} files changed.`);

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

    // --- Step 3: Post the overall review summary as a general PR comment ---
    const reviewSummaryBody = analysis.summary && analysis.summary.trim() !== ""
      ? `${analysis.summary}`
      : 'PRisma AI Review: No specific summary provided.';

    await postPullRequestIssueComment(owner, repo, prNumber, reviewSummaryBody);
    console.log(`Posted review summary to PR #${prNumber}.`);

    // --- Step 4: Post individual inline comments ---
    const commentsToMap = analysis.comments || [];

    if (commentsToMap.length === 0) {
      console.log('No inline comments to post.');
      return;
    }

    console.log(`Attempting to post ${commentsToMap.length} inline comments...`);

    await Promise.allSettled(commentsToMap.map(async (originalComment) => {
      let cleanedPath = originalComment.file;
      // Remove common diff prefixes like 'a/' or 'b/'
      if (cleanedPath && (cleanedPath.startsWith('a/') || cleanedPath.startsWith('b/'))) {
        cleanedPath = cleanedPath.substring(2);
      }

      // Find the corresponding file in the parsed diff using the new library's structure
      const fileDiff = parsedDiff.files.find(f =>
          f.newPath === cleanedPath || f.oldPath === cleanedPath // Check both old and new paths
      );

      if (!fileDiff) {
        console.warn(`Skipping comment for file ${cleanedPath}: File not found in diff or not changed.`);
        return;
      }

      let diffPosition = null;
      let targetDiffHunk = null;

      // Iterate through hunks and lines to find the correct diff position and hunk
      // parse-git-diff stores lines directly in file.lines with 'type' and 'line' content
      // and hunk data within file.hunks[i].lines
      // The `raw` property of a hunk is what we'll use for diff_hunk
      for (const hunk of fileDiff.hunks) {
          let hunkLineCounter = 0; // This tracks position within the current hunk for GitHub's 'position'

          // The `raw` property of the hunk contains the full hunk string including header
          const fullDiffHunk = hunk.raw;

          for (const line of hunk.lines) {
              hunkLineCounter++; // Increment for each line in the hunk (this is the `position` for GitHub)

              // Determine which absolute line number to match against
              // parse-git-diff's 'line' object has 'oldLine' and 'newLine'
              const absoluteLineToMatch = (line.type === 'added' || line.type === 'context') ? line.newLine : line.oldLine;

              // If the AI's original position matches an absolute line in this hunk
              if (absoluteLineToMatch === originalComment.position) {
                  diffPosition = hunkLineCounter;
                  targetDiffHunk = fullDiffHunk;
                  break; // Found the position, exit inner line loop
              }
          }
          if (diffPosition !== null) break; // Found position, exit hunk loop
      }

      if (diffPosition === null || targetDiffHunk === null) {
        console.warn(`Skipping comment for ${cleanedPath} at original line ${originalComment.position}: Could not find corresponding diff position or diff hunk.`);
        return;
      }

      console.log(`Mapped ${cleanedPath}: original line ${originalComment.position} -> diff position ${diffPosition}`);
      console.log(`Extracted diff_hunk for ${cleanedPath}:${originalComment.position}:\n${targetDiffHunk.substring(0, Math.min(targetDiffHunk.length, 200))}...`); // Log a snippet


      // Only attempt to post if all required parameters are valid after mapping
      if (cleanedPath && diffPosition !== null && originalComment.body && originalComment.body.trim() !== '' && targetDiffHunk) {
        await postPullRequestInlineComment(
          owner,
          repo,
          prNumber,
          latestCommitId,
          cleanedPath,
          diffPosition, // Use the calculated diff position
          originalComment.body,
          targetDiffHunk // <--- Pass the extracted diff_hunk
        );
      } else {
        console.warn(`Skipping invalid inline comment (after full mapping and validation): path=${cleanedPath}, position=${diffPosition}, body=${originalComment.body.substring(0, Math.min(originalComment.body.length, 50))}..., diffHunk present: ${!!targetDiffHunk}`);
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
  postPullRequestIssueComment
};