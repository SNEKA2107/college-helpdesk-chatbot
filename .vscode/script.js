function sendMessage() {
    let input = document.getElementById("userInput");
    let chatBox = document.getElementById("chatBox");

    let message = input.value.toLowerCase();

    if (message === "") {
        return;
    }

    chatBox.innerHTML += `<div class="user">${input.value}</div>`;

    let reply = "";

    if (message.includes("exam")) {
        reply = "Semester exam starts from June 10.";
    } 
    else if (message.includes("fees")) {
        reply = "Last date for fees payment is May 25.";
    } 
    else if (message.includes("marksheet")) {
        reply = "Your marksheet request is under verification.";
    } 
    else if (message.includes("library")) {
        reply = "Library is open from 8 AM to 5 PM.";
    } 
    else if (message.includes("notice")) {
        reply = "Latest notices are available in the Notifications section.";
    } 
    else {
        reply = "Please contact college office for more details.";
    }

    chatBox.innerHTML += `<div class="bot">${reply}</div>`;

    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;
}

function quickMsg(text) {
    document.getElementById("userInput").value = text;
    sendMessage();
}