let isF11Active = false;
let userWantsFullscreen = false;
let originalParent = null;
let originalNextSibling = null;

// Detect fullscreen button clicks
document.addEventListener('click', (e) => {
  if (e.target.closest('.vjs-fullscreen-control')) {
    console.log('Fullscreen button clicked - letting native fullscreen handle it');
    userWantsFullscreen = true;
    // Clean up our overlay if it exists, let native fullscreen take over
    const overlay = document.getElementById('fullscreen-overlay');
    if (overlay) {
      deactivateFullscreen();
    }
  }
});

// Listen for native fullscreen changes
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    console.log('Entered native fullscreen');
    userWantsFullscreen = true;
  } else {
    console.log('Exited native fullscreen');
    userWantsFullscreen = false;
  }
});

// Detect F11 by checking if window fills entire screen
function checkF11() {
  const nowF11 = (window.innerWidth === screen.width && window.innerHeight === screen.height);
  
  // Don't interfere if native fullscreen is active
  if (document.fullscreenElement) {
    return;
  }
  
  if (nowF11 && !isF11Active) {
    // User just pressed F11
    isF11Active = true;
    userWantsFullscreen = true;
    console.log('F11 pressed - activating fullscreen');
    activateFullscreen();
  } else if (!nowF11 && isF11Active) {
    // User just exited F11
    isF11Active = false;
    userWantsFullscreen = false;
    console.log('F11 released - deactivating fullscreen');
    deactivateFullscreen();
  }
}

function activateFullscreen() {
  const player = document.querySelector('.video-js') || document.querySelector('[class*="player"]');
  if (!player) return;
  
  // Store original location
  originalParent = player.parentNode;
  originalNextSibling = player.nextSibling;
  
  // Create black overlay
  const overlay = document.createElement('div');
  overlay.id = 'fullscreen-overlay';
  
  // Use viewport dimensions to ensure perfect fit
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  overlay.style.cssText = `
    position: fixed !important; 
    top: 0 !important; 
    left: 0 !important; 
    width: ${viewportWidth}px !important; 
    height: ${viewportHeight}px !important; 
    background: black !important; 
    z-index: 999999 !important; 
    display: flex !important; 
    align-items: center !important; 
    justify-content: center !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    overflow: hidden !important;
  `;
  
  // Move entire player to overlay
  overlay.appendChild(player);
  document.body.appendChild(overlay);
  
  // Make player fill overlay perfectly with viewport dimensions
  player.style.cssText = `
    width: ${viewportWidth}px !important; 
    height: ${viewportHeight}px !important;
    max-width: ${viewportWidth}px !important;
    max-height: ${viewportHeight}px !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    position: relative !important;
    top: 0 !important;
    left: 0 !important;
  `;
  
  console.log(`Fullscreen activated with dimensions: ${viewportWidth}x${viewportHeight}`);
}

function deactivateFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  if (!overlay) return;
  
  const player = overlay.querySelector('.video-js') || overlay.querySelector('[class*="player"]');
  if (player && originalParent) {
    // Reset player styles
    player.style.cssText = '';
    
    // Move player back to its exact original location
    if (originalNextSibling) {
      originalParent.insertBefore(player, originalNextSibling);
    } else {
      originalParent.appendChild(player);
    }
  }
  
  overlay.remove();
  
  // Clear references
  originalParent = null;
  originalNextSibling = null;
}

// Check for page changes and reapply if needed
let currentPage = location.href;
setInterval(() => {
  // Check F11 status
  checkF11();
  
  // Check for page changes
  if (location.href !== currentPage) {
    currentPage = location.href;
    console.log('Page changed');
    
    if (userWantsFullscreen) {
      setTimeout(() => {
        deactivateFullscreen(); // Clean up first
        setTimeout(() => {
          // Recalculate viewport dimensions for new page
          activateFullscreen();
        }, 500);
      }, 1000);
    }
  }
}, 500);

console.log('Fullscreen script started');