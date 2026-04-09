document.addEventListener("DOMContentLoaded", function () {

    // API Configuration
   // API Configuration - works locally and in production
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname ===
  '127.0.0.1'
      ? 'http://localhost:3000/api'  // Local development
      : ' https://whack-a-mole-zr8j.onrender.com/api';  // Production 
 
   
    // Screen elements
    const loginScreen = document.getElementById("loginScreen");
    const startScreen = document.getElementById("startScreen");
    const gameScreen = document.getElementById("gameScreen");
    const leaderboardScreen = document.getElementById("leaderboardScreen");

    // Login elements
    const usernameInput = document.getElementById("usernameInput");
    const passwordInput = document.getElementById("passwordInput");
    const loginBtn = document.getElementById("loginBtn");

    // Menu elements
    const startBtn = document.getElementById("startBtn");
    const leaderboardBtn = document.getElementById("leaderboardBtn");
    const logoutBtn = document.getElementById("logoutBtn");
    const backToMenuBtn = document.getElementById("backToMenuBtn");
    const backBtn = document.getElementById("backBtn");

    // Display elements
    const usernameDisplay = document.getElementById("usernameDisplay");
    const userHighScore = document.getElementById("userHighScore");
    const gamesPlayedDisplay = document.getElementById("gamesPlayed");
    const leaderboardBody = document.getElementById("leaderboardBody");

    // Game elements
    const grid = document.getElementById("grid");
    const scoreDisplay = document.getElementById("score");
    const highScoreDisplay = document.getElementById("highScore");
    const timeDisplay = document.getElementById("time");
    const difficultySelect = document.getElementById("difficulty");
    const hammer = document.getElementById("hammer");
    const hitSound = document.getElementById("hitSound");

    // Game state
    let currentUser = null;
    let score = 0;
    let highScore = 0;
    let timeLeft = 30;
    let currentMole = null;
    let moleTimeout;
    let timerInterval;

    // Create holes only once
    for (let i = 0; i < 9; i++) {
        const hole = document.createElement("div");
        hole.classList.add("hole");
        grid.appendChild(hole);
    }

    const holes = document.querySelectorAll(".hole");

    // Helper function to show error messages
    function showError(message) {
        alert(message);
    }

    // LOGIN
    loginBtn.addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError("Please enter both username and password");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                showError(data.error || 'Login failed');
                return;
            }

            currentUser = data;
            highScore = data.highestScore;

            // Update UI
            usernameDisplay.textContent = data.username;
            userHighScore.textContent = data.highestScore;
            gamesPlayedDisplay.textContent = data.gamesPlayed;
            highScoreDisplay.textContent = data.highestScore;

            // Show start screen
            loginScreen.classList.add("hidden");
            startScreen.classList.remove("hidden");

        } catch (error) {
            console.error('Login error:', error);
            showError('Failed to connect to server. Make sure the server is running.');
        }
    });

    // Allow Enter key to login
    passwordInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            loginBtn.click();
        }
    });

    // LOGOUT
    logoutBtn.addEventListener("click", () => {
        currentUser = null;
        usernameInput.value = '';
        passwordInput.value = '';
        startScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
    });

    // VIEW LEADERBOARD
    leaderboardBtn.addEventListener("click", async () => {
        startScreen.classList.add("hidden");
        leaderboardScreen.classList.remove("hidden");
        await loadLeaderboard();
    });

    // BACK TO MENU FROM LEADERBOARD
    backToMenuBtn.addEventListener("click", () => {
        leaderboardScreen.classList.add("hidden");
        startScreen.classList.remove("hidden");
    });

    // Load leaderboard data
    async function loadLeaderboard() {
        try {
            leaderboardBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

            console.log('Fetching leaderboard from:', `${API_URL}/leaderboard?limit=10`);
            const response = await fetch(`${API_URL}/leaderboard?limit=10`);

            console.log('Response status:', response.status);

            const data = await response.json();
            console.log('Leaderboard data received:', data);

            // Check if there's an error in the response
            if (data.error) {
                throw new Error(data.error + (data.details ? ': ' + data.details : ''));
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!Array.isArray(data)) {
                console.error('Expected array but got:', typeof data, data);
                throw new Error('Invalid data format received from server');
            }

            if (data.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="4">No players yet!</td></tr>';
                return;
            }

            leaderboardBody.innerHTML = data.map(player => `
                <tr class="${player.username === currentUser?.username ? 'current-user' : ''}">
                    <td>${player.rank}</td>
                    <td>${player.username}</td>
                    <td>${player.highestScore}</td>
                    <td>${player.gamesPlayed}</td>
                </tr>
            `).join('');

            console.log('✅ Leaderboard loaded successfully');

        } catch (error) {
            console.error('Leaderboard error:', error);
            leaderboardBody.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`;
        }
    }

    // START GAME
    startBtn.addEventListener("click", () => {
        startScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        document.body.classList.add("game-bg");
        startGame();
    });

    // BACK TO MENU
    backBtn.addEventListener("click", () => {
        stopGame();
        gameScreen.classList.add("hidden");
        startScreen.classList.remove("hidden");
        document.body.classList.remove("game-bg");
    });

    function startGame() {
        score = 0;
        timeLeft = 30;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeLeft;

        showMole();

        timerInterval = setInterval(async () => {
            timeLeft--;
            timeDisplay.textContent = timeLeft;

            if (timeLeft <= 0) {
                stopGame();

                // Submit score to database
                if (currentUser) {
                    await submitScore();
                }

                const isNewHighScore = score > highScore;
                const message = isNewHighScore
                    ? `🎉 NEW HIGH SCORE! ${score}`
                    : `Game Over! Score: ${score}`;

                alert(message);

                if (isNewHighScore) {
                    highScore = score;
                    highScoreDisplay.textContent = highScore;
                    userHighScore.textContent = highScore;
                }
            }
        }, 1000);
    }

    // Submit score to database
    async function submitScore() {
        try {
            const difficulty = difficultySelect.options[difficultySelect.selectedIndex].text;

            const response = await fetch(`${API_URL}/score/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: currentUser.username,
                    score: score,
                    difficulty: difficulty
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update UI with latest stats
                userHighScore.textContent = data.highestScore;
                gamesPlayedDisplay.textContent = data.gamesPlayed;
                highScore = data.highestScore;
            }

        } catch (error) {
            console.error('Score submission error:', error);
        }
    }

    function stopGame() {

        clearTimeout(moleTimeout);
        clearInterval(timerInterval);

        holes.forEach(hole => {
            hole.classList.remove("active");
            hole.innerHTML = "";
        });

        currentMole = null;
    }

    function showMole() {

        holes.forEach(hole => {
            hole.classList.remove("active");
            hole.innerHTML = "";
        });

        const randomIndex = Math.floor(Math.random() * holes.length);
        const hole = holes[randomIndex];

        hole.classList.add("active");

        const moleImg = document.createElement("img");
        moleImg.src = "mole.png";
        hole.appendChild(moleImg);

        currentMole = randomIndex;

        let difficulty = difficultySelect.value;
        let nextSpeed;

   const isMobile = window.innerWidth <= 500;

if (difficulty == "1000") {

    nextSpeed = isMobile
        ? Math.random() * 400 + 400   // 400–800ms (faster on phone)
        : Math.random() * 600 + 600;  // 600–1200ms (desktop)

} else if (difficulty == "700") {

    nextSpeed = isMobile
        ? Math.random() * 300 + 400   // 400–700ms
        : Math.random() * 500 + 500;  // 500–1000ms

} else {

    nextSpeed = isMobile
        ? Math.random() * 120 + 180   // 180–300ms
        : Math.random() * 150 + 250;  // 250–400ms
}



        moleTimeout = setTimeout(showMole, nextSpeed);
    }

    // Hole interactions
    holes.forEach((hole, index) => {

        hole.addEventListener("mouseenter", () => {
            hammer.style.display = "block";
        });

        hole.addEventListener("mouseleave", () => {
            hammer.style.display = "none";
        });

        hole.addEventListener("click", () => {

            hammer.style.transform = "rotate(20deg)";
            setTimeout(() => {
                hammer.style.transform = "rotate(-30deg)";
            }, 100);

            if (index === currentMole) {

                score++;
                scoreDisplay.textContent = score;

                hitSound.currentTime = 0;
                hitSound.play();

                hole.classList.add("shake");

                const smash = document.createElement("img");
                smash.src = "smash.png";
                smash.classList.add("smash");
                hole.appendChild(smash);

                setTimeout(() => {
                    hole.classList.remove("shake");
                    hole.innerHTML = "";
                }, 250);

                currentMole = null;
            }
        });
    });

    // Hammer follows mouse
    document.addEventListener("mousemove", (e) => {
        hammer.style.left = e.pageX - 30 + "px";
        hammer.style.top = e.pageY - 30 + "px";
    });

});
