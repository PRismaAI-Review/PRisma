# PRisma - AI-Powered Pull Request Reviewer

PRisma is an advanced AI system designed to redefine the pull request review process. It understands code structure, context, and style guides, delivering high-quality, contextual feedback within seconds.


Test test........!!!
## Features

- **Automated Code Review**: Analyzes pull requests for bugs, security vulnerabilities, and best practices
- **Contextual Feedback**: Provides specific, actionable comments on your code
- **GitHub Integration**: Seamlessly integrates with GitHub's pull request workflow
- **Powered by Gemini 1.5 Pro**: Leverages Google's advanced AI model for deep code understanding

## How It Works

1. **PR Ingestion**: Activated by GitHub webhook upon pull_request events
2. **Data Retrieval**: Gathers diff and metadata via GitHub API
3. **AI Analysis**: Transmits diff and PR data to Gemini AI with a specialized prompt
4. **Feedback Delivery**: Analyzes AI output and posts inline comments to GitHub

## Setup

### Prerequisites

- Node.js (v14+)
- GitHub account with repository access
- Gemini API key

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/prisma.git
   cd prisma
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Copy `config.env.example` to `config.env`
   - Add your GitHub token, Gemini API key, and webhook secret

4. Start the server:
   ```
   npm start
   ```

5. Configure GitHub webhook:
   - In your GitHub repository, go to Settings > Webhooks
   - Add a new webhook pointing to your server URL
   - Set content type to `application/json`
   - Set the secret to match your `WEBHOOK_SECRET`
   - Select the "Pull request" event

## License

MIT
```

## 10. Create a .gitignore file

```bash:.gitignore
# Dependencies
node_modules/
npm-debug.log
yarn-error.log

# Environment variables
.env
config.env

# Logs
logs/
*.log

# Build files
dist/
build/

# OS files
.DS_Store
Thumbs.db

# IDE files
.idea/
.vscode/
*.swp
*.swo
```

## Installation Instructions

To get started with your project:

```bash
npm install

- deployed for free on Render
