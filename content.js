chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCropOverlay') {
    createCropOverlay(request.dataUrl, request.serverUrl);
    sendResponse({ success: true });
    return true;
  }
});

function createCropOverlay(fullScreenshotUrl, serverUrl) {
  const existingOverlay = document.getElementById('pc-crop-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pc-crop-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '99999999';
  overlay.style.cursor = 'crosshair';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';

  const selectionBox = document.createElement('div');
  selectionBox.style.position = 'fixed';
  selectionBox.style.border = '2px dashed #06b6d4';
  selectionBox.style.backgroundColor = 'rgba(6, 182, 212, 0.15)';
  selectionBox.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.5)';
  selectionBox.style.display = 'none';
  overlay.appendChild(selectionBox);

  const banner = document.createElement('div');
  banner.innerText = 'Drag mouse to select area | Press ESC to cancel';
  banner.style.position = 'fixed';
  banner.style.top = '20px';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.backgroundColor = '#050509';
  banner.style.color = '#e2e8f0';
  banner.style.padding = '8px 16px';
  banner.style.borderRadius = '20px';
  banner.style.fontFamily = 'sans-serif';
  banner.style.fontSize = '12px';
  banner.style.border = '1px solid #8b5cf6';
  banner.style.zIndex = '100000000';
  overlay.appendChild(banner);

  document.body.appendChild(overlay);

  let startX = 0, startY = 0, endX = 0, endY = 0;
  let isDragging = false;

  overlay.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    endX = e.clientX;
    endY = e.clientY;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  });

  overlay.addEventListener('mouseup', async () => {
    if (!isDragging) return;
    isDragging = false;

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Remove crop selection overlay immediately on release
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }

    if (width < 10 || height < 10) return;

    const rect = {
      left: Math.min(startX, endX),
      top: Math.min(startY, endY),
      width: width,
      height: height
    };

    const loaderModal = showLoaderModal();

    try {
      const croppedBase64 = await cropImage(fullScreenshotUrl, rect);

      chrome.runtime.sendMessage({
        action: 'sendCropToBackend',
        serverUrl: serverUrl,
        base64Image: croppedBase64
      }, (response) => {
        loaderModal.remove();

        if (!response || !response.success) {
          alert("Vision Error: " + (response?.error || 'No response from server.'));
          return;
        }

        chrome.storage.local.set({ lastImagePrompt: response.prompt });
        showResultModal(response.prompt);
      });

    } catch (err) {
      loaderModal.remove();
      alert('Cropping error: ' + err.message);
    }
  });

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', handleKeyDown);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
}

function cropImage(imageSrc, rect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scaleX = img.width / window.innerWidth;
      const scaleY = img.height / window.innerHeight;

      canvas.width = rect.width * scaleX;
      canvas.height = rect.height * scaleY;

      ctx.drawImage(
        img,
        rect.left * scaleX,
        rect.top * scaleY,
        rect.width * scaleX,
        rect.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Changed from PNG to JPEG with 0.7 compression quality for fast network transport
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('Failed to render cropped canvas.'));
    img.src = imageSrc;
  });
}

function showLoaderModal() {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '20px';
  modal.style.right = '20px';
  modal.style.backgroundColor = '#050509';
  modal.style.border = '1px solid #06b6d4';
  modal.style.borderRadius = '8px';
  modal.style.padding = '12px 18px';
  modal.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.4)';
  modal.style.zIndex = '100000000';
  modal.style.color = '#e2e8f0';
  modal.style.fontFamily = 'sans-serif';
  modal.style.fontSize = '13px';
  modal.innerText = '⚡ Crafting prompt with AI...';
  document.body.appendChild(modal);
  return modal;
}

function showResultModal(promptText) {
  const modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.top = '20px';
  modal.style.right = '20px';
  modal.style.width = '340px';
  modal.style.backgroundColor = '#050509';
  modal.style.border = '1px solid #8b5cf6';
  modal.style.borderRadius = '12px';
  modal.style.padding = '16px';
  modal.style.boxShadow = '0 0 20px rgba(139, 92, 246, 0.5)';
  modal.style.zIndex = '100000000';
  modal.style.color = '#e2e8f0';
  modal.style.fontFamily = 'sans-serif';

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <strong style="color: #06b6d4; font-size: 14px; letter-spacing: 1px;">CUEIST AI</strong>
      <button id="pc-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
    </div>
    <div style="font-size: 12px; background: rgba(20,20,35,0.9); border: 1px solid rgba(139,92,246,0.4); border-radius: 6px; padding: 10px; max-height: 160px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;">${promptText}</div>
    <button id="pc-copy-btn" style="width:100%; margin-top:10px; padding:10px; background: linear-gradient(90deg, #8b5cf6, #6d28d9); color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; text-transform:uppercase;">📋 Copy Prompt</button>
  `;

  document.body.appendChild(modal);

  document.getElementById('pc-close-btn').onclick = () => modal.remove();
  document.getElementById('pc-copy-btn').onclick = (e) => {
    navigator.clipboard.writeText(promptText);
    e.target.innerText = '✅ Copied!';
    setTimeout(() => { e.target.innerText = '📋 Copy Prompt'; }, 1500);
  };
}