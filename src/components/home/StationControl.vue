<template>
  <div class="station-control">
    <button class="station-btn prev-btn" :disabled="!connected || isBusy" @click="$emit('prev')">
      &lt;
    </button>
    <div class="station-info" @click="handleOpenList">
      <span v-if="connected && currentStation" class="station-name clickable">
        <span class="station-name-wrapper" ref="nameWrapper">
          <span class="station-name-scroll" :class="{ 'is-scrolling': needsScroll }">
            <span class="station-name-copy">{{ currentStation.name }}</span>
            <span v-if="needsScroll" class="station-name-copy">{{ currentStation.name }}</span>
          </span>
        </span>
        <span v-if="showPrimaryBadge" class="primary-badge">主</span>
        <span class="dropdown-arrow">▼</span>
      </span>
      <span v-else-if="connected" class="station-loading"> 加载中... </span>
      <span v-else class="station-disconnected"> 未连接 </span>
    </div>
    <button class="station-btn next-btn" :disabled="!connected || isBusy" @click="$emit('next')">
      &gt;
    </button>
    <button
      class="station-btn refresh-btn"
      :disabled="!connected || isBusy"
      title="刷新信道信息"
      @click="$emit('refresh')"
    >
      <span v-if="isBusy" class="refresh-loading">...</span>
      <span v-else class="refresh-text">刷新</span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps({
  connected: {
    type: Boolean,
    default: false
  },
  currentStation: {
    type: Object,
    default: null
  },
  isBusy: {
    type: Boolean,
    default: false
  },
  showPrimaryBadge: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['prev', 'next', 'refresh', 'open-list'])

const nameWrapper = ref(null)
const needsScroll = ref(false)

// 检测文字是否超出容器宽度，超出才启动滚动动画
async function checkOverflow() {
  await nextTick()
  if (!nameWrapper.value) return
  const wrapper = nameWrapper.value
  const firstCopy = wrapper.querySelector('.station-name-copy')
  if (!firstCopy) return
  needsScroll.value = firstCopy.offsetWidth > wrapper.clientWidth
}

onMounted(() => checkOverflow())

watch(
  () => props.currentStation?.name,
  () => checkOverflow()
)

function handleOpenList() {
  if (!props.connected || !props.currentStation) return
  emit('open-list')
}
</script>

<style scoped>
.station-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.station-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-secondary);
  background: var(--bg-card);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.station-btn:hover:not(:disabled) {
  background: var(--bg-table-hover);
  color: var(--text-primary);
}

.station-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.station-info {
  width: 140px;
  text-align: center;
  overflow: hidden;
}

.station-name {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
  white-space: nowrap;
}

.station-name.clickable {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  justify-content: center;
}

/* 针对信道名称的长文本处理 - 无缝循环滚动方案 */
.station-name-wrapper {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
}

/* 滚动轨道：不滚动时居中，滚动时左对齐 */
.station-name-scroll {
  display: inline-flex;
  white-space: nowrap;
}

/* 每份文本副本 */
.station-name-copy {
  display: inline-block;
  white-space: nowrap;
}

/* 滚动时两份 copy 之间需要间距，保证总宽 = 2 * 单份宽，-50% 才能精确无缝 */
.station-name-scroll.is-scrolling .station-name-copy {
  padding-right: 40px;
}

/* 启动滚动：左对齐 + 动画，移动 50% 正好是一份内容（文字+间距）的距离，精确无缝循环 */
.station-name-scroll.is-scrolling {
  align-self: flex-start;
  animation: marquee-scroll 8s linear infinite;
}

@keyframes marquee-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    /* 两份 copy 宽度完全相同，-50% 精确等于一份内容宽度，无缝衔接 */
    transform: translateX(-50%);
  }
}

.refresh-btn {
  font-size: 0.8rem !important;
  width: 44px !important; /* 固定宽度，防止"刷新"变"..."时抖动 */
  padding: 0 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.refresh-loading {
  letter-spacing: 2px;
}

.refresh-text {
  display: block;
}

.station-name.clickable:hover {
  color: var(--color-success);
}

.dropdown-arrow {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

/* 主服务器标签样式 - 与 user-uid 同款绿色 */
.primary-badge {
  background: rgba(103, 194, 58, 0.15);
  color: var(--color-success);
  font-size: 0.7rem;
  padding: 0.1rem 0.1rem;
  border-radius: 2px;
  font-weight: 700;
  margin-left: 0.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  min-height: 1rem;
}

.station-loading {
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.station-disconnected {
  color: var(--text-disabled);
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .station-btn {
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
  }

  .station-info {
    min-width: 80px;
  }

  .station-name {
    font-size: 1rem;
  }
}
</style>
