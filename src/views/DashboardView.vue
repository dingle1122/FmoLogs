<template>
  <div class="dashboard-view">
    <section
      class="dashboard-hero"
      :class="{ active: isDisplaySpeakerActive, 'self-speaking': isOwnSpeaking }"
      title="双击切换全屏"
      @dblclick="$emit('toggle-dashboard-fullscreen')"
    >
      <span
        v-if="displaySpeaker && heroElements.watermark"
        class="hero-watermark"
        aria-hidden="true"
      >
        {{ displaySpeaker.callsign }}
        <span class="hero-watermark-count"
          >x{{ contactCounts.get(displaySpeaker.callsign) || 0 }}</span
        >
      </span>
      <div v-if="displaySpeaker && showSpeakerClock" class="speaker-clock" aria-label="当前时间">
        <time v-if="heroElements['local-time']" :datetime="currentLocalIso">{{
          currentLocalTimeText
        }}</time>
        <span
          v-if="heroElements['local-time'] && heroElements['utc-time']"
          class="speaker-clock-divider"
          aria-hidden="true"
          >|</span
        >
        <time v-if="heroElements['utc-time']" :datetime="currentUtcIso">{{
          currentUtcTimeText
        }}</time>
      </div>
      <div
        v-if="displaySpeaker"
        class="hero-content"
        :class="{
          'without-clock': !showSpeakerClock,
          'with-stacked-clock': showStackedSpeakerClock
        }"
      >
        <div class="hero-station">
          <div v-if="showSpeakerIdentity" class="speaker-title">
            <div class="speaker-identity">
              <span
                v-if="heroElements.callsign"
                class="speaker-callsign"
                :class="{ idle: !isDisplaySpeakerActive }"
              >
                {{ displaySpeaker.callsign }}
              </span>
              <span v-if="heroElements['contact-meta']" class="speaker-contact-meta">
                <span class="speaker-contact-count"
                  >x{{ contactCounts.get(displaySpeaker.callsign) || 0 }}</span
                >
                <span
                  v-if="
                    displaySpeaker.callsign !== selectedFromCallsign &&
                    todayContactedCallsigns.has(displaySpeaker.callsign)
                  "
                  class="speaker-contact-star"
                >
                  <img src="/img/star_2b50.webp" alt="" />
                </span>
              </span>
            </div>
          </div>

          <div v-if="showSpeakerDetails" class="speaker-details">
            <span
              v-if="heroElements['server-name'] && displaySpeaker.serverName"
              class="detail-tag"
              >{{ displaySpeaker.serverName }}</span
            >
            <span v-if="heroElements.grid && displaySpeaker.grid" class="speaker-grid">{{
              displaySpeaker.grid
            }}</span>
            <span v-if="heroElements.address && displaySpeakerAddress">{{
              displaySpeakerAddress
            }}</span>
          </div>

          <div v-if="heroElements.geo" class="metric-block geo-block">
            <span
              v-if="displaySpeakerGeoText"
              class="geo-icon"
              :style="{ transform: `rotate(${displaySpeakerBearing || 0}deg)` }"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4 19 20 12 16 5 20 12 4Z" />
              </svg>
            </span>
            <strong>{{ displaySpeakerGeoText }}</strong>
          </div>
        </div>

        <div v-if="heroElements.duration" class="hero-metrics">
          <div class="metric-block duration-block">
            <span
              class="duration-own-callsign"
              :class="{ visible: isOwnSpeaking && !isDisplaySpeakerActive }"
            >
              {{ heroOwnCallsign }}
            </span>
            <span>{{
              isOwnSpeaking && !isDisplaySpeakerActive
                ? '您正在发言'
                : isDisplaySpeakerActive
                  ? '持续时间'
                  : '发言时长'
            }}</span>
            <strong v-if="isDisplaySpeakerActive">
              {{ speakingDuration }}
            </strong>
            <strong v-else-if="isOwnSpeaking" class="self-speaking-duration">
              {{ ownSpeakingDuration }}
            </strong>
            <strong v-else-if="displaySpeaker.endTime" class="idle-duration">
              {{ formatDurationMmSs(displaySpeaker.endTime - displaySpeaker.startTime) }}
            </strong>
          </div>
        </div>
      </div>

      <div v-else class="hero-empty">
        <div>
          <span class="hero-own-callsign" :class="{ visible: isOwnSpeaking }">
            {{ heroOwnCallsign }}
          </span>
          <strong>{{
            isOwnSpeaking
              ? '您正在发言'
              : hasAnySpeakingHistory
                ? '暂时没有对方发言'
                : '暂时没人发言'
          }}</strong>
          <span>{{ heroEmptyText }}</span>
        </div>
      </div>
    </section>

    <div v-if="isEditingLayout" class="hero-elements-editor">
      <span>当前发言卡片</span>
      <label v-for="item in dashboardHeroElementOptions" :key="item.id">
        <input
          type="checkbox"
          :checked="heroElements[item.id]"
          @change="settingsStore.setDashboardHeroElementVisible(item.id, $event.target.checked)"
        />
        <span>{{ item.label }}</span>
      </label>
    </div>

    <template v-for="panel in dashboardLayout" :key="panel.id">
      <section v-if="panel.visible && panel.id === 'reachability-info'" class="reachability-panel">
        <h3>
          <span>可达性信息</span>
          <span v-if="isEditingLayout" class="panel-layout-actions">
            <button
              type="button"
              title="上移"
              :disabled="isFirstDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, -1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button
              type="button"
              title="下移"
              :disabled="isLastDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, 1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <button
              type="button"
              title="隐藏"
              @click="settingsStore.setDashboardPanelVisible(panel.id, false)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3 21 21" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.4 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.1 3.1" />
                <path d="M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
              </svg>
            </button>
          </span>
        </h3>

        <div v-if="stationInfoCards.length" class="station-info-strip">
          <div v-for="item in stationInfoCards" :key="item.id" class="station-info-item">
            <component
              :is="item.id === 'station' && !isEditingLayout ? 'button' : 'div'"
              class="station-info-card"
              :class="{
                'station-info-card-action': item.id === 'station' && !isEditingLayout,
                'station-info-card-editing': isEditingLayout
              }"
              :type="item.id === 'station' && !isEditingLayout ? 'button' : undefined"
              :title="item.title"
              :aria-label="`${item.title}：${item.value}`"
              @click="item.id === 'station' && !isEditingLayout && $emit('open-channel-list')"
            >
              <div v-if="isEditingLayout" class="station-card-layout-actions">
                <button
                  type="button"
                  title="左移"
                  :disabled="isFirstStationInfoCard(item.id)"
                  @click.stop="settingsStore.moveDashboardStationInfoCard(item.id, -1)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  title="右移"
                  :disabled="isLastStationInfoCard(item.id)"
                  @click.stop="settingsStore.moveDashboardStationInfoCard(item.id, 1)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <button
                  type="button"
                  title="隐藏"
                  @click.stop="settingsStore.setDashboardStationInfoCardVisible(item.id, false)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3 21 21" />
                    <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                    <path
                      d="M9.4 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.1 3.1"
                    />
                    <path d="M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
                  </svg>
                </button>
              </div>
              <svg
                v-if="item.icon === 'radio'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m4 7 13-4" />
                <rect x="3" y="7" width="18" height="14" rx="2" />
                <circle cx="15.5" cy="14" r="3" />
                <path d="M7 12h3M7 16h2" />
              </svg>
              <svg
                v-else-if="item.icon === 'frequency'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M2 12h3l2-6 4 12 3-9 3 6h5" />
              </svg>
              <svg
                v-else-if="item.icon === 'coordinate'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <svg
                v-else-if="item.icon === 'grid'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
              <svg
                v-else-if="item.icon === 'address'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z" />
                <path d="M9 4v13.5M15 6.5V20" />
              </svg>
              <svg
                v-else-if="item.icon === 'contacts'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <svg
                v-else-if="item.icon === 'screen-mode'"
                class="station-info-watermark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
              </svg>
              <svg
                v-else
                class="station-info-watermark station-channel-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
                />
              </svg>
              <div v-if="item.id === 'coordinate'" class="coordinate-content">
                <div v-for="row in coordinateRows" :key="row.key" class="coordinate-row">
                  <span>{{ row.integer }}</span>
                  <i>.</i>
                  <span>{{ row.fraction }}</span>
                </div>
              </div>
              <div v-else-if="item.id === 'radio-setup'" class="radio-setup-content">
                <div class="radio-setup-primary">
                  <span>{{ formatFrequency(radioProfile.freq) }}</span>
                  <i v-if="radioProfile.freq && radioProfile.height" aria-hidden="true"></i>
                  <span>{{ formatHeight(radioProfile.height) }}</span>
                </div>
                <div v-if="radioProfile.ant" class="radio-setup-antenna">
                  <span>{{ radioProfile.ant }}</span>
                </div>
              </div>
              <div v-else-if="item.id === 'contact-stats'" class="contact-stats-content">
                <strong>{{ todayLogs }}/{{ totalLogs }}</strong>
                <span>{{ uniqueCallsigns }}人</span>
              </div>
              <div v-else-if="item.id === 'screen-mode'" class="screen-mode-content">
                <strong>
                  <span>{{ screenModeText }}</span>
                  <button
                    type="button"
                    title="刷新模式"
                    :disabled="screenModeLoading || screenModeSetting"
                    @click="refreshScreenMode"
                  >
                    刷新
                  </button>
                </strong>
                <span class="screen-mode-actions">
                  <button
                    type="button"
                    class="screen-mode-toggle"
                    :disabled="screenModeLoading || screenModeSetting"
                    @click="toggleScreenMode"
                  >
                    {{ screenModeToggleText }}
                  </button>
                </span>
              </div>
              <span v-else>{{ item.value }}</span>
            </component>
          </div>
        </div>

        <div v-if="isEditingLayout && hiddenStationInfoCards.length" class="hidden-panels">
          <span>已隐藏卡片</span>
          <button
            v-for="card in hiddenStationInfoCards"
            :key="card.id"
            type="button"
            @click="settingsStore.setDashboardStationInfoCardVisible(card.id, true)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {{ stationInfoCardLabels[card.id] }}
          </button>
        </div>

        <div
          v-if="!stationInfoCards.length && !(isEditingLayout && hiddenStationInfoCards.length)"
          class="empty-state"
        >
          <div class="empty-state-copy">
            <strong>暂无可达性信息</strong>
            <span>连接设备后会显示在这里</span>
          </div>
        </div>
      </section>

      <section v-else-if="panel.visible && panel.id === 'recent-speaking'" class="event-strip-wrap">
        <h3>
          <span>最近发言</span>
          <span v-if="isEditingLayout" class="panel-layout-actions">
            <button
              type="button"
              title="上移"
              :disabled="isFirstDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, -1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button
              type="button"
              title="下移"
              :disabled="isLastDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, 1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <button
              type="button"
              title="隐藏"
              @click="settingsStore.setDashboardPanelVisible(panel.id, false)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3 21 21" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.4 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.1 3.1" />
                <path d="M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
              </svg>
            </button>
          </span>
        </h3>

        <div v-if="displayHistoryEvents.length === 0" class="empty-state">
          <div class="empty-state-copy">
            <strong>暂无最近发言</strong>
            <span>有新发言时会显示在这里</span>
          </div>
        </div>
        <div v-else class="event-strip">
          <div
            v-for="(event, index) in displayHistoryEvents"
            :key="index"
            class="event-chip"
            :class="{ self: event.callsign === selectedFromCallsign }"
            @click="
              event.callsign !== selectedFromCallsign &&
              $emit('show-callsign-records', event.callsign)
            "
          >
            <span class="event-index-bg" aria-hidden="true">{{ index + 1 }}</span>
            <div class="event-main">
              <div class="event-callsign-line">
                <strong>{{ event.callsign }}</strong>
                <span
                  v-if="
                    event.callsign !== selectedFromCallsign &&
                    todayContactedCallsigns.has(event.callsign)
                  "
                  class="event-contact-star"
                >
                  <img src="/img/star_2b50.webp" alt="" />
                </span>
              </div>
              <span class="event-address">{{ historyAddressMap[event.callsign] || '' }}</span>
              <span class="event-time">{{ formatEventTime(event.utcTime) }}</span>
            </div>
            <span class="event-count">x{{ contactCounts.get(event.callsign) || 0 }}</span>
          </div>
        </div>
      </section>

      <section v-else-if="panel.visible && panel.id === 'speaking-history'" class="history-panel">
        <h3>
          <span>历史发言记录</span>
          <span v-if="isEditingLayout" class="panel-layout-actions">
            <button
              type="button"
              title="上移"
              :disabled="isFirstDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, -1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button
              type="button"
              title="下移"
              :disabled="isLastDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, 1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <button
              type="button"
              title="隐藏"
              @click="settingsStore.setDashboardPanelVisible(panel.id, false)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3 21 21" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.4 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.1 3.1" />
                <path d="M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
              </svg>
            </button>
          </span>
        </h3>

        <div class="history-list">
          <div v-if="displayHistory.length === 0" class="empty-state">
            <div class="empty-state-copy">
              <strong>暂无历史发言记录</strong>
              <span>有发言记录时会显示在这里</span>
            </div>
          </div>

          <div
            v-for="(record, index) in displayHistory"
            :key="index"
            class="history-row"
            :class="{
              active: !record.endTime,
              self: record.callsign === selectedFromCallsign
            }"
            @click="
              record.callsign !== selectedFromCallsign &&
              $emit('show-callsign-records', record.callsign)
            "
          >
            <span class="history-index-bg" aria-hidden="true">{{ index + 1 }}</span>
            <div class="history-name">
              <div class="history-topline">
                <strong :class="{ on: !record.endTime }">
                  {{ record.callsign }}
                </strong>
                <span class="contact-count">
                  <span v-if="record.callsign === selectedFromCallsign" class="self-label">您</span>
                  <template v-else>x{{ contactCounts.get(record.callsign) || 0 }}</template>
                </span>
                <span
                  v-if="
                    record.callsign !== selectedFromCallsign &&
                    todayContactedCallsigns.has(record.callsign)
                  "
                  class="history-contact-star"
                >
                  <img class="star-img" src="/img/star_2b50.webp" alt="" />
                </span>
              </div>

              <div class="history-meta">
                <span v-if="record.serverName" class="detail-tag">{{ record.serverName }}</span>
                <span class="history-address">{{ historyAddressMap[record.callsign] || '' }}</span>
              </div>
            </div>

            <div class="history-times">
              <span class="history-time-summary" :class="{ on: !record.endTime }">
                <template v-if="!record.endTime">发言中</template>
                <template v-else>{{ formatTimeAgo(record.endTime) }}</template>
                {{ formatDurationMmSs((record.endTime || now) - record.startTime) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else-if="panel.visible && panel.id === 'today-contacts'"
        class="today-contact-panel"
      >
        <h3>
          <span>今日通联记录</span>
          <span v-if="isEditingLayout" class="panel-layout-actions">
            <button
              type="button"
              title="上移"
              :disabled="isFirstDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, -1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
            </button>
            <button
              type="button"
              title="下移"
              :disabled="isLastDashboardPanel(panel.id)"
              @click="settingsStore.moveDashboardPanel(panel.id, 1)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <button
              type="button"
              title="隐藏"
              @click="settingsStore.setDashboardPanelVisible(panel.id, false)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 3 21 21" />
                <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                <path d="M9.4 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.1 3.1" />
                <path d="M6.6 6.6C3.6 8.4 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4" />
              </svg>
            </button>
          </span>
        </h3>

        <div class="contact-list">
          <div v-if="todayContactRecords.length === 0" class="empty-state">
            <div class="empty-state-copy">
              <strong>暂无今日通联记录</strong>
              <span>同步到今日通联后会显示在这里</span>
            </div>
          </div>

          <div
            v-for="(record, index) in todayContactRecords"
            :key="`${record.timestamp}-${record.toCallsign}-${index}`"
            class="contact-row"
            @click="$emit('show-callsign-records', record.toCallsign)"
          >
            <span class="contact-index-bg" aria-hidden="true">{{ index + 1 }}</span>
            <div class="contact-name">
              <div class="contact-topline">
                <strong>{{ record.toCallsign }}</strong>
                <span class="contact-record-count">
                  x{{ contactCounts.get(record.toCallsign) || 0 }}
                </span>
              </div>

              <div class="contact-meta">
                <span class="contact-service">{{ record.relayName || '未知服务' }}</span>
                <span class="contact-address">{{ getTodayContactAddress(record) }}</span>
              </div>
            </div>

            <div class="contact-times">
              <span class="contact-time-summary">{{ formatContactTime(record.timestamp) }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>

    <div v-if="isEditingLayout && hiddenDashboardPanels.length" class="hidden-panels">
      <span>已隐藏</span>
      <button
        v-for="panel in hiddenDashboardPanels"
        :key="panel.id"
        type="button"
        @click="settingsStore.setDashboardPanelVisible(panel.id, true)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {{ dashboardPanelLabels[panel.id] }}
      </button>
    </div>

    <div class="dashboard-layout-toolbar">
      <button
        class="layout-edit-button"
        type="button"
        :class="{ active: isEditingLayout }"
        :title="isEditingLayout ? '完成布局编辑' : '编辑布局'"
        @click="isEditingLayout = !isEditingLayout"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span>{{ isEditingLayout ? '完成' : '编辑布局' }}</span>
      </button>
      <button
        v-if="isEditingLayout"
        class="layout-reset-button"
        type="button"
        @click="settingsStore.resetDashboardLayout()"
      >
        恢复默认
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject, reactive } from 'vue'
import { useSpeakingStatusStore } from '../stores/speakingStore'
import { useSettingsStore } from '../stores/settingsStore'
import { formatTimeAgo, formatDurationMmSs } from '../components/home/constants'
import { getAllRecordsFromIndexedDB } from '../services/db'
import { gridToAddress } from '../services/gridService'
import { normalizeHost } from '../utils/urlUtils'
import { FmoApiClient } from '../services/fmoApi'

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
  }
})

