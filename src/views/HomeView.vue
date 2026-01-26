<template>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <h1>FMO 日志查看器</h1>
        <span class="total-logs"
          ><span class="star">&#11088;</span> <strong>{{ todayLogs }}/{{ totalLogs }}</strong></span
        >
        <span v-if="uniqueCallsigns > 0" class="total-logs"
          ><span class="callsign-icon">&#128225;</span> <strong>{{ uniqueCallsigns }}</strong></span
        >
      </div>
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
        <button class="icon-btn" title="设置" @click="showSettings = true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path
              d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
            />
          </svg>
        </button>
      </div>
    </header>

    <div class="content-area">
      <div v-if="autoSyncMessage" class="auto-sync-hint">
        {{ autoSyncMessage }}
      </div>
      <div v-if="loading" class="loading">
        <template v-if="importProgress">
          正在导入数据... {{ importProgress.current }} / {{ importProgress.total }}
        </template>
        <template v-else> 加载中... </template>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div class="query-section">
        <div class="query-row">
          <div class="query-types">
            <label v-for="(name, type) in QueryTypeNames" :key="type">
              <input
                v-model="currentQueryType"
                type="radio"
                :value="type"
                :disabled="!dbLoaded"
                @change="handleQueryTypeChange"
              />
              {{ name }}
            </label>
          </div>
          <div class="filter-controls">
            <div v-if="currentQueryType === 'all'" class="search-box">
              <input
                v-model="searchKeyword"
                type="text"
                placeholder="接收方呼号"
                :disabled="!dbLoaded"
                @input="onSearchInput"
              />
            </div>
            <div v-if="currentQueryType === 'oldFriends'" class="search-box">
              <input
                v-model="oldFriendsSearchKeyword"
                type="text"
                placeholder="搜索呼号"
                :disabled="!dbLoaded"
                @input="onOldFriendsSearchInput"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- TOP20汇总视图 -->
      <div v-if="currentQueryType === 'top20Summary'" class="top20-container">
        <div v-if="!dbLoaded" class="empty-hint">请点击右上角设置图标选择日志目录</div>
        <template v-else-if="top20Result">
          <div class="top20-card">
            <h3>接收方呼号 TOP100</h3>
            <div class="top20-list">
              <div
                v-for="(item, index) in top20Result.toCallsign"
                :key="'callsign-' + index"
                class="top20-item"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name">{{ item.toCallsign || '-' }}</span>
                <span class="count"
                  ><strong>{{ item.count }}</strong></span
                >
              </div>
              <div v-if="top20Result.toCallsign.length === 0" class="empty-item">暂无数据</div>
            </div>
          </div>
          <div class="top20-card">
            <h3>接收网格 TOP20</h3>
            <div class="top20-list">
              <div
                v-for="(item, index) in top20Result.toGrid"
                :key="'grid-' + index"
                class="top20-item"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name">{{ item.toGrid || '-' }}</span>
                <span class="count"
                  ><strong>{{ item.count }}</strong></span
                >
              </div>
              <div v-if="top20Result.toGrid.length === 0" class="empty-item">暂无数据</div>
            </div>
          </div>
          <div class="top20-card">
            <h3>
              中继名称 TOP20
              <span
                class="info-icon"
                @mouseenter="handleMouseEnter"
                @mouseleave="handleMouseLeave"
                @click="toggleTooltip"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <div
                  v-if="showTooltip"
                  :class="tooltipClass"
                  :style="tooltipStyle"
                  @mouseenter="handleTooltipMouseEnter"
                  @mouseleave="handleTooltipMouseLeave"
                >
                  中继排名是根据导出的数据库信息进行排序的，存在被后续通联覆盖的情况。仅作娱乐性排名展示使用。
                </div>
              </span>
            </h3>
            <div class="top20-list">
              <div
                v-for="(item, index) in top20Result.relayName"
                :key="'relay-' + index"
                class="top20-item"
              >
                <span class="rank">{{ index + 1 }}</span>
                <span class="name"
                  >{{ item.relayName || '-'
                  }}<span class="relay-admin">（{{ item.relayAdmin }}）</span></span
                >
                <span class="count"
                  ><strong>{{ item.count }}</strong></span
                >
              </div>
              <div v-if="top20Result.relayName.length === 0" class="empty-item">暂无数据</div>
            </div>
          </div>
        </template>
      </div>

      <!-- 老朋友卡片视图 -->
      <div v-else-if="currentQueryType === 'oldFriends'" class="old-friends-container">
        <div v-if="!dbLoaded" class="empty-hint">请点击右上角设置图标选择日志目录</div>
        <template v-else-if="oldFriendsResult && oldFriendsResult.data.length > 0">
          <div class="old-friends-grid">
            <div
              v-for="(item, index) in oldFriendsResult.data"
              :key="'friend-' + index"
              class="friend-card"
              :class="{ 'today-contact': isTodayContact(item.latestTime) }"
              @click="showCallsignRecords(item.toCallsign)"
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

      <!-- 原有表格视图 -->
      <div v-else class="result-section">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="col in displayColumns" :key="col" :class="'col-' + col">
                {{ ColumnNames[col] || col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!dbLoaded" class="empty-row">
              <td :colspan="displayColumns.length" class="empty-cell">
                请点击右上角设置图标选择日志目录
              </td>
            </tr>
            <tr v-else-if="queryResult && queryResult.data.length === 0" class="empty-row">
              <td :colspan="displayColumns.length" class="empty-cell">暂无数据</td>
            </tr>
            <template v-else-if="queryResult">
              <tr
                v-for="(row, index) in queryResult.data"
                :key="index"
                :class="{ 'row-today': isTodayContact(row.timestamp) }"
                @click="showDetailModal(row)"
              >
                <td v-for="col in queryResult.columns" :key="col" :class="'col-' + col">
                  <template v-if="col === 'timestamp'">
                    <div class="timestamp-div">
                      <div>{{ formatDatePart(formatTimestamp(row[col])) }}</div>
                      <div>{{ formatTimePart(formatTimestamp(row[col])) }}</div>
                    </div>
                  </template>
                  <template v-else-if="col === 'dailyIndex'">
                    <div class="daily-index-cell">
                      <span
                        class="daily-index"
                        :class="{
                          'rank-1': row.dailyIndex === 1,
                          'rank-2': row.dailyIndex === 2,
                          'rank-3': row.dailyIndex === 3
                        }"
                        >{{ row.dailyIndex }}</span
                      >
                    </div>
                  </template>
                  <template v-else-if="col === 'freqHz'">
                    {{ formatFreqHz(row[col]) }}
                  </template>
                  <template v-else-if="col === 'relayName'">
                    <div class="relay-cell">
                      <div>{{ row.relayName }}</div>
                      <div class="relay-admin">（{{ row.relayAdmin }}）</div>
                    </div>
                  </template>
                  <template v-else-if="col === 'toCallsign'">
                    <div class="callsign-with-grid">
                      <div class="callsign-main">{{ row.toCallsign }}</div>
                      <div v-if="row.toGrid" class="callsign-grid">{{ row.toGrid }}</div>
                    </div>
                  </template>
                  <template v-else-if="col === 'fromCallsign'">
                    <div class="callsign-with-grid">
                      <div>{{ row.fromCallsign }}</div>
                      <div v-if="row.fromGrid" class="callsign-grid">{{ row.fromGrid }}</div>
                    </div>
                  </template>
                  <template v-else>
                    {{ row[col] }}
                  </template>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="currentQueryType === 'all'" class="pagination">
        <button
          :disabled="!dbLoaded || currentPage === 1"
          class="hidden-on-small"
          @click="goToPage(1)"
        >
          首页
        </button>
        <button :disabled="!dbLoaded || currentPage === 1" @click="goToPage(currentPage - 1)">
          上一页
        </button>
        <span class="page-info">
          第 {{ currentPage }} / {{ totalPages }} 页 (共 {{ totalRecords }} 条)
        </span>
        <button
          :disabled="!dbLoaded || currentPage === totalPages || totalPages === 0"
          @click="goToPage(currentPage + 1)"
        >
          下一页
        </button>
        <button
          :disabled="!dbLoaded || currentPage === totalPages || totalPages === 0"
          class="hidden-on-small"
          @click="goToPage(totalPages)"
        >
          末页
        </button>
      </div>

      <div v-if="currentQueryType === 'oldFriends' && oldFriendsResult" class="pagination">
        <button
          :disabled="!dbLoaded || oldFriendsPage === 1"
          class="hidden-on-small"
          @click="goToOldFriendsPage(1)"
        >
          首页
        </button>
        <button
          :disabled="!dbLoaded || oldFriendsPage === 1"
          @click="goToOldFriendsPage(oldFriendsPage - 1)"
        >
          上一页
        </button>
        <span class="page-info">
          第 {{ oldFriendsPage }} / {{ oldFriendsTotalPages }} 页 (共
          {{ oldFriendsResult.total }} 条)
        </span>
        <button
          :disabled="
            !dbLoaded || oldFriendsPage === oldFriendsTotalPages || oldFriendsTotalPages === 0
          "
          @click="goToOldFriendsPage(oldFriendsPage + 1)"
        >
          下一页
        </button>
        <button
          :disabled="
            !dbLoaded || oldFriendsPage === oldFriendsTotalPages || oldFriendsTotalPages === 0
          "
          class="hidden-on-small"
          @click="goToOldFriendsPage(oldFriendsTotalPages)"
        >
          末页
        </button>
      </div>
    </div>

    <!-- 详情弹框 -->
    <div v-if="showDetailModalFlag" class="modal-overlay" @click.self="showDetailModalFlag = false">
      <div class="modal modal-detail">
        <div class="modal-header">
          <h3>详细信息</h3>
          <button class="close-btn" @click="showDetailModalFlag = false">&times;</button>
        </div>
        <div class="modal-body">
          <div v-for="(value, key) in filteredSelectedRowData" :key="key" class="detail-item">
            <span class="detail-label">{{ ColumnNames[key] || key }}：</span>
            <span class="detail-value">
              <template v-if="key === 'timestamp'">
                {{ formatTimestamp(value) }}
              </template>
              <template v-else-if="key === 'freqHz'">
                {{ formatFreqHz(value) }}
              </template>
              <template v-else-if="key === 'relayName'">
                <div class="relay-cell">
                  <div>{{ value }}</div>
                  <div v-if="selectedRowData['relayAdmin']" class="relay-admin">
                    （{{ selectedRowData['relayAdmin'] }}）
                  </div>
                </div>
              </template>
              <template v-else>
                {{ value }}
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 通联记录弹框 -->
    <div v-if="showCallsignModal" class="modal-overlay" @click.self="showCallsignModal = false">
      <div class="modal modal-callsign-records">
        <div class="modal-header">
          <h3>与 {{ currentCallsign }} 的通联记录</h3>
          <button class="close-btn" @click="showCallsignModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="callsignRecords && callsignRecords.data.length > 0" class="record-cards-grid">
            <div
              v-for="(record, index) in callsignRecords.data"
              :key="'record-' + index"
              class="record-card"
              :class="{ 'today-record': isTodayContact(record.timestamp) }"
            >
              <div class="record-row">
                <span class="record-label">日期：</span>
                <span class="record-value">{{ formatTimestamp(record.timestamp) }}</span>
              </div>
              <div class="record-row">
                <span class="record-label">接收方：</span>
                <span class="record-value"
                  >{{ record.toCallsign }} / {{ record.toGrid || '-' }}</span
                >
              </div>
              <div class="record-row">
                <span class="record-label">发送方：</span>
                <span class="record-value"
                  >{{ record.fromCallsign }} / {{ record.fromGrid || '-' }}</span
                >
              </div>
              <div class="record-row">
                <span class="record-label">频率：</span>
                <span class="record-value">{{ formatFreqHz(record.freqHz) }} MHz</span>
              </div>
              <div class="record-row">
                <span class="record-label">中继：</span>
                <span class="record-value"
                  >{{ record.relayName || '-'
                  }}<template v-if="record.relayAdmin">（{{ record.relayAdmin }}）</template></span
                >
              </div>
              <div v-if="record.toComment" class="record-row">
                <span class="record-label">留言：</span>
                <span class="record-value">{{ record.toComment }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-hint">暂无记录</div>
        </div>
        <div v-if="callsignRecords && callsignRecords.totalPages > 1" class="modal-footer">
          <div class="pagination">
            <button
              :disabled="callsignRecordsPage === 1"
              class="hidden-on-small"
              @click="goToCallsignRecordsPage(1)"
            >
              首页
            </button>
            <button
              :disabled="callsignRecordsPage === 1"
              @click="goToCallsignRecordsPage(callsignRecordsPage - 1)"
            >
              上一页
            </button>
            <span class="page-info"
              >第 {{ callsignRecordsPage }} / {{ callsignRecords.totalPages }} 页</span
            >
            <button
              :disabled="callsignRecordsPage === callsignRecords.totalPages"
              @click="goToCallsignRecordsPage(callsignRecordsPage + 1)"
            >
              下一页
            </button>
            <button
              :disabled="callsignRecordsPage === callsignRecords.totalPages"
              class="hidden-on-small"
              @click="goToCallsignRecordsPage(callsignRecords.totalPages)"
            >
              末页
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置弹框 -->
    <div v-if="showSettings" class="modal-overlay" @click.self="showSettings = false">
      <div class="modal">
        <div class="modal-header settings-header">
          <div class="modal-tabs">
            <button
              class="tab-btn"
              :class="{ active: settingsActiveTab === 'general' }"
              @click="settingsActiveTab = 'general'"
            >
              常规设置
            </button>
            <button
              class="tab-btn"
              :class="{ active: settingsActiveTab === 'links' }"
              @click="settingsActiveTab = 'links'"
            >
              友情链接
            </button>
          </div>
          <button class="close-btn" @click="showSettings = false">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="settingsActiveTab === 'general'" class="tab-content">
            <div class="setting-item">
              <span class="setting-label">日志文件</span>
              <div class="setting-actions">
                <button v-if="canSelectDirectory" class="btn-primary" @click="selectDirectory">
                  {{ dbLoaded ? '追加目录' : '选择目录' }}
                </button>
                <button class="btn-primary" @click="triggerFileInput">
                  {{ dbLoaded && !canSelectDirectory ? '追加文件' : '选择文件' }}
                </button>
                <button v-if="dbLoaded" class="btn-secondary" @click="clearDirectory">
                  清除授权
                </button>
              </div>
            </div>
            <div v-if="dbLoaded" class="setting-info">
              已加载 {{ availableFromCallsigns.length }} 个呼号日志
            </div>

            <div v-if="availableFromCallsigns.length > 0" class="setting-item">
              <span class="setting-label">发送方呼号</span>
              <div class="setting-actions">
                <select
                  v-model="selectedFromCallsign"
                  class="setting-select"
                  @change="handleFromCallsignChange"
                >
                  <option
                    v-for="callsign in availableFromCallsigns"
                    :key="callsign"
                    :value="callsign"
                  >
                    {{ callsign }}
                  </option>
                </select>
              </div>
            </div>

            <!-- FMO同步设置 -->
            <div class="setting-group">
              <div class="setting-item">
                <span class="setting-label">FMO地址</span>
                <div class="setting-input-group">
                  <select v-model="protocol" class="protocol-select">
                    <option value="ws">ws://</option>
                    <option value="wss">wss://</option>
                  </select>
                  <input
                    v-model="fmoAddress"
                    type="text"
                    :placeholder="isMobileDevice ? '输入设备IP' : '输入设备IP或域名(fmo.local)'"
                    class="setting-input-flex"
                  />
                </div>
              </div>
              <div v-if="!isMobileDevice" class="setting-note">
                支持mDNS服务，可直接输入 <code>fmo.local</code> 连接设备
              </div>
              <div class="setting-item-save">
                <button class="btn-save" @click="handleSaveFmoAddress">保存</button>
              </div>
              <div class="setting-item-buttons">
                <button class="btn-secondary" :disabled="!fmoAddress || syncing" @click="syncToday">
                  {{ syncing ? '正在同步...' : '同步今日通联' }}
                </button>
                <button class="btn-secondary" :disabled="!fmoAddress || syncing" @click="backupLogs">
                  备份FMO日志
                </button>
              </div>
              <div v-if="syncStatus" class="sync-status">
                {{ syncStatus }}
              </div>
            </div>

            <div v-if="dbLoaded" class="setting-item setting-item-danger">
              <span class="setting-label">数据管理</span>
              <div class="setting-actions">
                <button class="btn-danger" @click="handleClearAllData">清空所有数据</button>
              </div>
            </div>
          </div>

          <div v-else-if="settingsActiveTab === 'links'" class="tab-content">
            <div class="links-section">
              <div class="links-card-grid">
                <a
                  href="https://map.srv.ink/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-card"
                >
                  <div class="link-icon">🗺️</div>
                  <div class="link-info">
                    <div class="link-name">FMO 地图</div>
                    <div class="link-url">map.srv.ink</div>
                  </div>
                  <div class="link-arrow">→</div>
                </a>
                <a
                  href="https://bg5esn.com/docs/fmo-user-shares/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-card"
                >
                  <div class="link-icon">📖</div>
                  <div class="link-info">
                    <div class="link-name">FMO实践分享</div>
                    <div class="link-url">bg5esn.com</div>
                  </div>
                  <div class="link-arrow">→</div>
                </a>
                <a
                  href="https://bg5esn.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="link-card"
                >
                  <div class="link-icon">⚓</div>
                  <div class="link-info">
                    <div class="link-name">大船地下室</div>
                    <div class="link-url">bg5esn.com</div>
                  </div>
                  <div class="link-arrow">→</div>
                </a>
                <!-- 可以继续添加更多友链 -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".db"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  scanDirectory,
  DatabaseManager,
  QueryTypes,
  QueryTypeNames,
  ColumnNames,
  formatTimestamp,
  formatFreqHz,
  getSavedDirHandle,
  loadDbFilesFromHandle,
  clearDirHandle,
  supportsDirectoryPicker,
  loadDbFilesFromFileList,
  importDbFilesToIndexedDB,
  getAvailableFromCallsigns,
  getTop20StatsFromIndexedDB,
  getOldFriendsFromIndexedDB,
  getCallsignRecordsFromIndexedDB,
  getAllRecordsFromIndexedDB,
  clearIndexedDBData,
  getTotalRecordsCountFromIndexedDB,
  getTodayRecordsCountFromIndexedDB,
  getUniqueCallsignCountFromIndexedDB,
  saveFmoAddress,
  getFmoAddress,
  isQsoExistsInIndexedDB,
  saveSingleQsoToIndexedDB
} from '../services/db'
import { FmoApiClient } from '../services/fmoApi'

const PAGE_SIZE = 100

/* 默认列（查看所有模式） */
const DEFAULT_COLUMNS = [
  'timestamp',
  'toCallsign',
  'fromCallsign',
  'freqHz',
  'toComment',
  'mode',
  'relayName'
]

const dbManager = new DatabaseManager()

const dbLoaded = ref(false)
const dbCount = ref(0)
const totalLogs = ref(0)
const todayLogs = ref(0)
const uniqueCallsigns = ref(0)
const loading = ref(false)
const error = ref(null)
const currentQueryType = ref(QueryTypes.ALL)
const currentPage = ref(1)
const queryResult = ref(null)
const top20Result = ref(null)
const showSettings = ref(false)
const settingsActiveTab = ref('general')
const searchKeyword = ref('')
const fileInputRef = ref(null)
const showDetailModalFlag = ref(false)
const selectedRowData = ref(null)
const showTooltip = ref(false)
const tooltipStyle = ref({})
const oldFriendsResult = ref(null)
const oldFriendsPage = ref(1)
const oldFriendsPageSize = 50
const oldFriendsSearchKeyword = ref('')
const showCallsignModal = ref(false)
const currentCallsign = ref('')
const callsignRecords = ref(null)
const callsignRecordsPage = ref(1)
const tooltipClass = computed(() => {
  // 根据样式中的top/bottom值判断位置
  if (tooltipStyle.value.top && tooltipStyle.value.top !== 'auto') {
    return 'tooltip tooltip-bottom'
  } else {
    return 'tooltip'
  }
})

// IndexedDB模式相关状态
const availableFromCallsigns = ref([])
const selectedFromCallsign = ref('') // 空字符串表示"所有呼号"
const importProgress = ref(null)
const fmoAddress = ref('') // 初始化为空，稍后在onMounted中根据设备类型设置
const protocol = ref('ws')
const syncing = ref(false)
const syncStatus = ref('')
const autoSyncMessage = ref('')
let autoSyncMessageTimer = null

function showAutoSyncMessage(msg) {
  autoSyncMessage.value = msg
  if (autoSyncMessageTimer) clearTimeout(autoSyncMessageTimer)
  autoSyncMessageTimer = setTimeout(() => {
    autoSyncMessage.value = ''
  }, 5000)
}

const isHttps = window.location.protocol === 'https:'

// 检测是否为移动设备
const isMobileDevice = computed(() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
})

