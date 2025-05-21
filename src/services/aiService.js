const {
  GoogleGenerativeAI
} = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
* Sleep function to wait between retries
*/
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
* Analyzes code with Gemini AI
*/
async function analyzeCodeWithGemini(diff, pullRequest, retries = 3, initialDelay = 60000) {
  try {
      const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash'
      });

      // Construct the prompt
const prompt = `
Prisma: AI-Powered Pull Request Reviewer

You are Prisma, an intelligent AI pull request reviewer. Analyze the provided
GitHub PR diff for:
● Potential bugs or logic errors.
● Deviations from best practices.
● Find security vulnerabilities.
● Recommendations for improved, more maintainable code.

IMPORTANT: Always include test instructions as the first comment in your response.
These instructions should explain how to test the changes in this PR.

Present your findings in a structured manner, including:
1. File and line number.
2. Identified issue.
3. Proposed fix or enhancement.

PR Title: ${pullRequest.title}
PR Description: ${pullRequest.body || 'No description provided'}

Here is the diff:
${diff}

Format your response as JSON with the following structure:
{
  "summary": "Overall summary of the PR",
  "commitId": "${pullRequest.head.sha}",
  "testInstructions": "Detailed instructions on how to test this PR",
  "comments": [
    {
      "file": "path/to/file",
      "position": line_number,
      "body": "Your comment with issue and suggestion"
    }
  ]
}
`;


      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Extract JSON from the response
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
          text.match(/\{[\s\S]*\}/);

      // In the analyzeCodeWithGemini function, after parsing the JSON:
if (jsonMatch) {
    const analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  
    // Prefix all comments with "PRisma bot:"
    if (analysis.comments && analysis.comments.length > 0) {
      analysis.comments.forEach(comment => {
        comment.body = `${comment.body}`;
      });
    }
  
    // Also prefix the summary
    if (analysis.summary) {
      analysis.summary = ` Review Summary:**\n\n${analysis.summary}`;
    }
  
    // Make sure testInstructions exists even if the AI didn't provide it
    if (!analysis.testInstructions) {
      analysis.testInstructions = "No specific test instructions provided.";
    }
  
    return analysis;
  } else {
    throw new Error('Failed to parse AI response as JSON');
  }
  } catch (error) {
      // Handle rate limit errors with retry logic
      if (error.message.includes('429 Too Many Requests') && retries > 0) {
          // Extract retry delay from error message if available
          let retryDelay = initialDelay;
          const retryDelayMatch = error.message.match(/"retryDelay":"(\d+)s"/);
          if (retryDelayMatch && retryDelayMatch[1]) {
              // Add a buffer to the suggested retry delay
              retryDelay = (parseInt(retryDelayMatch[1]) + 10) * 1000;
          }

          console.log(`Rate limited by Gemini API. Retrying in ${retryDelay/1000} seconds... (${retries} retries left)`);

          // Wait for the specified delay
          await sleep(retryDelay);

          // Retry with exponential backoff
          return analyzeCodeWithGemini(diff, pullRequest, retries - 1, retryDelay * 2);
      }

      console.error('Error analyzing code with Gemini:', error);
      throw error;
  }
}

module.exports = {
  analyzeCodeWithGemini
};