defineEmits(['show-callsign-records', 'open-channel-list', 'toggle-dashboard-fullscreen'])

const speakingStore = useSpeakingStatusStore()
const settingsStore = useSettingsStore()
const isEditingLayout = ref(false)

const dashboardPanelLabels = {
  'reachability-info': '可达性信息',
  'recent-speaking': '最近发言',
  'speaking-history': '历史发言记录',
  'today-contacts': '今日通联记录'
}

const stationInfoCardLabels = {
  station: '当前信道',
  'contact-stats': '通联统计',
  device: '电台信息',
  'radio-setup': '电台参数',
  coordinate: '用户坐标',
  grid: 'Grid / 地址',
  'screen-mode': '设备模式'
}

const dashboardHeroElementOptions = [
  { id: 'local-time', label: '本地时间' },
  { id: 'utc-time', label: 'UTC 时间' },
  { id: 'watermark', label: '背景呼号' },
  { id: 'callsign', label: '呼号' },
  { id: 'contact-meta', label: '通联次数/星标' },
  { id: 'server-name', label: '信道' },
  { id: 'grid', label: 'Grid' },
  { id: 'address', label: '地址' },
  { id: 'geo', label: '方位距离' },
  { id: 'duration', label: '发言时长' }
]

const selectedFromCallsign = inject('selectedFromCallsign', ref(''))
const fmoAddress = inject('fmoAddress', ref(''))
const protocol = inject('protocol', ref('ws'))

