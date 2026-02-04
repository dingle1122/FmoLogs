<template>
  <div class="query-section">
    <div class="query-row">
      <div class="query-types">
        <label v-for="(name, type) in QueryTypeNames" :key="type">
          <input
            :checked="currentQueryType === type"
            type="radio"
            :value="type"
            :disabled="!dbLoaded"
            @change="handleTypeChange(type)"
          />
          {{ name }}
        </label>
      </div>
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
  </div>
</template>

<script setup>
import { QueryTypeNames } from './constants'
import DatePicker from '../common/DatePicker.vue'

defineProps({
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

const emit = defineEmits([
  'update:currentQueryType',
  'update:searchKeyword',
  'update:oldFriendsSearchKeyword',
  'update:filterDate'
])

function handleTypeChange(type) {
  emit('update:currentQueryType', type)
}
</script>

<style scoped>
.query-section {
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.query-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.query-types {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.query-types label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
}

.query-types input:disabled + span {
  color: var(--text-disabled);
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-box {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
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

@media (max-width: 768px) {
  .query-types {
    gap: 1rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .query-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-controls {
    width: 100%;
  }

  .search-box input {
    width: 100%;
    flex: 1;
  }
}
</style>
