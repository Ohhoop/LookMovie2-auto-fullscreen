(() => {
  'use strict';

  const URL_NEEDLE = '/api/v';
  const SEARCH = /Timeout":\d+/g;
  const REPLACE = 'Timeout":0';
  const URL_KEY = '__lmAutoFsUrl';

  const XHR = window.XMLHttpRequest;
  if (!XHR || !XHR.prototype) return;

  const proto = XHR.prototype;
  const nativeOpen = proto.open;
  const descText = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const descResp = Object.getOwnPropertyDescriptor(proto, 'response');

  if (typeof nativeOpen !== 'function' || !descText || !descText.get) return;

  const shouldPatch = (xhr) => {
    const url = xhr[URL_KEY];
    return typeof url === 'string' && url.includes(URL_NEEDLE);
  };

  proto.open = function (method, url, ...rest) {
    try {
      this[URL_KEY] = typeof url === 'string' ? url : String(url);
    } catch (e) {
      this[URL_KEY] = '';
    }
    return nativeOpen.call(this, method, url, ...rest);
  };

  Object.defineProperty(proto, 'responseText', {
    configurable: true,
    enumerable: descText.enumerable,
    get() {
      const raw = descText.get.call(this);
      try {
        if (typeof raw === 'string' && shouldPatch(this)) {
          return raw.replace(SEARCH, REPLACE);
        }
      } catch (e) {}
      return raw;
    }
  });

  if (descResp && descResp.get) {
    Object.defineProperty(proto, 'response', {
      configurable: true,
      enumerable: descResp.enumerable,
      get() {
        const raw = descResp.get.call(this);
        try {
          if (typeof raw === 'string' && shouldPatch(this)) {
            return raw.replace(SEARCH, REPLACE);
          }
        } catch (e) {}
        return raw;
      }
    });
  }
  const nativeWindowOpen = window.open;
  if (typeof nativeWindowOpen === 'function') {
    const noop = () => {};
    const makeStub = () => ({
      closed: true,
      opener: null,
      focus: noop,
      blur: noop,
      close: noop,
      postMessage: noop,
      location: { href: '', assign: noop, replace: noop, reload: noop },
      document: { write: noop, writeln: noop, close: noop, open: noop }
    });

    const isSameSite = (url) => {
      if (!url) return false;
      try {
        return new URL(String(url), location.href).host === location.host;
      } catch (e) {
        return false;
      }
    };

    const guardedOpen = function (url, ...rest) {
      if (isSameSite(url)) {
        return nativeWindowOpen.call(window, url, ...rest);
      }
      return makeStub();
    };

    try {
      Object.defineProperty(window, 'open', {
        configurable: true,
        writable: true,
        value: guardedOpen
      });
    } catch (e) {
      window.open = guardedOpen;
    }
  }
})();
