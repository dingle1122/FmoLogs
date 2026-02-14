import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '../views/MainLayout.vue'
import LogsView from '../views/LogsView.vue'
import Top20View from '../views/Top20View.vue'
import OldFriendsView from '../views/OldFriendsView.vue'

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
        }
      ]
    }
  ]
})

export default router
