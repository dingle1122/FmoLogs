<template>
  <div
    v-if="fmoAddress && (eventsConnected || speakingHistory.length > 0)"
    class="speaking-bar"
    @click="$emit('click')"
  >
    <div class="speaking-bar-content">
      <span v-if="currentSpeaker" class="speaking-indicator speaking"></span>
      <span v-else class="speaking-indicator idle"></span>
      <span class="speaking-text">
        <template v-if="currentSpeaker">
          <template v-if="multiSelectMode">
            <!-- 多选模式：显示所有服务器的当前发言者，格式：呼号[标记]、呼号[标记] -->
            正在发言:
            <span
              v-for="(speaker, index) in allCurrentSpeakers"
              :key="speaker.addressId"
              class="speaker-item"
            >
              <strong>{{ speaker.callsign }}[{{ getServerName(speaker.addressId) }}]</strong>
              <span v-if="speaker.callsign === selectedFromCallsign" class="self-tag">您</span>
              <span v-if="speaker.address" class="speaker-address">{{ speaker.address }}</span>
              <strong v-if="index < allCurrentSpeakers.length - 1">&nbsp;&nbsp;&nbsp;&nbsp;</strong>
            </span>
          </template>
          <template v-else>
            <!-- 单选模式：只显示当前发言者，不加标记 -->
            正在发言: <strong>{{ currentSpeaker }}</strong>
            <span v-if="currentSpeaker === selectedFromCallsign" class="self-tag">您</span>
            <span v-if="currentSpeakerAddress" class="speaker-address">{{
              currentSpeakerAddress
            }}</span>
          </template>
        </template>
        <template v-else> 当前无人发言 </template>
      </span>
      <button
        class="audio-toggle-btn"
        :class="{ playing: isAudioPlaying, muted: isAudioMuted }"
        :title="isAudioPlaying ? (isAudioMuted ? '已静音' : '停止播放') : '播放音频'"
        @click.stop="$emit('toggle-audio')"
      >
        <span class="audio-icon">{{ isAudioPlaying ? '■' : '▶' }}</span>
      </button>
      <span class="speaking-expand">点击展开</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  currentSpeaker: {
    type: String,
    default: ''
  },
  currentSpeakerAddress: {
    type: String,
    default: ''
  },
  speakingHistory: {
    type: Array,
    default: () => []
  },
  fmoAddress: {
    type: String,
    default: ''
  },
  eventsConnected: {
    type: Boolean,
    default: false
  },
  selectedFromCallsign: {
    type: String,
    default: ''
  },
  allCurrentSpeakers: {
    type: Array,
    default: () => []
  },
  // 元素结构: { addressId, callsign, address }
  addressList: {
    type: Array,
    default: () => []
  },
  multiSelectMode: {
    type: Boolean,
    default: false
  },
  activeAddressId: {
    type: String,
    default: ''
  },
  isAudioPlaying: {
    type: Boolean,
    default: false
  },
  isAudioMuted: {
    type: Boolean,
    default: false
  }
})

// 根据 addressId 获取服务器显示名称
function getServerName(addressId) {
  // 主服务器显示"主"
  if (addressId === props.activeAddressId) return '主'
  const address = props.addressList.find((a) => a.id === addressId)
  if (!address) return '?'
  // 显示 numId，如果没有则降级显示在列表中的 index+1
  if (address.numId) return address.numId.toString()
  const index = props.addressList.findIndex((a) => a.id === addressId)
  return index !== -1 ? (index + 1).toString() : '?'
}

defineEmits(['click', 'toggle-audio'])
</script>

<style scoped>
.speaking-bar {
  flex-shrink: 0;
  background: var(--bg-speaking-bar);
  border-bottom: 2px solid var(--border-speaking-bar);
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.speaking-bar:hover {
  background: var(--bg-today-card);
}

.speaking-bar-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 1.5rem;
}

.speaking-indicator {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.speaking-indicator.speaking {
  background: var(--color-speaking);
  animation: pulse 1.5s infinite;
}

.speaking-indicator.idle {
  background: var(--text-disabled);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.speaking-text {
  flex: 1;
  font-size: 1.1rem;
  color: var(--text-primary);
  line-height: 1.3rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speaking-text strong {
  color: var(--color-speaking);
  font-weight: 700;
  font-size: 1.1rem;
}

.speaking-expand {
  font-size: 1rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* 音频播放按钮 */
.audio-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.audio-toggle-btn:hover {
  background-color: var(--bg-table-hover);
}

.audio-toggle-btn .audio-icon {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 播放中状态 */
.audio-toggle-btn.playing .audio-icon {
  color: var(--color-speaking);
}

/* 静音状态 */
.audio-toggle-btn.muted .audio-icon {
  color: var(--text-disabled);
}

/* 发言者项样式 */
.speaker-item {
  display: inline;
}

/* 当前用户标签样式 */
.self-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
  font-weight: 600;
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-speaking);
  line-height: 1;
  margin-left: 0.2em;
}

/* 地址显示样式 */
.speaker-address {
  display: inline;
  font-size: 0.85em;
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 0.3em;
}

@media (max-width: 768px) {
  .speaking-bar {
    padding: 0.4rem 0.75rem;
  }

  .speaking-bar-content {
    min-height: 2rem;
  }

  .speaking-text {
    font-size: 1.1rem;
  }

  .speaking-text strong {
    font-size: 1.3rem;
  }

  .speaking-expand {
    font-size: 0.9rem;
  }

  .audio-toggle-btn {
    width: 32px;
    height: 32px;
  }

  .audio-toggle-btn .audio-icon {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .speaking-bar {
    padding: 0.35rem 0.5rem;
  }

  .speaking-bar-content {
    gap: 0.5rem;
    min-height: 1.8rem;
  }

  .speaking-indicator {
    width: 14px;
    height: 14px;
  }

  .speaking-text {
    font-size: 1rem;
  }

  .speaking-text strong {
    font-size: 1.2rem;
  }

  .speaking-expand {
    font-size: 0.85rem;
  }

  .audio-toggle-btn {
    width: 28px;
    height: 28px;
  }

  .audio-toggle-btn .audio-icon {
    font-size: 0.85rem;
  }
}
</style>
