let gridSize = 3; // Začínáme s 3x3 mřížkou
let timeRemaining = 15; // Časový limit na 30 sekund
let score = 0; // Počáteční skóre
let interval;
let differenceIndex;

const gridContainer = document.getElementById('grid');
const timeDisplay = document.getElementById('time');
const scoreDisplay = document.getElementById('score');
let gameActive = true;

function startGame() {
    resetTimer(); // Resetujeme časovač
    score = 0; // Reset skóre na začátku hry
    updateScoreDisplay();
    createGrid();
}

function resetTimer() {
    clearInterval(interval); // Zastavíme případný starý časovač
    timeDisplay.textContent = timeRemaining; // Aktualizujeme zobrazení času
    interval = setInterval(() => {
        timeRemaining--;
        timeDisplay.textContent = timeRemaining;

        if (timeRemaining <= 0) {
            clearInterval(interval);
            gameActive = false;
        }
    }, 1000);
}

function createGrid() {
    gridContainer.innerHTML = ''; // Resetujeme mřížku
    gridContainer.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    let gridItems = [];

    // Vytvoření mřížky
    for (let i = 0; i < gridSize * gridSize; i++) {
        let div = document.createElement('div');
        div.addEventListener('click', () => handleClick(i));
        gridItems.push(div);
        gridContainer.appendChild(div);
    }

    // Nastavení barev políček
    setDifferentColor(gridItems);
}

function setDifferentColor(gridItems) {
    let normalColor = getRandomHSL();
    let normalLightness = normalColor.lightness;
    let differentLightness = normalLightness + 10; // Zvýšíme světlost o 10%

    // Zajistíme, aby rozdílná světlost nepřekročila 100%
    if (differentLightness > 100) {
        differentLightness = normalLightness - 10;
    }

    // Vybereme náhodné políčko pro odlišnou barvu
    differenceIndex = Math.floor(Math.random() * gridItems.length);

    gridItems.forEach((item, index) => {
        if (index === differenceIndex) {
            item.style.backgroundColor = `hsl(${normalColor.hue}, ${normalColor.saturation}%, ${differentLightness}%)`;
            item.classList.add('different');
        } else {
            item.style.backgroundColor = `hsl(${normalColor.hue}, ${normalColor.saturation}%, ${normalLightness}%)`;
        }
    });
}

function getRandomHSL() {
    const hue = Math.floor(Math.random() * 360); // Náhodný odstín (0–360°)
    const saturation = 50 + Math.random() * 50; // Sytost (50–100%)
    const lightness = 40 + Math.random() * 20; // Jas (40–60%)
    return { hue, saturation, lightness };
}

function handleClick(index) {
    if (!gameActive) return;

    if (index === differenceIndex) {
        score += 10; // Přidání bodů za správnou odpověď
        updateScoreDisplay();
        gridSize++; // Zvýšení velikosti mřížky
        if (gridSize > 9) gridSize = 9; // Maximální velikost mřížky
        timeRemaining += 3; // Přidání času jako odměna
        resetTimer(); // Obnovení časovače
        createGrid(); // Nová mřížka
    }
}

function updateScoreDisplay() {
    scoreDisplay.textContent = `Skóre: ${score}`; // Aktualizace zobrazení skóre
}

// Start hry po načtení
startGame();
