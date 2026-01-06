// Simplified scroll to chat section with direct positioning
function scrollToChat() {
    const chatSection = document.getElementById('chat-section');
    if (!chatSection) return;
    
    // Prevent multiple scroll triggers
    if (window.isScrolling) return;
    window.isScrolling = true;
    
    // Add a visual indicator that we're scrolling
    document.body.classList.add('is-scrolling');
    
    // Simple direct scroll to the section - position it at the top of the viewport
    window.scrollTo({
        top: window.pageYOffset + chatSection.getBoundingClientRect().top,
        behavior: 'smooth' // Changed to smooth for better UX
    });
    
    // Focus the input field after a short delay to ensure scrolling is complete
    setTimeout(() => {
        const input = document.getElementById('user-input');
        if (input) {
            input.focus();
        }
    }, 300);
    
    // Add visual feedback
    chatSection.classList.add('highlight-section');
    
    // Clean up classes after a short delay
    setTimeout(() => {
        window.isScrolling = false;
        document.body.classList.remove('is-scrolling');
        chatSection.classList.remove('highlight-section');
    }, 400);
}

// Generate a simple session ID for conversation context
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Get or create session ID
let sessionId = sessionStorage.getItem('chatSessionId');
if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('chatSessionId', sessionId);
}

// Chat functionality
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.querySelector('.chat-input button') || document.getElementById('send-button');

// Configuration
// Using window.location.origin to get the current host (works on both localhost and IP address)
const API_BASE_URL = window.location.origin;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// Retry mechanism for failed requests
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Session-ID': sessionId
                }
            });
            
            // If successful or client error (4xx), don't retry
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }
            
            // Server error (5xx), retry
            if (i < retries - 1) {
                console.log(`Request failed (${response.status}), retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            
            return response;
        } catch (error) {
            if (i < retries - 1 && error.name !== 'AbortError') {
                console.log(`Request failed (${error.message}), retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                continue;
            }
            throw error;
        }
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    // Add user message
    addMessage(message, 'user');
    userInput.value = '';

    // Disable input and show loading state
    setLoadingState(true);

    try {
        console.log('Sending message to server:', message);
        
        const response = await fetchWithRetry(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });

        console.log('Server response status:', response.status);
        
        const responseData = await response.json();
        console.log('Server response data:', responseData);

        if (!response.ok) {
            throw new Error(responseData.error || `Server error: ${response.status}`);
        }

        if (responseData.response) {
            addMessage(responseData.response, 'bot');
        } else {
            addMessage('I received your message but couldn\'t generate a proper response. Please try again.', 'bot');
        }

    } catch (error) {
        console.error('Detailed error:', error);
        
        let errorMessage = 'I apologize, but I\'m having trouble responding right now.';
        
        if (!window.navigator.onLine) {
            errorMessage = 'Network connection lost. Please check your internet connection and try again.';
        } else if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            errorMessage = 'Unable to connect to the AI service. Please make sure the server is running on localhost:3001.';
        } else if (error.message.includes('loading')) {
            errorMessage = 'The AI model is starting up. Please wait a moment and try again.';
        } else if (error.message.includes('rate limit')) {
            errorMessage = 'Too many requests. Please wait a moment before sending another message.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        addMessage(errorMessage, 'error');
    } finally {
        setLoadingState(false);
    }
}

function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format the message with proper HTML formatting
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    
    // Apply formatting to bot messages only
    if (sender === 'bot') {
        // Process markdown-like formatting
        let formattedText = text
            // Format headers (# Header) to bold
            .replace(/^#\s+(.+)$/gm, '<strong>$1</strong>')
            // Format bold (**text**)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Format bullet points
            .replace(/^-\s+(.+)$/gm, '• $1')
            // Add paragraph breaks for line breaks
            .split('\n\n').join('</p><p>')
            // Convert single line breaks to <br>
            .split('\n').join('<br>');
            
        messageText.innerHTML = `<p>${formattedText}</p>`;
    } else {
        // For user and error messages, just use text content
        messageText.textContent = text;
    }
    
    const messageTime = document.createElement('span');
    messageTime.className = 'message-time';
    messageTime.textContent = timestamp;
    
    messageContent.appendChild(messageText);
    messageContent.appendChild(messageTime);
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);
    
    // Enhanced scroll to bottom of chat with smoother animation
    setTimeout(() => {
        // Add a smooth scroll class to improve animation
        chatMessages.classList.add('smooth-scroll');
        
        // Scroll to the bottom with improved timing
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
        
        // Remove the class after animation completes
        setTimeout(() => {
            chatMessages.classList.remove('smooth-scroll');
        }, 500);
    }, 50);
}