const now = ref(Date.now())
let nowTimer = null

const myLat = ref(null)
const myLng = ref(null)
const myGridAddress = ref('')
const radioProfile = reactive({
  deviceName: '',
  freq: '',
  ant: '',
  height: ''
})
const screenMode = ref(null)
const screenModeLoading = ref(false)
const screenModeSetting = ref(false)

const historyAddressMap = reactive({})
const todayContactAddressMap = reactive({})
const gridAddressCache = reactive({})
const todayContactRecords = ref([])
let stationInfoRequestId = 0
let screenModeRequestId = 0

// ========== 计算属性 ==========

const currentSpeakerRecord = computed(() => {
  return speakingStore.speakingHistory.find((h) => !h.endTime) || null
})

const currentOwnSpeakerRecord = computed(() => {
  const ownCallsign = selectedFromCallsign.value
  if (!ownCallsign) return null
  return currentSpeakerRecord.value?.callsign === ownCallsign ? currentSpeakerRecord.value : null
})

const isAnyoneSpeaking = computed(() => !!currentSpeakerRecord.value)
const isOwnSpeaking = computed(() => !!currentOwnSpeakerRecord.value)

const displaySpeaker = computed(() => {
  const history = speakingStore.speakingHistory
  const ownCallsign = selectedFromCallsign.value
  const isOwnRecord = (record) => ownCallsign && record?.callsign === ownCallsign

  if (currentSpeakerRecord.value && !isOwnRecord(currentSpeakerRecord.value)) {
    return currentSpeakerRecord.value
  }

  return history.find((h) => !isOwnRecord(h)) || null
})

// 展示的发言者是否正在发言（只有当 displaySpeaker 就是当前发言者时才算）
const isDisplaySpeakerActive = computed(() => {
  return (
    isAnyoneSpeaking.value &&
    currentSpeakerRecord.value?.callsign === displaySpeaker.value?.callsign
  )
})

const hasAnySpeakingHistory = computed(() => speakingStore.speakingHistory.length > 0)

const heroEmptyText = computed(() =>
  isOwnSpeaking.value ? '等待对方回应时会保留在这里' : '有新发言时会显示在这里'
)

const heroOwnCallsign = computed(
  () => currentOwnSpeakerRecord.value?.callsign || selectedFromCallsign.value
)

const currentDate = computed(() => new Date(now.value))
const currentLocalIso = computed(() => currentDate.value.toISOString())
const currentUtcIso = computed(() => currentDate.value.toISOString())
const currentLocalTimeText = computed(() => formatDateTime(currentDate.value, 'local'))
const currentUtcTimeText = computed(() => formatDateTime(currentDate.value, 'utc'))

const displaySpeakerAddress = ref('')
const hasMyCoordinate = computed(() => Number.isFinite(myLat.value) && Number.isFinite(myLng.value))

const displaySpeakerDistance = computed(() => {
  if (!displaySpeaker.value?.grid || !hasMyCoordinate.value) return ''
  const coords = gridToLatLng(displaySpeaker.value.grid)
  if (!coords) return ''
  const dist = haversineDistance(myLat.value, myLng.value, coords.lat, coords.lng)
  if (!Number.isFinite(dist)) return ''
  if (dist < 1) return `${Math.round(dist * 1000)}m`
  return `${dist.toFixed(1)}km`
})

const displaySpeakerBearing = computed(() => {
  if (!displaySpeaker.value?.grid || !hasMyCoordinate.value) return ''
  const coords = gridToLatLng(displaySpeaker.value.grid)
  if (!coords) return ''
  const bearing = calcBearing(myLat.value, myLng.value, coords.lat, coords.lng)
  return Number.isFinite(bearing) ? bearing : ''
})

const displaySpeakerDirection = computed(() => {
  if (displaySpeakerBearing.value === '') return ''
  const deg = displaySpeakerBearing.value
  return `${bearingToDirection(deg)} ${Math.round(deg)}°`
})

const displaySpeakerGeoText = computed(() => {
  if (!displaySpeakerDirection.value || !displaySpeakerDistance.value) return ''
  return `${displaySpeakerDirection.value} ${displaySpeakerDistance.value}`
})

const myCoordinateText = computed(() => {
  if (myLat.value === null || myLng.value === null) return ''
  return `${formatCoordinate(myLat.value)}\n${formatCoordinate(myLng.value)}`
})

const coordinateRows = computed(() => {
  if (myLat.value === null || myLng.value === null) return []
  return [
    { key: 'longitude', ...splitCoordinate(myLng.value) },
    { key: 'latitude', ...splitCoordinate(myLat.value) }
  ]
})

const myGrid = computed(() => {
  if (myLat.value === null || myLng.value === null) return ''
  return latLngToGrid(myLat.value, myLng.value)
})

const speakingDuration = ref('00:00')
const ownSpeakingDuration = ref('00:00')
let durationTimer = null

const displayHistory = computed(() => {
  if (speakingStore.allSpeakingHistories?.length > 0) {
    return speakingStore.allSpeakingHistories
  }
  return speakingStore.speakingHistory
})

