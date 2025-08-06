# Live Voice AI Stream with Gemini

This project is a React application that demonstrates a live voice conversation with Google's Gemini AI model using the `@google/genai` SDK.

## Features

- Real-time audio capture from the user's microphone.
- Streaming audio to the Gemini Live model.
- Receiving and playing back audio responses from the AI.
- Displaying a live transcript of the conversation.

## Prerequisites

- Node.js (v18 or later)
- A Google Gemini API Key.

## Setup

1.  **Clone the repository**

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    Create a file named `.env` in the root of the project and add your API key:
    ```
    VITE_GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```

## Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```

2.  Open your browser and navigate to `http://localhost:5173` (or the address shown in your terminal).

3.  The browser will ask for permission to use your microphone. Click "Allow".

4.  Click the "Start" button to begin the conversation.
