(() => {
  'use strict';
  
  if (!window.location.href.startsWith('https://www.lookmovie2.to/shows/play/')) return;

  const state = {
    currentUrl: window.location.href,
    isF11Active: false,
    waitingForF11Toggle: false,
    originalParent: null,
    originalNextSibling: null,
    lastButtonCount: 0,
    lastVideoElement: null,
    lastF11Check: null,
    cachedElements: new Map(),
    throttledFunctions: new Map(),
    observers: new Set(),
    isInitialized: false,
    frameId: null,
    videoReadyCache: { result: false, timestamp: 0 }
  };

  const CONFIG = Object.freeze({
    TOAST_DURATION: 3000,
    FADE_OUT_DURATION: 500,
    URL_CHANGE_DELAY: 1000,
    THROTTLE_DELAY: 100,
    F11_TOLERANCE: 2,
    OBSERVER_DEBOUNCE: 250,
    MAX_CACHE_SIZE: 20
  });

  const TOAST_MESSAGES = Object.freeze({
    exit: 'To exit fullscreen, press F11 again.',
    enter: 'For fullscreen, please press F11 on your keyboard.'
  });

  const SELECTORS = Object.freeze({
    video: '.vjs-tech',
    videoFallback: 'video',
    player: '.video-js',
    playerFallback: '[class*="player"]',
    fullscreenButtons: '[class*="fullscreen"], [title*="Fullscreen"]',
    toast: 'custom-toast',
    overlay: 'fullscreen-overlay'
  });

  const TOAST_STYLES = Object.freeze({
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(255, 69, 0, 0.9)',
    color: '#fff',
    padding: '15px 30px',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    zIndex: '1000000',
    fontFamily: 'Arial, sans-serif',
    fontSize: '18px',
    fontWeight: '700',
    opacity: '1',
    userSelect: 'none'
  });

  const FULLSCREEN_STYLES = Object.freeze({
    overlay: {
      position: 'fixed',
      top: '0',
      left: '0',
      background: 'black',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0',
      padding: '0',
      border: 'none',
      overflow: 'hidden'
    },
    player: {
      margin: '0',
      padding: '0',
      border: 'none',
      position: 'relative',
      top: '0',
      left: '0'
    },
    document: {
      overflow: 'hidden'
    }
  });

  const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  const throttle = (fn, delay, key) => {
    const cached = state.throttledFunctions.get(key);
    const now = performance.now();
    
    if (cached && now - cached.lastCall < delay) return cached.result;
    
    const result = fn();
    state.throttledFunctions.set(key, { lastCall: now, result });
    
    if (state.throttledFunctions.size > CONFIG.MAX_CACHE_SIZE) {
      const firstKey = state.throttledFunctions.keys().next().value;
      state.throttledFunctions.delete(firstKey);
    }
    
    return result;
  };

  const getCachedElement = (selector, useCache = true) => {
    if (!useCache) return document.querySelector(selector);
    
    const cached = state.cachedElements.get(selector);
    if (cached?.element && document.contains(cached.element)) {
      cached.lastAccess = performance.now();
      return cached.element;
    }
    
    const element = document.querySelector(selector);
    if (element) {
      state.cachedElements.set(selector, {
        element,
        lastAccess: performance.now()
      });
      
      if (state.cachedElements.size > CONFIG.MAX_CACHE_SIZE) {
        const oldestEntry = [...state.cachedElements.entries()]
          .sort(([,a], [,b]) => a.lastAccess - b.lastAccess)[0];
        state.cachedElements.delete(oldestEntry[0]);
      }
    }
    return element;
  };

  const clearElementCache = (selector = null) => {
    selector ? state.cachedElements.delete(selector) : state.cachedElements.clear();
  };

  const showToast = (message) => {
    if (document.getElementById(SELECTORS.toast)) return;

    const fragment = document.createDocumentFragment();
    const toast = document.createElement('div');
    toast.id = SELECTORS.toast;
    toast.textContent = message;

    Object.assign(toast.style, TOAST_STYLES);
    fragment.appendChild(toast);
    document.body.appendChild(fragment);

    const hideToast = () => {
      toast.style.transition = 'opacity 0.5s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), CONFIG.FADE_OUT_DURATION);
    };

    setTimeout(hideToast, CONFIG.TOAST_DURATION);
  };

  const handleFullscreenRequest = (e) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    showToast(state.isF11Active ? TOAST_MESSAGES.exit : TOAST_MESSAGES.enter);
  };

  const setupPlayerFullscreenButtonListener = () => {
    return throttle(() => {
      const buttons = document.querySelectorAll(SELECTORS.fullscreenButtons);
      
      if (buttons.length === state.lastButtonCount) return;
      state.lastButtonCount = buttons.length;

      for (const button of buttons) {
        if (!button.dataset.listenerAdded) {
          button.addEventListener('click', handleFullscreenRequest, { 
            capture: true, 
            passive: false 
          });
          button.dataset.listenerAdded = 'true';
        }
      }
    }, CONFIG.THROTTLE_DELAY, 'setupButtons');
  };

  const setupPlayerDoubleClickListener = () => {
    return throttle(() => {
      const videoElement = getCachedElement(SELECTORS.video);
      
      if (videoElement === state.lastVideoElement) return;
      state.lastVideoElement = videoElement;

      if (videoElement?.dataset.doubleClickListenerAdded !== 'true') {
        videoElement?.addEventListener('dblclick', handleFullscreenRequest, { 
          capture: true, 
          passive: false 
        });
        if (videoElement) videoElement.dataset.doubleClickListenerAdded = 'true';
      }
    }, CONFIG.THROTTLE_DELAY, 'setupDoubleClick');
  };

  const detectUrlChange = () => {
    const newUrl = window.location.href;
    if (newUrl !== state.currentUrl) {
      state.currentUrl = newUrl;
      clearElementCache();
      state.lastButtonCount = 0;
      state.lastVideoElement = null;
      
      if (state.isF11Active) {
        deactivateFullscreen();
        
        const attemptReactivation = (attempts = 0) => {
          if (attempts > 20) return;
          
          const player = getCachedElement(SELECTORS.player) || getCachedElement(SELECTORS.playerFallback);
          if (player && isVideoReady()) {
            activateFullscreen();
          } else {
            setTimeout(() => attemptReactivation(attempts + 1), 500);
          }
        };
        
        setTimeout(attemptReactivation, CONFIG.URL_CHANGE_DELAY);
      }
    }
  };

  const checkF11 = () => {
    const { innerWidth, innerHeight } = window;
    const { width: screenWidth, height: screenHeight } = screen;
    
    const widthMatch = Math.abs(innerWidth - screenWidth) <= CONFIG.F11_TOLERANCE;
    const heightMatch = Math.abs(innerHeight - screenHeight) <= CONFIG.F11_TOLERANCE;
    const nowF11 = widthMatch && heightMatch;
    
    if (state.lastF11Check === nowF11 && !state.waitingForF11Toggle) return;
    state.lastF11Check = nowF11;
    
    if (nowF11 !== state.isF11Active || state.waitingForF11Toggle) {
      state.isF11Active = nowF11;
      state.waitingForF11Toggle = false;
      nowF11 ? activateFullscreen() : deactivateFullscreen();
    }
  };

  const isVideoReady = () => {
    const now = performance.now();
    if (now - state.videoReadyCache.timestamp < 100) {
      return state.videoReadyCache.result;
    }
    
    const videoElement = getCachedElement(SELECTORS.video) || getCachedElement(SELECTORS.videoFallback);
    if (!videoElement) {
      state.videoReadyCache = { result: false, timestamp: now };
      return false;
    }
    
    const result = videoElement.readyState >= 3 && 
                   videoElement.currentTime > 0 && 
                   !videoElement.paused && 
                   videoElement.duration > 0 &&
                   !videoElement.seeking;
    
    state.videoReadyCache = { result, timestamp: now };
    return result;
  };

  const setElementStyles = (element, styles) => {
    if (!element?.style) return;
    Object.assign(element.style, styles);
  };

  const activateFullscreen = () => {
    try {
      if (document.getElementById(SELECTORS.overlay)) return;

      const player = getCachedElement(SELECTORS.player) || getCachedElement(SELECTORS.playerFallback);
      if (!player || !isVideoReady()) return;

      state.originalParent = player.parentNode;
      state.originalNextSibling = player.nextSibling;

      const { body, documentElement } = document;
      setElementStyles(documentElement, FULLSCREEN_STYLES.document);
      setElementStyles(body, FULLSCREEN_STYLES.document);

      const overlay = document.createElement('div');
      overlay.id = SELECTORS.overlay;

      const { innerWidth: width, innerHeight: height } = window;
      const dimensions = { width: `${width}px`, height: `${height}px` };

      setElementStyles(overlay, {
        ...FULLSCREEN_STYLES.overlay,
        ...dimensions
      });

      setElementStyles(player, {
        ...FULLSCREEN_STYLES.player,
        ...dimensions,
        maxWidth: dimensions.width,
        maxHeight: dimensions.height
      });

      overlay.appendChild(player);
      body.appendChild(overlay);
    } catch (error) {
      console.warn('Fullscreen activation failed:', error);
    }
  };

  const deactivateFullscreen = () => {
    try {
      const overlay = document.getElementById(SELECTORS.overlay);
      if (!overlay) return;

      const player = overlay.querySelector(SELECTORS.player) || overlay.querySelector(SELECTORS.playerFallback);
      if (player && state.originalParent) {
        player.removeAttribute('style');
        const { originalParent, originalNextSibling } = state;
        
        if (originalNextSibling?.parentNode === originalParent) {
          originalParent.insertBefore(player, originalNextSibling);
        } else {
          originalParent.appendChild(player);
        }
      }

      overlay.remove();

      const { body, documentElement } = document;
      setElementStyles(documentElement, { overflow: '' });
      setElementStyles(body, { overflow: '' });

      state.originalParent = null;
      state.originalNextSibling = null;
    } catch (error) {
      console.warn('Fullscreen deactivation failed:', error);
    }
  };

  const mainLoop = () => {
    try {
      detectUrlChange();
      checkF11();
      setupPlayerFullscreenButtonListener();
      setupPlayerDoubleClickListener();
    } catch (error) {
      console.warn('Main loop error:', error);
    }
    state.frameId = requestAnimationFrame(mainLoop);
  };

  const handleKeydown = (e) => {
    if (e.key === 'Escape' && state.isF11Active) {
      e.preventDefault();
      showToast(TOAST_MESSAGES.exit);
      deactivateFullscreen();
      state.isF11Active = false;
      state.waitingForF11Toggle = true;
    }
  };

  const handleResize = debounce(() => {
    if (state.isF11Active) {
      activateFullscreen();
    }
  }, CONFIG.OBSERVER_DEBOUNCE);

  const cleanup = () => {
    if (state.frameId) {
      cancelAnimationFrame(state.frameId);
      state.frameId = null;
    }
    
    state.observers.forEach(observer => observer.disconnect());
    state.observers.clear();
    state.cachedElements.clear();
    state.throttledFunctions.clear();
  };

  const setupUrlObserver = () => {
    window.addEventListener('popstate', detectUrlChange, { passive: true });
    
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      detectUrlChange();
    };
  };

  const init = () => {
    if (state.isInitialized) return;
    
    document.addEventListener('keydown', handleKeydown, { passive: false });
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('beforeunload', cleanup, { once: true, passive: true });
    
    setupUrlObserver();

    state.isInitialized = true;
    state.frameId = requestAnimationFrame(mainLoop);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

