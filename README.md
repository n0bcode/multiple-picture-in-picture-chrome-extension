# Multiple Picture-in-Picture Chrome Extension

An advanced Chrome Extension that enables **multiple simultaneous Picture-in-Picture videos** using the [Picture-in-Picture Web API](https://wicg.github.io/picture-in-picture/). Watch multiple videos at once in floating windows!

<img src="https://raw.githubusercontent.com/beaufortfrancois/picture-in-picture-chrome-extension/master/screenshot.png">

## ✨ Features

### 🎥 Multiple Picture-in-Picture

- **Select multiple videos** from any webpage
- **Watch simultaneously** in separate floating windows
- **Smart video detection** with thumbnails and metadata
- **Toggle between single and multiple modes**

### 🎛️ Advanced Controls

- **Interactive popup interface** for video selection
- **Real-time video scanning** with automatic updates
- **Batch operations** - start/stop multiple videos at once
- **Context menu integration** for quick access

### ⌨️ Keyboard Shortcuts

- `Alt+P` - Quick single video Picture-in-Picture (legacy mode)
- `Alt+M` - Toggle multiple PiP mode on/off
- Customizable shortcuts via Chrome Extensions settings

### 🔧 Smart Features

- **Automatic video detection** on page load and dynamic content
- **Video metadata display** (resolution, duration, domain)
- **Thumbnail generation** for easy video identification
- **Persistent settings** across browser sessions
- **Cross-frame video support** (where permissions allow)

## 🚀 How to Use

### Basic Usage

1. **Click the extension icon** to open the popup interface
2. **Toggle "Multiple PiP Mode"** to enable multiple video selection
3. **Select videos** by clicking checkboxes or video items
4. **Click "Start PiP"** to launch Picture-in-Picture windows
5. **Use "Stop All"** to close all PiP windows at once

### Quick Access

- **Alt+P**: Instantly start PiP for the largest playing video (single mode)
- **Alt+M**: Toggle multiple PiP mode and show notification
- **Right-click extension icon**: Access context menu options

### Advanced Features

- **Auto PiP**: Automatically enter PiP when eligible (can be toggled)
- **Video filtering**: Only shows videos that support Picture-in-Picture
- **Real-time updates**: Video list updates as content changes
- **Error handling**: Clear feedback for any issues

## 🛠️ Installation

### From Source

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `src` folder
5. The extension will appear in your toolbar

### Configuration

Keyboard shortcuts can be customized at:
`chrome://extensions/shortcuts`

## 🎯 Use Cases

- **Educational content**: Watch multiple tutorial videos simultaneously
- **Sports streaming**: Follow multiple games or camera angles
- **News monitoring**: Keep track of multiple live streams
- **Entertainment**: Binge-watch multiple series episodes
- **Work productivity**: Monitor multiple video conferences or presentations

## 🔧 Technical Details

### Browser Compatibility

- **Chrome 70+** (Picture-in-Picture API support required)
- **Chromium-based browsers** (Edge, Brave, etc.)

### Permissions

- `activeTab`: Access current tab for video detection
- `storage`: Save user preferences and settings
- `scripting`: Inject content scripts for video management
- `contextMenus`: Add right-click menu options

### Architecture

- **Manifest V3** compliant
- **Service Worker** background script
- **Content Script** injection for video management
- **Popup interface** for user interaction
- **Chrome Storage API** for settings persistence

## 🐛 Troubleshooting

### Videos Not Detected

- Ensure videos are **playing or ready to play**
- Check that videos **support Picture-in-Picture**
- Try **refreshing the page** or clicking "Refresh" in popup
- Some videos may be **blocked by website policies**

### Multiple PiP Not Working

- Verify **Multiple PiP Mode is enabled** (toggle in popup)
- Check **browser Picture-in-Picture support**
- Some websites may **limit simultaneous PiP windows**
- Try **selecting fewer videos** if experiencing issues

### Performance Issues

- **Limit concurrent PiP windows** for better performance
- **Close unused PiP windows** to free resources
- **Disable auto PiP** if causing conflicts

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### Development Setup

1. Clone the repository
2. Make changes in the `src/` directory
3. Test with "Load unpacked" in Chrome
4. Submit a pull request

## 📄 License

Licensed under the Apache License, Version 2.0. See LICENSE file for details.

## 🙏 Acknowledgments

Based on the original Picture-in-Picture Chrome Extension by Google.
Enhanced with multiple video support and advanced features.