function setLoadingState(isLoading) {
    if (userInput) userInput.disabled = isLoading;
    if (sendButton) sendButton.disabled = isLoading;
    
    if (isLoading) {
        if (sendButton) {
            sendButton.innerHTML = '<span class="loading">●●●</span>';
            sendButton.style.opacity = '0.7';
        }
        
        // Add a typing indicator
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = '<div class="message-content"><p>Yako is thinking<span class="dots">...</span></p></div>';
        chatMessages.appendChild(typingDiv);
        
        // Animate the dots
        const dots = typingDiv.querySelector('.dots');
        let dotCount = 0;
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            dots.textContent = '.'.repeat(dotCount);
        }, 500);
        
        typingDiv.dotInterval = dotInterval;
        
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    } else {
        if (sendButton) {
            sendButton.textContent = 'Send';
            sendButton.style.opacity = '1';
        }
        
        // Remove typing indicator
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            if (typingIndicator.dotInterval) {
                clearInterval(typingIndicator.dotInterval);
            }
            typingIndicator.remove();
        }
    }
}

// Handle enter key in input
if (userInput) {
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !userInput.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Handle paste events
    userInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            // Auto-resize textarea if needed
            userInput.style.height = 'auto';
            userInput.style.height = userInput.scrollHeight + 'px';
        }, 0);
    });
}

// Handle send button click
if (sendButton) {
    sendButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    });
}

// No auto-focus when chat section is visible - only focus when user explicitly clicks
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // Don't auto-focus on scroll - this can be disruptive to user experience
        // We'll let the scrollToChat function handle focus when user clicks the button
    });
}, { threshold: 0.3 });

// Only observe if the chat section exists
const chatSection = document.getElementById('chat-section');
if (chatSection) {
    observer.observe(chatSection);
}

// Check server health on page load
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Server is healthy:', data);
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Server health check failed:', error.message);
        return false;
    }
    return false;
}

// Adjust UI based on device size
function adjustForMobileView() {
    const isMobile = window.innerWidth <= 768;
    const chatContainer = document.querySelector('.chat-container');
    const chatMessages = document.getElementById('chat-messages');
    
    if (isMobile) {
        // Adjust for mobile
        if (chatContainer) {
            chatContainer.style.height = '85vh';
        }
        if (chatMessages) {
            chatMessages.style.padding = '0.75rem';
        }
    } else {
        // Adjust for desktop
        if (chatContainer) {
            chatContainer.style.height = '80vh';
        }
        if (chatMessages) {
            chatMessages.style.padding = '2rem';
        }
    }
}

// Initialize the chat when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Chat interface loaded');
    
    // Check if server is running
    const isServerHealthy = await checkServerHealth();
    
    if (!isServerHealthy) {
        if (chatMessages) {
            addMessage('⚠️ Unable to connect to AI service. Please make sure the server is running on localhost:3001', 'error');
        }
    }
    
    // Ensure we start at the top of the page on initial load
    window.scrollTo(0, 0);
    
    // Adjust layout for mobile if needed
    adjustForMobileView();
    
    // Listen for resize events to adjust layout
    window.addEventListener('resize', adjustForMobileView);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && userInput) {
        userInput.focus();
    }
});

// Export functions for global access if needed
window.chatbot = {
    sendMessage,
    scrollToChat,
    checkServerHealth
};