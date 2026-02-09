document.addEventListener('DOMContentLoaded', () => {
    const addOneBtn = document.getElementById('add-one-btn');
    const addTenBtn = document.getElementById('add-ten-btn');
    const themeBtn = document.getElementById('theme-btn');
    const antField = document.getElementById('ant-field');
    const anteaterImg = document.getElementById('anteater-img');
    const countDisplay = document.getElementById('count');
    const crunchSound = document.getElementById('crunch-sound');

    let eatenCount = 0;
    let ants = []; // Array to store ant data: { id, element, x, y }
    let nextId = 0;
    let antsEatenSinceWobble = 0;
    let wobbleTarget = getRandomWobbleTarget(); // Initialize with random target

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

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Toggle icon based on mode
        if (document.body.classList.contains('dark-mode')) {
            themeBtn.textContent = '🌙';
        } else {
            themeBtn.textContent = '☀️';
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
