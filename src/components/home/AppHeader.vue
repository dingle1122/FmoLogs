<template>
  <header class="header">
    <div class="header-left">
      <img src="/vite.svg" alt="FMO Logs" class="header-logo" @click="$emit('open-nav-menu')" />
      <span class="header-divider"></span>
      <h1 class="header-title" @click="$emit('open-nav-menu')">FMO 日志查看器</h1>
      <span class="total-logs">
        <strong>&#11088; {{ todayLogs }}/{{ totalLogs }}</strong>
        <template v-if="uniqueCallsigns > 0">
          <span class="unique-count">({{ uniqueCallsigns }}人)</span>
        </template>
      </span>
      <span
        v-if="currentStationName"
        class="station-tag"
        title="当前信道"
        @click="$emit('open-channel-list')"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="station-icon">
          <path
            d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
          />
        </svg>
        <marquee-scroll :text="currentStationName" :speed="35" class="station-name-scroller" />
      </span>
    </div>
    <nav class="header-nav">
      <router-link v-for="route in NAV_ROUTES" :key="route.path" :to="route.path" class="nav-tab">
        {{ route.label }}
        <span v-if="route.type === 'messages' && hasUnreadMessages" class="unread-badge"></span>
      </router-link>
    </nav>
    <div class="header-actions">
      <button class="icon-btn" title="设置" @click="router.push('/settings')">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path
            d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router'
import MarqueeScroll from '../MarqueeScroll.vue'
import { NAV_ROUTES } from './constants'

const router = useRouter()

const props = defineProps({
  todayLogs: {
    type: Number,
    default: 0
  },
  totalLogs: {
    type: Number,
    default: 0
  },
  uniqueCallsigns: {
    type: Number,
    default: 0
  },
  dbLoaded: {
    type: Boolean,
    default: false
  },
  hasUnreadMessages: {
    type: Boolean,
    default: false
  },
  currentStationName: {
    type: String,
    default: ''
  }
})

defineEmits(['open-nav-menu', 'open-channel-list'])
</script>

<style scoped>
.header {
  flex-shrink: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  gap: 1.5rem;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.header-title {
  margin: 0;
  font-size: 1.1rem;
  cursor: pointer;
  transition: color 0.2s;
}

@media (hover: hover) {
  .header-title:hover {
    color: var(--component-header-title-hover);
  }

  .header-logo:hover {
    opacity: 0.8;
  }

  .station-tag:hover {
    background: var(--border-light);
    border-color: var(--component-header-station-hover-border);
  }
}

.header-logo {
  display: none;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.2s;
}

.header-logo:hover {
  opacity: 0.8;
}

.header-divider {
  display: none;
  width: 1px;
  height: 20px;
  background: var(--border-light);
  flex-shrink: 0;
}

.total-logs {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.total-logs strong {
  font-weight: 600;
}

.unique-count {
  font-weight: 600;
}

.station-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.6rem;
  background: var(--bg-table-hover);
  border-radius: 12px;
  font-size: 0.85rem;
  color: var(--component-header-station-text);
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.2s;
  width: 120px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.station-tag:hover {
  background: var(--border-light);
  border-color: var(--component-header-station-hover-border);
}

.station-icon {
  flex-shrink: 0;
  opacity: 0.8;
  z-index: 2;
  background: inherit;
  position: relative;
  padding-right: 2px;
}

/* 跑马灯滚动容器 */
.station-name-scroller {
  flex: 1;
  min-width: 0;
}

:deep(.marquee-content) {
  font-weight: 500;
}

.callsign-icon {
  font-size: 1.2rem;
}

.header-nav {
  display: flex;
  gap: 0;
  align-items: center;
}

.nav-tab {
  position: relative;
  background: none;
  border: none;
  border-radius: 0;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  font-family: inherit;
  text-decoration: none;
  display: inline-block;
}

@media (hover: hover) {
  .nav-tab:hover:not(.disabled) {
    color: var(--component-header-nav-hover-text);
    background: none;
  }
}

.nav-tab.router-link-active {
  color: var(--component-header-nav-active-text);
}

.nav-tab.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -0.75rem;
  left: 0.5rem;
  right: 0.5rem;
  height: 2px;
  background: var(--component-header-nav-active-indicator);
  border-radius: 1px 1px 0 0;
}

.nav-tab.disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  pointer-events: none;
}

.unread-badge {
  position: absolute;
  top: 0.35rem;
  right: 0.25rem;
  width: 7px;
  height: 7px;
  background: var(--brand-danger-strong);
  border-radius: 50%;
  border: 1.5px solid var(--bg-header, var(--bg-page));
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  color: var(--text-secondary);
  border-radius: 4px;
  text-decoration: none;
}

@media (hover: hover) {
  .icon-btn:hover {
    background: var(--bg-table-hover);
    color: var(--component-header-action-hover-text);
  }
}

@media (max-width: 768px) {
  .header {
    padding: 0.5rem 0.75rem;
  }

  .header-title {
    display: none;
  }

  .header-logo {
    display: block;
  }

  .header-divider {
    display: block;
  }

  .header-left {
    gap: 0.5rem;
  }

  .header-nav {
    display: none;
  }

  .total-logs {
    font-size: 0.95rem;
  }
}

@media (max-width: 480px) {
  .header-title {
    display: none;
  }
}
</style>
