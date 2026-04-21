import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../views/MainLayout.vue'
import LogsView from '../views/LogsView.vue'
import Top20View from '../views/Top20View.vue'
import OldFriendsView from '../views/OldFriendsView.vue'
import MessageView from '../views/MessageView.vue'
import MoreView from '../views/MoreView.vue'
import RemoteControlView from '../views/RemoteControlView.vue'
import FriendLinksView from '../views/FriendLinksView.vue'
import AboutView from '../views/AboutView.vue'
import SettingsView from '../views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          redirect: '/logs'
        },
        {
          path: 'logs',
          name: 'logs',
          component: LogsView
        },
        {
          path: 'top20',
          name: 'top20',
          component: Top20View
        },
        {
          path: 'old-friends',
          name: 'oldFriends',
          component: OldFriendsView
        },
        {
          path: 'messages',
          name: 'messages',
          component: MessageView
        },
        {
          path: 'more',
          name: 'more',
          component: MoreView
        },
        {
          path: 'remote-control',
          name: 'remoteControl',
          component: RemoteControlView
        },
        {
          path: 'friend-links',
          name: 'friendLinks',
          component: FriendLinksView
        },
        {
          path: 'about',
          name: 'about',
          component: AboutView
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView
        }
      ]
    }
  ]
})

export default router
