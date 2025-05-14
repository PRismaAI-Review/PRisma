require('dotenv').config({ path: './config.env' });
const axios = require('axios');

async function testGitHubToken() {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    
    console.log('GitHub token is valid!');
    console.log('Authenticated as:', response.data.login);
    console.log('User has scopes:', response.headers['x-oauth-scopes']);
    
    return true;
  } catch (error) {
    console.error('GitHub token validation failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

testGitHubToken();
