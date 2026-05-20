(() => {
  'use strict';

  const removeAds = () => {
    const ads = document.querySelectorAll('.ad-container, #floating-ads-internal, .player-pre-init-ads, [data-ads-url], .movie-btn, .chat-link, .loginLink, .rp-component-wrapper');
    ads.forEach(ad => ad.remove());
  };

  const adsObserver = new MutationObserver(removeAds);
  removeAds();
  adsObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  if (!window.location.href.startsWith('https://www.lookmovie2.to/shows/play/')) return;

  const getShowSlug = () => {
    const match = window.location.href.match(/\/shows\/play\/\d+-(.+?)#/);
    return match ? match[1] : null;
  };

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
    videoReadyCache: { result: false, timestamp: 0 },
    autoSkipEnabled: JSON.parse(localStorage.getItem('lookMovie_autoSkip') || 'false'),
    autoSkipButtonAdded: false,
    upnextObserver: null,
    currentToast: null,
    toastTimeout: null,
    f11Transitioning: false,
    f11TransitionTimeout: null,
    subtitleListenerAdded: false,
    subtitleRestored: false,
    subtitleRestoreAttempts: 0,
    reactivationPending: false,
    loadingOverlayActive: false
  };

  const CONFIG = Object.freeze({
    TOAST_DURATION: 3000,
    AUTO_SKIP_TOAST_DURATION: 1000,
    AUTO_SKIP_TOGGLE_TOAST_DURATION: 1500,
    FADE_OUT_DURATION: 500,
    URL_CHANGE_DELAY: 1000,
    THROTTLE_DELAY: 100,
    F11_TOLERANCE: 2,
    OBSERVER_DEBOUNCE: 250,
    MAX_CACHE_SIZE: 20,
    LOADING_RETRY_INTERVAL: 250,
    LOADING_MAX_ATTEMPTS: 240,
    EPISODE_RETRY_INTERVAL: 500,
    EPISODE_MAX_ATTEMPTS: 120
  });

  const TOAST_MESSAGES = Object.freeze({
    exit: 'To exit fullscreen, press F11 again.',
    enter: 'For fullscreen, please press F11 on your keyboard.'
  });

  const SELECTORS = Object.freeze({
    video: '.vjs-tech',
    videoFallback: 'video',
    player: 'div.video-js',
    playerFallback: '[class*="player"]',
    fullscreenButtons: '[class*="fullscreen"], [title*="Fullscreen"]',
    controlBar: '.vjs-control-bar, .vjs-controls, [class*="control-bar"], [class*="controls"], .video-controls',
    upnextContainer: 'svg:has(.vjs-upnext-svg-autoplay-ring), [class*="upnext"], .vjs-upnext',
    upnextSvg: '.vjs-upnext-svg-autoplay-ring, .vjs-upnext-svg-autoplay-circle, .vjs-upnext-svg-autoplay-triangle',
    toast: 'custom-toast',
    overlay: 'fullscreen-overlay',
    autoSkipToggle: 'auto-skip-toggle',
    loadingOverlay: 'fullscreen-loading-overlay',
    loadingSpinner: 'fullscreen-loading-spinner',
    loadingKeyframes: 'fullscreen-loading-keyframes'
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

  const LOADING_OVERLAY_STYLES = Object.freeze({
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    background: 'black',
    zIndex: '999998',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0',
    padding: '0',
    border: 'none',
    overflow: 'hidden'
  });

  const LOADING_SPINNER_STYLES = Object.freeze({
    width: '64px',
    height: '64px',
    border: '6px solid rgba(255, 255, 255, 0.2)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'lm-spin 0.9s linear infinite',
    boxSizing: 'border-box'
  });

  const AUTO_SKIP_BUTTON_STYLES = Object.freeze({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'center',
    width: '36px',
    height: '18px',
    backgroundColor: 'rgba(120, 120, 120, 0.6)',
    border: '2px solid #ffffff !important',
    borderRadius: '9px',
    cursor: 'pointer',
    margin: '0 8px',
    transition: 'all 0.3s ease',
    userSelect: 'none',
    flexShrink: '0',
    outline: 'none'
  });

  const AUTO_SKIP_TOGGLE_KNOB_STYLES = Object.freeze({
    position: 'absolute',
    top: '50%',
    left: '2px',
    width: '12px',
    height: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.8) !important',
    borderRadius: '50%',
    transition: 'transform 0.3s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    transform: 'translateY(-50%)'
  });

  const AUTO_SKIP_ENABLED_STYLES = Object.freeze({
    backgroundColor: 'rgba(255, 255, 255, 0.8) !important',
    borderColor: '#ffffff !important'
  });

  const AUTO_SKIP_KNOB_ENABLED_STYLES = Object.freeze({
    transform: 'translateX(16px) translateY(-50%)',
    backgroundColor: '#ffffff !important',
    border: '1px solid #eee'
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
    if (state.currentToast) {
      clearTimeout(state.toastTimeout);
      state.currentToast.remove();
      state.currentToast = null;
    }

    const toast = document.createElement('div');
    toast.id = SELECTORS.toast;
    toast.textContent = message;

    const isAutoSkipMessage = message.includes('Auto-skipping');
    const toastStyles = isAutoSkipMessage ? {
      ...TOAST_STYLES,
      background: 'rgba(255, 255, 255, 0.9)',
      color: '#333',
      fontSize: '16px',
      fontWeight: '500'
    } : TOAST_STYLES;

    Object.assign(toast.style, toastStyles);
    document.body.appendChild(toast);
    state.currentToast = toast;

    const hideToast = () => {
      if (state.currentToast === toast) {
        toast.style.transition = 'opacity 0.5s ease';
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) toast.remove();
          if (state.currentToast === toast) state.currentToast = null;
        }, CONFIG.FADE_OUT_DURATION);
      }
    };

    const isAutoSkipToggle = message.includes('Auto-Skip Next Episode');
    let duration = CONFIG.TOAST_DURATION;
    
    if (isAutoSkipMessage) {
      duration = CONFIG.AUTO_SKIP_TOAST_DURATION;
    } else if (isAutoSkipToggle) {
      duration = CONFIG.AUTO_SKIP_TOGGLE_TOAST_DURATION;
    }
    
    state.toastTimeout = setTimeout(hideToast, duration);
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

  const createAutoSkipToggle = () => {
    if (state.autoSkipButtonAdded || document.getElementById(SELECTORS.autoSkipToggle)) return;

    const controlBar = getCachedElement('.vjs-control-bar');
    if (!controlBar) return;
    
    const toggleButton = document.createElement('div');
    toggleButton.id = SELECTORS.autoSkipToggle;
    toggleButton.title = 'Auto-Skip Next Episode';
    toggleButton.setAttribute('role', 'switch');
    toggleButton.setAttribute('aria-checked', state.autoSkipEnabled.toString());

    Object.assign(toggleButton.style, AUTO_SKIP_BUTTON_STYLES);
    
    const knob = document.createElement('div');
    Object.assign(knob.style, AUTO_SKIP_TOGGLE_KNOB_STYLES);
    
    if (state.autoSkipEnabled) {
      Object.assign(toggleButton.style, AUTO_SKIP_ENABLED_STYLES);
      toggleButton.style.setProperty('background-color', 'rgba(255, 255, 255, 0.8)', 'important');
      toggleButton.style.setProperty('border-color', '#ffffff', 'important');
      Object.assign(knob.style, AUTO_SKIP_KNOB_ENABLED_STYLES);
    }

    toggleButton.appendChild(knob);

    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      state.autoSkipEnabled = !state.autoSkipEnabled;
      localStorage.setItem('lookMovie_autoSkip', JSON.stringify(state.autoSkipEnabled));
      toggleButton.setAttribute('aria-checked', state.autoSkipEnabled.toString());
      
      if (state.autoSkipEnabled) {
        Object.assign(toggleButton.style, AUTO_SKIP_ENABLED_STYLES);
        toggleButton.style.setProperty('background-color', 'rgba(255, 255, 255, 0.8)', 'important');
        Object.assign(knob.style, AUTO_SKIP_KNOB_ENABLED_STYLES);
        showToast('Auto-Skip Next Episode enabled');
        setupAutoSkipWatcher();
      } else {
        toggleButton.style.backgroundColor = 'rgba(120, 120, 120, 0.6)';
        toggleButton.style.borderColor = '#ffffff';
        knob.style.transform = 'translateX(0px) translateY(-50%)';
        knob.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        knob.style.border = 'none';
        knob.style.setProperty('background-color', 'rgba(255, 255, 255, 0.8)', 'important');
        showToast('Auto-Skip Next Episode disabled');
        if (state.upnextObserver) {
          state.upnextObserver.disconnect();
          state.observers.delete(state.upnextObserver);
          state.upnextObserver = null;
        }
      }
    });

    controlBar.appendChild(toggleButton);
    state.autoSkipButtonAdded = true;
  };

  const findUpnextElement = () => {
    const selectors = [
      'svg .vjs-upnext-svg-autoplay-ring',
      '.vjs-upnext-svg-autoplay-ring',
      '.vjs-upnext-svg-autoplay-circle',
      'svg:has(.vjs-upnext-svg-autoplay-ring)',
      '[class*="upnext"]',
      '.vjs-upnext'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.closest('svg') || element.closest('button') || element.closest('[role="button"]') || element;
      }
    }
    return null;
  };

  const triggerClick = (element) => {
    const clickMethods = [
      () => element.click(),
      () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
      () => element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })),
      () => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    ];
    
    for (const method of clickMethods) {
      try {
        method();
        return true;
      } catch (e) {
        continue;
      }
    }
    return false;
  };

  const UPNEXT_OBSERVER_OPTIONS = Object.freeze({
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['stroke-dashoffset', 'style', 'class']
  });

  const withAutoSkipPaused = (fn) => {
    const observer = state.upnextObserver;
    if (observer) observer.disconnect();
    try {
      fn();
    } finally {
      if (observer && state.autoSkipEnabled && state.upnextObserver === observer) {
        observer.observe(document.body, UPNEXT_OBSERVER_OPTIONS);
      }
    }
  };

  const setupAutoSkipWatcher = () => {
    if (!state.autoSkipEnabled || state.upnextObserver) return;

    const observer = new MutationObserver(debounce((mutations) => {
      if (!state.autoSkipEnabled) return;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const containsUpnext = node.querySelector?.('.vjs-upnext-svg-autoplay-ring') || 
                                   node.matches?.('.vjs-upnext-svg-autoplay-ring') ||
                                   node.querySelector?.('svg .vjs-upnext-svg-autoplay-ring');
              
              if (containsUpnext) {
                setTimeout(() => handleUpnextDetection(), 100);
              }
            }
          }
        }
        
        if (mutation.type === 'attributes' && mutation.target.classList?.contains('vjs-upnext-svg-autoplay-ring')) {
          if (mutation.attributeName === 'stroke-dashoffset') {
            setTimeout(() => handleUpnextDetection(), 50);
          }
        }
      }
    }, 30));

    observer.observe(document.body, UPNEXT_OBSERVER_OPTIONS);

    state.upnextObserver = observer;
    state.observers.add(observer);
  };

  const handleUpnextDetection = () => {
    if (!state.autoSkipEnabled || state.f11Transitioning) return;
    
    const upnextElement = findUpnextElement();
    if (upnextElement && upnextElement.offsetParent !== null) {
      const success = triggerClick(upnextElement);
      if (success) {
        showToast('Auto-skipping to next episode...');
      } else {
        tryClickParents(upnextElement);
      }
    }
  };

  const tryClickParents = (element) => {
    const parents = [
      element.parentElement,
      element.closest('button'),
      element.closest('[role="button"]'),
      element.closest('.vjs-button'),
      element.closest('[class*="button"]'),
      element.closest('[onclick]'),
      element.closest('div[style*="cursor"]')
    ].filter(Boolean);

    for (const parent of parents) {
      if (triggerClick(parent)) {
        showToast('Auto-skipping to next episode...');
        return true;
      }
    }
    return false;
  };

  const checkAllUpnextSelectors = () => {
    const allSelectors = [
      '.vjs-upnext-svg-autoplay-ring',
      '.vjs-upnext-svg-autoplay-circle', 
      '.vjs-upnext-svg-autoplay-triangle',
      'svg:has(.vjs-upnext-svg-autoplay-ring)',
      '[class*="upnext"]',
      '[class*="next-episode"]',
      '[class*="autoplay"]'
    ];

    for (const selector of allSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach((el) => {
        if (el.offsetParent !== null) {
          triggerClick(el) || tryClickParents(el);
        }
      });
    }
  };

  const detectUrlChange = () => {
    const newUrl = window.location.href;
    if (newUrl !== state.currentUrl) {
      state.currentUrl = newUrl;
      clearElementCache();
      state.lastButtonCount = 0;
      state.lastVideoElement = null;
      state.autoSkipButtonAdded = false;
      state.subtitleListenerAdded = false;
      state.subtitleRestored = false;
      state.subtitleRestoreAttempts = 0;
      
      if (state.upnextObserver) {
        state.upnextObserver.disconnect();
        state.observers.delete(state.upnextObserver);
        state.upnextObserver = null;
      }
      
      if (state.isF11Active) {
        deactivateFullscreen(false);
        createLoadingOverlay();
        scheduleReactivation();
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
      if (state.f11TransitionTimeout) {
        clearTimeout(state.f11TransitionTimeout);
      }
      
      // Si on entre en F11 et qu'un toast "enter" est affiché, le faire disparaître immédiatement
      if (!state.isF11Active && nowF11 && state.currentToast && 
          state.currentToast.textContent === TOAST_MESSAGES.enter) {
        clearTimeout(state.toastTimeout);
        state.currentToast.style.transition = 'opacity 0.2s ease';
        state.currentToast.style.opacity = '0';
        setTimeout(() => {
          if (state.currentToast && state.currentToast.parentNode) {
            state.currentToast.remove();
          }
          state.currentToast = null;
        }, 200);
      }
      
      // Si on sort de F11 et qu'un toast "exit" est affiché, le faire disparaître immédiatement
      if (state.isF11Active && !nowF11 && state.currentToast && 
          state.currentToast.textContent === TOAST_MESSAGES.exit) {
        clearTimeout(state.toastTimeout);
        state.currentToast.style.transition = 'opacity 0.2s ease';
        state.currentToast.style.opacity = '0';
        setTimeout(() => {
          if (state.currentToast && state.currentToast.parentNode) {
            state.currentToast.remove();
          }
          state.currentToast = null;
        }, 200);
      }
      
      state.f11Transitioning = true;
      state.isF11Active = nowF11;
      state.waitingForF11Toggle = false;
      if (nowF11) {
        if (!activateFullscreen()) {
          createLoadingOverlay();
          scheduleManualActivation();
        }
      } else {
        deactivateFullscreen();
      }
      state.f11TransitionTimeout = setTimeout(() => {
        state.f11Transitioning = false;
        state.f11TransitionTimeout = null;
      }, 1000);
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
                   videoElement.duration > 0 &&
                   !videoElement.seeking;
    
    state.videoReadyCache = { result, timestamp: now };
    return result;
  };

  const isEpisodeFullyLoaded = () => {
    const wrapper = document.querySelector('.player__wrapper');
    if (!wrapper || getComputedStyle(wrapper).display === 'none') return false;

    const loader = document.querySelector('.placeholder__wrapper');
    if (loader && loader.classList.contains('show-loader') &&
        getComputedStyle(loader).display !== 'none') return false;

    const vjsRoot = getCachedElement(SELECTORS.player) || getCachedElement(SELECTORS.playerFallback);
    if (!vjsRoot) return false;

    const cl = vjsRoot.classList;
    if (!cl.contains('vjs-has-started')) return false;
    if (cl.contains('vjs-waiting') || cl.contains('vjs-seeking') || cl.contains('vjs-error')) return false;

    const video = vjsRoot.querySelector(SELECTORS.video) ||
                  vjsRoot.querySelector(SELECTORS.videoFallback) ||
                  getCachedElement(SELECTORS.video) ||
                  getCachedElement(SELECTORS.videoFallback);
    if (!video) return false;

    return video.readyState >= 3 &&
           video.currentTime > 0 &&
           video.duration > 0 &&
           !video.seeking &&
           !video.paused;
  };

  const setElementStyles = (element, styles) => {
    if (!element?.style) return;
    Object.assign(element.style, styles);
  };

  const injectLoadingKeyframes = () => {
    if (document.getElementById(SELECTORS.loadingKeyframes)) return;
    const style = document.createElement('style');
    style.id = SELECTORS.loadingKeyframes;
    style.textContent = '@keyframes lm-spin { to { transform: rotate(360deg); } }';
    (document.head || document.documentElement).appendChild(style);
  };

  const createLoadingOverlay = () => {
    if (document.getElementById(SELECTORS.overlay)) return false;
    if (document.getElementById(SELECTORS.loadingOverlay)) return true;

    const { body, documentElement } = document;
    if (!body) return false;

    setElementStyles(documentElement, FULLSCREEN_STYLES.document);
    setElementStyles(body, FULLSCREEN_STYLES.document);

    const overlay = document.createElement('div');
    overlay.id = SELECTORS.loadingOverlay;
    setElementStyles(overlay, LOADING_OVERLAY_STYLES);

    const spinner = document.createElement('div');
    spinner.id = SELECTORS.loadingSpinner;
    setElementStyles(spinner, LOADING_SPINNER_STYLES);

    overlay.appendChild(spinner);
    body.appendChild(overlay);
    state.loadingOverlayActive = true;
    return true;
  };

  const removeLoadingOverlay = () => {
    const overlay = document.getElementById(SELECTORS.loadingOverlay);
    if (overlay) overlay.remove();
    state.loadingOverlayActive = false;
  };

  const activateFullscreen = () => {
    try {
      if (document.getElementById(SELECTORS.overlay)) {
        removeLoadingOverlay();
        return true;
      }

      const liveContainer = document.getElementById('player-container');
      const player = liveContainer?.querySelector(SELECTORS.player) ||
                     liveContainer?.querySelector(SELECTORS.playerFallback) ||
                     getCachedElement(SELECTORS.player) ||
                     getCachedElement(SELECTORS.playerFallback);
      if (!player || !isVideoReady()) return false;

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

      withAutoSkipPaused(() => {
        overlay.appendChild(player);
        body.appendChild(overlay);
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => removeLoadingOverlay());
      });
      return true;
    } catch (error) {
      console.warn('Fullscreen activation failed:', error);
      return false;
    }
  };

  const deactivateFullscreen = (restorePlayer = true) => {
    try {
      removeLoadingOverlay();
      state.reactivationPending = false;

      const overlay = document.getElementById(SELECTORS.overlay);
      if (!overlay) {
        const { body, documentElement } = document;
        setElementStyles(documentElement, { overflow: '' });
        setElementStyles(body, { overflow: '' });
        return;
      }

      const player = overlay.querySelector(SELECTORS.player) || overlay.querySelector(SELECTORS.playerFallback);
      withAutoSkipPaused(() => {
        if (restorePlayer && player && state.originalParent) {
          player.removeAttribute('style');
          const { originalParent, originalNextSibling } = state;

          if (originalNextSibling?.parentNode === originalParent) {
            originalParent.insertBefore(player, originalNextSibling);
          } else {
            originalParent.appendChild(player);
          }
        }

        overlay.remove();
      });

      const { body, documentElement } = document;
      setElementStyles(documentElement, { overflow: '' });
      setElementStyles(body, { overflow: '' });

      state.originalParent = null;
      state.originalNextSibling = null;
    } catch (error) {
      console.warn('Fullscreen deactivation failed:', error);
    }
  };

  const scheduleActivation = ({ predicate, initialDelay, retryInterval, maxAttempts, onGiveUp }) => {
    if (state.reactivationPending) return;
    state.reactivationPending = true;

    const attempt = (attempts = 0) => {
      if (!state.isF11Active) {
        state.reactivationPending = false;
        removeLoadingOverlay();
        return;
      }

      if (attempts > maxAttempts) {
        state.reactivationPending = false;
        if (typeof onGiveUp === 'function') onGiveUp();
        return;
      }

      if (predicate()) {
        const success = activateFullscreen();
        if (success) {
          state.reactivationPending = false;
          return;
        }
      }

      setTimeout(() => attempt(attempts + 1), retryInterval);
    };

    if (initialDelay > 0) {
      setTimeout(() => attempt(0), initialDelay);
    } else {
      attempt(0);
    }
  };

  const scheduleReactivation = () => {
    scheduleActivation({
      predicate: isEpisodeFullyLoaded,
      initialDelay: CONFIG.URL_CHANGE_DELAY,
      retryInterval: CONFIG.EPISODE_RETRY_INTERVAL,
      maxAttempts: CONFIG.EPISODE_MAX_ATTEMPTS,
      onGiveUp: () => removeLoadingOverlay()
    });
  };

  const scheduleManualActivation = () => {
    scheduleActivation({
      predicate: isVideoReady,
      initialDelay: 0,
      retryInterval: CONFIG.LOADING_RETRY_INTERVAL,
      maxAttempts: CONFIG.LOADING_MAX_ATTEMPTS,
      onGiveUp: () => {
        removeLoadingOverlay();
        showToast('Video failed to load in time. Press F11 to exit.');
      }
    });
  };

  const setupSubtitleListener = () => {
    if (state.subtitleListenerAdded) return;

    const subList = document.querySelector('.vjs-subtitles-list');
    if (!subList) return;

    subList.addEventListener('click', (e) => {
      const item = e.target.closest('.vjs-subtitles-language-item');
      if (!item) return;

      const slug = getShowSlug();
      if (!slug) return;

      const text = item.textContent.trim();
      localStorage.setItem('lookMovie_subtitle', JSON.stringify({ slug, subtitle: text }));
    });

    const offBtn = document.querySelector('.vjs-subtitle-off');
    if (offBtn) {
      offBtn.addEventListener('click', () => {
        const slug = getShowSlug();
        if (slug) localStorage.removeItem('lookMovie_subtitle');
      });
    }

    state.subtitleListenerAdded = true;
  };

  const restoreSubtitle = () => {
    if (state.subtitleRestored) return;

    const slug = getShowSlug();
    if (!slug) return;

    const saved = JSON.parse(localStorage.getItem('lookMovie_subtitle') || 'null');
    if (!saved || saved.slug !== slug) return;

    const items = document.querySelectorAll('.vjs-subtitles-language-item');
    if (!items.length) return;

    for (const item of items) {
      if (item.textContent.trim() === saved.subtitle) {
        item.click();
        state.subtitleRestored = true;
        return;
      }
    }

    state.subtitleRestoreAttempts++;
    if (state.subtitleRestoreAttempts > 60) {
      showToast('Cannot find subtitle "' + saved.subtitle + '", please select another source.');
      state.subtitleRestored = true;
    }
  };

  const removePremiumMenuItems = () => {
    const menuItems = document.querySelectorAll('.vjs-menu-item');
    menuItems.forEach(item => {
      const text = item.textContent.trim();
      if (text === 'HD' || text === 'FullHD') item.remove();
    });
  };

  const mainLoop = () => {
    try {
      detectUrlChange();
      checkF11();
      setupPlayerFullscreenButtonListener();
      setupPlayerDoubleClickListener();
      removePremiumMenuItems();
      setupSubtitleListener();
      restoreSubtitle();

      throttle(() => {
        createAutoSkipToggle();
        if (state.autoSkipEnabled && !state.upnextObserver) {
          setupAutoSkipWatcher();
        }
      }, CONFIG.THROTTLE_DELAY, 'setupAutoSkip');
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

    if (state.upnextObserver) {
      state.upnextObserver.disconnect();
      state.upnextObserver = null;
    }

    if (state.currentToast) {
      clearTimeout(state.toastTimeout);
      state.currentToast.remove();
      state.currentToast = null;
    }

    if (state.f11TransitionTimeout) {
      clearTimeout(state.f11TransitionTimeout);
      state.f11TransitionTimeout = null;
    }

    removeLoadingOverlay();
    state.reactivationPending = false;
    document.getElementById(SELECTORS.loadingKeyframes)?.remove();

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

    injectLoadingKeyframes();

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

