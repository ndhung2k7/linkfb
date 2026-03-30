// Lưu trữ dữ liệu cho extension
let extensionData = {
  totalLinksCollected: 0,
  activeTabs: new Map()
};

// Lắng nghe cài đặt extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Facebook Reels Auto Scroll installed');
  
  // Khởi tạo storage
  chrome.storage.local.set({
    delayMin: 3,
    delayMax: 10,
    isRunning: false
  });
});

// Lắng nghe message từ content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'statsUpdate') {
    // Cập nhật thống kê
    extensionData.totalLinksCollected = message.count;
    
    // Có thể lưu vào storage nếu cần
    chrome.storage.local.set({ totalLinks: message.count });
  }
  
  sendResponse({ received: true });
  return true;
});

// Xử lý khi tab đóng
chrome.tabs.onRemoved.addListener((tabId) => {
  if (extensionData.activeTabs.has(tabId)) {
    extensionData.activeTabs.delete(tabId);
  }
});

// Export dữ liệu (có thể dùng cho các tính năng nâng cao)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportData') {
    sendResponse({
      data: extensionData,
      timestamp: new Date().toISOString()
    });
  }
});
