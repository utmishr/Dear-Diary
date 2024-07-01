# Dear Diary

Dear Diary is a personalized digital diary application built with React and AWS Amplify. It provides users with a secure and feature-rich platform to create, manage, and revisit their daily diary entries.

## Features

- User Authentication: Secure sign-up and login functionality powered by AWS Cognito.
- Create Diary Entries: Add new diary entries with titles and content.
- Multimedia Support: Attach photos and audio recordings to your entries.
- Browse Entries: Navigate through your diary entries with a page-turning animation.
- Delete Entries: Remove unwanted diary entries.
- Cloud Storage: All entries and media are securely stored in AWS S3 buckets.
- GraphQL API: Utilizes AWS AppSync for efficient API calls.

## Tech Stack

- Frontend: React.js
- Authentication: AWS Cognito
- Database: AWS DynamoDB (via AppSync)
- Storage: AWS S3
- API: AWS AppSync (GraphQL)
- Serverless Functions: AWS Lambda
- Infrastructure as Code: AWS Amplify

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure AWS Amplify:
   ```
   amplify configure
   amplify init
   ```
4. Push the backend to AWS:
   ```
   amplify push
   ```
5. Start the development server:
   ```
   npm start
   ```

## Usage

1. Sign up for an account or log in.
2. Create a new diary entry by filling in the title and content.
3. Optionally, add a photo or record audio for your entry.
4. Save your entry to add it to your diary.
5. Browse through your entries using the "Previous" and "Next" buttons.
6. Delete entries you no longer want to keep.

## Security

- User authentication is handled securely by AWS Cognito.
- All data is stored in secure AWS S3 buckets.
- AWS Lambda functions manage the security configuration of the Cognito Identity Pool.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

---

