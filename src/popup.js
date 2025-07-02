// Multiple Picture-in-Picture Extension - Popup Script
// Handles the popup UI and communication with content scripts

class MultiplePipPopup {
  constructor() {
    this.videos = [];
    this.selectedVideos = new Set();
    this.isMultipleMode = false;
    this.currentTab = null;

    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.scanForVideos();
  }

  initializeElements() {
    this.elements = {
      multipleMode: document.getElementById("multipleMode"),
      videoList: document.getElementById("videoList"),
      loading: document.getElementById("loading"),
      noVideos: document.getElementById("noVideos"),
      startPip: document.getElementById("startPip"),
      stopAllPip: document.getElementById("stopAllPip"),
      refreshVideos: document.getElementById("refreshVideos"),
      status: document.getElementById("status"),
    };
  }

  bindEvents() {
    // Toggle multiple mode
    this.elements.multipleMode.addEventListener("change", (e) => {
      this.isMultipleMode = e.target.checked;
      this.saveSettings();
      this.updateUI();
    });

    // Button events
    this.elements.startPip.addEventListener("click", () => this.startPictureInPicture());
    this.elements.stopAllPip.addEventListener("click", () => this.stopAllPictureInPicture());
    this.elements.refreshVideos.addEventListener("click", () => this.scanForVideos());
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get({
        multipleMode: false,
        selectedVideos: [],
      });

      this.isMultipleMode = result.multipleMode;
      this.elements.multipleMode.checked = this.isMultipleMode;
      this.selectedVideos = new Set(result.selectedVideos);

      this.updateUI();
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        multipleMode: this.isMultipleMode,
        selectedVideos: Array.from(this.selectedVideos),
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }

