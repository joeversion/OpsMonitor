import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ServiceListView from '../views/ServiceListView.vue';
import authUtils from '../utils/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('../views/ProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:projectId/hosts',
      name: 'project-hosts',
      component: () => import('../views/HostsView.vue'),
      meta: { requiresAuth: true },
      props: true
    },
    {
      path: '/projects/:projectId/hosts/:hostId',
      name: 'host-detail',
      component: () => import('../views/HostsView.vue'),
      meta: { requiresAuth: true },
      props: true
    },
    {
      path: '/projects/:projectId/services',
      name: 'project-services',
      component: ServiceListView,
      meta: { requiresAuth: true },
      props: true
    },
    {
      path: '/hosts',
      name: 'hosts',
      component: () => import('../views/HostsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/services',
      name: 'services',
      component: ServiceListView,
      meta: { requiresAuth: true },
    },
    {
      path: '/connections',
      name: 'connections',
      component: () => import('../views/ConnectionsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:projectId/connections',
      name: 'project-connections',
      component: () => import('../views/ConnectionsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/alerts',
      name: 'alerts',
      component: () => import('../views/AlertConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/security',
      name: 'security',
      component: () => import('../views/SecurityConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/graph',
      name: 'graph',
      component: () => import('../views/DependencyGraphView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/cross-deps',
      name: 'cross-deps',
      component: () => import('../views/CrossProjectDepsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/grafana',
      name: 'grafana',
      component: () => import('../views/GrafanaDashboardsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('../views/UserManagementView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = authUtils.isAuthenticated();
  const requiresAuth = to.meta.requiresAuth !== false;
  const requiresAdmin = to.meta.requiresAdmin === true;

  // If route requires auth and user is not authenticated
  if (requiresAuth && !isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  // If route requires admin and user is not admin
  if (requiresAdmin && !authUtils.isAdmin()) {
    next({ name: 'home' });
    return;
  }

  // If user is authenticated and trying to access login page
  if (to.name === 'login' && isAuthenticated) {
    next({ name: 'home' });
    return;
  }

  next();
});

export default router;
