<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['load', 'play-status']);

const cid = ref('');
const gateway = ref('http://127.0.0.1:8080/ipfs/');

const gateways = [
  { url: 'http://127.0.0.1:8080/ipfs/', label: '本地 (最穩定/測試首選)' },
  { url: 'https://gateway.pinata.cloud/ipfs/', label: 'Pinata (速度快/推薦)' },
  { url: 'https://dweb.link/ipfs/', label: 'DWeb.link (官方推薦)' },
  { url: 'https://ipfs.io/ipfs/', label: 'IPFS.io (標準網關)' },
];

function loadVideo(eventOrStartTime) {
  const startTime = typeof eventOrStartTime === 'number' ? eventOrStartTime : 0;
  const trimmed = cid.value.trim();
  if (!trimmed) {
    alert('請先輸入 CID！');
    return;
  }

  const selectedGateway = gateway.value;
  let ipfsBaseUrl = `${selectedGateway}${trimmed}/`;

  const m3u8Url = `${ipfsBaseUrl}index.m3u8`;

  emit('play-status', '正在連線至網關...');
  emit('load', { ipfsBaseUrl, m3u8Url, startTime });

  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('cid', trimmed);
  if (startTime > 0) {
    currentUrl.searchParams.set('t', startTime);
  } else {
    currentUrl.searchParams.delete('t');
  }
  window.history.pushState({}, '', currentUrl);
}

function shareCurrentTime() {
  const trimmed = cid.value.trim();
  if (!trimmed) {
    alert('請先輸入或載入 CID！');
    return;
  }

  // 取得當前時間，優先透過 videojs api 來取得，如果沒有則嘗試透過 DOM
  let currentTime = 0;
  if (window.videojs && window.videojs.getAllPlayers().length > 0) {
    currentTime = Math.floor(window.videojs.getAllPlayers()[0].currentTime());
  } else {
    const video = document.querySelector('video');
    if (video) {
      currentTime = Math.floor(video.currentTime);
    } else {
      alert('找不到影片播放器');
      return;
    }
  }

  // 組合包含當下時間的 URL，取得乾淨的 base url 來重新構建
  const shareUrl = new URL(window.location.origin + window.location.pathname);
  shareUrl.searchParams.set('cid', trimmed);
  if (currentTime > 0) {
    shareUrl.searchParams.set('t', currentTime);
  }

  const urlStr = shareUrl.toString();

  // UI 更新成功回饋
  const handleSuccess = () => {
    const btnText = document.querySelector('#shareBtn .btn-text');
    const btnIcon = document.querySelector('#shareBtn .btn-icon');
    if (btnText && btnIcon) {
      btnText.textContent = '✅ 已複製！';
      btnIcon.textContent = '✅';
      setTimeout(() => {
        if (btnText) btnText.textContent = '🔗 分享片段';
        if (btnIcon) btnIcon.textContent = '🔗';
      }, 2000);
    } else {
      const btn = document.getElementById('shareBtn');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✅ 已複製！';
        setTimeout(() => {
          if (btn) btn.textContent = original;
        }, 2000);
      }
    }
  };

  // 實作回退機制，解決 HTTP / 區域網路測試時 navigator.clipboard undefined 的常見問題
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(urlStr)
      .then(handleSuccess)
      .catch((err) => {
        console.warn('Clipboard API 失敗，嘗試 fallback:', err);
        fallbackCopyTextToClipboard(urlStr, handleSuccess);
      });
  } else {
    fallbackCopyTextToClipboard(urlStr, handleSuccess);
  }
}

function fallbackCopyTextToClipboard(text, onSuccess) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // 為了避免影響排版，將 textarea 置於畫面上方並隱藏
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      onSuccess();
    } else {
      alert('複製失敗，請手動複製這段網址:\n' + text);
    }
  } catch (err) {
    alert('複製失敗，請手動複製這段網址:\n' + text);
  }

  document.body.removeChild(textArea);
}

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const cidFromUrl = urlParams.get('cid');
  const timeFromUrl = parseInt(urlParams.get('t'), 10) || 0;

  if (cidFromUrl) {
    cid.value = cidFromUrl;
    loadVideo(timeFromUrl);
  }
});
</script>

<template>
  <div class="control-panel">
    <div class="input-row">
      <label for="gatewaySelect">選擇網關：</label>
      <select id="gatewaySelect" v-model="gateway">
        <option v-for="g in gateways" :key="g.url" :value="g.url">
          {{ g.label }}
        </option>
      </select>
    </div>

    <div class="input-row">
      <input
        type="text"
        id="cidInput"
        placeholder="請輸入資料夾 CID (例如: Qm...)"
        v-model="cid"
        @keyup.enter="loadVideo"
      />
      <button @click="loadVideo" class="action-btn">
        <span class="btn-text">▶️ 載入影片</span>
        <span class="btn-icon">▶️</span>
      </button>
      <button
        @click="shareCurrentTime"
        id="shareBtn"
        class="action-btn"
        title="複製包含目前播放時間的連結"
      >
        <span class="btn-text">🔗 分享片段</span>
        <span class="btn-icon">🔗</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="./ControlPanel.css"></style>