const todayContactedCallsigns = computed(() => settingsStore.todayContactedCallsigns)
const contactCounts = computed(() => settingsStore.contactCounts)
const allHistoryEvents = computed(() => speakingStore.allHistoryEvents)
const displayHistoryEvents = computed(() => allHistoryEvents.value)
const dashboardLayout = computed(() => settingsStore.dashboardLayout)
const dashboardStationInfoLayout = computed(() => settingsStore.dashboardStationInfoLayout)
const heroElements = computed(() => settingsStore.dashboardHeroElements)
const showSpeakerClock = computed(
  () => heroElements.value['local-time'] || heroElements.value['utc-time']
)
const showStackedSpeakerClock = computed(
  () => heroElements.value['local-time'] && heroElements.value['utc-time']
)
const showSpeakerIdentity = computed(
  () => heroElements.value.callsign || heroElements.value['contact-meta']
)
const showSpeakerDetails = computed(
  () => heroElements.value['server-name'] || heroElements.value.grid || heroElements.value.address
)
const hiddenDashboardPanels = computed(() =>
  dashboardLayout.value.filter((panel) => !panel.visible)
)
const hiddenStationInfoCards = computed(() =>
  dashboardStationInfoLayout.value.filter((card) => !card.visible)
)
const todayContactsPanelVisible = computed(
  () => dashboardLayout.value.find((panel) => panel.id === 'today-contacts')?.visible !== false
)
const recentSpeakingPanelVisible = computed(
  () => dashboardLayout.value.find((panel) => panel.id === 'recent-speaking')?.visible !== false
)
const speakingHistoryPanelVisible = computed(
  () => dashboardLayout.value.find((panel) => panel.id === 'speaking-history')?.visible !== false
)
const reachabilityPanelVisible = computed(
  () => dashboardLayout.value.find((panel) => panel.id === 'reachability-info')?.visible !== false
)
const shouldLoadStationInfo = computed(
  () => reachabilityPanelVisible.value || (heroElements.value.geo && !!displaySpeaker.value)
)
const screenModeText = computed(() => {
  if (screenMode.value === 1) return '待机模式'
  if (screenMode.value === 0) return '标准模式'
  return ''
})
const screenModeToggleText = computed(() => {
  if (screenMode.value === 1) return '切换到标准'
  if (screenMode.value === 0) return '切换到待机'
  return '切换模式'
})
const stationInfoCards = computed(() => {
  const serverInfo = speakingStore.primaryServerInfo
  const cards = {
    station: {
      id: 'station',
      title: '当前信道',
      value: serverInfo?.name || '',
      icon: 'station'
    },
    'contact-stats': {
      id: 'contact-stats',
      title: '通联统计',
      value: `${props.todayLogs}/${props.totalLogs}\n${props.uniqueCallsigns}人`,
      icon: 'contacts'
    },
    device: { id: 'device', title: '电台信息', value: radioProfile.deviceName, icon: 'radio' },
    'radio-setup': {
      id: 'radio-setup',
      title: '工作频率 / 天线高度 / 天线信息',
      value: [
        [formatFrequency(radioProfile.freq), formatHeight(radioProfile.height)]
          .filter(Boolean)
          .join(' '),
        radioProfile.ant
      ]
        .filter(Boolean)
        .join('\n'),
      icon: 'frequency'
    },
    coordinate: {
      id: 'coordinate',
      title: '用户坐标',
      value: myCoordinateText.value,
      icon: 'coordinate'
    },
    grid: {
      id: 'grid',
      title: 'Grid / 地址',
      value: [myGrid.value, myGridAddress.value].filter(Boolean).join('  '),
      icon: 'grid'
    },
    'screen-mode': {
      id: 'screen-mode',
      title: '设备模式',
      value: screenModeText.value,
      icon: 'screen-mode'
    }
  }

  return dashboardStationInfoLayout.value
    .filter((item) => item.visible)
    .map((item) => cards[item.id])
    .filter((item) => item?.value !== '')
})

// ========== 方法 ==========

function isFirstDashboardPanel(id) {
  return dashboardLayout.value.filter((panel) => panel.visible)[0]?.id === id
}

function isLastDashboardPanel(id) {
  const visiblePanels = dashboardLayout.value.filter((panel) => panel.visible)
  return visiblePanels[visiblePanels.length - 1]?.id === id
}

function isFirstStationInfoCard(id) {
  return stationInfoCards.value[0]?.id === id
}

function isLastStationInfoCard(id) {
  return stationInfoCards.value[stationInfoCards.value.length - 1]?.id === id
}

function formatEventTime(utcTime) {
  if (!utcTime) return ''
  const date = new Date(utcTime * 1000)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatDateTime(date, timezone = 'local') {
  const timezoneOffset = timezone === 'utc' ? 0 : -date.getTimezoneOffset() / 60
  const timezoneText =
    timezoneOffset === 0
      ? 'UTC+0'
      : `UTC${timezoneOffset > 0 ? '+' : ''}${Number.isInteger(timezoneOffset) ? timezoneOffset : timezoneOffset.toFixed(1)}`
  const getValue = (part) =>
    timezone === 'utc'
      ? {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate(),
          hours: date.getUTCHours(),
          minutes: date.getUTCMinutes(),
          seconds: date.getUTCSeconds()
        }[part]
      : {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hours: date.getHours(),
          minutes: date.getMinutes(),
          seconds: date.getSeconds()
        }[part]

  const year = getValue('year')
  const month = String(getValue('month')).padStart(2, '0')
  const day = String(getValue('day')).padStart(2, '0')
  const hours = String(getValue('hours')).padStart(2, '0')
  const minutes = String(getValue('minutes')).padStart(2, '0')
  const seconds = String(getValue('seconds')).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezoneText}`
}

function formatCoordinate(value) {
  return Number(value)
    .toFixed(5)
    .replace(/\.?0+$/, '')
}

function splitCoordinate(value) {
  const [integer, fraction = ''] = formatCoordinate(value).split('.')
  return { integer, fraction }
}

function formatHeight(value) {
  if (value === '' || value === null || value === undefined) return ''
  const text = String(value).trim()
  return /[a-zA-Z米]$/.test(text) ? text : `${text}m`
}

function formatFrequency(value) {
  if (value === '' || value === null || value === undefined) return ''
  const numericValue = Number(String(value).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(numericValue)) return String(value).trim()
  return `${numericValue.toFixed(3)} MHz`
}

function latLngToGrid(latitude, longitude) {
  const lat = Math.max(-90, Math.min(90 - Number.EPSILON, Number(latitude))) + 90
  const lng = Math.max(-180, Math.min(180 - Number.EPSILON, Number(longitude))) + 180
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return ''

  const fieldLng = Math.floor(lng / 20)
  const fieldLat = Math.floor(lat / 10)
  const squareLng = Math.floor((lng % 20) / 2)
  const squareLat = Math.floor(lat % 10)
  const subLng = Math.floor((((lng % 20) % 2) * 60) / 5)
  const subLat = Math.floor(((lat % 1) * 60) / 2.5)

  return `${String.fromCharCode(65 + fieldLng)}${String.fromCharCode(65 + fieldLat)}${squareLng}${squareLat}${String.fromCharCode(65 + subLng)}${String.fromCharCode(65 + subLat)}`
}

function formatContactTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}:${seconds}`
}

