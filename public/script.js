const storedUsername = localStorage.getItem('username');
const socket = io({ auth: { username: storedUsername || null } });

// Assign random colors to users
const userColors = {};
function getUserColor(username) {
    if (!userColors[username]) {
        const draculaColors = [
            '#8be9fd', // cyan
            '#50fa7b', // green
            '#ffb86c', // orange
            '#ff79c6', // pink
            '#bd93f9', // purple
            '#ff5555', // red
            '#f1fa8c', // yellow
            '#6272a4'  // comment (blue-ish)
        ];

        userColors[username] = draculaColors[Object.keys(userColors).length % draculaColors.length];
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
        voteItem.classList.add('flex', 'items-center');

        const voteBar = document.createElement('div');
        voteBar.classList.add('h-2', 'bg-dracula-purple', 'rounded-full', 'mr-2');
        voteBar.style.width = `${(voteCounts[index] || 0) * 10}px`;
        voteBar.style.minWidth = '2px';

        voteItem.prepend(voteBar);
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
        item.innerHTML = `<i class="fas fa-${type === "join" ? 'user-plus' : 'user-minus'} mr-1"></i> ${message}`;
        item.classList.add(type === "join" ? 'text-dracula-green' : 'text-dracula-red', 'italic');
    } else {
        item.innerHTML = `<span style="color: ${getUserColor(username)}">${username}:</span> ${message}`;
    }
    document.getElementById('messages').appendChild(item);
    item.scrollIntoView({ behavior: 'smooth' });
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
        'p-4', 'rounded-lg', 'shadow-lg', 'border', 'border-dracula-comment',
        'bg-dracula-currentLine', 'mb-4', 'transition', 'hover:shadow-xl'
    );

    const questionEl = document.createElement('h4');
    questionEl.textContent = question;
    questionEl.classList.add('text-xl', 'font-semibold', 'text-dracula-purple', 'mb-3');

    const optionsContainer = document.createElement('div');
    optionsContainer.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-3');

    options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.textContent = option;
        optionBtn.classList.add(
            'bg-dracula-green', 'text-dracula-background', 'text-sm', 'px-4', 'py-2', 'rounded-lg',
            'hover:bg-dracula-cyan', 'transition', 'w-full', 'font-medium', 'text-left', 'pl-4'
        );
        optionBtn.onclick = () => vote(id, index);
        optionsContainer.appendChild(optionBtn);
    });

    const resultsList = document.createElement('ul');
    resultsList.id = `${id}-results`;
    resultsList.classList.add('mt-3', 'text-dracula-foreground', 'text-sm', 'space-y-2');

    updatePollResults(id, votes, options);

    pollDiv.appendChild(questionEl);
    pollDiv.appendChild(optionsContainer);
    pollDiv.appendChild(resultsList);

    document.getElementById('polls').appendChild(pollDiv);
}
