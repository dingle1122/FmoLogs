<template>
  <div class="about-view">
    <div class="about-header">
      <div class="about-left">
        <img src="/vite.svg" alt="FmoLogs" class="about-logo" />
        <div class="about-title">FmoLogs</div>
        <div class="about-version">{{ appVersion }}</div>
      </div>
      <div class="about-description">
        <p>
          本地化、离线优先的 FMO
          日志管理工具，支持本地导入日志文件、远程同步通联记录、数据查询与统计分析。
        </p>
        <p>所有数据存储在浏览器 IndexedDB 中，无需服务器，保障隐私安全。</p>
        <p class="about-links-text">
          <a
            href="https://github.com/dingle1122/FmoLogs"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-link"
          >
            GitHub 仓库
          </a>
          ·
          <a
            href="https://github.com/dingle1122/FmoLogs/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-link"
          >
            问题反馈
          </a>
        </p>
      </div>
    </div>

    <div class="about-thanks">
      <div class="thanks-title">特别感谢</div>
      <div class="thanks-list">
        <div v-for="person in thanksList" :key="person.name" class="thanks-item">
          <strong>{{ person.name }}</strong> - {{ person.contribution }}
        </div>
      </div>
    </div>

    <div class="about-footer">由 BH5HSJ 后视镜 贡献</div>
    <div class="about-footer">开源项目 · 欢迎贡献</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import packageInfo from '../../package.json'

const appVersion = computed(() => `v${packageInfo.version}`)

const thanksList = [
  { name: 'BG5ESN', contribution: '提供完美的FMO硬件平台' },
  { name: 'BG9JYT', contribution: '提供甘肃集群服务器，并提供被控支持' },
  { name: 'BG2LRU、BD6JDU、BI3SQP等各位友台', contribution: '提供宝贵的想法和建议' }
]
</script>

<style scoped>
.about-view {
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.about-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.25rem;
  width: 100%;
  max-width: 500px;
}

.about-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
}

.about-logo {
  width: 64px;
  height: 64px;
}

.about-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}

.about-version {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: monospace;
  background: var(--bg-input);
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
}

.about-description {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
  text-align: left;
}

.about-description p {
  margin: 0 0 0.6rem 0;
}

.about-description p:last-child {
  margin-bottom: 0;
}

.about-links-text {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-light);
}

.inline-link {
  color: var(--color-primary);
  text-decoration: none;
  transition: all 0.2s;
  font-weight: 500;
}

.inline-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.about-thanks {
  width: 100%;
  max-width: 500px;
  margin-bottom: 1.25rem;
}

.thanks-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.6rem;
  text-align: center;
}

.thanks-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.thanks-item {
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 0.3rem;
}

.thanks-item:last-child {
  margin-bottom: 0;
}

.about-footer {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: auto;
  padding-top: 0.75rem;
}
</style>