function gridToLatLng(grid) {
  if (!grid || grid.length < 4) return null
  grid = String(grid).trim().toUpperCase()
  if (!/^[A-R]{2}\d{2}([A-X]{2})?$/.test(grid)) return null
  let lng = (grid.charCodeAt(0) - 65) * 20 - 180
  let lat = (grid.charCodeAt(1) - 65) * 10 - 90
  lng += parseInt(grid[2]) * 2
  lat += parseInt(grid[3]) * 1
  if (grid.length >= 6) {
    lng += ((grid.charCodeAt(4) - 65) * 5) / 60
    lat += ((grid.charCodeAt(5) - 65) * 2.5) / 60
    lng += 2.5 / 60
    lat += 1.25 / 60
  } else {
    lng += 1
    lat += 0.5
  }
  return { lat, lng }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function bearingToDirection(bearing) {
  const dirs = [
    [22.5, '北'],
    [67.5, '东北'],
    [112.5, '东'],
    [157.5, '东南'],
    [202.5, '南'],
    [247.5, '西南'],
    [292.5, '西'],
    [337.5, '西北'],
    [360, '北']
  ]
  for (const [limit, cn] of dirs) {
    if (bearing < limit) return cn
  }
  return '北'
}

function formatAddress(data) {
  if (!data) return ''
  const parts = []
  if (data.province) parts.push(data.province)
  if (data.city && data.city !== data.province) parts.push(data.city)
  if (data.district) parts.push(data.district)
  return parts.join('-')
}

async function loadGridAddress(grid) {
  if (!grid || gridAddressCache[grid] !== undefined) return gridAddressCache[grid] || ''
  try {
    const result = await gridToAddress(grid)
    const formatted = formatAddress(result)
    gridAddressCache[grid] = formatted
    return formatted
  } catch {
    gridAddressCache[grid] = ''
    return ''
  }
}

async function loadHistoryAddresses(records) {
  for (const record of records) {
    if (record.grid && !historyAddressMap[record.callsign]) {
      historyAddressMap[record.callsign] = await loadGridAddress(record.grid)
    }
  }
}

function getTodayUtcDate() {
  const today = new Date()
  const year = today.getUTCFullYear()
  const month = String(today.getUTCMonth() + 1).padStart(2, '0')
  const day = String(today.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayContactAddress(record) {
  if (!record?.toGrid) return ''
  return todayContactAddressMap[record.toGrid] || record.toGrid
}

async function loadTodayContactAddresses(records) {
  for (const record of records) {
    if (record.toGrid && todayContactAddressMap[record.toGrid] === undefined) {
      todayContactAddressMap[record.toGrid] = await loadGridAddress(record.toGrid)
    }
  }
}

async function loadTodayContactRecords() {
  if (!todayContactsPanelVisible.value) {
    todayContactRecords.value = []
    return
  }

  if (!selectedFromCallsign.value) {
    todayContactRecords.value = []
    return
  }

  try {
    const result = await getAllRecordsFromIndexedDB(
      1,
      999999,
      '',
      selectedFromCallsign.value,
      getTodayUtcDate()
    )
    const todayUtcDate = getTodayUtcDate()
    todayContactRecords.value = (result.data || []).filter((record) => {
      if (!record.timestamp) return false
      const date = new Date(record.timestamp * 1000)
      const recordUtcDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        '0'
      )}-${String(date.getUTCDate()).padStart(2, '0')}`
      return recordUtcDate === todayUtcDate
    })
    await loadTodayContactAddresses(todayContactRecords.value)
  } catch (error) {
    console.error('加载今日通联记录失败:', error)
    todayContactRecords.value = []
  }
}

function normalizeScreenMode(value) {
  const mode = Number(value)
  return mode === 0 || mode === 1 ? mode : null
}

async function refreshScreenMode() {
  const requestId = ++screenModeRequestId
  screenModeLoading.value = true

  let client
  try {
    if (!reachabilityPanelVisible.value || !fmoAddress.value) {
      screenMode.value = null
      return
    }

    const host = normalizeHost(fmoAddress.value)
    const fullAddress = `${protocol.value}://${host}`
    client = new FmoApiClient(fullAddress)
    await client.connect()
    const result = await client.getScreenMode()
    if (requestId !== screenModeRequestId) return

    screenMode.value = normalizeScreenMode(result?.mode)
  } catch {
    if (requestId === screenModeRequestId) screenMode.value = null
  } finally {
    if (requestId === screenModeRequestId) screenModeLoading.value = false
    client?.close()
  }
}

async function toggleScreenMode() {
  if (screenMode.value === null || screenModeSetting.value) return

  const targetMode = screenMode.value === 1 ? 0 : 1
  screenModeSetting.value = true

  let client
  try {
    const host = normalizeHost(fmoAddress.value)
    const fullAddress = `${protocol.value}://${host}`
    client = new FmoApiClient(fullAddress)
    await client.connect()
    const result = await client.setScreenMode(targetMode)
    if (Number(result?.result) === 0) {
      await refreshScreenMode()
    }
  } catch {
    screenMode.value = null
  } finally {
    screenModeSetting.value = false
    client?.close()
  }
}

async function loadStationInfo() {
  const requestId = ++stationInfoRequestId
  radioProfile.deviceName = ''
  radioProfile.freq = ''
  radioProfile.ant = ''
  radioProfile.height = ''
  myLat.value = null
  myLng.value = null
  myGridAddress.value = ''
  screenMode.value = null

  if (!shouldLoadStationInfo.value || !fmoAddress.value) return

  let client
  try {
    const host = normalizeHost(fmoAddress.value)
    const fullAddress = `${protocol.value}://${host}`
    client = new FmoApiClient(fullAddress)
    await client.connect()

    const [deviceResult, freqResult, antResult, heightResult, coordinateResult, screenModeResult] =
      await Promise.allSettled([
        client.getUserPhyDeviceName(),
        client.getUserPhyFreq(),
        client.getUserPhyAnt(),
        client.getUserPhyAntHeight(),
        client.getCoordinate(),
        client.getScreenMode()
      ])

    if (requestId !== stationInfoRequestId) return

    if (deviceResult.status === 'fulfilled') {
      radioProfile.deviceName = String(deviceResult.value?.deviceName ?? '').trim()
    }
    if (freqResult.status === 'fulfilled') {
      radioProfile.freq = String(freqResult.value?.freq ?? '').trim()
    }
    if (antResult.status === 'fulfilled') {
      radioProfile.ant = String(antResult.value?.ant ?? '').trim()
    }
    if (heightResult.status === 'fulfilled') {
      radioProfile.height = String(heightResult.value?.height ?? '').trim()
    }
    if (screenModeResult.status === 'fulfilled') {
      screenMode.value = normalizeScreenMode(screenModeResult.value?.mode)
    }

    const coord = coordinateResult.status === 'fulfilled' ? coordinateResult.value : null
    const latitude = Number(coord?.latitude ?? coord?.lat)
    const longitude = Number(coord?.longitude ?? coord?.lng ?? coord?.lon)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      myLat.value = latitude
      myLng.value = longitude
    }
  } catch {
    // 服务器不可达或不支持可达性信息接口
  } finally {
    client?.close()
  }
}

function updateSpeakingDuration() {
  if (currentSpeakerRecord.value && !currentSpeakerRecord.value.endTime) {
    speakingDuration.value = formatDurationMmSs(Date.now() - currentSpeakerRecord.value.startTime)
  }
  if (currentOwnSpeakerRecord.value && !currentOwnSpeakerRecord.value.endTime) {
    ownSpeakingDuration.value = formatDurationMmSs(
      Date.now() - currentOwnSpeakerRecord.value.startTime
    )
  } else {
    ownSpeakingDuration.value = '00:00'
  }
}

async function updateDisplaySpeakerAddress() {
  if (displaySpeaker.value?.grid) {
    displaySpeakerAddress.value = await loadGridAddress(displaySpeaker.value.grid)
  } else {
    displaySpeakerAddress.value = ''
  }
}

// ========== 生命周期 ==========

onMounted(() => {
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  updateSpeakingDuration()
  durationTimer = setInterval(updateSpeakingDuration, 1000)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
  if (durationTimer) clearInterval(durationTimer)
})

watch(
  [displayHistory, recentSpeakingPanelVisible, speakingHistoryPanelVisible],
  ([records, recentVisible, historyVisible]) => {
    if ((recentVisible || historyVisible) && records?.length > 0) loadHistoryAddresses(records)
  },
  { immediate: true, deep: true }
)

watch(
  [selectedFromCallsign, todayContactsPanelVisible],
  () => {
    loadTodayContactRecords()
  },
  { immediate: true }
)

watch(
  () => settingsStore.contactCounts,
  () => {
    loadTodayContactRecords()
  }
)

watch(displaySpeaker, () => updateDisplaySpeakerAddress(), { immediate: true })

watch([fmoAddress, protocol, shouldLoadStationInfo], () => loadStationInfo(), {
  immediate: true
})

watch(
  [myGrid, reachabilityPanelVisible],
  async ([grid, panelVisible]) => {
    if (!panelVisible || !grid) {
      myGridAddress.value = ''
      return
    }
    const address = await loadGridAddress(grid)
    if (grid === myGrid.value) myGridAddress.value = address
  },
  { immediate: true }
)
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  width: 100%;
  --dashboard-card-bg-soft: var(--alpha-neutral-12);
  --dashboard-card-bg-subtle: var(--alpha-neutral-12);
  --dashboard-card-bg-hover: var(--alpha-black-10);
  --dashboard-action-bg: var(--bg-card);
  --dashboard-self-speaking-bg: var(--alpha-success-08);
  --dashboard-speaking-shadow: var(--alpha-success-25);
}

@supports (color: color-mix(in srgb, red 50%, transparent)) {
  .dashboard-view {
    --dashboard-card-bg-soft: color-mix(in srgb, var(--text-primary) 5%, transparent);
    --dashboard-card-bg-subtle: color-mix(in srgb, var(--text-primary) 3%, transparent);
    --dashboard-card-bg-hover: color-mix(in srgb, var(--text-primary) 7%, transparent);
    --dashboard-action-bg: color-mix(in srgb, var(--bg-card) 88%, transparent);
    --dashboard-self-speaking-bg: color-mix(in srgb, var(--color-speaking) 10%, transparent);
    --dashboard-speaking-shadow: color-mix(in srgb, var(--color-speaking) 32%, transparent);
  }
}

.dashboard-hero,
.reachability-panel,
.event-strip-wrap,
.today-contact-panel,
.history-panel {
  flex-shrink: 0;
  border-radius: 10px;
}

.event-strip-wrap,
.reachability-panel,
.today-contact-panel,
.history-panel {
  background: transparent;
}

.station-info-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
}

