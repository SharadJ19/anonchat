const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let userCount = 0;
let activeUsers = 0;
let users = {};  // { socketId: username }
let polls = [];  // Stores active polls
let userVotes = {};  // Stores user votes per poll { username: { pollId: optionIndex } }
let messages = [];  // Stores chat messages

app.use(express.static('public'));

io.on('connection', (socket) => {
    let username = socket.handshake.auth.username;

    if (!username || Object.values(users).includes(username)) {
        userCount++;
        username = `anon${userCount}`;
    }

    socket.username = username;
    users[socket.id] = username;

    if (!userVotes[username]) userVotes[username] = {}; // Store votes per username  
    activeUsers++;

    // Send stored data to the connected user
    socket.emit('restore-data', { messages, polls, username, userVotes: userVotes[username] });

    // Broadcast user connection message
    io.emit('chat-message', { username: "System", message: `${username} joined the chat`, type: "join" });
    io.emit('user-connected', { activeUsers });

    // Handle chat messages
    socket.on('chat-message', (message) => {
        const chatData = { username, message, type: "normal" };
        messages.push(chatData);
        io.emit('chat-message', chatData);
    });

    // Handle poll creation
    socket.on('create-poll', ({ question, options }) => {
        const pollId = `poll${Date.now()}`;
        const poll = { id: pollId, question, options, votes: Array(options.length).fill(0) };
        polls.push(poll);
        io.emit('new-poll', poll);
    });

    // Handle voting (Allows revoting)
    socket.on('vote', ({ pollId, optionIndex }) => {
        if (!userVotes[username]) userVotes[username] = {};

        const poll = polls.find(p => p.id === pollId);
        if (poll) {
            if (userVotes[username][pollId] !== undefined) {
                // Remove previous vote
                poll.votes[userVotes[username][pollId]]--;
            }

            // Apply new vote
            poll.votes[optionIndex]++;
            userVotes[username][pollId] = optionIndex;
            io.emit('poll-update', { pollId, voteCounts: poll.votes, options: poll.options });
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        activeUsers--;
        delete users[socket.id];

        io.emit('chat-message', { username: "System", message: `${username} left the chat`, type: "leave" });
        io.emit('user-disconnected', { activeUsers });

        // Reset everything when all users leave
        if (Object.keys(users).length === 0) {
            messages = [];
            polls = [];
            userVotes = {};
            userCount = 0;
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