// 过滤掉不显示在详情中的字段
const filteredSelectedRowData = computed(() => {
  if (!selectedRowData.value) return {}

  const filtered = {}
  Object.keys(selectedRowData.value).forEach((key) => {
    if (key !== 'logId' && key !== 'relayAdmin' && key !== 'dailyIndex') {
      filtered[key] = selectedRowData.value[key]
    }
  })

  return filtered
})

// 检测是否支持目录选择
const canSelectDirectory = supportsDirectoryPicker()

// 计算当前显示的列
const displayColumns = computed(() => {
  if (queryResult.value) {
    return queryResult.value.columns
  }
  return DEFAULT_COLUMNS
})

// 计算总页数
const totalPages = computed(() => {
  if (queryResult.value && queryResult.value.totalPages) {
    return queryResult.value.totalPages
  }
  return 0
})

// 计算总记录数
const totalRecords = computed(() => {
  if (queryResult.value) {
    return queryResult.value.total
  }
  return 0
})

// 老朋友总页数
const oldFriendsTotalPages = computed(() => {
  if (oldFriendsResult.value && oldFriendsResult.value.totalPages) {
    return oldFriendsResult.value.totalPages
  }
  return 0
})

// 判断是否今日通联（使用UTC时间）
function isTodayContact(timestamp) {
  if (!timestamp) return false
  const contactDate = new Date(timestamp * 1000)
  const today = new Date()
  return (
    contactDate.getUTCFullYear() === today.getUTCFullYear() &&
    contactDate.getUTCMonth() === today.getUTCMonth() &&
    contactDate.getUTCDate() === today.getUTCDate()
  )
}