  async getCurrentTab() {
    if (!this.currentTab) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    }
    return this.currentTab;
  }

  async scanForVideos() {
    this.showLoading(true);
    this.showStatus("Scanning for videos...", "info");

    try {
      const tab = await this.getCurrentTab();

      // Send message to content script to scan for videos instead of direct execution
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "SCAN_VIDEOS",
      });

      if (response && response.videos) {
        this.videos = response.videos;
        this.displayVideos();
      } else {
        this.videos = [];
        this.showNoVideos();
      }
    } catch (error) {
      console.error("Error scanning for videos:", error);
      this.showStatus("Error scanning for videos: " + error.message, "error");
      this.showNoVideos();
    }

    this.showLoading(false);
  }

  // Function to be injected into the page to scan for videos
  scanVideosInPage() {
    const videos = Array.from(document.querySelectorAll("video"))
      .filter((video) => {
        return video.readyState > 0 && !video.disablePictureInPicture && video.videoWidth > 0 && video.videoHeight > 0;
      })
      .map((video, index) => {
        const rect = video.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(video);

        // Try to get video title from various sources
        let title =
          video.title ||
          video.getAttribute("aria-label") ||
          video.getAttribute("data-title") ||
          video.closest("[title]")?.title ||
          video.closest("article")?.querySelector("h1, h2, h3")?.textContent ||
          `Video ${index + 1}`;

        // Get video source info
        const src = video.currentSrc || video.src || "Unknown source";
        const domain = new URL(src, window.location.href).hostname;

        return {
          id: `video_${index}_${Date.now()}`,
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
          index: index,
        };
      })
      .filter((video) => video.visible);

    return videos;
  }

  displayVideos() {
    if (this.videos.length === 0) {
      this.showNoVideos();
      return;
    }

    this.elements.videoList.innerHTML = "";
    this.elements.videoList.style.display = "block";
    this.elements.noVideos.style.display = "none";

    this.videos.forEach((video) => {
      const videoItem = this.createVideoItem(video);
      this.elements.videoList.appendChild(videoItem);
    });

    // Ensure the start button is updated even if no videos are selected yet
    this.updateStartButton();
    this.showStatus(`Found ${this.videos.length} video(s)`, "success");
  }

  createVideoItem(video) {
    const item = document.createElement("div");
    item.className = "video-item";
    item.dataset.videoId = video.id;

    if (this.selectedVideos.has(video.id)) {
      item.classList.add("selected");
    }

    const formatDuration = (seconds) => {
      if (!seconds || seconds === Infinity) return "Live";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatTime = (seconds) => {
      if (!seconds) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    item.innerHTML = `
      <input type="checkbox" class="video-checkbox" ${this.selectedVideos.has(video.id) ? "checked" : ""}>
      <div class="video-info">
        <div class="video-title">${this.escapeHtml(video.title)}</div>
        <div class="video-details">
          ${video.width}×${video.height} • ${video.domain}<br>
          ${formatTime(video.currentTime)} / ${formatDuration(video.duration)} • ${video.paused ? "Paused" : "Playing"}
        </div>
      </div>
      <canvas class="video-thumbnail" width="60" height="34"></canvas>
    `;

    // Event listeners
    const checkbox = item.querySelector(".video-checkbox");
    checkbox.addEventListener("change", (e) => {
      e.stopPropagation();
      this.toggleVideoSelection(video.id, e.target.checked);
    });

    item.addEventListener("click", (e) => {
      if (e.target.type !== "checkbox") {
        checkbox.checked = !checkbox.checked;
        this.toggleVideoSelection(video.id, checkbox.checked);
      }
    });

    // Generate thumbnail
    this.generateThumbnail(video, item.querySelector(".video-thumbnail"));

    return item;
  }

  async generateThumbnail(video, canvas) {
    // Fallback placeholder directly to avoid security issues with tainted canvas
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, 60, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VIDEO", 30, 20);
  }

  toggleVideoSelection(videoId, selected) {
    if (selected) {
      if (!this.isMultipleMode) {
        // Single mode: clear other selections
        this.selectedVideos.clear();
        document.querySelectorAll(".video-item").forEach((item) => {
          item.classList.remove("selected");
          item.querySelector(".video-checkbox").checked = false;
        });
      }
      this.selectedVideos.add(videoId);
    } else {
      this.selectedVideos.delete(videoId);
    }

    // Update UI
    const item = document.querySelector(`[data-video-id="${videoId}"]`);
    if (item) {
      item.classList.toggle("selected", selected);
      item.querySelector(".video-checkbox").checked = selected;
    }

    this.updateStartButton();
    this.saveSettings();
  }

  updateStartButton() {
    // Enable the button if videos are detected, even if none are selected
    const hasVideos = this.videos.length > 0;
    this.elements.startPip.disabled = !hasVideos;

    if (this.selectedVideos.size > 0) {
      const count = this.selectedVideos.size;
      this.elements.startPip.textContent = `Start PiP (${count})`;
    } else {
      this.elements.startPip.textContent = "Start PiP";
    }
    this.elements.startPip.disabled = false;
  }

  async startPictureInPicture() {
    if (this.selectedVideos.size === 0) {
      this.showStatus("Please select at least one video to start Picture-in-Picture", "error");
      return;
    }

    this.showStatus("Starting Picture-in-Picture...", "info");

    try {
      const tab = await this.getCurrentTab();
      const selectedVideoIds = Array.from(this.selectedVideos);

      // Send message to content script to start PiP instead of direct execution
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "START_PIP",
        videoIds: selectedVideoIds,
        multipleMode: this.isMultipleMode,
      });

      if (response && response.success && response.count > 0) {
        this.showStatus(`Started Picture-in-Picture for ${response.count} video(s)`, "success");
      } else if (response && response.error) {
        this.showStatus(`Error: ${response.error}`, "error");
      } else {
        this.showStatus("Failed to start Picture-in-Picture", "error");
      }
    } catch (error) {
      console.error("Error starting PiP:", error);
      this.showStatus("Error starting Picture-in-Picture: " + error.message, "error");
    }
  }

  async stopAllPictureInPicture() {
    this.showStatus("Stopping all Picture-in-Picture...", "info");

    try {
      const tab = await this.getCurrentTab();

      // Send message to content script to stop all PiP
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "STOP_ALL_PIP",
      });

      if (response && response.success) {
        this.showStatus(`Stopped ${response.stopped} Picture-in-Picture window(s)`, "success");
      } else {
        this.showStatus("Error stopping Picture-in-Picture", "error");
      }
    } catch (error) {
      console.error("Error stopping PiP:", error);
      this.showStatus("Error stopping Picture-in-Picture: " + error.message, "error");
    }
  }

  updateUI() {
    // Update mode-specific UI elements
    if (this.isMultipleMode) {
      // Multiple mode: allow multiple selections
    } else {
      // Single mode: limit to one selection
      if (this.selectedVideos.size > 1) {
        const firstSelected = Array.from(this.selectedVideos)[0];
        this.selectedVideos.clear();
        this.selectedVideos.add(firstSelected);

        // Update checkboxes
        document.querySelectorAll(".video-item").forEach((item) => {
          const isSelected = item.dataset.videoId === firstSelected;
          item.classList.toggle("selected", isSelected);
          item.querySelector(".video-checkbox").checked = isSelected;
        });
      }
    }

    this.updateStartButton();
  }

  showLoading(show) {
    this.elements.loading.style.display = show ? "block" : "none";
    this.elements.videoList.style.display = show ? "none" : "block";
    this.elements.noVideos.style.display = "none";
  }

  showNoVideos() {
    this.elements.loading.style.display = "none";
    this.elements.videoList.style.display = "none";
    this.elements.noVideos.style.display = "block";
    this.updateStartButton();
  }

  showStatus(message, type = "info") {
    this.elements.status.textContent = message;
    this.elements.status.className = `status ${type}`;
    this.elements.status.style.display = "block";

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.status.style.display = "none";
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new MultiplePipPopup();
});
