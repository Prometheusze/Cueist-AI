chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 70 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true;
  }

  if (request.action === 'sendCropToBackend') {
    // Controller to enforce a 60-second maximum timeout for cold starts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    fetch(`${request.serverUrl}/api/scan-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: request.base64Image }),
      signal: controller.signal
    })
    .then(async (res) => {
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }
      sendResponse({ success: true, prompt: data.prompt });
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      const errorMsg = err.name === 'AbortError' ? 'Backend timed out. Please try again.' : err.message;
      sendResponse({ success: false, error: errorMsg });
    });

    return true;
  }
});