// 自动同步定时器和状态锁
let autoSyncTimer = null
let isAutoSyncing = false

onMounted(async () => {
  await tryRestoreDirectory()
  const savedAddress = await getFmoAddress()
  if (savedAddress) {
    if (savedAddress.startsWith('wss://')) {
      protocol.value = 'wss'
      fmoAddress.value = savedAddress.replace(/^wss:\/\//, '')
    } else if (savedAddress.startsWith('ws://')) {
      protocol.value = 'ws'
      fmoAddress.value = savedAddress.replace(/^ws:\/\//, '')
    } else {
      fmoAddress.value = savedAddress
    }
  } else {
    // 如果没有保存的地址，根据设备类型设置默认值
    fmoAddress.value = isMobileDevice.value ? '' : 'fmo.local'
  }

  // 启动定时同步任务
  startAutoSyncTask()
})

// 定时同步任务：每10s同步第一页10条数据
async function startAutoSyncTask() {
  if (autoSyncTimer) return

  autoSyncTimer = setInterval(async () => {
    // 如果正在手动同步、自动同步已在进行中或未设置地址，则跳过
    if (isAutoSyncing || syncing.value || !fmoAddress.value) {
      return
    }

    isAutoSyncing = true

    try {
      // 获取当前完整地址
      const address = fmoAddress.value.trim()
      const host = address.replace(/^(https?|wss?):?\/\//, '').replace(/\/+$/, '')
      const fullAddress = `${protocol.value}://${host}`

      // 每次同步创建一个新的客户端
      const client = new FmoApiClient(fullAddress)

      try {
        // 检查插入前数据库是否为空
        const wasEmpty = !dbLoaded.value || totalLogs.value === 0

        // 使用当前选择的 fromCallsign 作为查询条件，每页查询10条数据
        const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000)
        const fromCallsign = selectedFromCallsign.value
        const response = await client.getQsoList(0, 10, fromCallsign)
        const list = response.list || []
        const newCallsigns = []

        for (const item of list) {
          // 跳过今天之前的数据
          if (item.timestamp < todayStart) continue

          let qso = null
          if (fromCallsign) {
            // 已有选择，先检查是否存在
            const exists = await isQsoExistsInIndexedDB(
              fromCallsign,
              item.timestamp,
              item.toCallsign
            )
            if (!exists) {
              const detailResponse = await client.getQsoDetail(item.logId)
              qso = detailResponse.log
              if (qso && qso.fromCallsign !== fromCallsign) qso = null
            }
          } else {
            // 未选择，通过详情获取呼号并插入
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
            if (qso) {
              const exists = await isQsoExistsInIndexedDB(
                qso.fromCallsign,
                qso.timestamp,
                qso.toCallsign
              )
              if (exists) qso = null
            }
          }

          if (qso) {
            await saveSingleQsoToIndexedDB(qso)
            newCallsigns.push(qso.toCallsign)
          }
        }

        // 如果有新数据插入，重新查询并提示
        if (newCallsigns.length > 0) {
          const callsigns = await getAvailableFromCallsigns()
          availableFromCallsigns.value = callsigns
          // 如果之前没有选择呼号，默认选择第一个
          if (!selectedFromCallsign.value && callsigns.length > 0) {
            selectedFromCallsign.value = callsigns[0]
          }
          
          // 如果插入前数据库为空，重新加载页面
          if (wasEmpty) {
            window.location.reload()
            return
          }
          
          await executeQuery()
          showAutoSyncMessage(`同步到和 ${newCallsigns.join(', ')} 的通联`)
        }
      } catch (err) {
        console.error('定时同步失败:', err)
      } finally {
        // 完成后关闭连接
        client.close()
      }
    } catch (err) {
      console.error('定时同步初始化失败:', err)
    } finally {
      isAutoSyncing = false
    }
  }, 10000)
}

async function tryRestoreDirectory() {
  try {
    const savedHandle = await getSavedDirHandle()
    if (savedHandle) {
      loading.value = true
      const dbFiles = await loadDbFilesFromHandle(savedHandle)
      if (dbFiles.length > 0) {
        await loadDatabases(dbFiles)
      }
      loading.value = false
    } else {
      // 尝试从IndexedDB恢复已有数据
      const callsigns = await getAvailableFromCallsigns()
      if (callsigns.length > 0) {
        availableFromCallsigns.value = callsigns
        // 默认选择第一个呼号
        selectedFromCallsign.value = callsigns[0]
        totalLogs.value = await getTotalRecordsCountFromIndexedDB(selectedFromCallsign.value)
        todayLogs.value = await getTodayRecordsCountFromIndexedDB(selectedFromCallsign.value)
        uniqueCallsigns.value = await getUniqueCallsignCountFromIndexedDB(
          selectedFromCallsign.value
        )
        dbLoaded.value = true
        dbCount.value = callsigns.length
        executeQuery()
      }
    }
  } catch {
    // 权限可能已失效，忽略错误
    loading.value = false
  }
}

async function loadDatabases(dbFiles) {
  dbManager.close()

  // 导入数据到IndexedDB（不清空旧数据，追加合并）
  importProgress.value = { current: 0, total: 0 }
  const importResult = await importDbFilesToIndexedDB(dbFiles, (progress) => {
    importProgress.value = progress
  })
  importProgress.value = null

  if (importResult.totalRecords === 0 && importResult.callsigns.length === 0) {
    // 尝试获取已有数据
    const existingCallsigns = await getAvailableFromCallsigns()
    if (existingCallsigns.length === 0) {
      error.value = '没有成功导入任何数据'
      return
    }
    availableFromCallsigns.value = existingCallsigns
  } else {
    // 更新可用的fromCallsign列表（合并新旧）
    const allCallsigns = await getAvailableFromCallsigns()
    availableFromCallsigns.value = allCallsigns
  }

  // 如果没有选择呼号或选择的呼号不在列表中，默认选择第一个
  if (
    !selectedFromCallsign.value ||
    !availableFromCallsigns.value.includes(selectedFromCallsign.value)
  ) {
    selectedFromCallsign.value = availableFromCallsigns.value[0]
  }

  // 获取统计数据
  totalLogs.value = await getTotalRecordsCountFromIndexedDB(selectedFromCallsign.value)
  todayLogs.value = await getTodayRecordsCountFromIndexedDB(selectedFromCallsign.value)
  uniqueCallsigns.value = await getUniqueCallsignCountFromIndexedDB(selectedFromCallsign.value)

  dbCount.value = dbFiles.length
  dbLoaded.value = true
  currentQueryType.value = QueryTypes.ALL
  currentPage.value = 1

  executeQuery()
}

async function selectDirectory() {
  loading.value = true
  error.value = null
  queryResult.value = null
  showSettings.value = false

  try {
    const dbFiles = await scanDirectory()
    if (dbFiles === null) {
      loading.value = false
      return
    }

    if (dbFiles.length === 0) {
      error.value = '所选目录中没有找到 .db 文件'
      loading.value = false
      return
    }

    await loadDatabases(dbFiles)
  } catch (err) {
    error.value = `加载失败: ${err.message}`
  }

  loading.value = false
}

async function clearDirectory() {
  await clearDirHandle()
  dbManager.close()
  showSettings.value = false
}

async function handleSaveFmoAddress() {
  let address = fmoAddress.value.trim()

  if (!address) {
    await saveFmoAddress('')
    alert('设置已保存')
    return
  }

  // 移除协议头（如果用户手动输入了）
  address = address.replace(/^(https?|wss?):?\/\//, '')

  // 根据协议选择构造完整地址
  const fullAddress = `${protocol.value}://${address}`

  // 校验地址
  loading.value = true
  try {
    const host = address.replace(/\/+$/, '')
    
    // 检查是否为有效的IP地址或域名（包括fmo.local）
    const client = new FmoApiClient(`${protocol.value}://${host}`)
    if (!client.isValidAddress(host)) {
      alert('请输入有效的IP地址或域名')
      return
    }
    
    const wsUrl = `${protocol.value}://${host}/ws`

    const isConnected = await new Promise((resolve) => {
      const socket = new WebSocket(wsUrl)
      const timeout = setTimeout(() => {
        socket.close()
        resolve(false)
      }, 5000) // 5秒超时

      socket.onopen = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(true)
      }

      socket.onerror = () => {
        clearTimeout(timeout)
        socket.close()
        resolve(false)
      }
    })

    if (isConnected) {
      await saveFmoAddress(fullAddress)
      alert('设置已保存')
    } else {
      if (isHttps && protocol.value === 'ws') {
        alert(
          '请确认 fmo 地址。提示：HTTPS 网站无法直接连接局域网设备，请按界面提示开启浏览器"不安全内容"访问权限，或选择 wss:// 协议。'
        )
      } else {
        alert('请确认fmo地址')
      }
    }
  } catch (err) {
    alert('请确认fmo地址')
  } finally {
    loading.value = false
  }
}

async function syncToday() {
  if (!fmoAddress.value || syncing.value) return

  // 检查地址是否已保存，未保存则先保存
  let address = fmoAddress.value.trim().replace(/^(https?|wss?):?\/\//, '')
  const fullAddress = `${protocol.value}://${address}`
  const savedAddress = await getFmoAddress()
  if (fullAddress !== savedAddress) {
    await saveFmoAddress(fullAddress)
  }

  syncing.value = true
  syncStatus.value = '连接 FMO...'
  error.value = null

  const client = new FmoApiClient(fmoAddress.value)
  try {
    const todayStart = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000)
    let page = 0
    let hasMoreToday = true
    let totalSynced = 0

    while (hasMoreToday) {
      syncStatus.value = `获取第 ${page + 1} 页列表...`
      const currentFromCallsign = selectedFromCallsign.value
      const response = await client.getQsoList(page, 20, currentFromCallsign)
      const list = response.list

      if (!list || list.length === 0) break

      for (const item of list) {
        if (item.timestamp >= todayStart) {
          let qso = null
          if (currentFromCallsign) {
            const exists = await isQsoExistsInIndexedDB(
              currentFromCallsign,
              item.timestamp,
              item.toCallsign
            )
            if (!exists) {
              const detailResponse = await client.getQsoDetail(item.logId)
              qso = detailResponse.log
              if (qso && qso.fromCallsign !== currentFromCallsign) qso = null
            }
          } else {
            const detailResponse = await client.getQsoDetail(item.logId)
            qso = detailResponse.log
            if (qso) {
              const exists = await isQsoExistsInIndexedDB(
                qso.fromCallsign,
                qso.timestamp,
                qso.toCallsign
              )
              if (exists) qso = null
            }
          }

          if (qso) {
            syncStatus.value = `保存记录: ${qso.toCallsign}...`
            await saveSingleQsoToIndexedDB(qso)
            totalSynced++
          }
        } else {
          hasMoreToday = false
          break
        }
      }

      if (list.length < 20) break
      page++
    }

    syncStatus.value = `同步完成，共更新 ${totalSynced} 条记录`

    // 重新加载数据以刷新界面状态
    const callsigns = await getAvailableFromCallsigns()
    availableFromCallsigns.value = callsigns
    if (callsigns.length > 0) {
      if (!selectedFromCallsign.value) {
        selectedFromCallsign.value = callsigns[0]
      }
      dbLoaded.value = true
      dbCount.value = callsigns.length
    }
    await executeQuery()

    // 延迟刷新页面，确保用户看到同步成功的提示并刷新完整状态
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  } catch (err) {
    error.value = `同步失败: ${err.message}`
  } finally {
    syncing.value = false
    client.close()
  }
}

function backupLogs() {
  if (!fmoAddress.value) return

  let address = fmoAddress.value.trim()
  if (!address.startsWith('http://') && !address.startsWith('https://')) {
    address = 'http://' + address
  }

  // 移除末尾斜杠
  address = address.replace(/\/+$/, '')

  const url = `${address}/api/qso/backup`

  // 创建隐藏链接并触发下载
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 清空所有数据
async function handleClearAllData() {
  if (!window.confirm('确定要清空所有数据吗？此操作不可恢复。')) {
    return
  }

  await clearDirHandle()
  await clearIndexedDBData()
  dbManager.close()
  dbLoaded.value = false
  dbCount.value = 0
  totalLogs.value = 0
  todayLogs.value = 0
  uniqueCallsigns.value = 0
  queryResult.value = null
  top20Result.value = null
  oldFriendsResult.value = null
  showSettings.value = false
  searchKeyword.value = ''
  oldFriendsSearchKeyword.value = ''
  availableFromCallsigns.value = []
  selectedFromCallsign.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileSelect(event) {
  const files = event.target.files
  if (!files || files.length === 0) return

  loading.value = true
  error.value = null
  queryResult.value = null
  showSettings.value = false

  try {
    const dbFiles = await loadDbFilesFromFileList(files)
    if (dbFiles.length === 0) {
      error.value = '所选文件中没有有效的 .db 文件'
      loading.value = false
      return
    }

    await loadDatabases(dbFiles)
  } catch (err) {
    error.value = `加载失败: ${err.message}`
  }

  loading.value = false
  event.target.value = ''
}

function handleQueryTypeChange() {
  searchKeyword.value = ''
  oldFriendsSearchKeyword.value = ''
  currentPage.value = 1
  oldFriendsPage.value = 1
  executeQuery()
}

// 处理fromCallsign选择变化
function handleFromCallsignChange() {
  currentPage.value = 1
  oldFriendsPage.value = 1
  executeQuery()
}

// 防抖定时器
let searchTimer = null

function onSearchInput() {
  if (searchTimer) {
    clearTimeout(searchTimer)
  }
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    executeQuery()
  }, 300)
}

async function executeQuery() {
  if (!dbLoaded.value || !selectedFromCallsign.value) return

  loading.value = true
  error.value = null

  try {
    const fromCallsign = selectedFromCallsign.value

    if (currentQueryType.value === QueryTypes.TOP20_SUMMARY) {
      top20Result.value = await getTop20StatsFromIndexedDB(fromCallsign)
      queryResult.value = null
      oldFriendsResult.value = null
    } else if (currentQueryType.value === QueryTypes.OLD_FRIENDS) {
      oldFriendsResult.value = await getOldFriendsFromIndexedDB(
        oldFriendsPage.value,
        oldFriendsPageSize,
        oldFriendsSearchKeyword.value.trim(),
        fromCallsign
      )
      queryResult.value = null
      top20Result.value = null
    } else if (currentQueryType.value === QueryTypes.ALL) {
      queryResult.value = await getAllRecordsFromIndexedDB(
        currentPage.value,
        PAGE_SIZE,
        searchKeyword.value.trim(),
        fromCallsign
      )
      top20Result.value = null
      oldFriendsResult.value = null
    } else {
      currentPage.value = 1
      queryResult.value = await getAllRecordsFromIndexedDB(1, PAGE_SIZE, '', fromCallsign)
      top20Result.value = null
      oldFriendsResult.value = null
    }

    // 更新统计数据
    totalLogs.value = await getTotalRecordsCountFromIndexedDB(fromCallsign)
    todayLogs.value = await getTodayRecordsCountFromIndexedDB(fromCallsign)
    uniqueCallsigns.value = await getUniqueCallsignCountFromIndexedDB(fromCallsign)
  } catch (err) {
    error.value = `查询失败: ${err.message}`
    queryResult.value = null
    top20Result.value = null
    oldFriendsResult.value = null
  }

  loading.value = false
}

function goToPage(page) {
  if (!queryResult.value || page < 1 || page > queryResult.value.totalPages) return
  currentPage.value = page
  executeQuery()
}

// 老朋友搜索输入处理
let oldFriendsSearchTimer = null

function onOldFriendsSearchInput() {
  if (oldFriendsSearchTimer) {
    clearTimeout(oldFriendsSearchTimer)
  }
  oldFriendsSearchTimer = setTimeout(() => {
    oldFriendsPage.value = 1
    executeQuery()
  }, 300)
}

// 老朋友分页跳转
function goToOldFriendsPage(page) {
  if (!oldFriendsResult.value || page < 1 || page > oldFriendsResult.value.totalPages) return
  oldFriendsPage.value = page
  executeQuery()
}

// 显示呼号通联记录
async function showCallsignRecords(callsign) {
  currentCallsign.value = callsign
  callsignRecordsPage.value = 1
  await loadCallsignRecords()
  showCallsignModal.value = true
}

// 加载呼号通联记录
async function loadCallsignRecords() {
  callsignRecords.value = await getCallsignRecordsFromIndexedDB(
    currentCallsign.value,
    callsignRecordsPage.value,
    10,
    selectedFromCallsign.value
  )
}

// 呼号记录分页跳转
async function goToCallsignRecordsPage(page) {
  if (!callsignRecords.value || page < 1 || page > callsignRecords.value.totalPages) return
  callsignRecordsPage.value = page
  await loadCallsignRecords()
}

function formatDatePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[0] // 只返回日期部分 (YYYY-MM-DD)
}

function formatTimePart(dateTimeStr) {
  if (!dateTimeStr) return ''
  return dateTimeStr.split(' ')[1] // 只返回时间部分 (HH:MM:SS)
}

function showDetailModal(row) {
  selectedRowData.value = row
  showDetailModalFlag.value = true
}

function toggleTooltip(event) {
  showTooltip.value = !showTooltip.value
  // 如果显示提示框，则检测位置
  if (showTooltip.value) {
    setTimeout(() => {
      adjustTooltipPosition(event)
    }, 0)
  }
}

function adjustTooltipPosition(event) {
  if (!showTooltip.value) return

  // 这里我们使用setTimeout确保DOM已经更新
  setTimeout(() => {
    const iconEl = event?.target?.closest('.info-icon') || event?.target

    if (iconEl) {
      const iconRect = iconEl.getBoundingClientRect()

      // 由于使用fixed定位，直接设置相对于视口的位置
      const iconCenterX = iconRect.left + iconRect.width / 2

      // 检查上方是否有足够空间显示提示框
      if (iconRect.top < 40) {
        // 预留一定空间
        // 如果上方空间不足，添加data-position属性让提示框显示在下方
        // 设置位置在图标下方
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          top: `${iconRect.bottom + 8}px`,
          bottom: 'auto'
        }
      } else {
        // 设置位置在图标上方
        tooltipStyle.value = {
          left: `${iconCenterX}px`,
          bottom: `${window.innerHeight - iconRect.top + 8}px`,
          top: 'auto'
        }
      }
    }
  }, 10)
}

