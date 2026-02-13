document.addEventListener("DOMContentLoaded", function () {

    const startBtn = document.getElementById("startBtn");
    const backBtn = document.getElementById("backBtn");
    const startScreen = document.getElementById("startScreen");
    const gameScreen = document.getElementById("gameScreen");
    const grid = document.getElementById("grid");
    const scoreDisplay = document.getElementById("score");
    const highScoreDisplay = document.getElementById("highScore");
    const timeDisplay = document.getElementById("time");
    const difficultySelect = document.getElementById("difficulty");
    const hammer = document.getElementById("hammer");
    const hitSound = document.getElementById("hitSound");

    let score = 0;
    let highScore = localStorage.getItem("highScore") || 0;
    let timeLeft = 30;
    let currentMole = null;
    let moleTimeout;
    let timerInterval;

    highScoreDisplay.textContent = highScore;

    // Create holes only once
    for (let i = 0; i < 9; i++) {
        const hole = document.createElement("div");
        hole.classList.add("hole");
        grid.appendChild(hole);
    }

    const holes = document.querySelectorAll(".hole");

    // START GAME
    startBtn.addEventListener("click", () => {

        startScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");

        // ✅ Change background for game
        document.body.classList.add("game-bg");

        startGame();
    });

    // BACK TO MENU
    backBtn.addEventListener("click", () => {

        stopGame();

        gameScreen.classList.add("hidden");
        startScreen.classList.remove("hidden");

        // ✅ Remove game background
        document.body.classList.remove("game-bg");
    });

    function startGame() {

        score = 0;
        timeLeft = 30;
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeLeft;

        showMole();

        timerInterval = setInterval(() => {

            timeLeft--;
            timeDisplay.textContent = timeLeft;

            if (timeLeft <= 0) {

                stopGame();
                alert("Game Over! Score: " + score);

                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem("highScore", highScore);
                    highScoreDisplay.textContent = highScore;
                }
            }

        }, 1000);
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

     if (difficulty == "1000") { 
    
         nextSpeed = Math.random() * 600 + 600;  
       } else if (difficulty == "700") { 
        nextSpeed = Math.random() * 500 + 500;
           }       
           else { 
        nextSpeed = Math.random() * 150 + 250;
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
