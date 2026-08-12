// REPLACE THIS WITH YOUR EXACT RENDER URL (no trailing slash)
const SERVER_URL = 'https://prompt-craft-backend.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
  // Silent ping to wake up Render Free Tier immediately
  fetch(SERVER_URL).catch(() => {});

  // === UI & Navigation Elements ===
  const mainMenu = document.getElementById('mainMenu');
  const textPromptInterface = document.getElementById('textPromptInterface');
  const imagePromptInterface = document.getElementById('imagePromptInterface');
  const backBtn = document.getElementById('backBtn');
  const textPromptCard = document.getElementById('textPromptCard');
  const imagePromptCard = document.getElementById('imagePromptCard');

  // === Functional Elements (Text) ===
  const taskInput = document.getElementById('textPromptInput');
  const generateTextBtn = document.getElementById('generateTextBtn');
  const textOutputBox = document.querySelector('#textPromptInterface .output-box');
  const textOutputText = document.getElementById('textPromptOutputText');
  const copyTextBtn = document.getElementById('copyTextBtn');

  // === Functional Elements (Image) ===
  const scanImageBtn = document.getElementById('scanImageBtn');
  const imageOutputBox = document.querySelector('#imagePromptInterface .output-box');
  const imageOutputText = document.getElementById('imagePromptOutputText');
  const copyImageBtn = document.getElementById('copyImageBtn');

  // Restore saved last image prompt if user re-opens extension
  chrome.storage.local.get(['lastImagePrompt'], (result) => {
    if (result.lastImagePrompt) {
      setOutput(imageOutputText, imageOutputBox, copyImageBtn, result.lastImagePrompt);
    }
  });

  // === Navigation Logic ===
  textPromptCard.addEventListener('click', () => showInterface(textPromptInterface));
  imagePromptCard.addEventListener('click', () => showInterface(imagePromptInterface));
  backBtn.addEventListener('click', () => showInterface(mainMenu));

  function showInterface(targetInterface) {
    mainMenu.classList.remove('active');
    textPromptInterface.classList.remove('active');
    imagePromptInterface.classList.remove('active');
    targetInterface.classList.add('active');
    backBtn.style.display = targetInterface === mainMenu ? 'none' : 'block';
  }

  // === Output Helper ===
  function setOutput(outputElement, outputBoxElement, copyBtnElement, text, isError = false) {
    outputElement.textContent = text;
    outputBoxElement.classList.remove('empty');
    if (isError) {
      outputElement.style.color = '#ef4444';
      copyBtnElement.classList.remove('active');
    } else {
      outputElement.style.color = 'var(--text-main)';
      copyBtnElement.classList.add('active');
    }
  }

  // === Clipboard Logic ===
  function copyToClipboard(textElement, buttonElement) {
    const textToCopy = textElement.innerText;

    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalIcon = '&#128203;';
      const successIcon = '&#9989;';
      
      buttonElement.innerHTML = successIcon;
      setTimeout(() => {
        buttonElement.innerHTML = originalIcon;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  copyTextBtn.addEventListener('click', () => copyToClipboard(textOutputText, copyTextBtn));
  copyImageBtn.addEventListener('click', () => copyToClipboard(imageOutputText, copyImageBtn));

  // === 1. Text Prompt Generation ===
  generateTextBtn.addEventListener('click', async () => {
    const task = taskInput.value.trim();
    if (!task) return alert('Please describe your task.');

    generateTextBtn.textContent = "Crafting...";
    generateTextBtn.disabled = true;
    setOutput(textOutputText, textOutputBox, copyTextBtn, "Crafting The Perfect Prompt For You...");

    try {
      const response = await fetch(`${SERVER_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskDescription: task })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      setOutput(textOutputText, textOutputBox, copyTextBtn, data.prompt);
    } catch (err) {
      setOutput(textOutputText, textOutputBox, copyTextBtn, "Error: " + err.message, true);
    } finally {
      generateTextBtn.textContent = "Generate Perfect Prompt";
      generateTextBtn.disabled = false;
    }
  });

  // === 2. Image Prompt Extraction ===
  scanImageBtn.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'captureTab' }, async (captureResponse) => {
      if (!captureResponse || !captureResponse.success) {
        alert("Capture failed: " + (captureResponse?.error || 'Check activeTab permissions.'));
        return;
      }

      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab || activeTab.url.startsWith("chrome://") || activeTab.url.startsWith("edge://")) {
          return alert("Cropping cannot run on internal browser pages. Please open a regular website.");
        }

        // Inject content.js
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        });

        // Trigger Overlay & Pass Server URL
        chrome.tabs.sendMessage(activeTab.id, { 
          action: 'startCropOverlay', 
          dataUrl: captureResponse.dataUrl,
          serverUrl: SERVER_URL
        });

        // Close popup smoothly so user can select area on page
        window.close();

      } catch (err) {
        alert(err.message);
      }
    });
  });
});