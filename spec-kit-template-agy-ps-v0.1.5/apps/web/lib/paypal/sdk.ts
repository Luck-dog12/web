type LoadPaypalScriptOptions = {
  clientId: string;
  currency: 'USD' | 'EUR';
  intent?: 'capture' | 'authorize';
  components?: string;
};

const PAYPAL_SDK_SELECTOR = 'script[data-paypal-sdk]';

let pendingLoad: Promise<void> | null = null;
let pendingKey: string | null = null;

function resetPaypalSdk() {
  document.querySelectorAll(PAYPAL_SDK_SELECTOR).forEach((node) => node.remove());
  delete window.paypal;
  pendingLoad = null;
  pendingKey = null;
}

function buildPaypalSdkUrl(options: LoadPaypalScriptOptions) {
  const url = new URL('https://www.paypal.com/sdk/js');
  url.searchParams.set('client-id', options.clientId);
  url.searchParams.set('currency', options.currency);
  url.searchParams.set('intent', options.intent ?? 'capture');
  url.searchParams.set('components', options.components ?? 'buttons');
  return url.toString();
}

function waitForScript(script: HTMLScriptElement, key: string) {
  pendingKey = key;
  pendingLoad = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
      pendingLoad = null;
      pendingKey = null;
    };

    const handleLoad = () => {
      cleanup();
      script.dataset.paypalSdkState = window.paypal ? 'loaded' : 'error';
      if (window.paypal) {
        resolve();
        return;
      }
      resetPaypalSdk();
      reject(new Error('PayPal SDK \u521d\u59cb\u5316\u5931\u8d25'));
    };

    const handleError = () => {
      cleanup();
      script.dataset.paypalSdkState = 'error';
      resetPaypalSdk();
      reject(new Error('PayPal SDK \u52a0\u8f7d\u5931\u8d25'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });
  return pendingLoad;
}

export function loadPaypalScript(options: LoadPaypalScriptOptions) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PayPal SDK can only be loaded in the browser'));
  }

  const key = buildPaypalSdkUrl(options);
  const existing = document.querySelector<HTMLScriptElement>(PAYPAL_SDK_SELECTOR);

  if (existing) {
    const existingKey = existing.dataset.paypalSdkKey;
    const existingState = existing.dataset.paypalSdkState;

    if (existingKey !== key || existingState === 'error') {
      resetPaypalSdk();
    } else if (existingState === 'loaded' && window.paypal) {
      return Promise.resolve();
    } else if (pendingLoad && pendingKey === key) {
      return pendingLoad;
    } else {
      return waitForScript(existing, key);
    }
  }

  if (pendingLoad && pendingKey === key) {
    return pendingLoad;
  }

  const script = document.createElement('script');
  script.src = key;
  script.async = true;
  script.setAttribute('data-paypal-sdk', 'true');
  script.dataset.paypalSdkKey = key;
  script.dataset.paypalSdkState = 'loading';
  const loadPromise = waitForScript(script, key);
  document.body.appendChild(script);
  return loadPromise;
}
