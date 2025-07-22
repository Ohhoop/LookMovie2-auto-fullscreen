let currentUrl = window.location.href;
let isF11Active = false;
let userPressedEsc = false;
let originalParent = null;
let originalNextSibling = null;

let playerFullscreenClicked = false; // Flag to block fake fullscreen after player fullscreen click

function setupPlayerFullscreenButtonListener() {
  document.querySelectorAll('[class*="fullscreen"], [title*="Fullscreen"]').forEach(button => {
    if (!button.dataset.listenerAdded) {
      button.addEventListener('click', (e) => {
        e.stopImmediatePropagation(); // Stop native fullscreen logic
        e.preventDefault();           // Prevent default click behavior
        alert('For fullscreen, please press F11 on your keyboard.');
      }, true); // Use capture to intercept before player handles it

      button.dataset.listenerAdded = 'true';
    }
  });
}

function detectUrlChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log('URL changed from:', currentUrl);
    console.log('URL changed to:', newUrl);
    currentUrl = newUrl;

    if (isF11Active) {
      console.log('F11 is active, resetting fullscreen for new page');
      deactivateFullscreen();
      setTimeout(activateFullscreen, 1000);
    }
  }
}

function checkF11() {
  const nowF11 = (window.innerWidth === screen.width && window.innerHeight === screen.height);

  if (userPressedEsc && nowF11) return;
  if (!nowF11) userPressedEsc = false;

  if (playerFullscreenClicked) return;

  if (nowF11 && !isF11Active) {
    isF11Active = true;
    console.log('F11 pressed - activating fullscreen');
    activateFullscreen();
  } else if (!nowF11 && isF11Active) {
    isF11Active = false;
    console.log('F11 released - deactivating fullscreen');
    deactivateFullscreen();
  }
}

function activateFullscreen() {
  if (document.getElementById('fullscreen-overlay')) return;

  const player = document.querySelector('.video-js') || document.querySelector('[class*="player"]');
  if (!player) return;

  originalParent = player.parentNode;
  originalNextSibling = player.nextSibling;

  const overlay = document.createElement('div');
  overlay.id = 'fullscreen-overlay';

  const { innerWidth: width, innerHeight: height } = window;

  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: `${width}px`,
    height: `${height}px`,
    background: 'black',
    zIndex: '999999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0',
    padding: '0',
    border: 'none',
    overflow: 'hidden'
  });

  Object.assign(player.style, {
    width: `${width}px`,
    height: `${height}px`,
    maxWidth: `${width}px`,
    maxHeight: `${height}px`,
    margin: '0',
    padding: '0',
    border: 'none',
    position: 'relative',
    top: '0',
    left: '0'
  });

  overlay.appendChild(player);
  document.body.appendChild(overlay);

  console.log(`Fullscreen activated with dimensions: ${width}x${height}`);
}

function deactivateFullscreen() {
  const overlay = document.getElementById('fullscreen-overlay');
  if (!overlay) return;

  const player = overlay.querySelector('.video-js') || overlay.querySelector('[class*="player"]');
  if (player && originalParent) {
    player.removeAttribute('style');
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(player, originalNextSibling);
    } else {
      originalParent.appendChild(player);
    }
  }

  overlay.remove();
  originalParent = null;
  originalNextSibling = null;
}

function mainLoop() {
  detectUrlChange();
  checkF11();
  setupPlayerFullscreenButtonListener();
  requestAnimationFrame(mainLoop);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isF11Active) {
    console.log('ESC pressed - exiting fake fullscreen');
    isF11Active = false;
    userPressedEsc = true;
    deactivateFullscreen();
  }
});

// Optional: Adjust overlay size on window resize
window.addEventListener('resize', () => {
  if (isF11Active) {
    activateFullscreen(); // Reapply fullscreen sizing
  }
});

requestAnimationFrame(mainLoop);
