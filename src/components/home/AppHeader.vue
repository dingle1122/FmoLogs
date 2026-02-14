<template>
  <header class="header">
    <div class="header-left">
      <h1>FMO 日志查看器</h1>
      <span class="total-logs">
        <span class="star">&#11088;</span>
        <strong>{{ todayLogs }}/{{ totalLogs }}</strong>
      </span>
      <span v-if="uniqueCallsigns > 0" class="total-logs">
        <span class="callsign-icon">&#128225;</span>
        <strong>{{ uniqueCallsigns }}</strong>
      </span>
    </div>
    <nav class="header-nav">
      <button
        v-for="(name, type) in QueryTypeNames"
        :key="type"
        class="nav-tab"
        :class="{ active: currentQueryType === type }"
        :disabled="!dbLoaded"
        @click="$emit('query-type-change', type)"
      >
        {{ name }}
      </button>
    </nav>
    <div class="header-actions">
      <a
        href="https://github.com/dingle1122/FmoLogs"
        target="_blank"
        rel="noopener noreferrer"
        class="icon-btn"
        title="GitHub"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path
            d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
          />
        </svg>
      </a>
      <button class="icon-btn" title="设置" @click="$emit('open-settings')">
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
import { QueryTypeNames } from './constants'

defineProps({
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
  currentQueryType: {
    type: String,
    default: 'all'
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['open-settings', 'query-type-change'])
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

.header h1 {
  margin: 0;
  font-size: 1.1rem;
}

.total-logs {
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.star {
  font-size: 1.5rem;
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
}

.nav-tab:hover:not(:disabled) {
  color: var(--color-primary);
  background: none;
}

.nav-tab.active {
  color: var(--color-primary);
}

.nav-tab.active::after {
  content: '';
  position: absolute;
  bottom: -0.75rem;
  left: 0.5rem;
  right: 0.5rem;
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px 1px 0 0;
}

.nav-tab:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
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

.icon-btn:hover {
  background: var(--bg-table-hover);
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .header {
    padding: 0.5rem 0.75rem;
  }

  .header h1 {
    font-size: 1.1rem;
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

  .star {
    font-size: 1.2rem;
  }

  .callsign-icon {
    font-size: 1.1rem;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1rem;
  }
}
</style>
