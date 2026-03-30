let currentTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Lấy tab hiện tại
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  // Load saved settings
  chrome.storage.local.get(['delayMin', 'delayMax', 'isRunning'], (result) => {
    if (result.delayMin) document.getElementById('delayMin').value = result.delayMin;
    if (result.delayMax) document.getElementById('delayMax').value = result.delayMax;
    
    // Cập nhật UI dựa trên trạng thái
    if (result.isRunning) {
      updateUI(true);
    }
  });
  
  // Lấy thống kê từ content script
  if (currentTab.url.includes('facebook.com')) {
    chrome.tabs.sendMessage(currentTab.id, { action: 'getStats' }, (response) => {
      if (response && response.count) {
        document.getElementById('statsCount').innerHTML = `Số link đã thu thập: ${response.count}`;
        document.getElementById('statsUnique').innerHTML = `Link unique: ${response.uniqueCount}`;
      }
    });
  }
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const delayMin = parseFloat(document.getElementById('delayMin').value);
  const delayMax = parseFloat(document.getElementById('delayMax').value);
  
  // Validate input
  if (delayMin < 1 || delayMax < delayMin) {
    alert('Vui lòng nhập delay hợp lệ (tối thiểu >= 1s, tối đa > tối thiểu)');
    return;
  }
  
  // Save settings
  chrome.storage.local.set({ delayMin, delayMax, isRunning: true });
  
  // Send start message to content script
  chrome.tabs.sendMessage(currentTab.id, {
    action: 'start',
    delayMin: delayMin,
    delayMax: delayMax
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      alert('Vui lòng refresh lại trang Facebook và thử lại');
    } else {
      updateUI(true);
    }
  });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.tabs.sendMessage(currentTab.id, { action: 'stop' }, (response) => {
    if (!chrome.runtime.lastError) {
      chrome.storage.local.set({ isRunning: false });
      updateUI(false);
    }
  });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  chrome.tabs.sendMessage(currentTab.id, { action: 'getLinks' }, (response) => {
    if (response && response.links && response.links.length > 0) {
      downloadLinks(response.links);
    } else {
      alert('Chưa có link nào được thu thập!');
    }
  });
});

function updateUI(isRunning) {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  const delayMin = document.getElementById('delayMin');
  const delayMax = document.getElementById('delayMax');
  
  if (isRunning) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDiv.textContent = 'Running';
    statusDiv.className = 'status running';
    delayMin.disabled = true;
    delayMax.disabled = true;
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDiv.textContent = 'Stopped';
    statusDiv.className = 'status stopped';
    delayMin.disabled = false;
    delayMax.disabled = false;
  }
}

function downloadLinks(links) {
  const uniqueLinks = [...new Set(links)];
  const content = uniqueLinks.join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `facebook_reels_links_${timestamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert(`Đã tải xuống ${uniqueLinks.length} link!`);
}
