const storedUsername = localStorage.getItem('username');
const socket = io({ auth: { username: storedUsername || null } });

// Assign random colors to users
const userColors = {};
function getUserColor(username) {
    if (!userColors[username]) {
        const colors = [
            '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#FFC733', 
            '#E63946', '#F4A261', '#2A9D8F', '#264653', '#D90429', '#00A8E8', 
            '#E6AF2E', '#9B5DE5', '#F15BB5', '#00F5D4', '#006D77', '#6A0572', 
            '#D00000', '#FF6F61', '#6A0572', '#5A189A', '#FF9F1C', '#2EC4B6',
            '#8338EC', '#FF006E', '#FB5607', '#3A86FF', '#C03221', '#4ECDC4', 
            '#FFBE0B', '#CB0073', '#E71D36', '#118AB2', '#EF233C', '#06D6A0', 
            '#FF595E', '#8E44AD', '#2980B9', '#D7263D', '#F3722C', '#4F5D75', 
            '#264653', '#E63946', '#E76F51', '#3498DB', '#9C27B0', '#1B9AAA', 
            '#B23A48', '#FFB400'
        ];
        
        userColors[username] = colors[Object.keys(userColors).length % colors.length];
    }
    return userColors[username];
}

// Function to update poll results
function updatePollResults(pollId, voteCounts, options) {
    const pollResults = document.getElementById(`${pollId}-results`);
    if (!pollResults) return;

    pollResults.innerHTML = '';

    options.forEach((option, index) => {
        const voteItem = document.createElement('li');
        voteItem.textContent = `${option}: ${voteCounts[index] || 0} votes`;
        voteItem.classList.add('text-gray-600', 'text-sm', 'mt-1');
        pollResults.appendChild(voteItem);
    });
}

// Restore data when a user reconnects
socket.on('restore-data', ({ messages, polls, username, userVotes }) => {
    localStorage.setItem('username', username);
    localStorage.setItem('userVotes', JSON.stringify(userVotes || {}));

    document.getElementById('messages').innerHTML = '';
    messages.forEach(({ username, message, type }) => displayMessage(username, message, type));

    document.getElementById('polls').innerHTML = '';
    polls.forEach(({ id, question, options, votes }) => createPollUI(id, question, options, votes));

    for (const poll of polls) {
        updatePollResults(poll.id, poll.votes, poll.options);
    }
});

// Display chat messages with colors
socket.on('chat-message', ({ username, message, type }) => displayMessage(username, message, type));

function displayMessage(username, message, type) {
    const item = document.createElement('li');
    if (username === "System") {
        item.textContent = message;
        item.classList.add(type === "join" ? 'text-green-600' : 'text-red-600', 'italic');
    } else {
        item.textContent = `${username}: ${message}`;
        item.style.color = getUserColor(username);
    }
    document.getElementById('messages').appendChild(item);
}

// Update active users count
socket.on('user-connected', ({ activeUsers }) => updateActiveUsers(activeUsers));
socket.on('user-disconnected', ({ activeUsers }) => updateActiveUsers(activeUsers));

function updateActiveUsers(count) {
    document.getElementById('active-users-count').textContent = count;
}

// Send chat message
document.getElementById('send-btn').onclick = () => {
    const message = document.getElementById('message-input').value.trim();
    if (message) {
        socket.emit('chat-message', message);
        document.getElementById('message-input').value = '';
    }
};

// Create poll
document.getElementById('create-poll-btn').onclick = () => {
    const question = document.getElementById('poll-question').value.trim();
    const options = document.getElementById('poll-option').value.split(',').map(opt => opt.trim()).filter(opt => opt !== '');

    if (!question || options.length < 2) {
        alert('Please provide a question and at least two options.');
        return;
    }

    socket.emit('create-poll', { question, options });

    // Clear input fields
    document.getElementById('poll-question').value = '';
    document.getElementById('poll-option').value = '';
};

// **Fix: Listen for 'new-poll' event & create the poll UI**
socket.on('new-poll', ({ id, question, options }) => {
    createPollUI(id, question, options, Array(options.length).fill(0));
});

// Vote function (Allow Revoting)
function vote(pollId, optionIndex) {
    socket.emit('vote', { pollId, optionIndex });
}

// Update poll results
socket.on('poll-update', ({ pollId, voteCounts, options }) => {
    updatePollResults(pollId, voteCounts, options);
});

// **Fix: Create poll UI properly**
function createPollUI(id, question, options, votes = []) {
    const pollDiv = document.createElement('div');
    pollDiv.classList.add(
        'p-4', 'rounded-lg', 'shadow-lg', 'border', 'border-gray-300', 
        'bg-white', 'mb-4', 'transition', 'hover:shadow-xl'
    );

    const questionEl = document.createElement('h4');
    questionEl.textContent = question;
    questionEl.classList.add('text-xl', 'font-semibold', 'text-blue-600', 'mb-2');

    const optionsContainer = document.createElement('div');
    optionsContainer.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-2');

    options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.textContent = option;
        optionBtn.classList.add(
            'bg-green-500', 'text-white', 'text-sm', 'px-4', 'py-2', 'rounded-lg', 
            'hover:bg-green-600', 'transition', 'w-full', 'font-medium'
        );
        optionBtn.onclick = () => vote(id, index);
        optionsContainer.appendChild(optionBtn);
    });

    const resultsList = document.createElement('ul');
    resultsList.id = `${id}-results`;
    resultsList.classList.add('mt-2', 'text-gray-700', 'text-sm', 'space-y-1');

    updatePollResults(id, votes, options);

    pollDiv.appendChild(questionEl);
    pollDiv.appendChild(optionsContainer);
    pollDiv.appendChild(resultsList);

    document.getElementById('polls').appendChild(pollDiv);
}
