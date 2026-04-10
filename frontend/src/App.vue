<template>
  <!-- Login page: no navigation -->
  <router-view v-if="isLoginPage" />
  
  <!-- Main layout with navigation -->
  <div v-else class="app-container">
    <el-container>
      <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar-aside">
        <div class="logo-container">
          <el-icon :size="24"><Monitor /></el-icon>
          <span v-show="!isCollapsed">{{ $t('app.brand') }}</span>
        </div>
        
        <!-- Project Selector -->
        <ProjectSelector 
          ref="projectSelectorRef"
          v-model="currentProjectId" 
          @change="handleProjectChange"
          @projects-loaded="handleProjectsLoaded"
          :collapsed="isCollapsed"
        />
        
        <el-menu router :default-active="$route.path" class="sidebar-menu" :collapse="isCollapsed">
          <!-- ANALYZE Group -->
          <div class="menu-group-title" v-show="!isCollapsed">{{ $t('app.menuAnalyze') }}</div>
          <el-menu-item index="/" class="enhanced-menu-item">
            <el-icon><Odometer /></el-icon>
            <template #title>
              <span>{{ $t('app.menuOverview') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/graph" class="enhanced-menu-item">
            <el-icon><Share /></el-icon>
            <template #title>
              <span>{{ $t('app.menuTopology') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/grafana" class="enhanced-menu-item">
            <el-icon><DataBoard /></el-icon>
            <template #title>
              <span>{{ $t('app.menuMetrics') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/alerts" class="enhanced-menu-item">
            <el-icon><Bell /></el-icon>
            <template #title>
              <span>{{ $t('app.menuAlerts') }}</span>
            </template>
          </el-menu-item>

          <div class="menu-divider" v-show="!isCollapsed"></div>

          <!-- INFRASTRUCTURE Group -->
          <div class="menu-group-title" v-show="!isCollapsed">{{ $t('app.menuInfra') }}</div>
          <el-menu-item index="/projects" class="enhanced-menu-item">
            <el-icon><FolderOpened /></el-icon>
            <template #title>
              <span>{{ $t('app.menuProjects') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/hosts" class="enhanced-menu-item">
            <el-icon><Monitor /></el-icon>
            <template #title>
              <span>{{ $t('app.menuHosts') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/services" class="enhanced-menu-item">
            <el-icon><Box /></el-icon>
            <template #title>
              <span>{{ $t('app.menuServices') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/security" class="enhanced-menu-item">
            <el-icon><Key /></el-icon>
            <template #title>
              <span>{{ $t('app.menuSecurity') }}</span>
            </template>
          </el-menu-item>
          
          <div class="menu-divider" v-show="!isCollapsed"></div>

          <!-- System Settings -->
          <el-menu-item index="/users" v-if="isAdmin" class="enhanced-menu-item">
            <el-icon><UserFilled /></el-icon>
            <template #title>
              <span>{{ $t('app.menuUsers') }}</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/settings" class="enhanced-menu-item">
            <el-icon><Tools /></el-icon>
            <template #title>
              <span>{{ $t('app.menuSettings') }}</span>
            </template>
          </el-menu-item>
        </el-menu>
        
        <!-- 折叠按钮 -->
        <div class="collapse-btn" @click="toggleCollapse">
          <el-icon :size="16"><Expand v-if="isCollapsed" /><Fold v-else /></el-icon>
        </div>
      </el-aside>
      <el-container>
        <el-header class="app-header">
          <div class="header-left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item v-if="showProjectInBreadcrumb">{{ currentProjectName }}</el-breadcrumb-item>
              <el-breadcrumb-item>{{ currentPage }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="header-right">
            <el-popover
              ref="alertPopoverRef"
              placement="bottom-end"
              :width="420"
              trigger="click"
              popper-class="alert-popover"
              @show="onAlertPopoverShow"
            >
              <template #reference>
                <el-badge :value="alertCount" :hidden="alertCount === 0" class="item alert-badge-item">
                  <el-icon :size="20" style="cursor: pointer"><Bell /></el-icon>
                </el-badge>
              </template>
              <div class="alert-popover-content">
                <div class="alert-popover-header">
                  <span class="alert-popover-title">{{ $t('app.alertPopoverTitle') }}</span>
                </div>
                <el-scrollbar max-height="360px">
                  <div v-if="recentAlerts.length === 0" class="alert-empty">
                    <el-empty :description="$t('app.alertNoAlerts')" :image-size="60" />
                  </div>
                  <div
                    v-for="alert in recentAlerts"
                    :key="alert.id"
                    class="alert-item"
                    :class="{ 'alert-item-unread': !alert.acknowledged }"
                  >
                    <div class="alert-item-icon">
                      <span v-if="alert.type === 'down'">🔴</span>
                      <span v-else-if="alert.type === 'recovery'">🟢</span>
                      <span v-else-if="alert.type === 'warning'">🟡</span>
                      <span v-else-if="alert.type === 'expiry'">🔐</span>
                      <span v-else>🔔</span>
                    </div>
                    <div class="alert-item-body">
                      <div class="alert-item-name">{{ alert.service_name || alert.security_config_name || '-' }}</div>
                      <div class="alert-item-msg">{{ alert.message }}</div>
                      <div class="alert-item-time">{{ formatAlertTime(alert.created_at) }}</div>
                    </div>
                  </div>
                </el-scrollbar>
                <div class="alert-popover-footer">
                  <el-button link type="primary" @click="goToAlerts">{{ $t('app.alertViewAll') }}</el-button>
                </div>
              </div>
            </el-popover>
            <LangSwitch />
            <el-dropdown @command="handleUserCommand">
              <span class="el-dropdown-link">
                <el-avatar :size="32" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
                <span style="margin-left: 8px;">{{ currentUser?.username || $t('app.defaultUser') }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item disabled>
                    <el-tag size="small" :type="currentUser?.role === 'admin' ? 'warning' : 'info'">
                      {{ currentUser?.role }}
                    </el-tag>
                  </el-dropdown-item>
                  <el-dropdown-item command="profile" divided>
                    <el-icon><User /></el-icon> {{ $t('app.profileSettings') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="logout">
                    <el-icon><SwitchButton /></el-icon> {{ $t('app.logout') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>
        <el-main>
          <router-view :project-id="currentProjectId" />
        </el-main>
      </el-container>
    </el-container>

    <!-- Profile Settings Dialog -->
    <el-dialog v-model="showProfileDialog" :title="$t('app.profileDialogTitle')" width="500px" :close-on-click-modal="false">
      <el-tabs v-model="profileActiveTab">
        <el-tab-pane :label="$t('app.tabProfile')" name="profile">
          <el-form :model="profileForm" label-width="120px" style="padding-top: 10px;">
            <el-form-item :label="$t('app.labelUsername')">
              <el-input v-model="profileForm.username" :placeholder="$t('app.placeholderNewUsername')" />
            </el-form-item>
            <el-form-item :label="$t('app.labelEmail')">
              <el-input v-model="profileForm.email" type="email" :placeholder="$t('app.placeholderNewEmail')" />
            </el-form-item>
            <el-form-item :label="$t('app.labelRole')">
              <el-tag :type="currentUser?.role === 'admin' ? 'warning' : 'info'">
                {{ currentUser?.role }}
              </el-tag>
              <span style="margin-left: 8px; color: #909399; font-size: 12px;">{{ $t('app.roleCannotChange') }}</span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane :label="$t('app.tabPassword')" name="password">
          <el-form :model="passwordForm" label-width="140px" style="padding-top: 10px;">
            <el-form-item :label="$t('app.labelCurrentPwd')">
              <el-input v-model="passwordForm.currentPassword" type="password" show-password :placeholder="$t('app.placeholderCurrentPwd')" />
            </el-form-item>
            <el-form-item :label="$t('app.labelNewPwd')">
              <el-input v-model="passwordForm.newPassword" type="password" show-password :placeholder="$t('app.placeholderNewPwd')" />
            </el-form-item>
            <el-form-item :label="$t('app.labelConfirmPwd')">
              <el-input v-model="passwordForm.confirmPassword" type="password" show-password :placeholder="$t('app.placeholderConfirmPwd')" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showProfileDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button v-if="profileActiveTab === 'profile'" type="primary" :loading="profileSaving" @click="saveProfile">
          {{ $t('app.btnSaveProfile') }}
        </el-button>
        <el-button v-else type="primary" :loading="profileSaving" @click="changePassword">
          {{ $t('app.btnChangePwd') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, provide, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Monitor, Odometer, Box, Bell, Connection, Setting, Tools, ArrowDown, Key, FolderOpened, Share, DataBoard, Expand, Fold, UserFilled, User, SwitchButton, Lock } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import api from './api';
import authApi from './api/auth';
import authUtils from './utils/auth';
import ProjectSelector from './components/ProjectSelector.vue';
import LangSwitch from './components/LangSwitch.vue';
import type { ProjectWithStats } from './api/projects';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const alertCount = ref(0);
const recentAlerts = ref<any[]>([]);
const alertPopoverRef = ref();
const currentProjectId = ref<string | undefined>(undefined);
const currentProjectData = ref<ProjectWithStats | null>(null);
const projectCount = ref(0);
const projectSelectorRef = ref<{ refresh: () => void } | null>(null);
const projectsVersion = ref(0);
const addProjectTrigger = ref(0);
const isCollapsed = ref(false); // 默认展开

// Check if current route is login page
const isLoginPage = computed(() => route.path === '/login');

// Current user - use ref to make it reactive when login/logout
const currentUser = ref(authUtils.getUser());
const isAdmin = computed(() => currentUser.value?.role === 'admin');

// Profile dialog state
const showProfileDialog = ref(false);
const profileActiveTab = ref('profile');
const profileSaving = ref(false);
const profileForm = ref({
  username: '',
  email: '',
});
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Watch route changes to update user info when navigating away from login
watch(() => route.path, (newPath, oldPath) => {
  if (oldPath === '/login' && newPath !== '/login') {
    // User just logged in, refresh user data
    currentUser.value = authUtils.getUser();
  }
});

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

async function handleUserCommand(command: string) {
  if (command === 'logout') {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore logout API errors
    }
    authUtils.clearAuth();
    currentUser.value = null; // Clear user state
    ElMessage.success(t('app.logoutSuccess'));
    router.push('/login');
  } else if (command === 'profile') {
    // Open profile dialog with current values
    profileForm.value = {
      username: currentUser.value?.username || '',
      email: currentUser.value?.email || '',
    };
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    profileActiveTab.value = 'profile';
    showProfileDialog.value = true;
  }
}

async function saveProfile() {
  if (!profileForm.value.username && !profileForm.value.email) {
    ElMessage.warning(t('app.msgUpdateOneField'));
    return;
  }

  profileSaving.value = true;
  try {
    const updatedUser = await authApi.updateProfile({
      username: profileForm.value.username || undefined,
      email: profileForm.value.email || undefined,
    });
    
    // Update localStorage and local state
    authUtils.setUser({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role,
    });
    currentUser.value = authUtils.getUser();
    
    ElMessage.success(t('app.msgProfileUpdated'));
    showProfileDialog.value = false;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || t('app.msgProfileFailed'));
  } finally {
    profileSaving.value = false;
  }
}

async function changePassword() {
  const { currentPassword, newPassword, confirmPassword } = passwordForm.value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    ElMessage.warning(t('app.msgFillAllPwd'));
    return;
  }
  
  if (newPassword.length < 6) {
    ElMessage.warning(t('app.msgPwdMinLength'));
    return;
  }
  
  if (newPassword !== confirmPassword) {
    ElMessage.warning(t('app.msgPwdMismatch'));
    return;
  }

  profileSaving.value = true;
  try {
    await authApi.updatePassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
    });
    ElMessage.success(t('app.msgPwdChanged'));
    showProfileDialog.value = false;
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || t('app.msgPwdChangeFailed'));
  } finally {
    profileSaving.value = false;
  }
}

const currentProjectName = computed(() => {
  return currentProjectData.value?.name || t('projectSelector.allProjects');
});

// System and shared pages don't need project prefix in breadcrumb
const showProjectInBreadcrumb = computed(() => {
  const systemPages = ['/settings', '/users', '/projects'];
  const sharedPages = ['/security', '/grafana', '/alerts'];
  const currentPath = route.path;
  return !systemPages.includes(currentPath) && !sharedPages.includes(currentPath);
});

const currentPage = computed(() => {
  const pathMap: Record<string, string> = {
    '/': t('app.menuOverview'),
    '/projects': t('app.menuProjects'),
    '/hosts': t('app.menuHosts'),
    '/services': t('app.menuServices'),
    '/security': t('app.menuSecurity'),
    '/alerts': t('app.menuAlerts'),
    '/graph': t('app.menuTopology'),
    '/grafana': t('app.menuMetrics'),
    '/settings': t('app.menuSettings'),
    '/users': t('app.breadcrumbUserMgmt'),
  };
  return pathMap[route.path] || t('app.breadcrumbDashboard');
});

function handleProjectChange(project: ProjectWithStats | null) {
  currentProjectData.value = project;
}

function handleProjectsLoaded(projects: ProjectWithStats[]) {
  projectCount.value = projects.length;
}

// Set project from child components (e.g., ProjectsView)
function setCurrentProject(projectId: number | null) {
  currentProjectId.value = projectId;
}

// Refresh project selector dropdown
function refreshProjects() {
  projectSelectorRef.value?.refresh();
}

// Notify all listeners that projects list has changed
// 只递增 version，让各 watch 自行节流处理；CRUD 场景走 refreshProjects() 直接刷新
function notifyProjectsUpdated() {
  projectsVersion.value++;
}

// Trigger open Add Project dialog in ProjectsView
function triggerAddProject() {
  addProjectTrigger.value++;
}

// Provide project context to child components
provide('currentProjectId', currentProjectId);
provide('setCurrentProject', setCurrentProject);
provide('refreshProjects', refreshProjects);
provide('projectsVersion', projectsVersion);
provide('notifyProjectsUpdated', notifyProjectsUpdated);
provide('addProjectTrigger', addProjectTrigger);
provide('triggerAddProject', triggerAddProject);

// ── Alert bell helpers ──
async function fetchAlertCount() {
  try {
    const res = await api.get('/alerts/unacknowledged/count');
    alertCount.value = res.data.count ?? 0;
  } catch { /* ignore */ }
}

async function onAlertPopoverShow() {
  try {
    const res = await api.get('/alerts', { params: { limit: 5 } });
    recentAlerts.value = res.data;
    // Auto-acknowledge: opening the popover = user has seen the alerts
    if (alertCount.value > 0) {
      alertCount.value = 0;
      api.post('/alerts/acknowledge').catch(() => {});
    }
  } catch { /* ignore */ }
}

async function acknowledgeAlerts() {
  try {
    await api.post('/alerts/acknowledge');
    alertCount.value = 0;
    // Mark local list as read
    recentAlerts.value = recentAlerts.value.map(a => ({ ...a, acknowledged: 1 }));
  } catch { /* ignore */ }
}

function goToAlerts() {
  alertPopoverRef.value?.hide();
  router.push('/alerts');
}

function formatAlertTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('app.alertJustNow');
  if (diffMin < 60) return t('app.alertMinutesAgo', { n: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('app.alertHoursAgo', { n: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  return t('app.alertDaysAgo', { n: diffDay });
}

onMounted(async () => {
  // Fetch unacknowledged alert count for bell badge
  await fetchAlertCount();

  // 全局 SSE：监听 check 事件，实时刷新项目状态统计 + 告警计数
  let _throttle: ReturnType<typeof setTimeout> | null = null;
  const token = authUtils.getToken();
  const apiBase = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  globalSse = new EventSource(`${apiBase}/checks/events${token ? '?token=' + encodeURIComponent(token) : ''}`);
  globalSse.onmessage = () => {
    if (_throttle) return;
    _throttle = setTimeout(() => {
      notifyProjectsUpdated();
      fetchAlertCount();
      _throttle = null;
    }, 2000);
  };
});

let globalSse: EventSource | null = null;
onUnmounted(() => {
  if (globalSse) globalSse.close();
});
</script>

<style>
:root {
  --sidebar-bg: #001529;
  --sidebar-active: #1890ff;
  --header-height: 60px;
}

.menu-group-title {
  padding: 16px 20px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45) !important;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  display: block !important;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.menu-divider {
  height: 1px;
  background: #002140;
  margin: 10px 0;
}

.menu-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.menu-label {
  font-size: 14px;
  font-weight: 500;
}

.menu-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
}

.enhanced-menu-item {
  position: relative;
}

.enhanced-menu-item.is-active .menu-desc {
  color: rgba(255, 255, 255, 0.85);
}

.enhanced-menu-item:hover .menu-desc {
  color: rgba(255, 255, 255, 0.65);
}

.menu-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none !important;
}

.menu-disabled:hover {
  background-color: transparent !important;
}

.lock-icon {
  position: absolute;
  right: 20px;
  color: rgba(255, 255, 255, 0.3);
}

.app-container {
  height: 100vh;
}
.el-container {
  height: 100%;
}

/* Sidebar dark theme */
.el-aside {
  background-color: var(--sidebar-bg);
  overflow-x: hidden;
  position: relative;
  z-index: 1000; /* 确保侧边栏始终在最上层 */
  transition: width 0.3s ease;
}

.sidebar-aside {
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.logo-container {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #002140;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  gap: 10px;
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-menu {
  background-color: var(--sidebar-bg) !important;
  border-right: none;
  flex: 1;
  overflow-y: auto;
}

.sidebar-menu:not(.el-menu--collapse) {
  width: 100%;
}

.collapse-btn {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #a6adb4;
  border-top: 1px solid #1f3a50;
  transition: all 0.2s;
  flex-shrink: 0;
  overflow: hidden;
}

.collapse-btn:hover {
  color: #fff;
  background-color: rgba(64, 158, 255, 0.3);
}

.sidebar-menu .el-menu-item {
  color: #a6adb4 !important;
}

.sidebar-menu .el-menu-item:hover,
.sidebar-menu .el-menu-item.is-active {
  background-color: var(--sidebar-active) !important;
  color: #fff !important;
}

.sidebar-menu .el-menu-item .el-icon {
  color: inherit;
}

/* 折叠状态下的菜单样式 */
.sidebar-menu.el-menu--collapse .el-menu-item {
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.sidebar-menu.el-menu--collapse .el-menu-item .el-icon {
  margin: 0 !important;
  display: inline-flex !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* 确保折叠状态下图标容器正确显示 */
.sidebar-menu.el-menu--collapse .el-menu-item > .el-icon {
  width: var(--el-menu-icon-width) !important;
  height: var(--el-menu-icon-width) !important;
}

/* Header */
.app-header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: var(--header-height);
  box-shadow: 0 1px 4px rgba(0,21,41,.08);
  position: relative;
  z-index: 1000; /* 确保 header 始终在最上层 */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.el-dropdown-link {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.el-main {
  background-color: #f0f2f5;
  padding: 20px;
}

/* ── Alert Bell Popover ── */
.alert-badge-item {
  display: flex;
  align-items: center;
}

.alert-popover-content {
  margin: -12px;
}

.alert-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.alert-popover-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}

.alert-empty {
  padding: 20px 0;
}

.alert-item {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid #fafafa;
  transition: background 0.15s;
  cursor: default;
}

.alert-item:hover {
  background: #f5f7fa;
}

.alert-item-unread {
  background: #ecf5ff;
}

.alert-item-unread:hover {
  background: #d9ecff;
}

.alert-item-icon {
  font-size: 18px;
  flex-shrink: 0;
  padding-top: 2px;
}

.alert-item-body {
  flex: 1;
  min-width: 0;
}

.alert-item-name {
  font-weight: 600;
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-item-msg {
  font-size: 12px;
  color: #606266;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.alert-item-time {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
}

.alert-popover-footer {
  text-align: center;
  padding: 8px 0;
  border-top: 1px solid #f0f0f0;
}
</style>
