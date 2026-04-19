<template>
  <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-quick-nav">
      <div class="modal-header">
        <h3>页面导航</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>
      <div class="modal-body">
        <nav class="nav-list">
          <router-link
            v-for="route in NAV_ROUTES"
            :key="route.path"
            :to="dbLoaded || route.type === 'messages' ? route.path : $route.path"
            class="nav-item"
            :class="{
              active: currentRoute === route.path,
              disabled: !dbLoaded && route.type !== 'messages'
            }"
            @click="handleNavClick(route)"
          >
            <SvgIcon :name="route.icon" :size="20" class="nav-icon" />
            <span class="nav-label">{{ route.label }}</span>
            <span v-if="!dbLoaded && route.type !== 'messages'" class="need-db-badge">需数据</span>
          </router-link>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NAV_ROUTES } from '../constants'
import SvgIcon from '../../common/SvgIcon.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const route = useRoute()

const currentRoute = computed(() => route.path)

function handleNavClick(routeItem) {
  if (!props.dbLoaded && routeItem.type !== 'messages') {
    return
  }
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.modal {
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-quick-nav {
  width: 320px;
  max-width: 90%;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 2px solid rgba(103, 194, 58, 0.3);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-success);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: var(--text-secondary);
}

.modal-body {
  padding: 1rem;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s;
  cursor: pointer;
  border: 1px solid transparent;
}

.nav-item:hover:not(.disabled) {
  background: var(--bg-table-hover);
  color: var(--text-primary);
  border-color: var(--color-success);
}

.nav-item.active {
  background: rgba(103, 194, 58, 0.08);
  color: var(--color-success);
  border-color: var(--color-success);
  font-weight: 500;
}

.nav-item.disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
  opacity: 0.7;
  pointer-events: none;
}

.nav-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.nav-item.active .nav-icon {
  color: var(--color-success);
}

.nav-label {
  flex: 1;
  font-size: 0.95rem;
}

.need-db-badge {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  background: var(--bg-table-hover);
  color: var(--text-tertiary);
  border-radius: 3px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .modal-quick-nav {
    width: 280px;
  }

  .nav-item {
    padding: 0.75rem 0.875rem;
  }

  .nav-label {
    font-size: 0.9rem;
  }
}
</style>
