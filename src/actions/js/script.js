var manifestData = chrome.runtime.getManifest();
document.getElementById('version-placeholder').innerText = "v"+manifestData.version;