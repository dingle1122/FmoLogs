<template>
  <div class="about-view">
    <h1 class="page-title">关于</h1>
    <div class="about-header">
      <div class="about-left">
        <img src="/vite.svg" alt="FmoLogs" class="about-logo" />
        <div class="about-title">FmoLogs</div>
        <div class="about-version">{{ appVersion }}</div>
      </div>
      <div class="about-description">
        <p>
          FmoLogs 是一款 FMO
          通联日志管理工具，支持导入本地日志文件、实时同步远程通联记录，还能查询和统计通联数据。
        </p>
        <p>所有数据都保存在你的设备中，不上传云端，充分保护隐私安全。</p>
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

    <div v-if="sponsorList.length > 0" class="about-sponsors">
      <div class="sponsors-title">赞助名单</div>
      <div class="sponsors-list">
        <span v-for="sponsor in sponsorList" :key="sponsor" class="sponsor-tag">{{ sponsor }}</span>
      </div>
    </div>

    <div class="about-coffee">
      <div class="coffee-toggle" @click="showCoffee = !showCoffee">
        <span>请作者喝杯咖啡</span>
      </div>
      <div v-if="showCoffee" class="coffee-content">
        <p class="coffee-hint">如果这个项目对你有帮助，欢迎支持一下</p>
        <div class="coffee-qrcode-list">
          <div class="coffee-item">
            <div class="coffee-qrcode-wrap">
              <img src="/coffee/wechat.png" alt="微信收款码" class="coffee-qrcode" />
            </div>
            <span class="coffee-label">微信支付</span>
          </div>
          <div class="coffee-item">
            <div class="coffee-qrcode-wrap">
              <img src="/coffee/alipay.png" alt="支付宝收款码" class="coffee-qrcode" />
            </div>
            <span class="coffee-label">支付宝</span>
          </div>
        </div>
      </div>
    </div>

    <div class="about-footer">
      <p>由 BH5HSJ 后视镜 贡献</p>
      <p>开源项目 · 欢迎贡献</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import packageInfo from '../../package.json'
import sponsorList from '../data/sponsors.json'
import thanksList from '../data/thanks.json'

const appVersion = computed(() => `v${packageInfo.version}`)

const showCoffee = ref(false)
</script>

<style scoped>
.about-view {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 1.5rem;
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
  background: var(--bg-table-header);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 1rem 1.25rem;
}

.thanks-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.2rem;
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

.about-coffee {
  width: 100%;
  max-width: 500px;
  margin-bottom: 1.25rem;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  overflow: hidden;
}

.coffee-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.coffee-content {
  padding: 0 1.25rem 1.25rem;
}

.coffee-hint {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin: 0 0 0.75rem 0;
}

.coffee-qrcode-list {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.coffee-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.coffee-qrcode-wrap {
  width: 140px;
  height: 140px;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.coffee-qrcode {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.coffee-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.about-sponsors {
  width: 100%;
  max-width: 500px;
  margin-bottom: 1.25rem;
  text-align: center;
}

.sponsors-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.sponsors-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

.sponsor-tag {
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-table-header);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 0.3rem 0.75rem;
}

.about-footer {
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-top: auto;
  padding-top: 0.75rem;
}
</style>
