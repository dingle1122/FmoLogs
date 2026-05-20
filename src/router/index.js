import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../views/MainLayout.vue'
import { getPlatform } from '../platform'

const children = [
  {
    path: '',
    redirect: '/logs'
  },
  {
    path: 'logs',
    name: 'logs',
    component: () => import('../views/LogsView.vue')
  },
  {
    path: 'top20',
    name: 'top20',
    component: () => import('../views/Top20View.vue')
  },
  {
    path: 'old-friends',
    name: 'oldFriends',
    component: () => import('../views/OldFriendsView.vue')
  },
  {
    path: 'messages',
    name: 'messages',
    component: () => import('../views/MessageView.vue')
  },
  {
    path: 'more',
    name: 'more',
    component: () => import('../views/MoreView.vue')
  },
  {
    path: 'remote-control',
    name: 'remoteControl',
    component: () => import('../views/RemoteControlView.vue')
  },
  {
    path: 'friend-links',
    name: 'friendLinks',
    component: () => import('../views/FriendLinksView.vue')
  },
  {
    path: 'about',
    name: 'about',
    component: () => import('../views/AboutView.vue')
  },
  {
    path: 'settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue')
  },
  {
    path: 'themes',
    name: 'themes',
    component: () => import('../views/ThemeSettingsView.vue')
  }
]

// 仅 Android 端注册定位上报路由
if (getPlatform().capabilities.hasNativeLocation) {
  children.push({
    path: 'location-report',
    name: 'locationReport',
    component: () => import('../views/LocationReportView.vue')
  })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children
    }
  ]
})

export default router
