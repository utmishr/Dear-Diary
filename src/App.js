import React, { useState, useCallback, useEffect } from "react";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import { fetchAuthSession } from "aws-amplify/auth";
import { uploadData, getUrl } from "aws-amplify/storage";
import { createNote, deleteNote } from "./graphql/mutations";
import { listNotes } from "./graphql/queries";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import awsExports from "./aws-exports";
import { v4 as uuidv4 } from "uuid";

Amplify.configure(awsExports);
const client = generateClient();

// Custom hook for audio recording
function useAudioRecorder() {
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const recorder = new MediaRecorder(stream);
          setMediaRecorder(recorder);

          recorder.ondataavailable = (e) => {
            setAudioBlob(e.data);
          };
        })
        .catch((err) => console.error("Error accessing microphone:", err));
    }
  }, []);

  const startRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      mediaRecorder.start();
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  return { audioBlob, isRecording, startRecording, stopRecording };
}

function App({ signOut, user }) {
  const [notes, setNotes] = useState([]);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    image: null,
  });
  const { audioBlob, isRecording, startRecording, stopRecording } =
    useAudioRecorder();

  async function getAuthToken() {
    try {
      const { accessToken } = (await fetchAuthSession()).tokens ?? {};
      return accessToken;
    } catch (err) {
      console.log("Error getting auth token", err);
      return null;
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setFormData((prevData) => ({ ...prevData, image: file }));
  };

  const fetchNotes = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No auth token");

      const noteData = await client.graphql({
        query: listNotes,
        authMode: "AMAZON_COGNITO_USER_POOLS",
        authToken: token,
      });
      const noteList = await Promise.all(
        noteData.data.listNotes.items.map(async (note) => {
          if (note.imageKey) {
            const { url: imageUrl } = await getUrl({ key: note.imageKey });
            note.imageUrl = imageUrl;
          }
          if (note.audioKey) {
            const { url: audioUrl } = await getUrl({ key: note.audioKey });
            note.audioUrl = audioUrl;
          }
          return note;
        })
      );
      setNotes(noteList);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function addNote() {
    try {
      if (!formData.title || !formData.content) return;
      const token = await getAuthToken();
      if (!token) throw new Error("No auth token");

      let imageKey = null;
      let audioKey = null;

      if (formData.image) {
        const imageExtension = formData.image.name.split(".").pop();
        imageKey = `${uuidv4()}.${imageExtension}`;
        await uploadData({
          key: imageKey,
          data: formData.image,
          options: {
            contentType: formData.image.type,
          },
        });
      }

      if (audioBlob) {
        audioKey = `${uuidv4()}.webm`;
        await uploadData({
          key: audioKey,
          data: audioBlob,
          options: {
            contentType: "audio/webm",
          },
        });
      }

      const note = {
        title: formData.title,
        content: formData.content,
        imageKey,
        audioKey,
      };

      const result = await client.graphql({
        query: createNote,
        variables: { input: note },
        authMode: "AMAZON_COGNITO_USER_POOLS",
        authToken: token,
      });

      setNotes((prevNotes) => [...prevNotes, result.data.createNote]);
      setCurrentNoteIndex(notes.length);
      setFormData({ title: "", content: "", image: null });
    } catch (error) {
      console.error("Error adding note:", error);
    }
  }

  const turnPage = useCallback(
    (direction) => {
      if (notes.length === 0) return; // Don't turn page if there are no notes

      setIsFlipping(direction);
      setTimeout(() => {
        if (direction === "next" && currentNoteIndex < notes.length - 1) {
          setCurrentNoteIndex((prevIndex) => prevIndex + 1);
        } else if (direction === "prev" && currentNoteIndex > 0) {
          setCurrentNoteIndex((prevIndex) => prevIndex - 1);
        }
        setIsFlipping(false);
      }, 500); // Match this with the CSS animation duration
    },
    [currentNoteIndex, notes.length]
  );

  async function deleteNoteById(id) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("No auth token");

      await client.graphql({
        query: deleteNote,
        variables: { input: { id } },
        authMode: "AMAZON_COGNITO_USER_POOLS",
        authToken: token,
      });

      setNotes((prevNotes) => {
        const updatedNotes = prevNotes.filter((note) => note.id !== id);

        // Adjust currentNoteIndex if necessary
        if (currentNoteIndex >= updatedNotes.length) {
          setCurrentNoteIndex(Math.max(0, updatedNotes.length - 1));
        }

        return updatedNotes;
      });
    } catch (error) {
      console.log("error on deleting note", error);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        <div style={styles.header}>
          <h1 style={styles.title}>Dear Diary</h1>
          <button style={styles.logoutButton} onClick={signOut}>
            Close Diary
          </button>
        </div>

        <h2 style={{ fontFamily: "Papyrus", wordSpacing: ".3em" }}>
          Pen an Entry
        </h2>
        <input
          style={styles.input}
          onChange={(e) =>
            setFormData((prevData) => ({ ...prevData, title: e.target.value }))
          }
          placeholder="Today's Topic"
          value={formData.title}
        />
        <textarea
          style={{ ...styles.input, minHeight: "200px" }}
          onChange={(e) =>
            setFormData((prevData) => ({
              ...prevData,
              content: e.target.value,
            }))
          }
          placeholder="Your Thoughts"
          value={formData.content}
        />

        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          style={styles.input}
        />

        <div style={styles.recordingContainer}>
          <button
            style={
              isRecording
                ? styles.stopRecordingButton
                : styles.startRecordingButton
            }
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
          <p style={styles.recordingStatus}>
            Recording status: {isRecording ? "recording" : "not recording"}
          </p>
        </div>
        <button style={styles.button} onClick={addNote}>
          Add new page
        </button>
      </div>

      <div style={styles.rightSection}>
        <h2 style={{ fontFamily: "Papyrus", wordSpacing: ".3em" }}>
          Your Memories
        </h2>
        <div style={styles.notebookContainer}>
          {notes.length > 0 ? (
            <div
              style={{
                ...styles.notePage,
                animation: isFlipping
                  ? isFlipping === "next"
                    ? "flipNext 0.5s ease-in-out"
                    : "flipPrev 0.5s ease-in-out"
                  : "none",
              }}
            >
              <div style={styles.noteTitleContainer}>
                <h3 style={styles.noteTitle}>
                  {notes[currentNoteIndex].title}
                </h3>
                <span style={styles.noteIndex}>{currentNoteIndex + 1}</span>
              </div>

              <p style={styles.noteContent}>
                {notes[currentNoteIndex].content}
              </p>
              {notes[currentNoteIndex].imageUrl && (
                <img
                  src={notes[currentNoteIndex].imageUrl}
                  alt="Note"
                  style={styles.noteImage}
                />
              )}
              {notes[currentNoteIndex].audioUrl && (
                <audio
                  src={notes[currentNoteIndex].audioUrl}
                  controls
                  style={{ width: "100%" }}
                />
              )}
            </div>
          ) : (
            <p>No notes yet. Start by adding a note!</p>
          )}
        </div>
        <div style={styles.navigationButtons}>
          {notes.length > 0 && (
            <>
              <button
                style={styles.deleteButton}
                onClick={() => deleteNoteById(notes[currentNoteIndex].id)}
              >
                Delete
              </button>
              <button
                onClick={() => turnPage("prev")}
                disabled={currentNoteIndex === 0}
                style={styles.turnButton}
              >
                Previous
              </button>
              <button
                onClick={() => turnPage("next")}
                disabled={currentNoteIndex === notes.length - 1}
                style={styles.turnButton}
              >
                Next
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  noteImage: {
    maxWidth: "100%",
    marginTop: "10px",
    marginBottom: "10px",
  },
  container: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Roboto', sans-serif",
    backgroundColor: "#f5f5f5",
    color: "black",
  },
  leftSection: {
    width: "40%",
    padding: "40px",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #ddd",
    backgroundColor: "#FCEEF5",
  },
  rightSection: {
    width: "60%",
    padding: "40px",
    overflowY: "auto",
    backgroundColor: "#C4E4FF",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontFamily: "Lucida Handwriting",
    fontWeight: "300",
    color: "black",
    margin: 0,
  },
  input: {
    width: "100%",
    marginBottom: 20,
    padding: 15,
    color: "black",
    fontSize: 18,
    borderRadius: 8,
    border: "1px solid #ddd",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    backgroundColor: "#F3BAD6",
  },
  button: {
    backgroundColor: "#E05297",
    color: "white",
    border: "none",
    padding: "12px 20px",
    fontSize: 16,
    cursor: "pointer",
    borderRadius: 8,
    transition: "all 0.3s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  logoutButton: {
    // backgroundColor: "transparent",
    backgroundColor: "#E05297",
    color: "white",
    padding: "10px 15px",
    fontSize: 14,
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    transition: "all 0.3s ease",
  },
  note: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    transition: "all 0.3s ease",
  },
  noteContent: {
    fontSize: 20,
    color: "black",
    lineHeight: 1.6,
  },
  deleteButton: {
    backgroundColor: "#DD5746",
    color: "white",
    border: "none",
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    borderRadius: 4,
    transition: "all 0.3s ease",
  },
  notebookContainer: {
    perspective: "1000px",
    height: "500px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  notePage: {
    width: "100%",
    height: "100%",
    padding: "20px",
    backgroundColor: "#59D5E0",
    fontFamily: "Helvetica",
    fontSize: 20,
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
    transformStyle: "preserve-3d",
    transition: "transform 0.5s",
    position: "absolute",
    overflow: "auto",
  },
  navigationButtons: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "20px",
  },
  turnButton: {
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#3652AD",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  noteTitleContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 26,
    fontWeight: "500",
    color: "#333",
    margin: 0,
  },
  noteIndex: {
    fontSize: 18,
    fontWeight: "500",
    color: "black",
  },
  fileInput: {
    display: "none",
    fontSize: 18,
    color: "black",
  },
  fileInputLabel: {
    backgroundColor: "#A555EC",
    color: "white",
    padding: "12px 20px",
    fontSize: 16,
    cursor: "pointer",
    borderRadius: 8,
    transition: "all 0.3s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    display: "inline-block",
    marginBottom: 20,
    textAlign: "center",
  },
  recordingContainer: {
    marginBottom: 20,
  },
  startRecordingButton: {
    backgroundColor: "#E05297",
    color: "white",
    border: "none",
    padding: "12px 20px",
    fontSize: 16,
    cursor: "pointer",
    borderRadius: 8,
    transition: "all 0.3s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  stopRecordingButton: {
    backgroundColor: "#A555EC",
    color: "white",
    border: "none",
    padding: "12px 20px",
    fontSize: 16,
    cursor: "pointer",
    borderRadius: 8,
    transition: "all 0.3s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  recordingStatus: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
  },
};

// Add the keyframes to the document
const pageFlipKeyframes = `
@keyframes flipNext {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(-90deg);
  }
}

@keyframes flipPrev {
  0% {
    transform: rotateY(0deg);
  }
  100% {
    transform: rotateY(90deg);
  }
}`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = pageFlipKeyframes;
document.head.appendChild(styleSheet);

export default withAuthenticator(App);