function handleMouseEnter(event) {
  showTooltip.value = true
  adjustTooltipPosition(event)
}

function handleMouseLeave() {
  // 延迟隐藏，让用户有机会将鼠标移到提示框上
  setTimeout(() => {
    if (!isMouseOverTooltip) {
      showTooltip.value = false
    }
  }, 300)
}

// 跟踪鼠标是否在提示框上
let isMouseOverTooltip = false

function handleTooltipMouseEnter() {
  isMouseOverTooltip = true
}

function handleTooltipMouseLeave() {
  isMouseOverTooltip = false
  showTooltip.value = false
}

onUnmounted(() => {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
  dbManager.close()
})
</script>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.header {
  flex-shrink: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-header);
  border-bottom: 1px solid var(--border-light);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header h1 {
  margin: 0;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.content-area {
  flex: 1;
  overflow: hidden;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  position: relative;
}

.auto-sync-hint {
  background: var(--bg-success-light);
  color: var(--color-success);
  padding: 8px 16px;
  border-radius: 4px;
  margin-bottom: 10px;
  border: 1px solid var(--color-success-border);
  font-size: 14px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

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
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.search-box input {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  width: 150px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.loading {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.error {
  padding: 1rem;
  background: var(--bg-error-light);
  color: var(--color-danger);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.result-section {
  margin-top: 1rem;
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
}

.data-table th,
.data-table td {
  border: 1px solid var(--border-table);
  padding: 0.5rem;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.data-table th {
  background: var(--bg-table-header);
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: center;
}

/* 列宽设置 */
.col-timestamp {
  width: 120px;
}
.col-dailyIndex {
  width: 60px;
  text-align: center;
  vertical-align: middle;
}
.col-freqHz {
  width: 95px;
}
.col-fromCallsign {
  width: 100px;
}
.col-fromGrid {
  width: 100px;
}
.col-toCallsign {
  width: 140px;
}
.col-toGrid {
  width: 100px;
}
.col-toComment {
  width: auto;
}
.col-mode {
  width: 80px;
}
.col-relayName {
  width: 130px;
  text-align: center;
  vertical-align: middle;
}
.col-count {
  width: 60px;
}

/* 日期单元格样式 */
.col-timestamp {
  text-align: center;
  vertical-align: middle;
  line-height: 1.2;
}

.timestamp-div {
  display: block;
  white-space: nowrap;
  text-align: center;
}

.relay-cell {
  text-align: center;
}

.relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

/* 呼号+网格合并显示样式 */
.callsign-with-grid {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.callsign-main {
  font-weight: bold;
  font-size: 1.1rem;
}

.callsign-grid {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: normal;
}

.daily-index {
  display: inline-block;
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--text-secondary);
  background: var(--bg-disabled);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  min-width: 1.8rem;
  text-align: center;
}

.daily-index.rank-1 {
  color: var(--text-white);
  background: linear-gradient(135deg, #f7c247, #e6a23c);
}

.daily-index.rank-2 {
  color: var(--text-white);
  background: linear-gradient(135deg, #a8b0ba, #909399);
}

.daily-index.rank-3 {
  color: var(--text-white);
  background: linear-gradient(135deg, #cd8c52, #b87333);
}

.daily-index-cell {
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-detail .relay-cell {
  text-align: left;
}

.data-table tbody tr.row-today {
  background: var(--bg-today-card);
}

.data-table tbody tr:hover:not(.empty-row) {
  background: var(--bg-table-hover);
}

.data-table tbody tr {
  line-height: 1.6;
}

.empty-row .empty-cell {
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

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

/* 弹框样式 */
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
  z-index: 1000;
}

.modal {
  background: var(--bg-card);
  border-radius: 8px;
  width: 650px;
  max-width: 90%;
  box-shadow: 0 4px 20px var(--shadow-modal);
}

.modal-detail {
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.detail-item {
  display: flex;
  margin-bottom: 0.8rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid var(--border-light);
}

.detail-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.detail-label {
  flex: 0 0 120px;
  font-weight: 500;
  color: var(--text-secondary);
}

.detail-value {
  flex: 1;
  color: var(--text-primary);
  word-break: break-all;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-secondary);
}

.modal-body {
  padding: 1.5rem;
  height: 450px;
  overflow-y: auto;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-input {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  width: 150px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.setting-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-group {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-light);
}

.setting-group .setting-item {
  margin-bottom: 1rem;
}

.setting-group .setting-item-buttons {
  display: flex;
  flex-direction: row;
  gap: 0.8rem;
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.sync-status {
  margin-top: 0.8rem;
  font-size: 0.85rem;
  color: var(--color-primary);
  text-align: center;
}

.https-hint {
  margin-bottom: 1rem;
  padding: 0.8rem;
  background: var(--bg-https-hint);
  border: 1px solid var(--color-warning-border);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--color-warning);
  line-height: 1.5;
}

.setting-item-buttons .btn-secondary {
  width: 100%;
}

.setting-label {
  font-weight: 500;
}

.setting-input-group {
  display: flex;
  gap: 0.5rem;
  flex: 1;
}

.protocol-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 85px;
}

.protocol-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-input-flex {
  flex: 1;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  min-width: 0;
  width: 98%;
  background: var(--bg-input);
  color: var(--text-primary);
}

.setting-input-flex:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-item-save {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

.btn-save {
  width: 100%;
  padding: 0.6rem;
  font-size: 1rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px var(--shadow-primary);
}

.btn-save:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 8px var(--shadow-primary-hover);
  transform: translateY(-1px);
}

.setting-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-primary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-primary);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--bg-container);
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--bg-table-hover);
}

.setting-info {
  margin-top: 1rem;
  color: var(--color-success);
  font-size: 0.9rem;
}

.setting-select {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 150px;
}

.setting-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.setting-item-danger {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-light);
}

.btn-danger {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  background: var(--color-danger);
  color: var(--text-white);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger:hover {
  background: var(--color-danger-hover);
}

/* 设置弹窗选项卡样式 */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem !important;
}

.modal-tabs {
  display: flex;
  gap: 0.25rem;
}

.tab-btn {
  padding: 0.4rem 0.8rem;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1rem;
  transition: all 0.2s;
  position: relative;
}

.tab-btn:hover {
  background: var(--bg-table-hover);
  color: var(--color-primary);
}

.tab-btn.active {
  color: var(--color-primary);
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -0.5rem;
  left: 0.8rem;
  right: 0.8rem;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px;
}

.tab-content {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 友情链接卡片化样式 */
.links-section {
  padding: 0.5rem 0;
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

.link-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-primary);
  box-shadow: 0 8px 16px var(--shadow-card);
  background: var(--bg-table-hover);
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

.link-card:hover .link-arrow {
  color: var(--color-primary);
  transform: translateX(3px);
  opacity: 1;
}

.tag-icon {
  font-size: 1rem;
}

/* TOP20汇总样式 */
.top20-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;
  overflow: auto;
  margin-top: 1rem;
}

.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-tertiary);
  padding: 3rem;
}

.top20-card {
  background: var(--bg-card);
  border: 1px solid var(--border-secondary);
  border-radius: 8px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.disclaimer {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
  padding: 1rem 0;
  margin-top: 1rem;
  border-top: 1px dashed var(--border-secondary);
}

.top20-card h3 {
  margin: 0;
  padding: 0.75rem 1rem;
  background: var(--bg-table-header);
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border-secondary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  overflow: visible;
}

.info-icon {
  position: relative;
  display: inline-block;
  cursor: pointer;
  margin-left: 0.5rem;
}

.info-icon svg {
  color: var(--text-tertiary);
  transition: color 0.2s ease;
}

.info-icon:hover svg {
  color: var(--color-primary);
}

.tooltip {
  position: fixed;
  top: auto;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--tooltip-bg);
  color: var(--text-white);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: normal;
  z-index: 9999;
  width: max-content;
  max-width: 350px;
  min-width: 200px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  word-wrap: break-word;
  word-break: break-word;
}

/* 当上方空间不足时，显示在下方 */
.tooltip-bottom {
  top: calc(100% + 8px);
  bottom: auto;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-word;
}

.tooltip-bottom::before {
  top: -12px;
  border-color: transparent transparent var(--tooltip-bg) transparent;
}

.tooltip::before {
  content: '';
  position: fixed;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: var(--tooltip-bg) transparent transparent transparent;
}

.top20-list {
  padding: 0.5rem 0;
  overflow-y: auto;
  flex: 1;
}

.top20-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  line-height: 1.6;
}

.top20-item:hover {
  background: var(--bg-table-hover);
}

.top20-item .rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-disabled);
  border-radius: 50%;
  font-size: 0.85rem;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-right: 0.75rem;
}

