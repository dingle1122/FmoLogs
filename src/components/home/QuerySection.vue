<template>
  <div v-if="hasFilters" class="query-section">
    <div class="filter-controls">
      <div v-if="currentQueryType === 'all'" class="search-box">
        <input
          :value="searchKeyword"
          type="text"
          placeholder="接收方呼号"
          :disabled="!dbLoaded"
          @input="$emit('update:searchKeyword', $event.target.value)"
        />
      </div>
      <div v-if="currentQueryType === 'all'" class="date-filter">
        <DatePicker
          :model-value="filterDate"
          :from-callsign="fromCallsign"
          placeholder="筛选日期"
          @update:model-value="$emit('update:filterDate', $event)"
        />
      </div>
      <div v-if="currentQueryType === 'oldFriends'" class="search-box">
        <input
          :value="oldFriendsSearchKeyword"
          type="text"
          placeholder="搜索呼号"
          :disabled="!dbLoaded"
          @input="$emit('update:oldFriendsSearchKeyword', $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DatePicker from '../common/DatePicker.vue'

const props = defineProps({
  currentQueryType: {
    type: String,
    required: true
  },
  searchKeyword: {
    type: String,
    default: ''
  },
  oldFriendsSearchKeyword: {
    type: String,
    default: ''
  },
  filterDate: {
    type: String,
    default: null
  },
  fromCallsign: {
    type: String,
    default: null
  },
  dbLoaded: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:searchKeyword', 'update:oldFriendsSearchKeyword', 'update:filterDate'])

const hasFilters = computed(() => {
  return props.currentQueryType === 'all' || props.currentQueryType === 'oldFriends'
})
</script>

<style scoped>
.query-section {
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
}

.search-box {
  display: flex;
  align-items: center;
}

.search-box input {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  width: 120px;
  height: 32px;
  box-sizing: border-box;
  background: var(--bg-input);
  color: var(--text-primary);
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.date-filter {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .filter-controls {
    width: 100%;
  }

  .search-box input {
    width: 100%;
    flex: 1;
  }
}
</style>
