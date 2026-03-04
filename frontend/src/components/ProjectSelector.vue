<template>
  <div class="project-selector" :class="{ collapsed: collapsed }">
    <div class="selector-label" v-show="!collapsed">Current Project</div>
    <el-dropdown trigger="click" @command="handleSelect" class="selector-dropdown">
      <div class="selector-button" :class="{ 'collapsed-btn': collapsed }">
        <div class="project-info">
          <div 
            class="project-icon" 
            :class="{ 'collapsed-icon': collapsed }"
            :style="{ background: getGradient(currentProject?.icon_color || 'blue') }"
          >
            {{ currentProject?.name?.charAt(0) || 'A' }}
          </div>
          <span class="project-name" v-show="!collapsed">{{ currentProject?.name || 'All Projects' }}</span>
        </div>
        <el-icon class="arrow-icon" v-show="!collapsed"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="all" :class="{ active: !currentProjectId }">
            <div class="dropdown-item-content">
              <div class="project-icon small" style="background: linear-gradient(135deg, #409EFF, #667eea);">
                🌐
              </div>
              <span>All Projects</span>
              <span class="status-indicator all"></span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item 
            v-for="project in projects" 
            :key="project.id" 
            :command="project.id"
            :class="{ active: currentProjectId === project.id }"
          >
            <div class="dropdown-item-content">
              <div 
                class="project-icon small" 
                :style="{ background: getGradient(project.icon_color) }"
              >
                {{ project.name.charAt(0) }}
              </div>
              <span>{{ project.name }}</span>
              <span 
                class="status-indicator" 
                :class="getProjectStatus(project)"
              ></span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item divided command="add">
            <div class="dropdown-item-content add-project">
              <el-icon><Plus /></el-icon>
              <span>New Project</span>
            </div>
          </el-dropdown-item>
          <el-dropdown-item command="manage">
            <div class="dropdown-item-content manage-project">
              <el-icon><Setting /></el-icon>
              <span>Manage Projects</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowDown, Plus, Setting } from '@element-plus/icons-vue';
import { getProjects, type ProjectWithStats } from '../api/projects';

const props = defineProps<{
  modelValue?: string;
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
  (e: 'change', project: ProjectWithStats | null): void;
  (e: 'projects-loaded', projects: ProjectWithStats[]): void;
}>();

const router = useRouter();
const triggerAddProject = inject<() => void>('triggerAddProject');
const projectsVersion = inject<import('vue').Ref<number>>('projectsVersion');
const projects = ref<ProjectWithStats[]>([]);
const currentProjectId = ref<string | undefined>(props.modelValue);

const currentProject = computed(() => {
  if (!currentProjectId.value) return null;
  return projects.value.find(p => p.id === currentProjectId.value) || null;
});

const colorGradients: Record<string, string> = {
  blue: 'linear-gradient(135deg, #667eea, #764ba2)',
  green: 'linear-gradient(135deg, #11998e, #38ef7d)',
  orange: 'linear-gradient(135deg, #f5af19, #f12711)',
  purple: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
  teal: 'linear-gradient(135deg, #0093E9, #80D0C7)',
  pink: 'linear-gradient(135deg, #f093fb, #f5576c)',
  crimson: 'linear-gradient(135deg, #eb3349, #f45c43)',
  indigo: 'linear-gradient(135deg, #4776e6, #8e54e9)',
  lime: 'linear-gradient(135deg, #56ab2f, #a8e063)',
  amber: 'linear-gradient(135deg, #ffb75e, #ed8f03)',
  cyan: 'linear-gradient(135deg, #13d2b8, #00a8cc)',
  violet: 'linear-gradient(135deg, #d02aad, #e94057)',
  forest: 'linear-gradient(135deg, #134e5e, #71b280)',
  berry: 'linear-gradient(135deg, #8e2de2, #4a00e0)',
  coral: 'linear-gradient(135deg, #ff6a88, #ff9472)',
  navy: 'linear-gradient(135deg, #2e3192, #1bffff)'
};

function getGradient(color: string): string {
  return colorGradients[color] || colorGradients.blue || '';
}

function getProjectStatus(project: ProjectWithStats): string {
  if (project.down_count > 0) return 'error';
  if (project.warning_count > 0) return 'warning';
  return 'healthy';
}

async function loadProjects() {
  try {
    projects.value = await getProjects();
    emit('projects-loaded', projects.value);
    
    // 如果有初始选中的项目ID，验证它是否存在
    if (currentProjectId.value) {
      const projectExists = projects.value.some(p => p.id === currentProjectId.value);
      if (projectExists) {
        // 触发 change 事件以同步项目数据
        const project = projects.value.find(p => p.id === currentProjectId.value);
        if (project) {
          emit('change', project);
        }
      } else {
        // 项目不存在，重置为 All Projects
        currentProjectId.value = undefined;
        emit('update:modelValue', undefined);
        emit('change', null);
      }
    }
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

function handleSelect(command: string) {
  if (command === 'add') {
    router.push('/projects');
    triggerAddProject?.();
    return;
  }
  
  if (command === 'manage') {
    router.push('/projects');
    return;
  }
  
  const newValue = command === 'all' ? undefined : command;
  currentProjectId.value = newValue;
  emit('update:modelValue', newValue);
  emit('change', currentProject.value);
}



watch(() => props.modelValue, (val) => {
  currentProjectId.value = val;
});

onMounted(() => {
  loadProjects();
});

watch(projectsVersion!, () => {
  loadProjects();
});

defineExpose({
  refresh: loadProjects
});
</script>

<style scoped>
.project-selector {
  padding: 16px;
  border-bottom: 1px solid #344054;
}

.project-selector.collapsed {
  padding: 8px;
  display: flex;
  justify-content: center;
}

.selector-label {
  font-size: 11px;
  color: #98a2b3;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.selector-dropdown {
  width: 100%;
}

.project-selector.collapsed .selector-dropdown {
  width: auto;
}

.selector-button {
  background: #344054;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background 0.2s;
  width: 100%;
}

.selector-button.collapsed-btn {
  padding: 8px;
  width: auto;
  justify-content: center;
  border-radius: 6px;
}

.selector-button:hover {
  background: #475467;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.project-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.project-icon.collapsed-icon {
  width: 32px;
  height: 32px;
  font-size: 16px;
}

.project-icon.small {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.project-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
}

.arrow-icon {
  color: #98a2b3;
}

.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.dropdown-item-content.add-project {
  color: #409EFF;
}

.dropdown-item-content.manage-project {
  color: #909399;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
}

.status-indicator.healthy {
  background: #12b76a;
}

.status-indicator.warning {
  background: #f79009;
}

.status-indicator.error {
  background: #f04438;
}

.status-indicator.all {
  background: linear-gradient(135deg, #409EFF, #667eea);
}

:deep(.el-dropdown-menu__item.active) {
  background: #eff8ff;
  color: #175cd3;
}
</style>