.top20-item:nth-child(1) .rank {
  background: #ffd700;
  color: var(--text-white);
}

.top20-item:nth-child(2) .rank {
  background: #c0c0c0;
  color: var(--text-white);
}

.top20-item:nth-child(3) .rank {
  background: #cd7f32;
  color: var(--text-white);
}

.top20-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top20-item .relay-admin {
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.top20-item .count {
  flex-shrink: 0;
  margin-left: 0.5rem;
  color: var(--color-primary);
}

.empty-item {
  text-align: center;
  color: var(--text-tertiary);
  padding: 2rem;
}

/* 老朋友卡片样式 */
.old-friends-container {
  flex: 1;
  overflow: auto;
  margin-top: 1rem;
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

/* 通联记录弹框样式 */
.modal-callsign-records {
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-callsign-records .modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.modal-callsign-records .modal-footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-light);
  background: var(--bg-card);
}

.record-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.record-card {
  background: var(--bg-record-card);
  border: 1px solid var(--border-record-card);
  border-radius: 8px;
  padding: 0.75rem;
}

.record-row {
  display: flex;
  margin-bottom: 0.3rem;
  font-size: 0.85rem;
  line-height: 1.4;
}

.record-row:last-child {
  margin-bottom: 0;
}

.record-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  width: 60px;
}

