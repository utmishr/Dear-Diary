const AWS = require("aws-sdk");
const ses = new AWS.SES();
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const { noteId, recipientEmail } = event.arguments;
  const { identity } = event;

  // Fetch the note from DynamoDB
  const params = {
    TableName: process.env.API_NOTEPADGO_NOTETABLE_NAME,
    Key: { id: noteId },
  };

  try {
    const { Item } = await dynamodb.get(params).promise();

    if (!Item || Item.owner !== identity.username) {
      return "Note not found or you don't have permission to share it.";
    }

    // Prepare the email
    const emailParams = {
      Destination: { ToAddresses: [recipientEmail] },
      Message: {
        Body: {
          Text: { Data: `Title: ${Item.title}\n\nContent: ${Item.content}` },
        },
        Subject: { Data: "Shared Note from NotepadGo" },
      },
      Source: "your-verified-email@example.com", // Replace with your SES verified email
    };

    // Send the email
    await ses.sendEmail(emailParams).promise();

    return "Note shared successfully via email!";
  } catch (error) {
    console.error("Error:", error);
    return "An error occurred while sharing the note.";
  }
};
