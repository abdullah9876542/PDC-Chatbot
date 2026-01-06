# Yako AI Chatbot

A modern AI chatbot interface that uses the Groq API for fast and efficient responses.

## Prerequisites

1. Node.js installed on your system
2. Groq account and API key

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory and add your Groq API key:
```
GROQ_API_KEY=your_groq_api_key_here
SYSTEM_MESSAGE=You are Yako, a helpful and friendly AI assistant.
```

To get your API key:
1. Go to https://console.groq.com/keys
2. Create a new API key
3. Copy the key and paste it in your `.env` file

3. Start the application:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3001
```

## Features

- Clean, modern UI
- Ultra-fast AI responses using Groq's Llama 3 model
- Loading states and error handling
- Responsive design
- Smooth scrolling and animations
- Conversation history

## Technical Details

- Frontend: Vanilla JavaScript, HTML5, CSS3
- Backend: Node.js with Express
- API: Groq API (Llama 3 8B model)

## Note

Make sure you have set up your Groq API key correctly in the `.env` file. The server will use rule-based fallback responses if no valid API key is provided. 