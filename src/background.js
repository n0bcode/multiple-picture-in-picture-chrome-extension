// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Multiple Picture-in-Picture Extension - Background Script
// Manages extension lifecycle, context menus, and keyboard shortcuts

// Store active PiP windows per tab
const activePipWindows = new Map();

// Handle extension icon click - now opens popup instead of direct script execution
chrome.action.onClicked.addListener((tab) => {
  // Popup will handle the interaction
  // This is kept for backward compatibility but popup takes precedence
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
  switch (command) {
    case "_execute_action":
      // Alt+P - Execute original single PiP script for quick access
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["script.js"],
      });
      break;

    case "toggle_multiple_pip":
      // Alt+M - Toggle multiple PiP mode
      await toggleMultiplePipMode(tab);
      break;
  }
});

async function toggleMultiplePipMode(tab) {
  try {
    const { multipleMode } = await chrome.storage.local.get({ multipleMode: false });
    const newMode = !multipleMode;

    await chrome.storage.local.set({ multipleMode: newMode });

    // Update badge to show current mode
    updateBadge(newMode);

    // Show notification
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: (mode) => {
        // Create a temporary notification
        const notification = document.createElement("div");
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #4285f4;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: opacity 0.3s ease;
        `;
        notification.textContent = `Multiple PiP Mode: ${mode ? "ON" : "OFF"}`;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      },
      args: [newMode],
    });
  } catch (error) {
    console.error("Error toggling multiple PiP mode:", error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const { autoPip, multipleMode } = await chrome.storage.local.get({
    autoPip: true,
    multipleMode: false,
  });

  // Create context menu items
  chrome.contextMenus.create({
    id: "autoPip",
    contexts: ["action"],
    title: "Automatic picture-in-picture (BETA)",
    type: "checkbox",
    checked: autoPip,
  });

  chrome.contextMenus.create({
    id: "separator1",
    contexts: ["action"],
    type: "separator",
  });

  chrome.contextMenus.create({
    id: "multipleMode",
    contexts: ["action"],
    title: "Multiple PiP Mode",
    type: "checkbox",
    checked: multipleMode,
  });

  chrome.contextMenus.create({
    id: "separator2",
    contexts: ["action"],
    type: "separator",
  });

  chrome.contextMenus.create({
    id: "stopAllPip",
    contexts: ["action"],
    title: "Stop All Picture-in-Picture",
    type: "normal",
  });

  updateContentScripts(autoPip);
  updateBadge(multipleMode);
});

chrome.runtime.onStartup.addListener(async () => {
  const { autoPip, multipleMode } = await chrome.storage.local.get({
    autoPip: true,
    multipleMode: false,
  });

  chrome.action.setBadgeBackgroundColor({ color: "#4285F4" });
  chrome.action.setBadgeTextColor({ color: "#fff" });
  updateContentScripts(autoPip);
  updateBadge(multipleMode);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case "autoPip":
      const autoPip = info.checked;
      chrome.storage.local.set({ autoPip });
      updateContentScripts(autoPip);
      break;

    case "multipleMode":
      const multipleMode = info.checked;
      await chrome.storage.local.set({ multipleMode });
      updateBadge(multipleMode);
      break;

    case "stopAllPip":
      await stopAllPictureInPicture(tab);
      break;
  }
});

async function stopAllPictureInPicture(tab) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Exit document PiP if active
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        }

        // Remove PiP attributes from all videos
        const pipVideos = document.querySelectorAll("video[__pip__]");
        pipVideos.forEach((video) => {
          video.removeAttribute("__pip__");
          video.removeAttribute("__pip_id__");
        });

        return pipVideos.length;
      },
    });
  } catch (error) {
    console.error("Error stopping all PiP:", error);
  }
}

function updateContentScripts(autoPip) {
  chrome.action.setTitle({ title: `Multiple Picture-in-Picture Extension (Auto PiP: ${autoPip ? "on" : "off"})` });

  if (!autoPip) {
    chrome.scripting.unregisterContentScripts({ ids: ["autoPip"] });
    return;
  }

  chrome.scripting.registerContentScripts([
    {
      id: "autoPip",
      js: ["autoPip.js"],
      matches: ["<all_urls>"],
      runAt: "document_start",
    },
  ]);
}

function updateBadge(multipleMode) {
  if (multipleMode) {
    chrome.action.setBadgeText({ text: "M" });
    chrome.action.setBadgeBackgroundColor({ color: "#34A853" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Track PiP windows for cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  activePipWindows.delete(tabId);
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "PIP_STARTED":
      if (!activePipWindows.has(sender.tab.id)) {
        activePipWindows.set(sender.tab.id, new Set());
      }
      activePipWindows.get(sender.tab.id).add(message.videoId);
      break;

    case "PIP_STOPPED":
      if (activePipWindows.has(sender.tab.id)) {
        activePipWindows.get(sender.tab.id).delete(message.videoId);
        if (activePipWindows.get(sender.tab.id).size === 0) {
          activePipWindows.delete(sender.tab.id);
        }
      }
      break;

    case "GET_PIP_COUNT":
      const count = activePipWindows.has(sender.tab.id) ? activePipWindows.get(sender.tab.id).size : 0;
      sendResponse({ count });
      break;
  }
});
