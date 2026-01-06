const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const natural = require('natural');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Serve robots.txt and sitemap.xml with correct content type
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// API configuration
// IMPORTANT: Set your Groq API key in the .env file
const GROQ_API_KEY = process.env.GROQ_API_KEY; 
const SYSTEM_MESSAGE = process.env.SYSTEM_MESSAGE || "You are Yako, a helpful and friendly AI assistant powered by Groq's Llama 3 model. Use appropriate emojis in your responses to make them more engaging and expressive. For example, use 👋 for greetings, 🤔 for thinking, 💡 for ideas, ✅ for confirmations, etc.";

console.log(`System message: ${SYSTEM_MESSAGE}`);
console.log(`Groq API Key available: ${GROQ_API_KEY ? 'Yes' : 'No (using fallback responses)'}`);
if (!GROQ_API_KEY) {
    console.log('⚠️  No API key found. Please set GROQ_API_KEY in your .env file to use AI responses.');
}

// Store conversation history
const conversationHistory = new Map();

// Simple response patterns as fallback
const fallbackResponses = [
    "🤔 That's interesting! Can you tell me more about that?",
    "👍 I understand. What would you like to know?",
    "💯 That's a good point. How can I help you further?",
    "👀 I see. What else would you like to discuss?",
    "🙏 Thanks for sharing that with me. What's on your mind?",
    "😊 I appreciate you telling me that. How can I assist you?",
    "✅ That makes sense. What would you like to explore next?",
    "👂 I hear you. Is there anything specific I can help with?"
];

// Smart fallback based on message content
function getSmartFallback(message = '') {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return "👋 Hello! Nice to meet you. How can I help you today?";
    } else if (lowerMessage.includes('how are you')) {
        return "😊 I'm doing well, thank you for asking! How are you doing?";
    } else if (lowerMessage.includes('what') && lowerMessage.includes('name')) {
        return "🤖 I'm Yako, an AI assistant here to help you. What's your name?";
    } else if (lowerMessage.includes('help')) {
        return "🙌 I'm here to help! What would you like assistance with?";
    } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
        return "👋 Goodbye! It was nice chatting with you. Have a great day!";
    } else {
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
}

// Load knowledge base
let knowledgeBase = [];
try {
    knowledgeBase = JSON.parse(fs.readFileSync(path.join(__dirname, 'knowledge_base.json'), 'utf8'));
    console.log(`Loaded knowledge base with ${knowledgeBase.length} entries.`);
} catch (e) {
    console.warn('Could not load knowledge base:', e.message);
}

// Prepare TF-IDF for RAG
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();
knowledgeBase.forEach((entry, idx) => {
    tfidf.addDocument(entry.question + ' ' + entry.answer, idx.toString());
});

function retrieveRelevantContext(query, topK = 1) {
    if (!knowledgeBase.length) return [];
    const scores = [];
    tfidf.tfidfs(query, (i, measure) => {
        scores.push({ idx: i, score: measure });
    });
    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topK).filter(s => s.score > 0);
    return top.map(s => knowledgeBase[s.idx].answer);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString()
    });
});

