<template>
  <div class="friend-links-view">
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-state">
      <span>{{ error }}</span>
    </div>

    <!-- 分类分组展示 -->
    <template v-else>
      <div v-for="group in groupedLinks" :key="group.category || 'default'" class="link-group">
        <h3 v-if="group.category" class="group-title">{{ group.category }}</h3>
        <div class="links-card-grid">
          <a
            v-for="link in group.items"
            :key="link.id"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="link-card"
            :class="{ disabled: link.disabled }"
            :title="link.description"
          >
            <div class="link-icon">
              <template v-if="link.icon.type === 'emoji'">
                {{ link.icon.content }}
              </template>
              <template v-else-if="link.icon.type === 'svg'">
                <span v-html="link.icon.content"></span>
              </template>
              <template v-else-if="link.icon.type === 'url'">
                <img :src="link.icon.content" :alt="link.name" />
              </template>
            </div>
            <div class="link-info">
              <div class="link-name">
                {{ link.name }}
              </div>
              <div v-if="link.description" class="link-description">{{ link.description }}</div>
            </div>
            <div class="link-arrow">&rarr;</div>
          </a>
        </div>
      </div>
      <div v-if="rssSource" class="rss-source">
        数据来源：<a :href="rssSource" target="_blank" rel="noopener noreferrer">{{ rssSource }}</a>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchFriendLinks, getRssSourceUrl } from '../components/home/modals/friendLinks'

const friendLinksList = ref([])
const loading = ref(true)
const error = ref(null)
const rssSource = ref(null)

onMounted(async () => {
  try {
    const result = await fetchFriendLinks()
    friendLinksList.value = result.links
    if (result.fromRss) {
      rssSource.value = getRssSourceUrl()
    }
  } catch (e) {
    error.value = '加载失败'
    console.error(e)
  } finally {
    loading.value = false
  }
})

// 按分类分组
const groupedLinks = computed(() => {
  const groups = {}
  const defaultCategory = '__default__'

  for (const link of friendLinksList.value) {
    const category = link.tag || defaultCategory
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(link)
  }

  // 转换为数组，有分类的放前面，无分类的放最后
  const result = []
  for (const [category, items] of Object.entries(groups)) {
    if (category !== defaultCategory) {
      result.push({ category, items })
    }
  }
  if (groups[defaultCategory]) {
    result.push({ category: '其他', items: groups[defaultCategory] })
  }

  return result
})
</script>

<style scoped>
.friend-links-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-secondary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.rss-source {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
  text-align: center;
}

.rss-source a {
  color: var(--color-primary);
  text-decoration: none;
}

.rss-source a:hover {
  text-decoration: underline;
}

.link-group {
  margin-bottom: 1.5rem;
}

.link-group:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
  padding-left: 0.6rem;
  border-left: 3px solid var(--color-primary);
}

.links-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.link-card {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

@media (hover: hover) {
  .link-card:hover {
    transform: translateY(-4px);
    border-color: var(--color-primary);
    box-shadow: 0 8px 16px var(--shadow-card);
    background: var(--bg-table-hover);
  }
}

.link-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.link-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
  border-radius: 10px;
  font-size: 1.4rem;
  margin-right: 1rem;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
  overflow: hidden;
}

.link-icon svg {
  width: 100%;
  height: 100%;
}

.link-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.link-info {
  flex: 1;
  min-width: 0;
}

.link-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
  margin-bottom: 0.2rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-description {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.link-url {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-family: monospace;
}

.link-arrow {
  font-size: 1.2rem;
  color: var(--text-disabled);
  transition: all 0.3s;
  margin-left: 0.5rem;
  opacity: 0.3;
}

@media (hover: hover) {
  .link-card:hover .link-arrow {
    color: var(--color-primary);
    transform: translateX(3px);
    opacity: 1;
  }
}
</style>