.record-value {
  color: var(--text-primary);
  flex: 1;
  word-break: break-all;
}

.record-card.today-record {
  background: var(--bg-today-card);
  border-color: var(--border-today-card);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .top20-container {
    grid-template-columns: repeat(2, 1fr);
  }

  .old-friends-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.setting-note {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #606266;
}

.setting-note code {
  background-color: #e6f7ff;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: monospace;
  color: #409eff;
  border: 1px solid #d9ecff;
}

@media (max-width: 768px) {
  .header {
    padding: 0.75rem;
  }

  .header h1 {
    font-size: 1.2rem;
  }

  .header-left {
    gap: 0.5rem;
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

  .content-area {
    padding: 0.75rem;
  }

  .query-types {
    gap: 1rem;
    font-size: 0.9rem;
  }

  .top20-container {
    grid-template-columns: 1fr;
  }

  .top20-card {
    max-height: 50vh;
  }

  .old-friends-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .data-table {
    font-size: 0.8rem;
  }

  .data-table th,
  .data-table td {
    padding: 0.4rem;
  }

  /* 隐藏部分列 */
  .col-freqHz,
  .col-fromCallsign,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  /* 在中等屏幕上隐藏分页的首页和末页按钮 */
  .pagination .hidden-on-small {
    display: none;
  }

  .pagination {
    flex-wrap: nowrap;
    gap: 0.3rem;
  }
  .pagination button {
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
  }

  .page-info {
    font-size: 0.85rem;
  }

  .record-cards-grid {
    grid-template-columns: 1fr;
  }

  .modal-callsign-records {
    width: 95%;
    max-height: 80vh;
  }

  .modal-callsign-records .modal-body {
    padding: 0.75rem;
    max-height: calc(80vh - 120px);
  }

  .modal-callsign-records .modal-footer {
    padding: 0.5rem;
  }

  .modal-callsign-records .modal-footer .pagination {
    gap: 0.25rem;
  }

  .modal-callsign-records .modal-footer .pagination button {
    padding: 0.25rem 0.5rem;
    font-size: 0.8rem;
  }

  .modal-callsign-records .modal-footer .page-info {
    font-size: 0.75rem;
    margin: 0 0.25rem;
  }
}

/* 手机端只显示关键列 */
@media (max-width: 480px) {
  /* 隐藏除日期、接收方呼号外的所有列 */
  .col-freqHz,
  .col-fromCallsign,
  .col-toComment,
  .col-mode,
  .col-relayName {
    display: none;
  }

  /* 确保只显示日期、接收方呼号列 */
  .col-timestamp,
  .col-toCallsign {
    display: table-cell;
  }

  /* 在小屏幕上隐藏分页的首页和末页按钮 */
  .pagination .hidden-on-small {
    display: none;
  }

  /* 确保分页信息文本适应较小空间 */
  .page-info {
    font-size: 0.8rem;
    margin: 0 0.5rem;
  }

  .header h1 {
    font-size: 1rem;
  }

  .query-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-box {
    width: 100%;
  }

  .search-box input {
    width: 100%;
  }

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

  .col-timestamp {
    width: 90px;
  }
}
</style>
