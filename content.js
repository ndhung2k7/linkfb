let isRunning = false;
let timeoutId = null;
let collectedLinks = new Set();
let delayMin = 3;
let delayMax = 10;
let observer = null;
let currentReelIndex = 0;

// Hàm random delay
function getRandomDelay() {
  return (Math.random() * (delayMax - delayMin) + delayMin) * 1000;
}

// Hàm scroll mượt
function smoothScroll() {
  return new Promise((resolve) => {
    const scrollHeight = document.documentElement.scrollHeight;
    const currentScroll = window.scrollY;
    const targetScroll = currentScroll + window.innerHeight;
    
    const duration = 500;
    const startTime = performance.now();
    
    function scrollStep(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const newScroll = currentScroll + (targetScroll - currentScroll) * easeProgress;
      
      window.scrollTo(0, newScroll);
      
      if (progress < 1) {
        requestAnimationFrame(scrollStep);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(scrollStep);
  });
}

// Hàm thu thập link video
function collectVideoLinks() {
  const links = document.querySelectorAll('a[href*="/reel/"]');
  let newLinksCount = 0;
  
  links.forEach(link => {
    const href = link.href;
    if (href && href.includes('/reel/') && !collectedLinks.has(href)) {
      collectedLinks.add(href);
      newLinksCount++;
    }
  });
  
  if (newLinksCount > 0) {
    console.log(`Đã thu thập ${newLinksCount} link mới. Tổng: ${collectedLinks.size}`);
    
    // Gửi thông báo cập nhật stats
    chrome.runtime.sendMessage({
      type: 'statsUpdate',
      count: collectedLinks.size
    });
  }
}

// Hàm chuyển sang reel tiếp theo
async function nextReel() {
  if (!isRunning) return;
  
  console.log('Đang chuyển sang reel tiếp theo...');
  
  // Thu thập link trước khi chuyển
  collectVideoLinks();
  
  // Tìm và click vào reel tiếp theo
  const reels = document.querySelectorAll('[role="button"][aria-label*="Reel"], a[href*="/reel/"]');
  const visibleReels = Array.from(reels).filter(reel => {
    const rect = reel.getBoundingClientRect();
    return rect.top >= 0 && rect.top <= window.innerHeight;
  });
  
  if (visibleReels.length > 0) {
    // Click vào reel hiện tại để chuyển sang tiếp theo
    const currentReel = visibleReels[0];
    if (currentReel) {
      currentReel.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else {
    // Scroll để load thêm reel
    await smoothScroll();
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Lên lịch cho lần next tiếp theo
  scheduleNext();
}

// Hàm schedule lần next tiếp theo
function scheduleNext() {
  if (!isRunning) return;
  
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  
  const delay = getRandomDelay();
  console.log(`Next reel sau ${(delay / 1000).toFixed(1)} giây`);
  
  timeoutId = setTimeout(async () => {
    await nextReel();
  }, delay);
}

// Hàm theo dõi DOM để phát hiện video mới
function setupObserver() {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver((mutations) => {
    if (!isRunning) return;
    
    let hasNewReels = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector('a[href*="/reel/"]')) {
              hasNewReels = true;
            }
          }
        });
      }
    });
    
    if (hasNewReels) {
      collectVideoLinks();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Hàm dừng tất cả
function stop() {
  isRunning = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  console.log('Đã dừng auto scroll');
}

// Hàm bắt đầu
function start(config) {
  if (isRunning) {
    stop();
  }
  
  isRunning = true;
  delayMin = config.delayMin;
  delayMax = config.delayMax;
  
  console.log(`Bắt đầu auto scroll với delay ${delayMin}-${delayMax} giây`);
  
  // Thiết lập observer nếu chưa có
  if (!observer) {
    setupObserver();
  }
  
  // Thu thập link hiện tại
  collectVideoLinks();
  
  // Bắt đầu chu kỳ
  scheduleNext();
}

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'start':
      start({
        delayMin: request.delayMin,
        delayMax: request.delayMax
      });
      sendResponse({ status: 'started' });
      break;
      
    case 'stop':
      stop();
      sendResponse({ status: 'stopped' });
      break;
      
    case 'getLinks':
      sendResponse({ 
        links: Array.from(collectedLinks),
        count: collectedLinks.size
      });
      break;
      
    case 'getStats':
      sendResponse({
        count: collectedLinks.size,
        uniqueCount: collectedLinks.size
      });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
  
  return true; // Keep message channel open
});

// Thông báo đã sẵn sàng
console.log('Facebook Reels Auto Scroll content script loaded');