// Initialize routes
function setupRoutes() {
    console.log('🤖 Setting up routes...');
    
    // Chat endpoint
    app.post('/api/chat', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message || message.trim() === '') {
                return res.status(400).json({ error: 'Message is required' });
            }
            
            console.log('Received message:', message);

            // Get conversation history
            const sessionId = req.headers['x-session-id'] || 'default';
            let history = conversationHistory.get(sessionId) || [];
            
            // Add user message to history
            history.push({ role: 'user', content: message });
            
            let botResponse;
            
            try {
                // Handle common queries with rule-based system first for faster response
                const lowerMessage = message.toLowerCase();
                
                if (/^(what\s+is\s+)?2\s*\+\s*2(\s*=\s*)?$/i.test(lowerMessage)) {
                    botResponse = "2 + 2 = 4";
                } 
                else if (/what.*time|current time/i.test(lowerMessage)) {
                    botResponse = `The current time is ${new Date().toLocaleTimeString()}.`;
                } 
                else if (/what.*date|today.*date|current date/i.test(lowerMessage)) {
                    botResponse = `Today's date is ${new Date().toLocaleDateString()}.`;
                }
                else if (/\d+\s*\+\s*\d+/.test(lowerMessage)) {
                    // Addition
                    const numbers = lowerMessage.match(/(\d+)\s*\+\s*(\d+)/);
                    if (numbers && numbers.length >= 3) {
                        const result = parseInt(numbers[1]) + parseInt(numbers[2]);
                        botResponse = `${numbers[1]} + ${numbers[2]} = ${result}`;
                    }
                }
                else if (/\d+\s*\-\s*\d+/.test(lowerMessage)) {
                    // Subtraction
                    const numbers = lowerMessage.match(/(\d+)\s*\-\s*(\d+)/);
                    if (numbers && numbers.length >= 3) {
                        const result = parseInt(numbers[1]) - parseInt(numbers[2]);
                        botResponse = `${numbers[1]} - ${numbers[2]} = ${result}`;
                    }
                }
                else if (/\d+\s*\*\s*\d+/.test(lowerMessage)) {
                    // Multiplication
                    const numbers = lowerMessage.match(/(\d+)\s*\*\s*(\d+)/);
                    if (numbers && numbers.length >= 3) {
                        const result = parseInt(numbers[1]) * parseInt(numbers[2]);
                        botResponse = `${numbers[1]} × ${numbers[2]} = ${result}`;
                    }
                }
                else if (/\d+\s*\/\s*\d+/.test(lowerMessage)) {
                    // Division
                    const numbers = lowerMessage.match(/(\d+)\s*\/\s*(\d+)/);
                    if (numbers && numbers.length >= 3) {
                        const result = parseInt(numbers[1]) / parseInt(numbers[2]);
                        botResponse = `${numbers[1]} ÷ ${numbers[2]} = ${result}`;
                    }
                }
                else if (/who.*are.*you/i.test(lowerMessage)) {
                    botResponse = "🤖 I'm Yako, an AI assistant designed to help answer your questions and have conversations.";
                }
                else if (/how.*work/i.test(lowerMessage)) {
                    botResponse = "💡 I work by using advanced natural language processing to understand your questions and provide helpful responses.";
                }
                else if (/thank|thanks/i.test(lowerMessage)) {
                    botResponse = "😊 You're welcome! I'm happy to help.";
                }
                // Easter egg for Suhaira - using word boundaries and exact match
                else if (/^i\s*am\s*suhaira$/i.test(message.trim())) {
                    botResponse = "❤️💖💙💚💛💜🧡 OMG! We have the most gorgeous lady in the world talking to us today! 💖❤️💙💚💛💜🧡 How are you doing Cutie Pie? 🧸🎀 You are Yako's Favorite User 💖❤️💙💚💛💜🧡 Talha Sent Flowers For You 🪷🌷🌼🦋✨🌸🌺🦩";
                }
                else if (GROQ_API_KEY) {
                    // If no rule matches and we have an API key, use Groq
                    console.log('Using Groq API for response...');

                    // RAG: Retrieve relevant context
                    const ragContexts = retrieveRelevantContext(message, 1);
                    let contextString = '';
                    if (ragContexts.length > 0) {
                        contextString = `Relevant info: ${ragContexts.join('\n')}`;
                    }

                    // Prepare the conversation history for Groq
                    const messages = [
                        { role: 'system', content: SYSTEM_MESSAGE },
                    ];
                    if (contextString) {
                        messages.push({ role: 'system', content: contextString });
                    }
                    // Include up to 10 recent messages for context
                    messages.push(...history.slice(-10));

                    // Call Groq API
                    console.log('Making request to Groq API...');
                    console.log('API key starts with:', GROQ_API_KEY.substring(0, 3) + '...');

                    const requestBody = {
                        model: 'llama-3.3-70b-versatile',  // Using Llama 3.3 70B model
                        messages: messages,
                        max_tokens: 500,  // Increased token limit for more complete responses
                        temperature: 0.7
                    };

                    console.log('Request payload:', JSON.stringify(requestBody, null, 2));
                    
                    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                    
                    console.log('Response status:', groqResponse.status);
                    
                    if (groqResponse.ok) {
                        const data = await groqResponse.json();
                        console.log('Groq API response:', JSON.stringify(data, null, 2));
                        
                        if (data && data.choices && data.choices.length > 0 && data.choices[0].message) {
                            botResponse = data.choices[0].message.content.trim();
                            console.log('✅ Groq API response received');
                        } else {
                            console.error('Unexpected response format:', data);
                            throw new Error('Invalid response format from Groq API');
                        }
                    } else {
                        console.error('API response not ok:', groqResponse.status);
                        let errorText = '';
                        
                        try {
                            const errorData = await groqResponse.json();
                            console.error('API error details:', errorData);
                            errorText = JSON.stringify(errorData);
                        } catch (e) {
                            errorText = await groqResponse.text().catch(() => 'Could not get error details');
                            console.error('API error text:', errorText);
                        }
                        
                        if (groqResponse.status === 401) {
                            throw new Error(`Groq API error: Authentication failed. Please check your API key. Details: ${errorText}`);
                        } else {
                            throw new Error(`Groq API error (${groqResponse.status}): ${errorText}`);
                        }
                    }
                } else {
                    // No API key, use fallback
                    console.log('⚠️ No Groq API key available, using fallback');
                    botResponse = getSmartFallback(message);
                }
                
                console.log('Bot response:', botResponse);
                
            } catch (error) {
                console.error('❌ Error generating response:', error.message);
                console.error('Full error:', error);
                // Use fallback if all methods fail
                botResponse = getSmartFallback(message);
            }
            
            // Add bot response to history and store
            history.push({ role: 'assistant', content: botResponse });
            
            // Keep history manageable
            if (history.length > 20) {
                history = history.slice(-20);
            }
            
            conversationHistory.set(sessionId, history);
            
            res.json({ response: botResponse });

        } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({ 
                error: 'Sorry, I encountered an error. Please try again.',
                details: error.message 
            });
        }
    });

    // Add a route to get conversation history
    app.get('/api/history', (req, res) => {
        const sessionId = req.headers['x-session-id'] || 'default';
        const history = conversationHistory.get(sessionId) || [];
        res.json({ history });
    });

    // Endpoint to check if Groq API key is valid
    app.get('/api/check-api-key', async (req, res) => {
        if (!GROQ_API_KEY) {
            return res.json({ valid: false, message: 'No API key provided' });
        }
        
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                }
            });
            
            if (response.ok) {
                res.json({ valid: true, message: 'API key is valid' });
            } else {
                const error = await response.json();
                res.json({ valid: false, message: error.error?.message || 'Invalid API key' });
            }
        } catch (error) {
            res.json({ valid: false, message: error.message });
        }
    });

}

// Setup all routes
setupRoutes();

// For Vercel: export the app as a serverless function
// For local: start the Express server
if (process.env.VERCEL) {
    // Running on Vercel - export the app
    console.log('🚀 Running on Vercel');
    module.exports = app;
} else {
    // Running locally - start the server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        
        // Get local IP address for mobile access
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        let localIp = '127.0.0.1';
        
        // Find a non-internal IPv4 address
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
        }
        
        console.log(`📱 Access on your phone at http://${localIp}:${PORT}`);
        console.log('✅ Chatbot is ready!');
        console.log('💬 Using Groq API with rule-based fallback');
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Server shutting down gracefully...');
        process.exit(0);
    });
}