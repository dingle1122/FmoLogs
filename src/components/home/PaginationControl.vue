<template>
  <div class="pagination">
    <button
      :disabled="disabled || currentPage === 1"
      class="hidden-on-small"
      @click="$emit('page-change', 1)"
    >
      首页
    </button>
    <button
      :disabled="disabled || currentPage === 1"
      @click="$emit('page-change', currentPage - 1)"
    >
      上一页
    </button>
    <span class="page-info">
      第 {{ currentPage }} / {{ totalPages }} 页
      <template v-if="totalRecords !== undefined"> (共 {{ totalRecords }} 条) </template>
    </span>
    <button
      :disabled="disabled || currentPage === totalPages || totalPages === 0"
      @click="$emit('page-change', currentPage + 1)"
    >
      下一页
    </button>
    <button
      :disabled="disabled || currentPage === totalPages || totalPages === 0"
      class="hidden-on-small"
      @click="$emit('page-change', totalPages)"
    >
      末页
    </button>
  </div>
</template>

<script setup>
defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  totalRecords: {
    type: Number,
    default: undefined
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['page-change'])
</script>

<style scoped>
.pagination {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  background: var(--bg-container);
  border-top: 1px solid var(--border-light);
  flex-wrap: nowrap;
  min-height: 50px;
}

.pagination button {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  background: var(--bg-container);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--text-primary);
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-table-hover);
}

.pagination button:disabled {
  color: var(--text-disabled);
  cursor: not-allowed;
}

.page-info {
  margin: 0 1rem;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .pagination {
    display: none;
  }
}

@media (max-width: 480px) {
  .page-info {
    font-size: 0.8rem;
    margin: 0 0.5rem;
  }
}
</style>
