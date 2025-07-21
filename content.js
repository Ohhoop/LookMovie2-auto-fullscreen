let isF11Active = false;
let userWantsFullscreen = false;

// Detect F11 by checking if window fills entire screen
function checkF11() {
  const nowF11 = (window.innerWidth === screen.width && window.innerHeight === screen.height);
  
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
  
  // Create black overlay
  const overlay = document.createElement('div');
  overlay.id = 'fullscreen-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:black; z-index:999999; display:flex; align-items:center; justify-content:center;';
  
  // Move entire player to overlay
  overlay.appendChild(player);
  document.body.appendChild(overlay);
  
  // Make player fill overlay
  player.style.cssText = 'width:100% !important; height:100% !important;';
}

function deactivateFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  if (!overlay) return;
  
  const player = overlay.querySelector('.video-js') || overlay.querySelector('[class*="player"]');
  if (player) {
    // Reset player styles
    player.style.cssText = '';
    // Move player back to where video players usually go
    const container = document.querySelector('[class*="video"]') || document.querySelector('main') || document.body;
    container.appendChild(player);
  }
  
  overlay.remove();
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
        setTimeout(activateFullscreen, 500); // Then reactivate
      }, 1000);
    }
  }
}, 500);

console.log('Fullscreen script started');