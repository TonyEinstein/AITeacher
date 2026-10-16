<template>
  <div class="digital-avatar" :class="{ speaking: isSpeaking }">
    <!-- SVG 数字人 -->
    <svg viewBox="0 0 200 240" class="avatar-svg">
      <!-- 背景光晕 -->
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" :stop-color="glowColor" stop-opacity="0.3" />
          <stop offset="100%" :stop-color="glowColor" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="bodyColor" />
          <stop offset="100%" :stop-color="bodyColorDark" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="100" rx="90" ry="90" fill="url(#glow)" />

      <!-- 身体/衣服 -->
      <path d="M 50 240 Q 50 170 100 165 Q 150 170 150 240 Z" fill="url(#bodyGrad)" />
      <!-- 衣领 -->
      <path d="M 85 165 L 100 185 L 115 165" fill="none" :stroke="bodyColorDark" stroke-width="2" />

      <!-- 头部 -->
      <ellipse cx="100" cy="95" rx="50" ry="58" fill="#f5d5b8" />
      <!-- 头发 -->
      <path d="M 52 85 Q 50 40 100 35 Q 150 40 148 85 Q 145 60 130 55 Q 120 50 100 52 Q 80 50 70 55 Q 55 60 52 85 Z" fill="#3d2817" />
      <!-- 耳朵 -->
      <ellipse cx="52" cy="100" rx="6" ry="10" fill="#f5d5b8" />
      <ellipse cx="148" cy="100" rx="6" ry="10" fill="#f5d5b8" />

      <!-- 眉毛 -->
      <path :d="leftBrowPath" fill="none" stroke="#3d2817" stroke-width="3" stroke-linecap="round" />
      <path :d="rightBrowPath" fill="none" stroke="#3d2817" stroke-width="3" stroke-linecap="round" />

      <!-- 眼睛 -->
      <g class="eyes">
        <ellipse cx="80" cy="95" rx="8" :ry="eyeOpen ? 7 : 1" fill="#2d1810" />
        <ellipse cx="120" cy="95" rx="8" :ry="eyeOpen ? 7 : 1" fill="#2d1810" />
        <!-- 高光 -->
        <circle v-if="eyeOpen" cx="82" cy="93" r="2" fill="#fff" />
        <circle v-if="eyeOpen" cx="122" cy="93" r="2" fill="#fff" />
      </g>

      <!-- 鼻子 -->
      <path d="M 100 105 Q 97 118 100 122 Q 103 118 100 105" fill="none" stroke="#e0b896" stroke-width="1.5" />

      <!-- 嘴巴（说话时动） -->
      <g class="mouth-group">
        <ellipse
          cx="100"
          cy="135"
          :rx="mouthWidth"
          :ry="mouthHeight"
          fill="#8b3a3a"
          :class="{ 'mouth-open': isSpeaking }"
        />
        <!-- 舌头 -->
        <ellipse v-if="mouthHeight > 4" cx="100" cy="138" rx="6" ry="3" fill="#c96b6b" />
      </g>

      <!-- 腮红 -->
      <ellipse cx="68" cy="120" rx="10" ry="6" fill="#f5b8b8" opacity="0.4" />
      <ellipse cx="132" cy="120" rx="10" ry="6" fill="#f5b8b8" opacity="0.4" />

      <!-- 手势（说话时挥动） -->
      <g class="hand-left" :transform="handLeftTransform">
        <ellipse cx="35" cy="200" rx="12" ry="16" fill="#f5d5b8" />
      </g>
      <g class="hand-right" :transform="handRightTransform">
        <ellipse cx="165" cy="200" rx="12" ry="16" fill="#f5d5b8" />
      </g>
    </svg>

    <!-- 说话时的声波动画 -->
    <div v-if="isSpeaking" class="voice-waves">
      <span v-for="i in 5" :key="i" class="wave" :style="{ animationDelay: (i * 0.1) + 's' }"></span>
    </div>

    <p class="avatar-name">{{ name }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  isSpeaking?: boolean;
  name?: string;
  style?: 'serious' | 'gentle' | 'humorous';
}>();

const eyeOpen = ref(true);
const mouthWidth = ref(3);
const mouthHeight = ref(2);
const handLeftAngle = ref(0);
const handRightAngle = ref(0);
let blinkTimer: any = null;
let mouthTimer: any = null;
let handTimer: any = null;

// 风格配色
const bodyColor = computed(() => {
  const map: Record<string, string> = {
    serious: '#2c3e50',
    gentle: '#5b8fb9',
    humorous: '#e67e22',
  };
  return map[props.style || 'gentle'];
});
const bodyColorDark = computed(() => {
  const map: Record<string, string> = {
    serious: '#1a252f',
    gentle: '#3a6b8a',
    humorous: '#c95a10',
  };
  return map[props.style || 'gentle'];
});
const glowColor = computed(() => bodyColor.value);

// 眉毛路径（风格不同表情不同）
const leftBrowPath = computed(() => {
  if (props.style === 'serious') return 'M 65 80 Q 78 76 90 80';
  if (props.style === 'humorous') return 'M 65 82 Q 78 74 90 80';
  return 'M 65 80 Q 78 78 90 80';
});
const rightBrowPath = computed(() => {
  if (props.style === 'serious') return 'M 110 80 Q 122 76 135 80';
  if (props.style === 'humorous') return 'M 110 80 Q 122 74 135 82';
  return 'M 110 80 Q 122 78 135 80';
});

const handLeftTransform = computed(() => `rotate(${handLeftAngle.value}, 35, 180)`);
const handRightTransform = computed(() => `rotate(${handRightAngle.value}, 165, 180)`);

onMounted(() => {
  // 眨眼动画
  blinkTimer = setInterval(() => {
    eyeOpen.value = false;
    setTimeout(() => { eyeOpen.value = true; }, 150);
  }, 3000 + Math.random() * 2000);

  // 嘴巴动画（说话时）
  mouthTimer = setInterval(() => {
    if (props.isSpeaking) {
      mouthHeight.value = 3 + Math.random() * 8;
      mouthWidth.value = 4 + Math.random() * 6;
    } else {
      mouthHeight.value = 2;
      mouthWidth.value = 3;
    }
  }, 100);

  // 手势动画（说话时挥动）
  handTimer = setInterval(() => {
    if (props.isSpeaking) {
      handLeftAngle.value = -10 + Math.random() * 20;
      handRightAngle.value = -10 + Math.random() * 20;
    } else {
      handLeftAngle.value = 0;
      handRightAngle.value = 0;
    }
  }, 200);
});

onUnmounted(() => {
  clearInterval(blinkTimer);
  clearInterval(mouthTimer);
  clearInterval(handTimer);
});
</script>

<style scoped>
.digital-avatar {
  text-align: center;
  position: relative;
}
.avatar-svg {
  width: 180px;
  height: 220px;
  transition: transform 0.3s;
}
.digital-avatar.speaking .avatar-svg {
  animation: avatar-bounce 0.5s ease-in-out infinite;
}
@keyframes avatar-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.mouth-open {
  transition: all 0.1s;
}
.voice-waves {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 8px;
  height: 20px;
  align-items: flex-end;
}
.wave {
  width: 4px;
  background: linear-gradient(to top, #4299e1, #63b3ed);
  border-radius: 2px;
  animation: wave-anim 0.8s ease-in-out infinite;
}
@keyframes wave-anim {
  0%, 100% { height: 4px; }
  50% { height: 18px; }
}
.avatar-name {
  color: #1e3a5f;
  font-size: 16px;
  font-weight: bold;
  margin-top: 8px;
}
</style>