.reachability-panel {
  overflow: visible;
}

.station-info-item {
  min-width: 11.5rem;
}

.station-info-card {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 4.5rem;
  padding: 0.7rem 0.75rem;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  background: var(--dashboard-card-bg-soft);
  color: var(--text-secondary);
  font-family: inherit;
  text-align: left;
  overflow: hidden;
}

.station-info-card .station-info-watermark {
  position: absolute;
  right: -0.15rem;
  bottom: -0.35rem;
  width: 3.3rem;
  height: 3.3rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
  opacity: 0.075;
  pointer-events: none;
  z-index: 0;
}

.station-info-card .station-channel-icon {
  fill: currentColor;
  stroke: none;
}

.station-info-card-action {
  border-color: var(--component-header-station-hover-border);
  background: var(--component-header-station-bg);
  color: var(--component-header-station-text);
  cursor: pointer;
}

.station-info-card-editing {
  min-height: 6.4rem;
  padding-top: 2.45rem;
}

.station-card-layout-actions {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-height: 2rem;
  padding: 0.28rem 0.42rem;
  border-bottom: 1px solid var(--border-light);
  background: var(--dashboard-card-bg-soft);
  z-index: 3;
}

.station-card-layout-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.55rem;
  height: 1.55rem;
  padding: 0;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: var(--dashboard-action-bg);
  color: var(--text-tertiary);
}

.station-card-layout-actions button:disabled {
  cursor: default;
  opacity: 0.3;
}

.station-card-layout-actions svg {
  width: 0.92rem;
  height: 0.92rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

@media (hover: hover) {
  .station-info-card-action:hover {
    border-color: var(--component-header-station-hover-border);
    background: var(--component-header-station-hover-bg);
    color: var(--component-header-station-text);
  }

  .station-card-layout-actions button:not(:disabled):hover {
    border-color: var(--border-secondary);
    color: var(--text-secondary);
  }
}

.station-info-card > span {
  position: relative;
  display: -webkit-box;
  min-width: 0;
  padding-right: 1.6rem;
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.25;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-overflow: ellipsis;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  z-index: 1;
}

.radio-setup-content {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-right: 1.6rem;
  line-height: 1.25;
  z-index: 1;
}

.radio-setup-primary,
.radio-setup-antenna {
  display: flex;
  align-items: center;
  min-width: 0;
}

.radio-setup-primary {
  gap: 0.45rem;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
}

.radio-setup-primary i {
  width: 1px;
  height: 0.85rem;
  flex: 0 0 auto;
  background: var(--border-secondary);
}

.radio-setup-antenna {
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 700;
}

.radio-setup-antenna span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coordinate-content {
  position: relative;
  display: grid;
  grid-template-columns: max-content max-content max-content;
  column-gap: 0.2rem;
  min-width: 0;
  padding-right: 1.6rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.25;
  z-index: 1;
}

.coordinate-row {
  display: contents;
}

.coordinate-row span:first-child {
  text-align: right;
}

.coordinate-row i {
  font-style: normal;
}

.contact-stats-content {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-right: 1.6rem;
  line-height: 1.2;
  z-index: 1;
}

.contact-stats-content strong {
  color: var(--text-primary);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.contact-stats-content span {
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.screen-mode-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28rem;
  width: 100%;
  min-width: 0;
  padding-right: 1.6rem;
  line-height: 1.2;
  z-index: 1;
}

.screen-mode-content strong {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screen-mode-content strong span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.screen-mode-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 100%;
  min-width: 0;
}

.screen-mode-content button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.screen-mode-content button:disabled {
  cursor: default;
  opacity: 0.55;
}

@media (hover: hover) {
  .screen-mode-content button:not(:disabled):hover {
    color: var(--text-primary);
  }
}

.dashboard-layout-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  min-height: 2rem;
}

.layout-edit-button,
.layout-reset-button,
.hero-elements-editor label,
.hidden-panels button,
.panel-layout-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.layout-edit-button,
.layout-reset-button {
  min-height: 2rem;
  padding: 0.3rem 0.55rem;
  border-color: var(--border-light);
  border-radius: 5px;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 0.78rem;
}

.layout-edit-button {
  gap: 0.3rem;
}

.layout-edit-button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.layout-edit-button svg,
.hidden-panels button svg,
.panel-layout-actions button svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}

.hidden-panels {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.55rem 0.65rem;
  border: 1px dashed var(--border-light);
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
}

.hero-elements-editor {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.55rem 0.65rem;
  border: 1px dashed var(--border-light);
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 0.78rem;
}

.hero-elements-editor label {
  gap: 0.28rem;
  min-height: 1.9rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-light);
  border-radius: 4px;
  background: var(--bg-table-stripe);
  color: var(--text-secondary);
  cursor: pointer;
}

.hero-elements-editor input {
  width: 0.9rem;
  height: 0.9rem;
  margin: 0;
  accent-color: var(--color-primary);
}

.hidden-panels button {
  gap: 0.25rem;
  min-height: 1.9rem;
  padding: 0.25rem 0.5rem;
  border-color: var(--border-light);
  border-radius: 4px;
  background: var(--bg-table-stripe);
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.dashboard-hero {
  position: relative;
  overflow: hidden;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--border-secondary);
  background: linear-gradient(135deg, var(--bg-card), var(--bg-table-stripe));
}

.dashboard-hero.active {
  background: linear-gradient(135deg, var(--bg-speaking-bar), var(--bg-card));
}

.dashboard-hero.self-speaking:not(.active) {
  background: linear-gradient(270deg, var(--dashboard-self-speaking-bg), var(--bg-card));
}

.dashboard-hero::before {
  position: absolute;
  top: 0;
  right: auto;
  bottom: 0;
  left: 0;
  width: 4px;
  background: var(--text-disabled);
  content: '';
  z-index: 2;
}

.dashboard-hero.active::before {
  background: var(--color-speaking);
}

.dashboard-hero.self-speaking:not(.active)::before {
  top: 0;
  right: 0;
  bottom: 0;
  left: auto;
  width: 4px;
  background: var(--color-speaking);
  box-shadow: -5px 0 16px var(--dashboard-speaking-shadow);
  opacity: 1;
}

