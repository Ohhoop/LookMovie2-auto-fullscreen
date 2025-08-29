if (window.location.href.startsWith('https://www.lookmovie2.to/shows/play/')) {
  let currentUrl = window.location.href;
  let isF11Active = false;
  let waitingForF11Toggle = false;
  let originalParent = null;
  let originalNextSibling = null;

  function showToast(message) {
    if (document.getElementById('custom-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'custom-toast';
    toast.textContent = message;

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 69, 0, 0.9)',
      color: '#fff',
      padding: '15px 30px',
      borderRadius: '12px',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      zIndex: 1000000,
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      opacity: '1',
      userSelect: 'none',
    });

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.5s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  function setupPlayerFullscreenButtonListener() {
    const buttons = document.querySelectorAll('[class*="fullscreen"], [title*="Fullscreen"]');
    buttons.forEach(button => {
      if (!button.dataset.listenerAdded) {
        button.addEventListener('click', (e) => {
          e.stopImmediatePropagation();
          e.preventDefault();
          showToast(isF11Active 
            ? 'To exit fullscreen, press F11 again.' 
            : 'For fullscreen, please press F11 on your keyboard.'
          );
        }, true);
        button.dataset.listenerAdded = 'true';
      }
    });
  }

  function setupPlayerDoubleClickListener() {
    const videoElement = document.querySelector('.vjs-tech');
    if (videoElement && !videoElement.dataset.doubleClickListenerAdded) {
      videoElement.addEventListener('dblclick', (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        showToast(isF11Active 
          ? 'To exit fullscreen, press F11 again.' 
          : 'For fullscreen, please press F11 on your keyboard.'
        );
      }, true);
      videoElement.dataset.doubleClickListenerAdded = 'true';
    }
  }

  function detectUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      if (isF11Active) {
        deactivateFullscreen();
        setTimeout(activateFullscreen, 1000);
      }
    }
  }

  function checkF11() {
    const widthMatch = Math.abs(window.innerWidth - screen.width) <= 2;
    const heightMatch = Math.abs(window.innerHeight - screen.height) <= 2;
    const nowF11 = widthMatch && heightMatch;
    
    if (nowF11 !== isF11Active || waitingForF11Toggle) {
      if (nowF11) {
        isF11Active = true;
        waitingForF11Toggle = false;
        activateFullscreen();
      } else {
        isF11Active = false;
        deactivateFullscreen();
      }
    }
  }

  function activateFullscreen() {
    if (document.getElementById('fullscreen-overlay')) return;

    const player = document.querySelector('.video-js') || document.querySelector('[class*="player"]');
    if (!player) return;

    originalParent = player.parentNode;
    originalNextSibling = player.nextSibling;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'fullscreen-overlay';

    const width = window.innerWidth;
    const height = window.innerHeight;

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

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    originalParent = null;
    originalNextSibling = null;
  }

  function mainLoop() {
    detectUrlChange();
    checkF11();
    setupPlayerFullscreenButtonListener();
    setupPlayerDoubleClickListener();
    requestAnimationFrame(mainLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isF11Active) {
      e.preventDefault();
      showToast('To exit fullscreen, press F11 again.');
      deactivateFullscreen();
      isF11Active = false;
      waitingForF11Toggle = true;
    }
  });

  window.addEventListener('resize', () => {
    if (isF11Active) {
      activateFullscreen();
    }
  });


  requestAnimationFrame(mainLoop);
}

