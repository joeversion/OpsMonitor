<template>
  <div class="projects-view">
    <div class="page-header">
      <h1>📋 {{ $t('projectsPage.title') }}</h1>
      <el-button type="primary" @click="showAddDialog = true" v-if="isAdmin">
        <el-icon><Plus /></el-icon>
        {{ $t('projectsPage.createProject') }}
      </el-button>
    </div>

    <!-- Global Stats -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><FolderOpened /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('projectsPage.totalProjects') }}</div>
            <div class="stat-value">{{ filteredProjects.length }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><Monitor /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('projectsPage.totalServices') }}</div>
            <div class="stat-value">{{ totalServices }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9eb; color: #67C23A;">
            <el-icon :size="24"><CircleCheckFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('statusLabels.healthy') }}</div>
            <div class="stat-value" style="color: #67C23A">{{ totalHealthy }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><WarningFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('statusLabels.warning') }}</div>
            <div class="stat-value" style="color: #E6A23C">{{ totalWarning }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fef0f0; color: #F56C6C;">
            <el-icon :size="24"><CircleCloseFilled /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('statusLabels.down') }}</div>
            <div class="stat-value" style="color: #F56C6C">{{ totalDown }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Projects Grid -->
    <div class="projects-grid" v-loading="loading">
      <div 
        v-for="project in filteredProjects" 
        :key="project.id" 
        class="project-card"
        :class="{ 'is-current': String(project.id) === String(currentProjectId?.value) }"
        @click="selectProject(project)"
      >
        <div class="card-header">
          <div 
            class="project-icon" 
            :style="{ background: getGradient(project.icon_color) }"
          >
            {{ project.name.charAt(0) }}
          </div>
          <div class="project-info">
            <div class="project-name">
              {{ project.name }}
              <el-tag 
                :type="getStatusType(project)" 
                size="small"
                effect="light"
              >
                {{ getStatusText(project) }}
              </el-tag>
            </div>
            <el-tooltip 
              placement="bottom"
              :disabled="!isDescriptionOverflow(project.description)"
              :show-after="500"
              raw-content
              effect="light"
              popper-class="project-desc-tooltip"
            >
              <template #content>
                <div v-html="project.description || $t('projectsPage.noDescription')" style="max-width: 300px; color: #303133;"></div>
              </template>
              <div 
                class="project-desc" 
                @click.stop="copyDescription(project.description)"
                v-html="project.description || `<span style='color:#999'>${$t('projectsPage.noDescription')}</span>`"
              ></div>
            </el-tooltip>
          </div>
          <el-dropdown trigger="click" class="project-menu" @click.stop v-if="isAdmin">
            <el-button :icon="MoreFilled" circle text class="more-btn" @click.stop />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click.stop="editProject(project)">
                  <el-icon><Edit /></el-icon> {{ $t('common.edit') }}
                </el-dropdown-item>
                <el-dropdown-item @click.stop="confirmDelete(project)" divided>
                  <el-icon color="#f56c6c"><Delete /></el-icon> 
                  <span style="color: #f56c6c">{{ $t('common.delete') }}</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="card-stats">
          <div class="pstat">
            <div class="pstat-value">{{ project.service_count }}</div>
            <div class="pstat-label">{{ $t('projectsPage.services') }}</div>
          </div>
          <div class="pstat">
            <div class="pstat-value healthy">{{ project.healthy_count }}</div>
            <div class="pstat-label">{{ $t('statusLabels.healthy') }}</div>
          </div>
          <div class="pstat">
            <div class="pstat-value warning">{{ project.warning_count }}</div>
            <div class="pstat-label">{{ $t('statusLabels.warning') }}</div>
          </div>
          <div class="pstat">
            <div class="pstat-value down">{{ project.down_count }}</div>
            <div class="pstat-label">{{ $t('statusLabels.down') }}</div>
          </div>
        </div>
      </div>

      <!-- Add New Project Card -->
      <div class="project-card add-card" @click="showAddDialog = true" v-if="isAdmin">
        <div class="add-content">
          <div class="add-icon">
            <el-icon :size="32"><Plus /></el-icon>
          </div>
          <div class="add-text">{{ $t('projectsPage.dialogCreate') }}</div>
          <div class="add-subtext">{{ $t('projectsPage.createProjectDesc') }}</div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Project Dialog -->
    <el-dialog 
      v-model="showAddDialog" 
      :title="editingProject ? $t('projectsPage.dialogEdit') : $t('projectsPage.dialogCreate')" 
      width="450px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form :model="projectForm" label-position="top">
        <el-form-item :label="$t('projectsPage.labelName')" required>
          <el-input v-model="projectForm.name" :placeholder="$t('projectsPage.placeholderName')" />
        </el-form-item>
        <el-form-item :label="$t('projectsPage.labelDesc')">
          <div class="rich-editor-container">
            <Toolbar
              style="border-bottom: 1px solid #dcdfe6"
              :editor="editorRef"
              :defaultConfig="toolbarConfig"
              mode="simple"
            />
            <Editor
              style="height: 150px; overflow-y: auto;"
              v-model="projectForm.description"
              :defaultConfig="editorConfig"
              mode="simple"
              @onCreated="handleEditorCreated"
            />
          </div>
        </el-form-item>
        <el-form-item :label="$t('projectsPage.labelIconColor')">
          <div class="color-options">
            <el-tooltip 
              v-for="color in colorOptions" 
              :key="color.value"
              :content="color.name"
              placement="top"
              :show-after="300"
            >
              <div 
                class="color-option"
                :class="{ active: projectForm.icon_color === color.value }"
                :style="{ background: color.gradient }"
                @click="projectForm.icon_color = color.value"
              >
                <el-icon v-if="projectForm.icon_color === color.value" :size="20"><Check /></el-icon>
              </div>
            </el-tooltip>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          {{ editingProject ? $t('common.save') : $t('projectsPage.createProject') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, shallowRef, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  Plus, FolderOpened, Monitor, CircleCheckFilled, WarningFilled, CircleCloseFilled,
  MoreFilled, Edit, Delete, Check
} from '@element-plus/icons-vue';
import { 
  getProjects, createProject, updateProject, deleteProject,
  type ProjectWithStats 
} from '../api/projects';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import '@wangeditor/editor/dist/css/style.css';
import { i18nChangeLanguage } from '@wangeditor/editor';
import authUtils from '../utils/auth';

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const router = useRouter();
const { t } = useI18n();
const setCurrentProject = inject<(id: number | string | null) => void>('setCurrentProject');
const currentProjectId = inject<import('vue').Ref<string | undefined>>('currentProjectId');
const refreshProjects = inject<() => void>('refreshProjects');
const projectsVersion = inject<import('vue').Ref<number>>('projectsVersion');
const addProjectTrigger = inject<import('vue').Ref<number>>('addProjectTrigger');
const projects = ref<ProjectWithStats[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);
const saving = ref(false);
const editingProject = ref<ProjectWithStats | null>(null);

const projectForm = ref({
  name: '',
  description: '',
  icon_color: 'blue'
});

// Rich text editor
const editorRef = shallowRef();

const toolbarConfig = {
  toolbarKeys: [
    'bold', 'italic', 'underline', 'through',
    '|',
    'color', 'bgColor',
    '|',
    'fontSize', 'fontFamily',
    '|',
    'bulletedList', 'numberedList',
    '|',
    'clearStyle'
  ]
};

const editorConfig = {
  placeholder: t('projectsPage.placeholderDesc'),
  MENU_CONF: {
    fontSize: {
      fontSizeList: ['12px', '14px', '16px', '18px', '20px', '24px']
    },
    fontFamily: {
      fontFamilyList: [
        'Arial',
        'Helvetica',
        'Verdana',
        'Georgia',
        'Times New Roman',
        'Courier New',
        'Microsoft YaHei',
        'SimSun'
      ]
    }
  }
};

function handleEditorCreated(editor: any) {
  editorRef.value = editor;
}

onBeforeUnmount(() => {
  const editor = editorRef.value;
  if (editor) {
    editor.destroy();
  }
});

const colorOptions = [
  { value: 'blue', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', name: 'Royal Purple' },
  { value: 'green', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)', name: 'Emerald' },
  { value: 'orange', gradient: 'linear-gradient(135deg, #f5af19, #f12711)', name: 'Sunset' },
  { value: 'purple', gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)', name: 'Purple Dream' },
  { value: 'teal', gradient: 'linear-gradient(135deg, #0093E9, #80D0C7)', name: 'Ocean Blue' },
  { value: 'pink', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)', name: 'Pink Rose' },
  { value: 'crimson', gradient: 'linear-gradient(135deg, #eb3349, #f45c43)', name: 'Crimson Sunset' },
  { value: 'indigo', gradient: 'linear-gradient(135deg, #4776e6, #8e54e9)', name: 'Indigo Night' },
  { value: 'lime', gradient: 'linear-gradient(135deg, #56ab2f, #a8e063)', name: 'Lime Green' },
  { value: 'amber', gradient: 'linear-gradient(135deg, #ffb75e, #ed8f03)', name: 'Amber Gold' },
  { value: 'cyan', gradient: 'linear-gradient(135deg, #13d2b8, #00a8cc)', name: 'Cyan Wave' },
  { value: 'violet', gradient: 'linear-gradient(135deg, #d02aad, #e94057)', name: 'Violet Bloom' },
  { value: 'forest', gradient: 'linear-gradient(135deg, #134e5e, #71b280)', name: 'Forest Green' },
  { value: 'berry', gradient: 'linear-gradient(135deg, #8e2de2, #4a00e0)', name: 'Berry Purple' },
  { value: 'coral', gradient: 'linear-gradient(135deg, #ff6a88, #ff9472)', name: 'Coral Reef' },
  { value: 'navy', gradient: 'linear-gradient(135deg, #2e3192, #1bffff)', name: 'Navy Blue' }
];

const filteredProjects = computed(() => projects.value);

const totalServices = computed(() => filteredProjects.value.reduce((sum, p) => sum + p.service_count, 0));
const totalHealthy = computed(() => filteredProjects.value.reduce((sum, p) => sum + p.healthy_count, 0));
const totalWarning = computed(() => filteredProjects.value.reduce((sum, p) => sum + p.warning_count, 0));
const totalDown = computed(() => filteredProjects.value.reduce((sum, p) => sum + p.down_count, 0));

function getGradient(color: string): string {
  const option = colorOptions.find(c => c.value === color);
  return option ? option.gradient : (colorOptions[0]?.gradient || '');
}

function getStatusType(project: ProjectWithStats): 'success' | 'warning' | 'danger' {
  if (project.down_count > 0) return 'danger';
  if (project.warning_count > 0) return 'warning';
  return 'success';
}

function getStatusText(project: ProjectWithStats): string {
  if (project.down_count > 0) return t('statusLabels.critical');
  if (project.warning_count > 0) return t('statusLabels.warning');
  return t('statusLabels.healthy');
}

function isDescriptionOverflow(description: string | undefined): boolean {
  if (!description) return false;
  // Check if description has more than 2 lines or is too long
  const lines = description.split('\n');
  return lines.length > 2 || description.length > 80;
}

function copyDescription(description: string | undefined) {
  if (!description) return;
  // Strip HTML tags for plain text copy
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = description;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';
  navigator.clipboard.writeText(plainText).then(() => {
    ElMessage.success(t('projectsPage.copiedToClipboard'));
  }).catch(() => {
    ElMessage.error(t('projectsPage.copyFailed'));
  });
}

async function loadProjects(silent = false) {
  if (!silent) loading.value = true;
  try {
    projects.value = await getProjects();
  } catch (error) {
    if (!silent) ElMessage.error(t('projectsPage.loadFailed'));
  } finally {
    if (!silent) loading.value = false;
  }
}

function selectProject(project: ProjectWithStats) {
  // Update project selector to select this project
  if (setCurrentProject) {
    setCurrentProject(project.id);
  }
  // Navigate to dashboard with project selected
  router.push('/');
}

function editProject(project: ProjectWithStats) {
  editingProject.value = project;
  projectForm.value = {
    name: project.name,
    description: project.description || '',
    icon_color: project.icon_color
  };
  showAddDialog.value = true;
}

async function handleSave() {
  if (!projectForm.value.name.trim()) {
    ElMessage.warning(t('projectsPage.ruleNameRequired'));
    return;
  }

  saving.value = true;
  try {
    if (editingProject.value) {
      await updateProject(editingProject.value.id, projectForm.value);
      ElMessage.success(t('projectsPage.updateSuccess'));
    } else {
      await createProject(projectForm.value);
      ElMessage.success(t('projectsPage.createSuccess'));
    }
    showAddDialog.value = false;
    await loadProjects();
    refreshProjects?.();
  } catch (error) {
    ElMessage.error(t('projectsPage.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  // Destroy editor instance to avoid conflicts
  const editor = editorRef.value;
  if (editor) {
    editor.destroy();
    editorRef.value = null;
  }
  editingProject.value = null;
  projectForm.value = { name: '', description: '', icon_color: 'blue' };
}

async function confirmDelete(project: ProjectWithStats) {
  try {
    await ElMessageBox.confirm(
      t('projectsPage.deleteConfirm', { name: project.name }),
      t('projectsPage.deleteProject'),
      { type: 'warning', confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel') }
    );
    await deleteProject(project.id);
    ElMessage.success(t('projectsPage.deleteSuccess'));
    await loadProjects();
    refreshProjects?.();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('projectsPage.deleteFailed'));
    }
  }
}

// 当外部（如 ProjectSelector 快捷添加）创建项目时，自动刷新列表
// 加前沿节流 30s，避免 SSE 频繁触发 projectsVersion 导致页面持续刷新
let _projectsVersionThrottle: ReturnType<typeof setTimeout> | null = null;
watch(projectsVersion!, () => {
  if (_projectsVersionThrottle) return;
  loadProjects(true);  // 后台静默刷新，用户无感知
  _projectsVersionThrottle = setTimeout(() => {
    _projectsVersionThrottle = null;
  }, 30000);
});

// 当侧边栏点击 New Project 时，自动打开新建对话框
watch(addProjectTrigger!, () => {
  showAddDialog.value = true;
});

onMounted(() => {
  // Set wangEditor to English
  i18nChangeLanguage('en');
  loadProjects();
});
</script>

<style scoped>
.projects-view {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #101828;
}

/* Stats Cards */
.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 4px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
  transition: all 0.3s;
  height: 100px;
  box-sizing: border-box;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-info {
  text-align: right;
}

.stat-label {
  color: #909399;
  font-size: 14px;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.project-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.project-card.is-current {
  border: 2px solid #409EFF;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
}

.card-header {
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.project-icon {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  color: #101828;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-desc {
  font-size: 13px;
  color: #667085;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
}

.project-desc:hover {
  color: #344054;
}

.card-stats {
  padding: 16px 20px;
  background: #f9fafb;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.pstat {
  text-align: center;
}

.pstat-value {
  font-size: 20px;
  font-weight: 600;
  color: #101828;
}

.pstat-value.healthy { color: #12b76a; }
.pstat-value.warning { color: #f79009; }
.pstat-value.down { color: #f04438; }

.pstat-label {
  font-size: 11px;
  color: #667085;
  text-transform: uppercase;
}

/* Add Card */
.project-card.add-card {
  border: 2px dashed #d0d5dd;
  background: transparent;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.project-card.add-card:hover {
  border-color: #409EFF;
  background: #f9fafb;
  transform: none;
  box-shadow: none;
}

.add-content {
  text-align: center;
}

.add-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f2f4f7;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  color: #667085;
}

.add-text {
  font-size: 16px;
  font-weight: 500;
  color: #344054;
}

.add-subtext {
  font-size: 13px;
  color: #667085;
  margin-top: 4px;
}

/* Color Options */
.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 100%;
}

.color-option {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.color-option:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.color-option.active {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.5);
  transform: scale(1.1);
}

.color-option.active:hover {
  transform: translateY(-3px) scale(1.15);
}

/* Project Menu Button */
.project-menu {
  opacity: 0;
  transition: opacity 0.2s;
}

.project-card:hover .project-menu {
  opacity: 1;
}

.more-btn {
  color: #667085;
}

.more-btn:hover {
  background: #f2f4f7;
  color: #344054;
}

/* Show menu button when dropdown is open */
.project-menu:focus-within,
.project-menu.el-dropdown--show {
  opacity: 1;
}

/* Rich Text Editor */
.rich-editor-container {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  width: 100%;
  overflow: hidden;
}

.rich-editor-container:focus-within {
  border-color: #409eff;
}

:deep(.w-e-toolbar) {
  background-color: #f5f7fa;
  border-radius: 4px 4px 0 0;
}

:deep(.w-e-text-container) {
  background-color: #fff;
}

:deep(.w-e-text-placeholder) {
  color: #a8abb2;
  font-style: normal;
}
</style>

<!-- Global styles for tooltip (teleported to body) -->
<style>
.project-desc-tooltip {
  background: #fff !important;
  border: 1px solid #e4e7ec !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.project-desc-tooltip .el-tooltip__arrow::before {
  background: #fff !important;
  border-color: #e4e7ec !important;
}
</style>
