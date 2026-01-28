<template>
  <div class="old-friends-container">
    <div v-if="!dbLoaded" class="empty-hint">请点击右上角设置图标选择日志目录</div>
    <template v-else-if="oldFriendsResult && oldFriendsResult.data.length > 0">
      <div class="old-friends-grid">
        <div
          v-for="(item, index) in oldFriendsResult.data"
          :key="'friend-' + index"
          class="friend-card"
          :class="{ 'today-contact': isTodayContact(item.latestTime) }"
          @click="$emit('show-records', item.toCallsign)"
        >
          <div class="friend-header">
            <div class="friend-callsign">
              {{ item.toCallsign || '-' }}
              <span class="contact-count">（{{ item.count }}）</span>
            </div>
            <div class="friend-grid">{{ item.toGrid || '-' }}</div>
          </div>
          <div class="friend-time">
            <div class="time-label">首次：{{ formatTimestamp(item.firstTime) }}</div>
            <div class="time-label">最新：{{ formatTimestamp(item.latestTime) }}</div>
          </div>
        </div>
      </div>
    </template>
    <div v-else-if="oldFriendsResult" class="empty-hint">暂无数据</div>
  </div>
</template>

<script setup>
import { formatTimestamp, isTodayContact } from './constants'

defineProps({
  oldFriendsResult: {
    type: Object,
    default: null
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['show-records'])
</script>

<style scoped>
.old-friends-container {
  flex: 1;
  overflow: auto;
  margin-top: 1rem;
}

.empty-hint {
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

.old-friends-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
}

.friend-card {
  background: var(--bg-friend-card);
  border: 1px solid var(--border-friend-card);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  cursor: pointer;
}

.friend-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-card);
}

.friend-card.today-contact {
  background: var(--bg-today-card);
  border-color: var(--border-today-card);
}

.friend-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.friend-callsign {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.contact-count {
  font-weight: normal;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.friend-grid {
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.friend-time {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.friend-time .time-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 1024px) {
  .old-friends-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .old-friends-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .old-friends-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .friend-card {
    padding: 0.6rem;
  }

  .friend-callsign {
    font-size: 1rem;
  }

  .friend-grid {
    font-size: 0.75rem;
  }

  .friend-time {
    font-size: 0.8rem;
  }
}
</style>
