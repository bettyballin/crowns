document.addEventListener('DOMContentLoaded', () => {
    // Game variables
    let gameBoard = [];
    let boardSize = 4; // Default for easy difficulty
    let regions = [];
    let cellElements = [];
    let timer = 0;
    let timerInterval;
    let isDragging = false;
    let dragAction = null;
    let gameStarted = false;
    let solution = [];
    let gameBoardHistory = []; // To store previous board state for revert
    
    // DOM Elements
    const gameBoardElement = document.getElementById('game-board');
    const timeElement = document.getElementById('time');
    const easyBtn = document.getElementById('easy-btn');
    const mediumBtn = document.getElementById('medium-btn');
    const hardBtn = document.getElementById('hard-btn');
    const hintBtn = document.getElementById('hint-btn');
    const revertBtn = document.getElementById('revert-btn');
    const clearBtn = document.getElementById('clear-btn');
    const solutionBtn = document.getElementById('solution-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const rulesModal = document.getElementById('rules-modal');
    const winModal = document.getElementById('win-modal');
    const winTimeElement = document.getElementById('win-time');
    const playAgainBtn = document.getElementById('play-again-btn');
    const closeBtn = document.querySelector('.close');
    
    // Initialize game
    initGame();
    
    // Event listeners
    easyBtn.addEventListener('click', () => setDifficulty('easy'));
    mediumBtn.addEventListener('click', () => setDifficulty('medium'));
    hardBtn.addEventListener('click', () => setDifficulty('hard'));
    hintBtn.addEventListener('click', showHint);
    revertBtn.addEventListener('click', revertBoard);
    clearBtn.addEventListener('click', clearBoard);
    solutionBtn.addEventListener('click', showSolution);
    rulesBtn.addEventListener('click', () => rulesModal.style.display = 'block');
    closeBtn.addEventListener('click', () => rulesModal.style.display = 'none');
    playAgainBtn.addEventListener('click', () => {
        winModal.style.display = 'none';
        initGame();
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === rulesModal) {
            rulesModal.style.display = 'none';
        }
        if (e.target === winModal) {
            winModal.style.display = 'none';
            initGame();
        }
    });
    
    // Initialize game
    function initGame() {
        // Reset variables
        clearInterval(timerInterval);
        timer = 0;
        timeElement.textContent = '0s';
        gameStarted = false;
        hintBtn.disabled = true;
        gameBoardHistory = []; // Reset history
        
        // Generate game board
        generateBoard();
        renderBoard();
        
        // Start timer after first interaction
        gameBoardElement.addEventListener('click', startTimer, { once: true });
        
        // Enable hint after 15 seconds
        setTimeout(() => {
            hintBtn.disabled = false;
        }, 15000);
    }
    
    // Set difficulty level
    function setDifficulty(difficulty) {
        // Remove active class from all buttons
        easyBtn.classList.remove('active');
        mediumBtn.classList.remove('active');
        hardBtn.classList.remove('active');
        
        // Set boardSize based on difficulty
        switch(difficulty) {
            case 'easy':
                boardSize = 4;
                easyBtn.classList.add('active');
                break;
            case 'medium':
                boardSize = 5;
                mediumBtn.classList.add('active');
                break;
            case 'hard':
                boardSize = 6;
                hardBtn.classList.add('active');
                break;
        }
        
        // Update board display classes
        document.querySelector('.game-container').className = `game-container difficulty-${difficulty}`;
        
        // Reset and create new game
        initGame();
    }
    
    // Generate board with regions
    function generateBoard() {
        gameBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
        regions = [];
        
        // Generate regions (color blocks)
        generateRegions();
        
        // Generate solution
        generateSolution();
    }
    
    // Generate regions for the board
    function generateRegions() {
        const numRegions = boardSize;
        const totalCells = boardSize * boardSize;
        const minRegionSize = Math.floor(totalCells / numRegions);
        const extraCells = totalCells % numRegions;
        
        // Create region sizes (should be roughly equal)
        const regionSizes = Array(numRegions).fill(minRegionSize);
        for (let i = 0; i < extraCells; i++) {
            regionSizes[i]++;
        }
        
        // Create region assignments
        const regionAssignments = Array(totalCells).fill(-1);
        const cells = Array.from({length: totalCells}, (_, i) => i);
        
        // Start with a random cell for each region
        const seedCells = [];
        for (let region = 0; region < numRegions; region++) {
            let selectedIndex, selectedCell;
            do {
                selectedIndex = Math.floor(Math.random() * cells.length);
                selectedCell = cells[selectedIndex];
            } while (seedCells.includes(selectedCell));
            
            seedCells.push(selectedCell);
            cells.splice(selectedIndex, 1);
            regionAssignments[selectedCell] = region;
            regionSizes[region]--;
        }
        
        // Grow regions by selecting adjacent cells
        while (cells.length > 0) {
            // Find frontiers for each region (empty cells adjacent to the region)
            const frontiers = Array(numRegions).fill().map(() => []);
            
            for (let cellIndex = 0; cellIndex < totalCells; cellIndex++) {
                if (regionAssignments[cellIndex] === -1) {
                    // This is an unassigned cell
                    const row = Math.floor(cellIndex / boardSize);
                    const col = cellIndex % boardSize;
                    
                    // Check adjacent cells (only orthogonally, not diagonally)
                    const neighbors = [
                        [row - 1, col], // up
                        [row + 1, col], // down
                        [row, col - 1], // left
                        [row, col + 1]  // right
                    ];
                    
                    const adjacentRegions = new Set();
                    for (const [adjRow, adjCol] of neighbors) {
                        if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
                            const adjIndex = adjRow * boardSize + adjCol;
                            const adjRegion = regionAssignments[adjIndex];
                            if (adjRegion !== -1) {
                                adjacentRegions.add(adjRegion);
                            }
                        }
                    }
                    
                    // Add this cell to frontiers of all adjacent regions
                    for (const region of adjacentRegions) {
                        frontiers[region].push(cellIndex);
                    }
                }
            }
            
            // Find a region that still needs cells and has a frontier
            let chosenRegion = -1;
            for (let region = 0; region < numRegions; region++) {
                if (regionSizes[region] > 0 && frontiers[region].length > 0) {
                    chosenRegion = region;
                    break;
                }
            }
            
            if (chosenRegion === -1) {
                // No valid frontier found, try to find any cells adjacent to a region
                const remainingCells = cells.map(cellIndex => {
                    const row = Math.floor(cellIndex / boardSize);
                    const col = cellIndex % boardSize;
                    const adjacentRegions = [];
                    
                    // Check neighbors
                    const neighbors = [
                        [row - 1, col], // up
                        [row + 1, col], // down
                        [row, col - 1], // left
                        [row, col + 1]  // right
                    ];
                    
                    for (const [adjRow, adjCol] of neighbors) {
                        if (adjRow >= 0 && adjRow < boardSize && adjCol >= 0 && adjCol < boardSize) {
                            const adjIndex = adjRow * boardSize + adjCol;
                            const adjRegion = regionAssignments[adjIndex];
                            if (adjRegion !== -1) {
                                adjacentRegions.push(adjRegion);
                            }
                        }
                    }
                    
                    return { cellIndex, adjacentRegions };
                }).filter(cell => cell.adjacentRegions.length > 0);
                
                // If there are cells adjacent to regions, prefer those
                if (remainingCells.length > 0) {
                    const randomCell = remainingCells[Math.floor(Math.random() * remainingCells.length)];
                    const region = randomCell.adjacentRegions[0]; // Pick the first region
                    regionAssignments[randomCell.cellIndex] = region;
                    const cellIndex = cells.indexOf(randomCell.cellIndex);
                    cells.splice(cellIndex, 1);
                    
                    // Update the region size
                    for (let i = 0; i < numRegions; i++) {
                        if (regionSizes[i] > 0) {
                            regionSizes[i]--;
                            break;
                        }
                    }
                } else {
                    // If no cells are adjacent to any region, just assign randomly
                    for (let region = 0; region < numRegions; region++) {
                        while (regionSizes[region] > 0 && cells.length > 0) {
                            const randomIndex = Math.floor(Math.random() * cells.length);
                            const randomCell = cells[randomIndex];
                            cells.splice(randomIndex, 1);
                            regionAssignments[randomCell] = region;
                            regionSizes[region]--;
                        }
                    }
                }
            } else {
                // Choose a random cell from the chosen region's frontier
                const frontierIndex = Math.floor(Math.random() * frontiers[chosenRegion].length);
                const chosenCell = frontiers[chosenRegion][frontierIndex];
                
                // Assign the cell to the region
                regionAssignments[chosenCell] = chosenRegion;
                regionSizes[chosenRegion]--;
                
                // Remove the cell from the available cells
                const cellIndex = cells.indexOf(chosenCell);
                if (cellIndex !== -1) {
                    cells.splice(cellIndex, 1);
                }
            }
        }
        
        // Create 2D region matrix
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const index = row * boardSize + col;
                if (!regions[row]) regions[row] = [];
                regions[row][col] = regionAssignments[index];
            }
        }
    }
    
    // Generate a valid solution
    function generateSolution() {
        solution = Array(boardSize).fill().map(() => Array(boardSize).fill(false));
        
        // First, ensure one crown per region
        const regionCrowns = new Map();
        
        // Place crowns one by one
        let remainingAttempts = 100; // Limit attempts to avoid infinite loops
        
        while (remainingAttempts > 0) {
            // Reset solution
            solution = Array(boardSize).fill().map(() => Array(boardSize).fill(false));
            let success = true;
            
            // Try to place crowns for each region first
            for (let regionId = 0; regionId < boardSize; regionId++) {
                const regionCells = [];
                
                // Find all cells in this region
                for (let row = 0; row < boardSize; row++) {
                    for (let col = 0; col < boardSize; col++) {
                        if (regions[row][col] === regionId) {
                            regionCells.push({row, col});
                        }
                    }
                }
                
                // Shuffle cells to try random positions
                shuffleArray(regionCells);
                
                let placed = false;
                for (const {row, col} of regionCells) {
                    if (canPlaceCrown(row, col)) {
                        solution[row][col] = true;
                        placed = true;
                        break;
                    }
                }
                
                if (!placed) {
                    success = false;
                    break;
                }
            }
            
            // Verify solution is valid
            if (success && isValidSolution()) {
                break;
            }
            
            remainingAttempts--;
        }
        
        if (remainingAttempts === 0) {
            // If we couldn't generate a valid solution, try again with a new board
            generateBoard();
            return;
        }
    }
    
    // Check if a crown can be placed at the given position
    function canPlaceCrown(row, col) {
        // Check if a crown already exists in this row or column
        for (let i = 0; i < boardSize; i++) {
            if (solution[row][i] || solution[i][col]) {
                return false;
            }
        }
        
        // Check adjacent cells (including diagonals)
        for (let r = Math.max(0, row - 1); r <= Math.min(boardSize - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(boardSize - 1, col + 1); c++) {
                if (solution[r][c]) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Check if the solution is valid
    function isValidSolution() {
        // Check if each row has exactly one crown
        for (let row = 0; row < boardSize; row++) {
            if (solution[row].filter(cell => cell).length !== 1) {
                return false;
            }
        }
        
        // Check if each column has exactly one crown
        for (let col = 0; col < boardSize; col++) {
            let count = 0;
            for (let row = 0; row < boardSize; row++) {
                if (solution[row][col]) {
                    count++;
                }
            }
            if (count !== 1) {
                return false;
            }
        }
        
        // Check if each region has exactly one crown
        const regionCrowns = new Map();
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (solution[row][col]) {
                    const region = regions[row][col];
                    if (regionCrowns.has(region)) {
                        return false;
                    }
                    regionCrowns.set(region, true);
                }
            }
        }
        
        return regionCrowns.size === boardSize;
    }
    
    // Render the board to the DOM
    function renderBoard() {
        gameBoardElement.innerHTML = '';
        gameBoardElement.style.gridTemplateColumns = `repeat(${boardSize}, 1fr)`;
        cellElements = [];
        
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = document.createElement('div');
                const regionId = regions[row][col];
                
                cell.className = `cell region-${regionId}`;
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Add border classes for cells in the same region
                // Check the four neighboring cells (top, right, bottom, left)
                const topRow = row - 1;
                const bottomRow = row + 1;
                const leftCol = col - 1;
                const rightCol = col + 1;
                
                // Add border classes
                if (topRow >= 0 && regions[topRow][col] === regionId) {
                    cell.classList.add('no-top-border');
                }
                
                if (rightCol < boardSize && regions[row][rightCol] === regionId) {
                    cell.classList.add('no-right-border');
                }
                
                if (bottomRow < boardSize && regions[bottomRow][col] === regionId) {
                    cell.classList.add('no-bottom-border');
                }
                
                if (leftCol >= 0 && regions[row][leftCol] === regionId) {
                    cell.classList.add('no-left-border');
                }
                
                cell.addEventListener('click', () => handleCellClick(row, col));
                cell.addEventListener('mousedown', () => handleDragStart(row, col));
                cell.addEventListener('mouseenter', () => handleDragOver(row, col));
                
                gameBoardElement.appendChild(cell);
                
                if (!cellElements[row]) cellElements[row] = [];
                cellElements[row][col] = cell;
            }
        }
        
        // Set up drag end event
        document.addEventListener('mouseup', handleDragEnd);
    }
    
    // Handle cell click
    function handleCellClick(row, col) {
        if (!gameStarted) {
            startTimer();
        }
        
        // Save current board state before making changes
        saveCurrentBoardState();
        
        // Click cycle: Empty -> X -> Crown -> Empty
        const currentState = gameBoard[row][col];
        
        if (currentState === null) {
            // Empty -> X
            gameBoard[row][col] = 'x';
            cellElements[row][col].classList.add('x');
            cellElements[row][col].classList.remove('crown');
        } else if (currentState === 'x') {
            // X -> Crown
            gameBoard[row][col] = 'crown';
            cellElements[row][col].classList.remove('x');
            cellElements[row][col].classList.add('crown');
        } else {
            // Crown -> Empty
            gameBoard[row][col] = null;
            cellElements[row][col].classList.remove('x', 'crown');
        }
        
        // Check if the game is won
        checkWinCondition();
    }
    
    // Save the current board state for revert functionality
    function saveCurrentBoardState() {
        const currentState = gameBoard.map(row => [...row]);
        gameBoardHistory.push(currentState);
        
        // Limit history to 10 states to prevent memory issues
        if (gameBoardHistory.length > 10) {
            gameBoardHistory.shift();
        }
    }
    
    // Revert to the previous board state
    function revertBoard() {
        if (gameBoardHistory.length === 0) return;
        
        // Get previous state
        const previousState = gameBoardHistory.pop();
        
        // Update gameBoard with previous state
        gameBoard = previousState.map(row => [...row]);
        
        // Update UI to match
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = cellElements[row][col];
                const state = gameBoard[row][col];
                
                // Reset classes
                cell.classList.remove('x', 'crown');
                
                // Apply correct class based on state
                if (state === 'x') {
                    cell.classList.add('x');
                } else if (state === 'crown') {
                    cell.classList.add('crown');
                }
            }
        }
    }
    
    // Clear all marks from the board
    function clearBoard() {
        // Save current state before clearing
        saveCurrentBoardState();
        
        // Reset all cells to empty
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                gameBoard[row][col] = null;
                cellElements[row][col].classList.remove('x', 'crown');
            }
        }
    }
    
    // Show the solution
    function showSolution() {
        // Save current state before showing solution
        saveCurrentBoardState();
        
        // Set the board to match the solution
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                const cell = cellElements[row][col];
                
                // Reset classes
                cell.classList.remove('x', 'crown');
                
                if (solution[row][col]) {
                    // This cell should have a crown in the solution
                    gameBoard[row][col] = 'crown';
                    cell.classList.add('crown');
                } else {
                    // This cell should not have a crown
                    gameBoard[row][col] = null;
                }
            }
        }
    }
    
    // Handle mouse down for drag operations
    function handleDragStart(row, col) {
        isDragging = true;
        
        // Save current state before drag operation
        saveCurrentBoardState();
        
        // Determine action based on current cell state
        const currentState = gameBoard[row][col];
        
        if (currentState === null) {
            // If empty, we'll add X's
            dragAction = 'addX';
            
            // Apply to the starting cell
            gameBoard[row][col] = 'x';
            cellElements[row][col].classList.add('x');
            cellElements[row][col].classList.remove('crown');
        } else if (currentState === 'x' || currentState === 'crown') {
            // If there's an X or crown, we'll clear cells
            dragAction = 'clear';
            
            // Apply to the starting cell
            gameBoard[row][col] = null;
            cellElements[row][col].classList.remove('x', 'crown');
        }
    }
    
    // Handle mouse over during drag
    function handleDragOver(row, col) {
        if (!isDragging) return;
        
        switch (dragAction) {
            case 'addX':
                // Add X to empty cells
                if (gameBoard[row][col] === null) {
                    gameBoard[row][col] = 'x';
                    cellElements[row][col].classList.add('x');
                    cellElements[row][col].classList.remove('crown');
                }
                break;
                
            case 'clear':
                // Clear any cell we drag over (X or crown)
                gameBoard[row][col] = null;
                cellElements[row][col].classList.remove('x', 'crown');
                break;
        }
    }
    
    // Handle drag end
    function handleDragEnd() {
        isDragging = false;
        dragAction = null;
        
        // Check if the game is won after drag operations
        checkWinCondition();
    }
    
    // Start the timer
    function startTimer() {
        if (gameStarted) return;
        gameStarted = true;
        
        timerInterval = setInterval(() => {
            timer++;
            timeElement.textContent = `${timer}s`;
        }, 1000);
    }
    
    // Show a hint
    function showHint() {
        if (!gameStarted) return;
        
        // Find a cell that should have a crown but doesn't
        let hintFound = false;
        
        // First look for empty cells that should have crowns
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (solution[row][col] && gameBoard[row][col] !== 'crown') {
                    highlightHint(row, col);
                    hintFound = true;
                    break;
                }
            }
            if (hintFound) break;
        }
        
        // If no empty cells that should have crowns, look for incorrect crowns
        if (!hintFound) {
            for (let row = 0; row < boardSize; row++) {
                for (let col = 0; col < boardSize; col++) {
                    if (gameBoard[row][col] === 'crown' && !solution[row][col]) {
                        highlightHint(row, col);
                        hintFound = true;
                        break;
                    }
                }
                if (hintFound) break;
            }
        }
        
        // Disable hint button after use
        hintBtn.disabled = true;
        setTimeout(() => {
            hintBtn.disabled = false;
        }, 30000); // Re-enable after 30 seconds
    }
    
    // Highlight a hint cell
    function highlightHint(row, col) {
        const cell = cellElements[row][col];
        cell.classList.add('hint');
        
        setTimeout(() => {
            cell.classList.remove('hint');
        }, 2000);
    }
    
    // Check if the game is won
    function checkWinCondition() {
        // Count crowns in each row, column, and region
        const rowCrowns = Array(boardSize).fill(0);
        const colCrowns = Array(boardSize).fill(0);
        const regionCrowns = new Map();
        
        // Check if any crowns are adjacent
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (gameBoard[row][col] === 'crown') {
                    // Count for row, column, and region
                    rowCrowns[row]++;
                    colCrowns[col]++;
                    
                    const region = regions[row][col];
                    regionCrowns.set(region, (regionCrowns.get(region) || 0) + 1);
                    
                    // Check adjacent cells (including diagonals)
                    for (let r = Math.max(0, row - 1); r <= Math.min(boardSize - 1, row + 1); r++) {
                        for (let c = Math.max(0, col - 1); c <= Math.min(boardSize - 1, col + 1); c++) {
                            if (r !== row || c !== col) { // Skip the current cell
                                if (gameBoard[r][c] === 'crown') {
                                    // Adjacent crowns found, not a win
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Check if each row has exactly one crown
        for (let i = 0; i < boardSize; i++) {
            if (rowCrowns[i] !== 1) return;
        }
        
        // Check if each column has exactly one crown
        for (let i = 0; i < boardSize; i++) {
            if (colCrowns[i] !== 1) return;
        }
        
        // Check if each region has exactly one crown
        if (regionCrowns.size !== boardSize) return;
        for (const [_, count] of regionCrowns) {
            if (count !== 1) return;
        }
        
        // Check if the solution matches the expected solution
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if ((gameBoard[row][col] === 'crown') !== solution[row][col]) {
                    return;
                }
            }
        }
        
        // All checks passed, game is won
        handleWin();
    }
    
    // Handle win
    function handleWin() {
        clearInterval(timerInterval);
        
        // Add celebration animation to the board
        gameBoardElement.classList.add('celebrate');
        setTimeout(() => {
            gameBoardElement.classList.remove('celebrate');
        }, 1000);
        
        // Show win modal
        winTimeElement.textContent = `${timer}s`;
        winModal.style.display = 'block';
    }
    
    // Utility function to shuffle an array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
});