.history-marker span {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.history-marker span.on {
  background: var(--color-speaking);
  animation: pulse 1.5s ease-in-out infinite;
}

.hero-watermark {
  position: absolute;
  top: 0;
  right: 0.45rem;
  bottom: 0;
  left: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: var(--text-primary);
  font-size: 6rem;
  font-size: clamp(3.8rem, 15vw, 8.8rem);
  font-weight: 800;
  line-height: 0.9;
  opacity: 0.045;
  overflow: hidden;
  pointer-events: none;
  text-transform: uppercase;
  white-space: nowrap;
  z-index: 0;
}

.hero-watermark-count {
  margin-left: 0.28em;
  text-transform: none;
}

.dashboard-hero.active .hero-watermark {
  color: var(--color-speaking);
  opacity: 0.075;
}

.hero-content {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 1rem;
  padding-top: 1.35rem;
  z-index: 1;
}

.hero-content.without-clock {
  padding-top: 0;
}

.hero-station {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.speaker-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.speaker-clock {
  position: absolute;
  top: 0.72rem;
  right: 1.1rem;
  left: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.16rem 0.55rem;
  max-width: 100%;
  color: var(--text-tertiary);
  font-family: 'IntelOneMono', monospace;
  font-size: 0.88rem;
  font-weight: 500;
  line-height: 1.2;
  opacity: 0.86;
  pointer-events: none;
  text-align: right;
  z-index: 3;
}

.speaker-clock time {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.speaker-clock-divider {
  color: var(--text-disabled);
  font-weight: 400;
  opacity: 0.7;
}

.speaker-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.speaker-callsign {
  color: var(--color-speaking);
  font-size: 3.2rem;
  font-size: clamp(2.45rem, 5.8vw, 4.1rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.95;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.speaker-callsign.idle {
  color: var(--text-secondary);
}

.speaker-contact-count {
  color: var(--text-tertiary);
  font-size: 3.2rem;
  font-size: clamp(2.45rem, 5.8vw, 4.1rem);
  font-weight: 800;
  line-height: 0.95;
  white-space: nowrap;
}

.speaker-contact-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.speaker-contact-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  width: clamp(1.9rem, 4.4vw, 2.95rem);
  height: 2.4rem;
  height: clamp(1.9rem, 4.4vw, 2.95rem);
  line-height: 1;
}

.speaker-contact-star img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.speaker-details,
.history-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.55rem;
  min-width: 0;
  color: var(--text-tertiary);
  font-size: 0.88rem;
}

.speaker-details {
  margin-top: 0.45rem;
}

.speaker-grid {
  text-transform: uppercase;
}

.hero-station .geo-block {
  margin-top: 0.55rem;
}

.geo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  border: 2px solid var(--text-disabled);
  border-radius: 50%;
  background: var(--alpha-neutral-12);
  color: var(--text-tertiary);
  transform-origin: center;
}

.geo-icon svg {
  display: block;
  width: 1.12rem;
  height: 1.12rem;
  fill: currentColor;
  transform: translateY(-0.08rem);
}

.dashboard-hero.active .geo-icon {
  border-color: var(--color-speaking);
  background: var(--alpha-success-12);
  color: var(--color-speaking);
}

.geo-item strong {
  color: var(--text-primary);
  font-size: 1.02rem;
  font-weight: 800;
}

.detail-tag {
  max-width: 100%;
  padding: 0.08rem 0.42rem;
  border-radius: 4px;
  background: var(--alpha-neutral-12);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-metrics {
  display: grid;
  grid-template-columns: auto;
  gap: 0.5rem;
  align-items: stretch;
}

.metric-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 7.2rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-table-stripe);
}

.metric-block span {
  color: var(--text-tertiary);
  font-size: 0.9rem;
  font-weight: 500;
  line-height: 1.2;
}

.metric-block strong {
  color: var(--color-speaking);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.1;
  margin-top: 0.22rem;
  white-space: nowrap;
}

.geo-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  align-self: flex-start;
  column-gap: 0.45rem;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.geo-block strong {
  display: block;
  min-width: 0;
  margin-top: 0;
  color: var(--text-tertiary);
  font-size: 1.02rem;
  font-weight: 700;
}

.dashboard-hero.active .geo-block strong {
  color: var(--color-speaking);
}

.duration-block .idle-duration {
  color: var(--text-secondary);
}

.duration-block .self-speaking-duration {
  color: var(--color-speaking);
}

.duration-block {
  min-width: 6.5rem;
  align-items: flex-end;
  padding-right: 0;
  padding-left: 0.6rem;
  border-color: transparent;
  background: transparent;
  text-align: right;
}

.duration-block .duration-own-callsign {
  min-height: 1.75rem;
  max-width: 10rem;
  color: var(--color-speaking);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  visibility: hidden;
  white-space: nowrap;
}

.duration-block .duration-own-callsign.visible {
  visibility: visible;
}

.duration-block strong {
  font-size: 1.65rem;
}

.hero-empty {
  position: relative;
  display: grid;
  place-items: center;
  align-items: center;
  justify-items: center;
  min-height: 6.7rem;
  color: var(--text-secondary);
  text-align: center;
  z-index: 1;
}

.hero-empty strong,
.hero-empty span {
  display: block;
}

.hero-own-callsign {
  min-height: 2.45rem;
  color: var(--color-speaking);
  font-size: 1.82rem;
  font-weight: 800;
  line-height: 1.15;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-transform: uppercase;
  visibility: hidden;
}

.hero-own-callsign.visible {
  visibility: visible;
}

.hero-empty span {
  margin-top: 0.24rem;
  color: var(--text-tertiary);
  font-size: 0.92rem;
}

.hero-empty .hero-own-callsign {
  margin-top: 0;
  color: var(--color-speaking);
  font-size: 1.82rem;
}

.hero-empty strong {
  color: var(--text-primary);
  font-size: 1.12rem;
  font-weight: 500;
}

.today-contact-panel,
.history-panel {
  overflow: visible;
}

.event-strip-wrap h3,
.reachability-panel h3,
.today-contact-panel h3,
.history-panel h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  flex-shrink: 0;
  margin: 0;
  padding: 0.8rem 1rem;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0;
}

.panel-layout-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.panel-layout-actions button {
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border-color: var(--border-light);
  border-radius: 4px;
  background: transparent;
  color: var(--text-tertiary);
}

.panel-layout-actions button:disabled {
  cursor: default;
  opacity: 0.3;
}

.event-strip-wrap {
  min-width: 0;
  overflow: visible;
}

.event-strip-wrap > .empty-state {
  margin: 0.55rem 0.65rem;
}

.empty-state {
  display: grid;
  grid-column: 1 / -1;
  place-items: center;
  align-items: center;
  justify-items: center;
  min-height: 6.8rem;
  padding: 1.1rem;
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  background: var(--dashboard-card-bg-subtle);
  color: var(--text-tertiary);
  text-align: center;
}

.empty-state-copy {
  min-width: 0;
}

.empty-state-copy strong,
.empty-state-copy span {
  display: block;
}

.empty-state-copy strong {
  color: var(--text-secondary);
  font-size: 0.96rem;
  font-weight: 500;
}

.empty-state-copy span {
  margin-top: 0.16rem;
  color: var(--text-tertiary);
  font-size: 0.86rem;
}

.event-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  overflow: visible;
}

.event-chip {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.45rem;
  min-width: 11.5rem;
  min-height: 6.1rem;
  padding: 0.72rem 0.6rem 0.65rem;
  padding-right: 2.65rem;
  border-radius: 6px;
  background: var(--dashboard-card-bg-soft);
  cursor: pointer;
  overflow: hidden;
  transition: background 0.15s;
}

.event-chip.self {
  cursor: default;
}

.event-index-bg {
  position: absolute;
  right: -0.14rem;
  bottom: -0.3rem;
  color: var(--text-primary);
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
  opacity: 0.065;
  pointer-events: none;
  z-index: 0;
}

.event-callsign-line {
  display: flex;
  align-items: center;
  gap: 0.22rem;
  min-width: 0;
}

.event-callsign-line strong {
  min-width: 0;
}

.event-contact-star {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.08rem;
  height: 1.08rem;
  pointer-events: none;
}

.event-contact-star img {
  display: block;
  width: 1.08rem;
  height: 1.08rem;
  object-fit: contain;
}

.event-main {
  position: relative;
  align-self: center;
  min-width: 0;
  z-index: 1;
}

.event-main strong,
.contact-topline strong,
.history-topline strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 800;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-main strong {
  flex: 0 1 auto;
  font-size: 1.15rem;
}

.event-time {
  display: block;
  margin-top: 0.12rem;
  color: var(--text-tertiary);
  font-size: 0.82rem;
}

