document.addEventListener('DOMContentLoaded', () => {
    const addOneBtn = document.getElementById('add-one-btn');
    const addTenBtn = document.getElementById('add-ten-btn');
    const themeBtn = document.getElementById('theme-btn');
    const antField = document.getElementById('ant-field');
    const anteaterImg = document.getElementById('anteater-img');
    const countDisplay = document.getElementById('count');
    const crunchSound = document.getElementById('crunch-sound');
    const saveScoreBtn = document.getElementById('save-score-btn');
    const leaderboardList = document.getElementById('leaderboard-list');

    let eatenCount = 0;
    let ants = []; // Array to store ant data: { id, element, x, y }
    let nextId = 0;
    let antsEatenSinceWobble = 0;
    let wobbleTarget = getRandomWobbleTarget(); // Initialize with random target

    // Generate or retrieve session ID (unique per tab)
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        sessionStorage.setItem('sessionId', sessionId);
    }

    // Helper for random wobble target between 4 and 17
    function getRandomWobbleTarget() {
        return Math.floor(Math.random() * (17 - 4 + 1)) + 4;
    }

    // Dragging state
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let selectedAnts = []; // Array of ant objects currently being dragged
    let longPressTimer = null;


    // --- Spawning Logic ---

    function spawnAnt(x, y, isBig = false) {
        const antEl = document.createElement('div');
        antEl.classList.add('ant');
        if (isBig) {
            antEl.classList.add('big');
        } else {
            antEl.classList.add('small');
        }
        antEl.textContent = '🐜';
        antEl.id = `ant-${nextId}`;
        
        // Random position if not provided
        // Spawn in the bottom half of the screen
        if (x === undefined || y === undefined) {
            const padding = 50;
            const minX = padding;
            const maxX = window.innerWidth - padding;
            const minY = window.innerHeight / 2;
            const maxY = window.innerHeight - padding;
            
            x = Math.random() * (maxX - minX) + minX;
            y = Math.random() * (maxY - minY) + minY;
        }

        antEl.style.left = `${x}px`;
        antEl.style.top = `${y}px`;

        const antObj = {
            id: nextId++,
            element: antEl,
            x: x,
            y: y
        };

        // Event listener for starting drag on this ant (Mouse & Touch)
        antEl.addEventListener('mousedown', (e) => startDrag(e, antObj));
        antEl.addEventListener('touchstart', (e) => startDrag(e, antObj), { passive: false });
        antEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        antField.appendChild(antEl);
        ants.push(antObj);
    }

    addOneBtn.addEventListener('click', () => {
        spawnAnt(undefined, undefined, true);
    });

    addTenBtn.addEventListener('click', () => {
        for (let i = 0; i < 10; i++) {
            spawnAnt(undefined, undefined, false);
        }
    });

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = '🌙';
    } else {
        document.body.classList.remove('dark-mode');
        themeBtn.textContent = '☀️';
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Toggle icon based on mode
        if (document.body.classList.contains('dark-mode')) {
            themeBtn.textContent = '🌙';
            localStorage.setItem('theme', 'dark');
        } else {
            themeBtn.textContent = '☀️';
            localStorage.setItem('theme', 'light');
        }
    });

    // --- Firebase Leaderboard Logic ---

    // Initialize Firebase
    let database;
    let leaderboardRef;
    
    try {
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
            console.log('🔥 Initializing Firebase...');
            firebase.initializeApp(firebaseConfig);
            database = firebase.database();
            leaderboardRef = database.ref('leaderboard');
            console.log('✅ Firebase initialized successfully!');
            console.log('📊 Database URL:', firebaseConfig.databaseURL);
            
            // Listen for real-time updates
            console.log('👂 Setting up real-time listener...');
            leaderboardRef.on('value', (snapshot) => {
                console.log('📥 Leaderboard data received:', snapshot.val());
                displayLeaderboard(snapshot.val());
            }, (error) => {
                console.error('❌ Error listening to leaderboard:', error);
            });
            console.log('✅ Listener attached successfully!');
        } else {
            console.warn('Firebase not configured. Using localStorage fallback.');
            displayLeaderboard();
        }
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
        console.warn('Using localStorage fallback.');
        displayLeaderboard();
    }

    function addScore(name, score) {
        console.log('💾 addScore called:', { name, score, sessionId });
        
        if (!database) {
            console.log('⚠️ No database, using localStorage fallback');
            // Fallback to localStorage if Firebase not available
            addScoreLocal(name, score);
            return;
        }

        console.log('🔄 Fetching current leaderboard data...');
        // Get all entries
        leaderboardRef.once('value', (snapshot) => {
            const data = snapshot.val() || {};
            console.log('📊 Current leaderboard data:', data);
            const entries = Object.entries(data).map(([key, value]) => ({ key, ...value }));
            
            // Check if this session already has an entry
            const existing = entries.find(entry => entry.sessionId === sessionId);
            console.log('🔍 Existing entry for this session:', existing);
            
            if (existing) {
                // Session exists - update only if new score is higher
                if (score > existing.score) {
                    console.log('📝 Updating existing entry...');
                    leaderboardRef.child(existing.key).update({
                        name: name,
                        score: score,
                        date: new Date().toISOString()
                    }).then(() => {
                        console.log('✅ Score updated successfully!');
                    }).catch(err => {
                        console.error('❌ Error updating score:', err);
                    });
                } else {
                    console.log('⏭️ New score not higher than existing, skipping update');
                }
            } else {
                // New session - add to leaderboard
                console.log('➕ Adding new entry to leaderboard...');
                leaderboardRef.push({
                    name: name,
                    score: score,
                    sessionId: sessionId,
                    date: new Date().toISOString()
                }).then(() => {
                    console.log('✅ Score added successfully!');
                }).catch(err => {
                    console.error('❌ Error adding score:', err);
                });
            }
            
            // Clean up - keep only top 5
            cleanupLeaderboard();
        }).catch(err => {
            console.error('❌ Error fetching leaderboard:', err);
        });
    }

    function cleanupLeaderboard() {
        console.log('🧹 Cleaning up leaderboard (keeping top 5)...');
        leaderboardRef.once('value', (snapshot) => {
            const data = snapshot.val() || {};
            const entries = Object.entries(data).map(([key, value]) => ({ key, ...value }));
            
            // Sort by score descending
            entries.sort((a, b) => b.score - a.score);
            
            // Remove entries beyond top 5
            if (entries.length > 5) {
                entries.slice(5).forEach(entry => {
                    leaderboardRef.child(entry.key).remove();
                });
            } else {
            }
        });
    }

    function displayLeaderboard(data) {
        leaderboardList.innerHTML = '';

        if (!data || Object.keys(data).length === 0) {
            leaderboardList.innerHTML = '<div class="leaderboard-empty">No scores yet</div>';
            return;
        }

        // Convert object to array and sort
        const entries = Object.values(data);
        entries.sort((a, b) => b.score - a.score);
        const top5 = entries.slice(0, 5);

        top5.forEach((entry, index) => {
            const rank = index + 1;
            const entryDiv = document.createElement('div');
            entryDiv.className = 'leaderboard-entry';
            
            const rankSpan = document.createElement('span');
            rankSpan.className = 'leaderboard-rank';
            rankSpan.textContent = `${rank}.`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'leaderboard-name';
            nameSpan.textContent = entry.name;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'leaderboard-score';
            scoreSpan.textContent = entry.score;
            
            entryDiv.appendChild(rankSpan);
            entryDiv.appendChild(nameSpan);
            entryDiv.appendChild(scoreSpan);
            
            leaderboardList.appendChild(entryDiv);
        });
    }

    // LocalStorage fallback functions
    function addScoreLocal(name, score) {
        let leaderboard = JSON.parse(localStorage.getItem('leaderboard') || '[]');
        
        const existingIndex = leaderboard.findIndex(entry => entry.sessionId === sessionId);
        
        if (existingIndex !== -1) {
            if (score > leaderboard[existingIndex].score) {
                leaderboard[existingIndex].name = name;
                leaderboard[existingIndex].score = score;
                leaderboard[existingIndex].date = new Date().toISOString();
            }
        } else {
            leaderboard.push({ name, score, sessionId, date: new Date().toISOString() });
        }
        
        leaderboard.sort((a, b) => b.score - a.score);
        const top5 = leaderboard.slice(0, 5);
        localStorage.setItem('leaderboard', JSON.stringify(top5));
        displayLeaderboard(top5.reduce((acc, entry, i) => ({ ...acc, [i]: entry }), {}));
    }

    saveScoreBtn.addEventListener('click', () => {
        if (eatenCount === 0) {
            alert('You need to eat at least one ant first!');
            return;
        }

        const name = prompt('Enter your name for the leaderboard:');
        if (name && name.trim()) {
            if (!database) {
                // Fallback to localStorage
                addScoreLocal(name.trim(), eatenCount);
                alert(`Score saved! You ate ${eatenCount} ants.`);
                return;
            }

            // Check if session already has a score
            leaderboardRef.once('value', (snapshot) => {
                const data = snapshot.val() || {};
                const entries = Object.values(data);
                const existing = entries.find(entry => entry.sessionId === sessionId);
                
                if (existing && eatenCount <= existing.score) {
                    alert(`You already have a higher score of ${existing.score}.`);
                } else if (existing) {
                    addScore(name.trim(), eatenCount);
                    alert(`Score updated! New record: ${eatenCount} ants (previous: ${existing.score})`);
                } else {
                    addScore(name.trim(), eatenCount);
                    alert(`Score saved! You ate ${eatenCount} ants.`);
                }
            });
        }
    });

    // --- Drag and Drop Logic ---

    function getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            // For touchend
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function startDrag(e, targetAnt) {
        // Prevent default text selection and scrolling
        if (e.cancelable) e.preventDefault();
        
        isDragging = true;
        const pos = getEventPos(e);
        dragStartPos = { x: pos.x, y: pos.y };

        // Handle Multi-select
        // If Shift is pressed, select ALL ants and cluster them
        // If Ctrl or Meta (Command) key is pressed, select ALL ants but maintain positions
        // Otherwise, only select the clicked ant
        if (e.shiftKey) {
            selectedAnts = [...ants];
            // Cluster all ants to the target ant's position
            selectedAnts.forEach(ant => {
                if (ant !== targetAnt) {
                    // Move to targetAnt pos with small jitter
                    ant.x = targetAnt.x + (Math.random() * 20 - 10);
                    ant.y = targetAnt.y + (Math.random() * 20 - 10);
                    ant.element.style.left = `${ant.x}px`;
                    ant.element.style.top = `${ant.y}px`;
                }
            });
        } else if (e.ctrlKey || e.metaKey) {
            selectedAnts = [...ants];
        } else {
            selectedAnts = [targetAnt];

            // Setup Long Press for Mobile (or Desktop) to select all
            if (longPressTimer) clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
                if (isDragging) {
                    selectedAnts = [...ants];
                    // Cluster all ants to the target ant's position
                    selectedAnts.forEach(ant => {
                        if (ant !== targetAnt) {
                            // Move to targetAnt pos with small jitter
                            ant.x = targetAnt.x + (Math.random() * 20 - 10);
                            ant.y = targetAnt.y + (Math.random() * 20 - 10);
                            ant.element.style.left = `${ant.x}px`;
                            ant.element.style.top = `${ant.y}px`;
                        }
                    });

                    selectedAnts.forEach(ant => {
                        ant.element.classList.add('dragging');
                        ant.element.classList.add('selected');
                    });
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            }, 600); // 600ms hold
        }

        // Add visual feedback
        selectedAnts.forEach(ant => {
            ant.element.classList.add('dragging');
            if (selectedAnts.length > 1) {
                ant.element.classList.add('selected');
            }
        });

        // Add global move and up listeners
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('touchend', onDragEnd);
    }

    function onDragMove(e) {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault(); // Prevent scrolling on mobile

        const pos = getEventPos(e);
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;

        // If moved significantly, cancel long press
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        // Move all selected ants by the delta
        selectedAnts.forEach(ant => {
            const newX = ant.x + dx;
            const newY = ant.y + dy;
            ant.element.style.left = `${newX}px`;
            ant.element.style.top = `${newY}px`;
            
            // Store temporary position for collision detection later, 
            // but don't update persistent state yet
            ant.tempX = newX;
            ant.tempY = newY;
        });
    }

    function onDragEnd(e) {
        if (!isDragging) return;

        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        isDragging = false;
        
        // Calculate final positions
        const pos = getEventPos(e);
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;

        // Check for collision with Anteater
        const anteaterRect = anteaterImg.getBoundingClientRect();
        
        // Arrays to manage updates
        const eatenAnts = [];
        const survivingAnts = [];

        selectedAnts.forEach(ant => {
            // Update position in state
            ant.x += dx;
            ant.y += dy;
            
            // Cleanup temp
            delete ant.tempX;
            delete ant.tempY;

            // Simple rectangle collision detection
            // We use the ant's center point for checking
            const antRect = ant.element.getBoundingClientRect();
            const antCenterX = antRect.left + antRect.width / 2;
            const antCenterY = antRect.top + antRect.height / 2;

            if (
                antCenterX >= anteaterRect.left &&
                antCenterX <= anteaterRect.right &&
                antCenterY >= anteaterRect.top &&
                antCenterY <= anteaterRect.bottom
            ) {
                eatenAnts.push(ant);
            } else {
                // Keep surviving ants selected state consistent (remove dragging class)
                survivingAnts.push(ant);
            }
            
            // Reset visual classes
            ant.element.classList.remove('dragging');
            ant.element.classList.remove('selected');
        });

        // Process Eaten Ants
        if (eatenAnts.length > 0) {
            eatAnts(eatenAnts);
        }

        // Clean up listeners
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('touchend', onDragEnd);
        selectedAnts = [];
    }

    // --- Eating Logic ---

    function eatAnts(eatenGroup) {
        // Increment counter
        eatenCount += eatenGroup.length;
        countDisplay.textContent = eatenCount;

        // Remove from DOM and internal array
        eatenGroup.forEach(ant => {
            if (ant.element.parentNode) {
                ant.element.parentNode.removeChild(ant.element);
            }
            // Remove from global ants array
            const index = ants.indexOf(ant);
            if (index > -1) {
                ants.splice(index, 1);
            }
        });

        // Check for wobble trigger
        antsEatenSinceWobble += eatenGroup.length;
        if (antsEatenSinceWobble >= wobbleTarget) {
            triggerWobble();
            antsEatenSinceWobble = 0;
            wobbleTarget = getRandomWobbleTarget();
        }

        // Play Sound
        playCrunchSound(eatenGroup.length);
    }

    function triggerWobble() {
        // Remove class if it exists to restart animation
        anteaterImg.classList.remove('wobble');
        
        // Force reflow to allow restarting animation
        void anteaterImg.offsetWidth;
        
        anteaterImg.classList.add('wobble');
        
        // Remove class after animation ends to keep DOM clean
        setTimeout(() => {
            anteaterImg.classList.remove('wobble');
        }, 800); // 800ms matches CSS animation duration
    }

    function playCrunchSound(count) {
        if (!crunchSound) return;

        // Reset sound to start if it's already playing
        crunchSound.currentTime = 0;
        
        // Adjust volume based on number of ants
        // Base volume 0.2, adds 0.05 per ant, max 1.0
        const volume = Math.min(1.0, 0.2 + (count * 0.05));
        crunchSound.volume = volume;
        
        // Play might fail if user hasn't interacted with document yet, 
        // but since this is triggered by a drag-drop (mouseup), it should be fine.
        crunchSound.play().catch(e => console.log("Audio play failed:", e));
    }
});
