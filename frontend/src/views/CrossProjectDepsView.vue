<template>
  <div class="cross-project-deps">
    <!-- Feature Coming Soon Watermark -->
    <div class="coming-soon-overlay">
      <div class="coming-soon-text">{{ $t('crossDeps.watermark') }}</div>
    </div>
    
    <div class="page-header">
      <h1>{{ $t('crossDeps.title') }}</h1>
      <div class="header-controls">
        <el-button @click="refreshGraph" type="primary">
          <el-icon><Refresh /></el-icon>
          {{ $t('common.refresh') }}
        </el-button>
        <el-button @click="showAddDialog = true" v-if="isAdmin">
          <el-icon><Plus /></el-icon>
          {{ $t('crossDeps.btnAdd') }}
        </el-button>
      </div>
    </div>
    
    <!-- Overview Stats -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><FolderOpened /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('crossDeps.statProjects') }}</div>
            <div class="stat-value">{{ projectCount }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><Key /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('crossDeps.statSharedResources') }}</div>
            <div class="stat-value" style="color: #E6A23C">{{ resourceCount }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9ff; color: #6172f3;">
            <el-icon :size="24"><Connection /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('crossDeps.statCrossDeps') }}</div>
            <div class="stat-value" style="color: #6172f3">{{ dependencyCount }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fef0f0; color: #F56C6C;">
            <el-icon :size="24"><Warning /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">{{ $t('crossDeps.statCriticalLinks') }}</div>
            <div class="stat-value" style="color: #F56C6C">{{ criticalCount }}</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- View Mode Toggle -->
    <div class="view-toggle">
      <button 
        class="toggle-btn" 
        :class="{ active: activeTab === 'graph' }"
        @click="activeTab = 'graph'"
      >
        <el-icon><Share /></el-icon>
        {{ $t('crossDeps.tabGraph') }}
      </button>
      <button 
        class="toggle-btn" 
        :class="{ active: activeTab === 'list' }"
        @click="activeTab = 'list'"
      >
        <el-icon><List /></el-icon>
        {{ $t('crossDeps.tabList') }}
      </button>
    </div>
    
    <!-- Graph View -->
    <div v-show="activeTab === 'graph'" class="graph-section">
      <div class="graph-container">
        <div class="graph-header">
          <div class="graph-title">
            <span>🌐</span>
            <span>{{ $t('crossDeps.graphTitle') }}</span>
          </div>
          <div class="graph-legend">
            <div class="legend-group">
              <span class="legend-label">{{ $t('crossDeps.legendNodes') }}</span>
              <div class="legend-item">
                <span class="legend-dot project"></span>
                <span>{{ $t('crossDeps.legendProject') }}</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot resource"></span>
                <span>{{ $t('crossDeps.legendSharedResource') }}</span>
              </div>
            </div>
            <div class="legend-group">
              <span class="legend-label">{{ $t('crossDeps.legendRiskLevel') }}</span>
              <span class="layer-tag critical">{{ $t('crossDeps.riskCritical') }}</span>
              <span class="layer-tag high">{{ $t('crossDeps.riskHigh') }}</span>
              <span class="layer-tag medium">{{ $t('crossDeps.riskMedium') }}</span>
              <span class="layer-tag low">{{ $t('crossDeps.riskLow') }}</span>
            </div>
          </div>
        </div>
        <div class="graph-canvas">
          <LayeredGraphCanvas 
            ref="canvasRef"
          >
            <!-- Graph Controls -->
            <div class="graph-controls">
              <button class="graph-btn" :title="$t('crossDeps.tooltipZoomIn')" @click="zoomIn">
                <el-icon><ZoomIn /></el-icon>
              </button>
              <button class="graph-btn" :title="$t('crossDeps.tooltipZoomOut')" @click="zoomOut">
                <el-icon><ZoomOut /></el-icon>
              </button>
              <button class="graph-btn" :title="$t('crossDeps.tooltipFitView')" @click="fitView">
                <el-icon><FullScreen /></el-icon>
              </button>
              <button class="graph-btn" :title="$t('common.refresh')" @click="refreshGraph">
                <el-icon><Refresh /></el-icon>
              </button>
            </div>
          </LayeredGraphCanvas>
        </div>
      </div>
    </div>
    
    <!-- List View -->
    <div v-show="activeTab === 'list'" class="list-section">
      <el-table :data="dependencies" stripe>
        <el-table-column :label="$t('crossDeps.colSource')" min-width="200">
          <template #default="{ row }">
            <div class="dep-cell">
              <el-tag size="small" type="info">{{ row.source_project_name || $t('crossDeps.na') }}</el-tag>
              <span class="service-name">{{ row.source_service_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('crossDeps.colType')" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.dependency_type)" size="small">
              {{ row.dependency_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('crossDeps.colTarget')" min-width="200">
          <template #default="{ row }">
            <div class="dep-cell">
              <el-tag v-if="row.target_project_name" size="small" type="info">
                {{ row.target_project_name }}
              </el-tag>
              <el-tag v-else-if="row.target_resource_type" size="small" type="warning">
                {{ row.target_resource_type }}
              </el-tag>
              <span class="service-name">
                {{ row.target_service_name || row.target_resource_name }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="$t('crossDeps.colRisk')" width="100">
          <template #default="{ row }">
            <el-tag :type="getRiskTagType(row.risk_level)" size="small">
              {{ row.risk_level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('crossDeps.colDesc')" prop="description" min-width="150" />
        <el-table-column :label="$t('common.actions')" width="120" fixed="right" v-if="isAdmin">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editDependency(row)">
              {{ $t('common.edit') }}
            </el-button>
            <el-button link type="danger" size="small" @click="deleteDep(row.id)">
              {{ $t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <!-- Add/Edit Dialog -->
    <el-dialog 
      v-model="showAddDialog" 
      :title="editingDep ? $t('crossDeps.titleEdit') : $t('crossDeps.titleAdd')"
      width="500px"
    >
      <el-form :model="depForm" label-position="top">
        <el-form-item :label="$t('crossDeps.labelSource')" required>
          <el-select v-model="depForm.source_service_id" :placeholder="$t('crossDeps.placeholderSource')" filterable>
            <el-option-group 
              v-for="project in projectsWithServices" 
              :key="project.id" 
              :label="project.name"
            >
              <el-option 
                v-for="service in project.services" 
                :key="service.id" 
                :label="service.name"
                :value="service.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('crossDeps.labelTargetType')" required>
          <el-radio-group v-model="depForm.targetType">
            <el-radio value="service">{{ $t('crossDeps.optService') }}</el-radio>
            <el-radio value="resource">{{ $t('crossDeps.optSharedResource') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="depForm.targetType === 'service'" :label="$t('crossDeps.labelTargetService')" required>
          <el-select v-model="depForm.target_service_id" :placeholder="$t('crossDeps.placeholderTarget')" filterable>
            <el-option-group 
              v-for="project in projectsWithServices" 
              :key="project.id" 
              :label="project.name"
            >
              <el-option 
                v-for="service in project.services" 
                :key="service.id" 
                :label="service.name"
                :value="service.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="depForm.targetType === 'resource'" :label="$t('crossDeps.labelTargetResource')" required>
          <el-select v-model="depForm.target_resource_id" :placeholder="$t('crossDeps.placeholderResource')" filterable>
            <el-option 
              v-for="resource in resources" 
              :key="resource.id" 
              :label="`${resource.name} (${resource.type})`"
              :value="resource.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('crossDeps.labelDepType')" required>
          <el-select v-model="depForm.dependency_type" :placeholder="$t('crossDeps.labelDepType')">
            <el-option value="depends" :label="$t('crossDeps.depDepends')" />
            <el-option value="uses" :label="$t('crossDeps.depUses')" />
            <el-option value="sync" :label="$t('crossDeps.depSync')" />
            <el-option value="backup" :label="$t('crossDeps.depBackup')" />
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('crossDeps.labelRisk')">
          <el-select v-model="depForm.risk_level" :placeholder="$t('crossDeps.labelRisk')">
            <el-option value="low" :label="$t('crossDeps.riskLow')" />
            <el-option value="medium" :label="$t('crossDeps.riskMedium')" />
            <el-option value="high" :label="$t('crossDeps.riskHigh')" />
            <el-option value="critical" :label="$t('crossDeps.riskCritical')" />
          </el-select>
        </el-form-item>
        
        <el-form-item :label="$t('crossDeps.labelDesc')">
          <el-input v-model="depForm.description" type="textarea" rows="2" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveDependency">
          {{ editingDep ? $t('common.update') : $t('common.create') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Graph } from '@antv/g6';
import { ElMessage, ElMessageBox } from 'element-plus';
import { 
  Refresh, Plus, FolderOpened, Key, Connection, Warning, 
  Share, List, ZoomIn, ZoomOut, FullScreen 
} from '@element-plus/icons-vue';
import LayeredGraphCanvas from '../components/LayeredGraphCanvas.vue';
import { 
  getCrossProjectDependencies, 
  getCrossProjectGraph,
  createDependency,
  updateDependency,
  deleteDependency,
  type ServiceDependency,
  type CrossProjectGraphData
} from '../api/dependencies';
import { getProjects, type ProjectWithStats } from '../api/projects';
import { getServices } from '../api/services';
import api from '../api';
import authUtils from '../utils/auth';

// i18n
const { t } = useI18n();

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

const activeTab = ref<'graph' | 'list'>('graph');
const canvasRef = ref<any>(null);
const graphContainer = computed(() => canvasRef.value?.graphContainer);
const dependencies = ref<ServiceDependency[]>([]);
const graphData = ref<CrossProjectGraphData>({ nodes: [], edges: [] });
const showAddDialog = ref(false);
const editingDep = ref<ServiceDependency | null>(null);
const projects = ref<ProjectWithStats[]>([]);
const allServices = ref<any[]>([]);
const resources = ref<any[]>([]);

let graph: Graph | null = null;

// 注入当前项目上下文
const currentProjectId = inject<{ value: string | undefined }>('currentProjectId');

// 监听项目切换，刷新数据
watch(
  () => currentProjectId?.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      console.log('CrossProject: Project changed from', oldVal, 'to', newVal);
      // 刷新跨项目依赖数据
      loadData();
    }
  }
);

const depForm = ref({
  source_service_id: '',
  target_service_id: '',
  target_resource_id: '',
  targetType: 'service' as 'service' | 'resource',
  dependency_type: 'depends',
  risk_level: 'medium',
  description: ''
});

const projectCount = computed(() => graphData.value.nodes.filter(n => n.data?.nodeType === 'project').length);
const resourceCount = computed(() => graphData.value.nodes.filter(n => n.data?.nodeType === 'resource').length);
const dependencyCount = computed(() => dependencies.value.length);
const criticalCount = computed(() => 
  dependencies.value.filter(d => d.risk_level === 'critical' || d.risk_level === 'high').length
);

const projectsWithServices = computed(() => {
  return projects.value.map(p => ({
    ...p,
    services: allServices.value.filter(s => s.project_id === p.id)
  }));
});

const riskColors = {
  critical: '#f04438',
  high: '#f79009',
  medium: '#6172f3',
  low: '#12b76a'
};

function getTypeTagType(type: string): 'primary' | 'success' | 'warning' | 'info' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
    depends: 'primary',
    uses: 'info',
    sync: 'warning',
    backup: 'success'
  };
  return map[type] || 'info';
}

function getRiskTagType(risk: string): 'danger' | 'warning' | 'primary' | 'success' {
  const map: Record<string, 'danger' | 'warning' | 'primary' | 'success'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'primary',
    low: 'success'
  };
  return map[risk] || 'primary';
}

async function loadData() {
  try {
    const [depsRes, graphRes, projectsRes, servicesRes, resourcesRes] = await Promise.all([
      getCrossProjectDependencies(),
      getCrossProjectGraph(),
      getProjects(),
      getServices(),
      api.get('/security-configs')
    ]);
    
    dependencies.value = depsRes;
    graphData.value = graphRes;
    projects.value = projectsRes;
    allServices.value = servicesRes;
    resources.value = resourcesRes.data;
    
    if (activeTab.value === 'graph') {
      renderGraph();
    }
  } catch (error) {
    console.error('Failed to load data', error);
    ElMessage.error(t('crossDeps.msgLoadFailed'));
  }
}

function renderGraph() {
  if (!graphContainer.value) return;
  
  if (graph) {
    graph.destroy();
  }
  
  const { nodes, edges } = graphData.value;
  
  if (nodes.length === 0) {
    return;
  }
  
  // 确保容器有有效的尺寸，防止 Canvas 创建过大
  const width = Math.max(graphContainer.value.clientWidth || 800, 100);
  const height = Math.max(graphContainer.value.clientHeight || 600, 100);
  
  graph = new Graph({
    container: graphContainer.value,
    width: width,
    height: height,
    
    layout: {
      type: 'force',
      preventOverlap: true,
      nodeSpacing: 100,
      linkDistance: 200,
    },
    
    node: {
      style: {
        size: (d: any) => d.data?.nodeType === 'project' ? 80 : 60,
        fill: (d: any) => d.data?.nodeType === 'project' ? '#eff8ff' : '#fef3c7',
        stroke: (d: any) => d.data?.nodeType === 'project' ? '#175cd3' : '#f59e0b',
        lineWidth: 3,
        labelText: (d: any) => d.data?.name || d.id,
        labelFill: '#101828',
        labelFontSize: 13,
        labelFontWeight: 500,
        labelPlacement: 'bottom',
        labelOffsetY: 8,
        cursor: 'pointer',
      },
    },
    
    edge: {
      style: {
        stroke: (d: any) => riskColors[d.data?.maxRisk as keyof typeof riskColors] || '#667085',
        lineWidth: (d: any) => Math.min(d.data?.count || 1, 5),
        lineDash: (d: any) => d.data?.maxRisk === 'critical' ? [6, 4] : undefined,
        endArrow: {
          fill: '#667085',
          path: 'M 0,0 L 8,4 L 8,-4 Z',
        } as any,
        labelText: (d: any) => d.data?.count > 1 ? `×${d.data.count}` : '',
        labelFill: '#667085',
        labelFontSize: 11,
      },
    },
    
    behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    
    autoFit: 'view',
    padding: [60, 60, 60, 60],
    
    data: { nodes, edges }
  });
  
  graph.render().catch(err => console.error('Graph render error:', err));
}

// 缩放控制
function zoomIn() {
  if (graph) {
    const zoom = graph.getZoom();
    graph.zoomTo(zoom * 1.2);
  }
}

function zoomOut() {
  if (graph) {
    const zoom = graph.getZoom();
    graph.zoomTo(zoom * 0.8);
  }
}

function fitView() {
  if (graph) {
    graph.fitView();
  }
}

async function refreshGraph() {
  await loadData();
  ElMessage.success(t('crossDeps.msgRefreshed'));
}

function editDependency(dep: ServiceDependency) {
  editingDep.value = dep;
  depForm.value = {
    source_service_id: dep.source_service_id,
    target_service_id: dep.target_service_id || '',
    target_resource_id: dep.target_resource_id || '',
    targetType: dep.target_resource_id ? 'resource' : 'service',
    dependency_type: dep.dependency_type,
    risk_level: dep.risk_level,
    description: dep.description || ''
  };
  showAddDialog.value = true;
}

async function saveDependency() {
  try {
    const data = {
      source_service_id: depForm.value.source_service_id,
      target_service_id: depForm.value.targetType === 'service' ? depForm.value.target_service_id : undefined,
      target_resource_id: depForm.value.targetType === 'resource' ? depForm.value.target_resource_id : undefined,
      dependency_type: depForm.value.dependency_type,
      risk_level: depForm.value.risk_level,
      description: depForm.value.description || undefined
    };
    
    if (editingDep.value) {
      await updateDependency(editingDep.value.id, {
        dependency_type: data.dependency_type,
        risk_level: data.risk_level,
        description: data.description
      });
      ElMessage.success(t('crossDeps.msgUpdated'));
    } else {
      await createDependency(data);
      ElMessage.success(t('crossDeps.msgCreated'));
    }
    
    showAddDialog.value = false;
    editingDep.value = null;
    resetForm();
    await loadData();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || t('crossDeps.msgSaveFailed'));
  }
}

async function deleteDep(id: string) {
  try {
    await ElMessageBox.confirm(t('crossDeps.confirmDeleteMsg'), t('crossDeps.confirmDeleteTitle'), {
      type: 'warning'
    });
    
    await deleteDependency(id);
    ElMessage.success(t('crossDeps.msgDeleted'));
    await loadData();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(t('crossDeps.msgDeleteFailed'));
    }
  }
}

function resetForm() {
  depForm.value = {
    source_service_id: '',
    target_service_id: '',
    target_resource_id: '',
    targetType: 'service',
    dependency_type: 'depends',
    risk_level: 'medium',
    description: ''
  };
}

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (graph) {
    graph.destroy();
  }
});

function handleResize() {
  if (graph && graphContainer.value) {
    // 确保 resize 时使用有效的尺寸
    const width = Math.max(graphContainer.value.clientWidth || 800, 100);
    const height = Math.max(graphContainer.value.clientHeight || 600, 100);
    graph.resize(width, height);
    graph.fitView();
  }
}
</script>

<style scoped>
.cross-project-deps {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.page-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f5f7fa;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #101828;
}

.header-controls {
  display: flex;
  gap: 10px;
}

/* Overview Stats */
.stats-row {
  margin-bottom: 20px;
  padding: 0 20px;
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

/* View Toggle */
.view-toggle {
  display: flex;
  gap: 4px;
  background: #f2f4f7;
  border-radius: 8px;
  padding: 4px;
  margin: 0 20px 16px;
  width: fit-content;
}

.toggle-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  color: #667085;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
}

.toggle-btn:hover {
  color: #344054;
}

.toggle-btn.active {
  background: #fff;
  color: #344054;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* Graph Section */
.graph-section {
  flex: 1;
  padding: 0 16px 16px;
}

.graph-container {
  height: 100%;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.graph-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e4e7ec;
}

.graph-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #101828;
}

.graph-legend {
  display: flex;
  gap: 24px;
}

.legend-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-label {
  font-size: 12px;
  color: #667085;
  font-weight: 500;
}

.legend-title {
  font-size: 12px;
  color: #667085;
  font-weight: 500;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #344054;
}

.legend-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid;
}

.legend-dot.project {
  background: #eff8ff;
  border-color: #175cd3;
}

.legend-dot.resource {
  background: #fef3c7;
  border-color: #f59e0b;
}

.legend-line {
  width: 24px;
  height: 3px;
  border-radius: 2px;
}

.legend-line.critical { background: #f04438; }
.legend-line.high { background: #f79009; }
.legend-line.medium { background: #6172f3; }
.legend-line.low { background: #12b76a; }

/* Layer Tags for Risk Level */
.layer-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.layer-tag.critical { background: #fef3f2; color: #f04438; border: 1px solid #f04438; }
.layer-tag.high { background: #fffaeb; color: #f79009; border: 1px solid #f79009; }
.layer-tag.medium { background: #eff6ff; color: #6172f3; border: 1px solid #6172f3; }
.layer-tag.low { background: #ecfdf5; color: #12b76a; border: 1px solid #12b76a; }

.graph-canvas {
  flex: 1;
  position: relative;
  min-height: 500px;
  background: radial-gradient(circle at 50% 50%, #f8fafc 0%, #f1f5f9 100%);
  overflow: hidden; /* 防止 canvas 溢出 */
  isolation: isolate; /* 创建新的层叠上下文 */
}

/* List Section */
.list-section {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.dep-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.service-name {
  font-weight: 500;
  color: #101828;
}

/* Graph Controls */
.graph-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 50;
}

.graph-btn {
  width: 36px;
  height: 36px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
  color: #667085;
}

.graph-btn:hover {
  background: #f9fafb;
  border-color: #d0d5dd;
  color: #344054;
}

.graph-btn:active {
  background: #f2f4f7;
}

/* Coming Soon Overlay */
.coming-soon-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.coming-soon-text {
  font-size: 48px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.06);
  white-space: nowrap;
  transform: rotate(-25deg);
  text-transform: uppercase;
  letter-spacing: 8px;
  user-select: none;
}
</style>