.event-address {
  display: -webkit-box;
  width: 100%;
  min-height: calc(0.78rem * 1.25 * 2);
  margin-top: 0.18rem;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.event-count,
.contact-count,
.contact-record-count,
.contact-time-summary,
.history-time-summary {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.event-count {
  position: absolute;
  top: 0.48rem;
  right: 0.55rem;
  font-weight: 700;
  z-index: 1;
}

.contact-list,
.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
  gap: 0.45rem;
  padding: 0.55rem 0.65rem;
  overflow: visible;
}

.contact-row,
.history-row {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 11.5rem;
  min-height: 6.1rem;
  padding: 0.72rem 0.8rem 0.78rem;
  padding-right: 2.65rem;
  border-left: 3px solid transparent;
  border-radius: 6px;
  background: var(--dashboard-card-bg-soft);
  cursor: pointer;
  line-height: 1.35;
  overflow: hidden;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.contact-index-bg,
.history-index-bg {
  position: absolute;
  right: -0.14rem;
  bottom: -0.3rem;
  color: var(--text-primary);
  font-size: 2.6rem;
  font-weight: 800;
  line-height: 1;
  opacity: 0.065;
  pointer-events: none;
  z-index: 0;
}

.contact-row {
  border-left: 0;
}

.history-row.active .history-index-bg {
  color: var(--color-speaking);
  opacity: 0.095;
}

.history-row.active {
  border-left-color: var(--color-speaking);
  background: var(--alpha-success-08);
}

.history-row.self {
  cursor: default;
}

@media (hover: hover) {
  .event-chip:hover,
  .contact-row:hover,
  .history-row:hover {
    background: var(--dashboard-card-bg-hover);
  }

  .history-row.active:hover {
    background: var(--alpha-success-08);
  }
}

.contact-name,
.history-name {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.38rem;
  min-width: 0;
  z-index: 1;
}

.contact-topline,
.history-topline {
  display: flex;
  align-items: center;
  gap: 0.36rem;
  min-width: 0;
}

.contact-topline strong,
.history-topline strong {
  flex: 0 1 auto;
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.15;
}

.contact-record-count,
.history-topline .contact-count {
  position: absolute;
  top: -0.24rem;
  right: -2.1rem;
  flex-shrink: 0;
  margin-top: 0;
  color: var(--text-tertiary);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.15;
  z-index: 1;
}

.history-topline strong.on,
.history-time-summary.on,
.history-row.active .contact-count {
  color: var(--color-speaking);
}

.history-topline .self-label {
  display: inline-block;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
}

.history-contact-star {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.18rem;
  height: 1.18rem;
  line-height: 1;
}

.star-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.contact-times,
.history-times {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  margin-top: auto;
  white-space: nowrap;
  z-index: 1;
}

.contact-time-summary,
.history-time-summary {
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.25;
  text-overflow: ellipsis;
}

.history-time-summary.on {
  background: transparent;
}

.contact-meta,
.history-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  width: 100%;
  min-height: calc(0.78rem * 1.25 * 3 + 0.2rem);
  margin-top: 0;
  font-size: 0.78rem;
  line-height: 1.25;
  overflow: hidden;
}

.contact-service,
.history-meta .detail-tag {
  display: block;
  width: 100%;
  max-width: 100%;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.25;
}

.contact-address,
.history-address {
  display: -webkit-box;
  width: 100%;
  min-height: calc(0.78rem * 1.25 * 2);
  max-width: 100%;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 400;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.45;
    transform: scale(1.2);
  }
}

@supports not (display: grid) {
  .station-info-strip,
  .event-strip,
  .contact-list,
  .history-list {
    display: flex;
    flex-wrap: wrap;
    margin: -0.225rem;
  }

  .station-info-item,
  .event-chip,
  .contact-row,
  .history-row {
    flex: 1 1 11.5rem;
    margin: 0.225rem;
  }

  .station-info-strip {
    padding: 0.325rem 0.425rem;
  }

  .event-strip,
  .contact-list,
  .history-list {
    padding: 0.325rem 0.425rem;
  }

  .hero-content {
    display: flex;
    align-items: stretch;
  }

  .hero-station {
    flex: 1 1 auto;
  }

  .hero-metrics {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
  }

  .geo-block,
  .coordinate-row {
    display: flex;
    align-items: center;
  }

  .geo-block > * + *,
  .coordinate-row > * + * {
    margin-left: 0.45rem;
  }

  .coordinate-row span:first-child {
    min-width: 1.1rem;
  }

  .hero-empty,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-state {
    flex: 1 1 100%;
    margin: 0.225rem;
  }
}

@supports not (gap: 1rem) {
  .dashboard-view > * + * {
    margin-top: 0.75rem;
  }

  .station-card-layout-actions > * + *,
  .dashboard-layout-toolbar > * + *,
  .hidden-panels > * + *,
  .hero-elements-editor > * + *,
  .panel-layout-actions > * + *,
  .speaker-identity > * + *,
  .speaker-contact-meta > * + *,
  .event-callsign-line > * + *,
  .contact-topline > * + *,
  .history-topline > * + * {
    margin-left: 0.4rem;
  }

  .radio-setup-primary > * + *,
  .radio-setup-antenna > * + *,
  .screen-mode-actions > * + *,
  .speaker-details > * + *,
  .history-meta > * + * {
    margin-left: 0.45rem;
  }

  .screen-mode-content > * + *,
  .contact-name > * + *,
  .history-name > * + *,
  .contact-meta > * + *,
  .history-meta > * + * {
    margin-top: 0.35rem;
  }

  .hero-content > * + *,
  .hero-metrics > * + *,
  .contact-row > * + *,
  .history-row > * + * {
    margin-top: 0.5rem;
  }
}

@media (max-width: 760px) {
  .dashboard-view {
    height: auto;
    margin-top: 0.5rem;
  }

  .hero-content {
    grid-template-columns: 1fr;
    gap: 0.75rem;
    padding-top: 1.6rem;
  }

  .hero-content.with-stacked-clock {
    padding-top: 2.75rem;
  }

  .hero-content.without-clock {
    padding-top: 0;
  }

  .hero-metrics {
    grid-template-columns: auto;
    justify-content: end;
    justify-self: stretch;
  }

  .metric-block,
  .geo-block {
    min-width: 0;
  }

  .metric-block strong {
    font-size: 1.25rem;
  }

  .speaker-callsign,
  .speaker-contact-count {
    font-size: 2.75rem;
    font-size: clamp(2.45rem, 12vw, 3.2rem);
  }

  .speaker-contact-meta {
    flex-basis: 100%;
  }

  .speaker-clock {
    flex-direction: column;
    align-items: flex-end;
    gap: 0.18rem;
  }

  .speaker-clock-divider {
    display: none;
  }

  .speaker-contact-star {
    width: 2.1rem;
    width: clamp(1.9rem, 8vw, 2.35rem);
    height: 2.1rem;
    height: clamp(1.9rem, 8vw, 2.35rem);
  }

  .history-row {
    min-height: 6rem;
  }

  @supports not (display: grid) {
    .hero-content {
      flex-direction: column;
    }

    .hero-metrics {
      align-self: flex-end;
    }
  }
}

@media (max-width: 520px) {
  .dashboard-hero {
    padding: 0.8rem 0.9rem;
  }

  .station-info-strip,
  .event-strip,
  .contact-list,
  .history-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .station-info-card {
    min-width: 0;
    max-width: none;
    min-height: 4.5rem;
  }

  .event-chip,
  .contact-row,
  .history-row {
    min-width: 0;
  }

  .speaker-details {
    padding-left: 0;
  }

  .hero-metrics {
    grid-template-columns: 1fr;
    justify-self: end;
  }

  .contact-row,
  .history-row {
    gap: 0.5rem;
    min-height: 5.9rem;
    padding: 0.72rem 0.75rem 0.65rem;
    padding-right: 2.65rem;
  }

  .empty-state {
    min-height: 6.6rem;
  }

  @supports not (display: grid) {
    .station-info-item,
    .event-chip,
    .contact-row,
    .history-row {
      flex-basis: calc(50% - 0.45rem);
      min-width: 0;
    }
  }
}

@media (max-width: 375px) {
  .station-info-strip,
  .event-strip,
  .contact-list,
  .history-list {
    grid-template-columns: minmax(0, 1fr);
  }

  @supports not (display: grid) {
    .station-info-item,
    .event-chip,
    .contact-row,
    .history-row {
      flex-basis: 100%;
    }
  }
}
</style>
