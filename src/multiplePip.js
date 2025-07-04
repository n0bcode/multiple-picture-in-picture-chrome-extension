// Multiple Picture-in-Picture Extension - Content Script
// Handles multiple video PiP functionality and communication with popup

class MultiplePipManager {
  constructor() {
    this.videos = new Map();
    this.pipVideos = new Set();
    this.observer = null;
    this.isMultipleMode = false;
    this.customPipWindows = new Map();

    this.init();
  }

  async init() {
    // Load settings
    await this.loadSettings();

    // Set up video monitoring
    this.setupVideoMonitoring();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.multipleMode) {
        this.isMultipleMode = changes.multipleMode.newValue;
      }
    });

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // Monitor for PiP events
    this.setupPipEventListeners();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get({
        multipleMode: false,
      });
      this.isMultipleMode = result.multipleMode;
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  setupVideoMonitoring() {
    // Initial scan
    this.scanForVideos();

    // Set up mutation observer to detect new videos
    this.observer = new MutationObserver((mutations) => {
      let shouldRescan = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === "VIDEO" || node.querySelector("video")) {
                shouldRescan = true;
              }
            }
          });
        }
      });

      if (shouldRescan) {
        setTimeout(() => this.scanForVideos(), 100);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  scanForVideos() {
    const videoElements = document.querySelectorAll("video");

    videoElements.forEach((video, index) => {
      if (!this.videos.has(video)) {
        const videoInfo = this.createVideoInfo(video, index);
        this.videos.set(video, videoInfo);

        // Add event listeners
        this.setupVideoEventListeners(video);
      }
    });

    // Clean up removed videos
    this.videos.forEach((info, video) => {
      if (!document.contains(video)) {
        this.videos.delete(video);
        this.pipVideos.delete(video);
      }
    });

    // Log for debugging
    console.log("Scanned videos:", this.videos.size);
  }

  createVideoInfo(video, index) {
    return {
      id: `video_${index}_${Date.now()}`,
      element: video,
      index: index,
      isPip: false,
      pipId: null,
    };
  }

  setupVideoEventListeners(video) {
    // PiP enter event
    video.addEventListener("enterpictureinpicture", (event) => {
      const videoInfo = this.videos.get(video);
      if (videoInfo) {
        videoInfo.isPip = true;
        videoInfo.pipId = `pip_${videoInfo.index}_${Date.now()}`;
        this.pipVideos.add(video);

        // Notify background script
        chrome.runtime.sendMessage({
          type: "PIP_STARTED",
          videoId: videoInfo.id,
          pipId: videoInfo.pipId,
        });
      }
    });

    // PiP leave event
    video.addEventListener("leavepictureinpicture", (event) => {
      const videoInfo = this.videos.get(video);
      if (videoInfo) {
        videoInfo.isPip = false;
        const pipId = videoInfo.pipId;
        videoInfo.pipId = null;
        this.pipVideos.delete(video);

        // Notify background script
        chrome.runtime.sendMessage({
          type: "PIP_STOPPED",
          videoId: videoInfo.id,
          pipId: pipId,
        });
      }
    });
  }

  setupPipEventListeners() {
    // Listen for document-level PiP events
    document.addEventListener("enterpictureinpicture", (event) => {
      console.log("Document PiP entered:", event.target);
    });

    document.addEventListener("leavepictureinpicture", (event) => {
      console.log("Document PiP left:", event.target);
    });
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "CHECK_CONTENT_SCRIPT_READY":
        sendResponse({ isReady: true });
        break;
      case "SCAN_VIDEOS":
        this.scanForVideos();
        const videoList = this.getVideoList();
        sendResponse({ videos: videoList });
        break;

      case "START_PIP":
        // Use a workaround to ensure PiP request is tied to a user gesture
        setTimeout(() => {
          this.startPictureInPicture(message.videoIds, message.multipleMode)
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        }, 100);
        return true; // Keep message channel open for async response

      case "STOP_ALL_PIP":
        this.stopAllPictureInPicture()
          .then((result) => sendResponse(result))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;

      case "GET_PIP_STATUS":
        sendResponse({
          pipCount: this.pipVideos.size,
          pipVideos: Array.from(this.pipVideos)
            .map((video) => {
              const info = this.videos.get(video);
              return info ? info.id : null;
            })
            .filter(Boolean),
        });
        break;
    }
  }

  getVideoList() {
    const videos = [];

    this.videos.forEach((info, video) => {
      if (this.isVideoValid(video)) {
        const rect = video.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(video);

        // Try to get video title from various sources
        let title =
          video.title ||
          video.getAttribute("aria-label") ||
          video.getAttribute("data-title") ||
          video.closest("[title]")?.title ||
          video.closest("article")?.querySelector("h1, h2, h3")?.textContent ||
          `Video ${info.index + 1}`;

        // Get video source info
        const src = video.currentSrc || video.src || "Unknown source";
        let domain = "Unknown";
        try {
          domain = new URL(src, window.location.href).hostname;
        } catch (e) {
          domain = window.location.hostname;
        }

        videos.push({
          id: info.id,
          title: title.trim().substring(0, 50),
          src: src,
          domain: domain,
          width: Math.round(video.videoWidth),
          height: Math.round(video.videoHeight),
          duration: video.duration || 0,
          currentTime: video.currentTime || 0,
          paused: video.paused,
          muted: video.muted,
          volume: video.volume,
          rect: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            left: Math.round(rect.left),
          },
          visible:
            computedStyle.display !== "none" &&
            computedStyle.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0,
          index: info.index,
          isPip: info.isPip,
          pipId: info.pipId,
        });
      }
    });

    return videos;
  }

  isVideoValid(video) {
    return video.readyState > 0 && !video.disablePictureInPicture && video.videoWidth > 0 && video.videoHeight > 0;
  }

  async startPictureInPicture(videoIds, multipleMode = false) {
    const errors = [];
    let successCount = 0;

    console.log("Starting PiP for videos:", videoIds);
    console.log("Multiple mode:", multipleMode);

    // Start PiP for selected videos
    for (let i = 0; i < videoIds.length; i++) {
      try {
        const videoId = videoIds[i];
        const video = this.findVideoById(videoId);
        if (video && this.isVideoValid(video)) {
          console.log(`Attempting PiP for video ${videoId}`);
          // First try native PiP if supported and not in multiple mode beyond browser limit
          let pipStarted = false;
          if (!multipleMode || successCount < 1) {
            try {
              pipStarted = await this.startNativePipForVideo(video, videoId);
              console.log(`Native PiP ${pipStarted ? "succeeded" : "failed"} for video ${videoId}`);
            } catch (nativeError) {
              console.log(`Native PiP failed for video ${videoId}, falling back to custom:`, nativeError.message);
            }
          }

          // Fall back to custom PiP if native didn't work or in multiple mode
          if (!pipStarted) {
            await this.startCustomPipForVideo(video, videoId);
            console.log(`Custom PiP started for video ${videoId}`);
          }
          successCount++;

          // Small delay to ensure browser handles multiple PiP windows
          await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
          errors.push(`Video ${videoId} not found or invalid`);
          console.log(`Error: Video ${videoId} not found or invalid`);
        }
      } catch (error) {
        errors.push(`Video ${videoId}: ${error.message}`);
        console.log(`Error for video ${videoId}:`, error.message);
      }
    }

    if (successCount === 0 && errors.length > 0) {
      return {
        success: false,
        count: 0,
        error: errors.join("; "),
      };
    }

    return {
      success: successCount > 0,
      count: successCount,
      error: errors.length > 0 ? errors.join("; ") : "",
    };
  }

  async startCustomPipForVideo(video, videoId) {
    if (!this.isVideoValid(video)) {
      throw new Error("Video is not ready for Picture-in-Picture");
    }

    if (video.hasAttribute("__pip__")) {
      throw new Error("Video is already in Picture-in-Picture mode");
    }

    try {
      // Create a custom popup window for PiP using a new browser window
      const videoInfo = this.videos.get(video);
      const pipId = `pip_${videoInfo.index}_${Date.now()}`;
      const videoSrc = video.currentSrc || video.src;

      // Get the URL for the pipWindow.html within the extension
      const pipWindowUrl = chrome.runtime.getURL("pipWindow.html");
      const windowUrl = `${pipWindowUrl}?src=${encodeURIComponent(videoSrc)}&videoId=${encodeURIComponent(
        videoInfo.id
      )}`;

      // Create a new browser window for the video
      chrome.runtime.sendMessage({
        type: "CREATE_PIP_WINDOW",
        url: windowUrl,
        width: 320,
        height: 240,
        pipId: pipId,
        videoId: videoInfo.id,
      });

      // Mark video as PiP
      video.setAttribute("__pip__", "true");
      video.setAttribute("__pip_id__", pipId);
      if (videoInfo) {
        videoInfo.isPip = true;
        videoInfo.pipId = pipId;
        this.pipVideos.add(video);
      }

      // Store the pipId in customPipWindows for tracking
      this.customPipWindows.set(pipId, { videoId, window: true });

      // Notify background script
      chrome.runtime.sendMessage({
        type: "PIP_STARTED",
        videoId: videoInfo.id,
        pipId: pipId,
        mode: "custom",
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to start Custom Picture-in-Picture: ${error.message}`);
    }
  }

  async startNativePipForVideo(video, videoId) {
    if (!this.isVideoValid(video)) {
      throw new Error("Video is not ready for Picture-in-Picture");
    }

    if (video.hasAttribute("__pip__")) {
      throw new Error("Video is already in Picture-in-Picture mode");
    }

    try {
      // Check if native PiP is supported
      if (!document.pictureInPictureEnabled || video.disablePictureInPicture) {
        throw new Error("Native Picture-in-Picture is not supported or disabled for this video");
      }

      // Request native PiP
      await video.requestPictureInPicture();

      // If successful, the enterpictureinpicture event will handle the rest
      return true;
    } catch (error) {
      throw new Error(`Failed to start Native Picture-in-Picture: ${error.message}`);
    }
  }

  closeCustomPip(pipId) {
    const pipWindow = this.customPipWindows.get(pipId);
    if (pipWindow) {
      // Since it's a separate window, we can't close it directly from content script
      // Instead, notify background to handle any cleanup if needed
      chrome.runtime.sendMessage({
        type: "CLOSE_PIP_WINDOW",
        pipId: pipId,
      });
      this.customPipWindows.delete(pipId);

      // Update video attributes
      this.videos.forEach((info, video) => {
        if (info.pipId === pipId) {
          video.removeAttribute("__pip__");
          video.removeAttribute("__pip_id__");
          info.isPip = false;
          info.pipId = null;
          this.pipVideos.delete(video);
        }
      });
    }
  }

  // Deprecated method - kept for reference but not used
  async startPipForVideo(video) {
    throw new Error("This method is deprecated. Use startCustomPipForVideo instead.");
  }

  async stopAllPictureInPicture() {
    let stoppedCount = 0;

    // Exit native PiP if active
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
        stoppedCount++;
      } catch (error) {
        console.error("Error exiting native PiP:", error);
      }
    }

    // Remove PiP attributes from all videos
    const pipVideos = document.querySelectorAll("video[__pip__]");
    pipVideos.forEach((video) => {
      video.removeAttribute("__pip__");
      video.removeAttribute("__pip_id__");

      const videoInfo = this.videos.get(video);
      if (videoInfo) {
        videoInfo.isPip = false;
        videoInfo.pipId = null;
      }

      this.pipVideos.delete(video);
      stoppedCount++;
    });

    // Close all custom PiP windows
    this.customPipWindows.forEach((_, pipId) => {
      this.closeCustomPip(pipId);
      stoppedCount++;
    });

    return {
      success: true,
      stopped: stoppedCount,
    };
  }

  findVideoById(videoId) {
    for (const [video, info] of this.videos) {
      if (info.id === videoId) {
        return video;
      }
    }
    return null;
  }

  findVideoByIndex(index) {
    const videos = document.querySelectorAll("video");
    return videos[index] || null;
  }

  // Enhanced video detection for better compatibility
  enhancedVideoScan() {
    const videos = [];

    // Standard video elements
    document.querySelectorAll("video").forEach((video, index) => {
      if (this.isVideoValid(video)) {
        videos.push({ element: video, index, type: "video" });
      }
    });

    // Check for embedded videos in iframes (if accessible)
    document.querySelectorAll("iframe").forEach((iframe, index) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc) {
          iframeDoc.querySelectorAll("video").forEach((video, videoIndex) => {
            if (this.isVideoValid(video)) {
              videos.push({
                element: video,
                index: `iframe_${index}_${videoIndex}`,
                type: "iframe_video",
                iframe: iframe,
              });
            }
          });
        }
      } catch (error) {
        // Cross-origin iframe, can't access
      }
    });

    return videos;
  }

  // Cleanup when page unloads
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.videos.clear();
    this.pipVideos.clear();
    this.customPipWindows.forEach((_, pipId) => {
      this.closeCustomPip(pipId);
    });
  }
}

// Initialize the manager when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.multiplePipManager = new MultiplePipManager();
  });
} else {
  window.multiplePipManager = new MultiplePipManager();
}

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  if (window.multiplePipManager) {
    window.multiplePipManager.cleanup();
  }
});

// Export for testing/debugging
if (typeof module !== "undefined" && module.exports) {
  module.exports = MultiplePipManager;
}
