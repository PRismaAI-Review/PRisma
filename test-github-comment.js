require('dotenv').config({ path: './config.env' });
const axios = require('axios');

async function testPostComment() {
  try {
    // Replace these with your actual repository and PR details
    const owner = 'misstry';
    const repo = 'PRisma';
    const prNumber = 1; // Replace with an actual PR number
    
    console.log(`Attempting to post a test comment to ${owner}/${repo}#${prNumber}`);
    
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        body: "This is a test comment from PRisma Bot"
      },
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    
    console.log('Comment posted successfully!');
    console.log('Response:', response.status, response.statusText);
    console.log('Comment URL:', response.data.html_url);
    
    return true;
  } catch (error) {
    console.error('Failed to post comment:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

testPostComment();
