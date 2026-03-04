<template>
  <div class="overview-dashboard">
    <!-- 页面标题栏 -->
    <div class="page-header">
      <div class="page-title-section">
        <div class="page-icon">📊</div>
        <div class="page-info">
          <div class="page-title">Overview Dashboard</div>
          <div class="page-subtitle">System Global Monitoring View</div>
        </div>
      </div>
      
      <!-- 刷新控制 -->
      <div class="refresh-controls">
        <div class="last-updated">
          <el-icon v-if="loading" class="is-loading"><Loading /></el-icon>
          <span v-else>🕐</span>
          <span>Last updated: {{ lastUpdatedText }}</span>
        </div>
        
        <div class="countdown-container" v-if="autoRefresh">
          <div class="countdown-text">{{ countdown }}s</div>
          <div class="countdown-bar">
            <div class="countdown-progress-bar" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
        
        <el-switch 
          v-model="autoRefresh" 
          inline-prompt 
          active-text="Auto" 
          inactive-text="Manual" 
          @change="handleAutoRefreshChange" 
        />
        
        <el-dropdown @command="handleRefreshIntervalChange">
          <el-button>
            {{ refreshInterval }}s <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :command="15">15 seconds</el-dropdown-item>
              <el-dropdown-item :command="30">30 seconds</el-dropdown-item>
              <el-dropdown-item :command="60">1 minute</el-dropdown-item>
              <el-dropdown-item :command="300">5 minutes</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        
        <el-button type="primary" :loading="loading" @click="refreshData">
          <el-icon v-if="!loading"><Refresh /></el-icon>
          <span>{{ loading ? 'Loading...' : 'Refresh' }}</span>
        </el-button>
      </div>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="12" class="stats-grid">
      <el-col :span="6">
        <div class="stat-card total">
          <div class="stat-header">
            <div class="stat-label">Total Services</div>
            <div class="stat-icon total">🖥️</div>
          </div>
          <div class="stat-value-section">
            <div class="stat-value">{{ stats.total }}</div>
          </div>
          <div class="stat-progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: '100%', background: '#409EFF' }"></div>
            </div>
            <div class="stat-progress">
              <span>All services</span>
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :span="6">
        <div class="stat-card healthy">
          <div class="stat-header">
            <div class="stat-label">Healthy</div>
            <div class="stat-icon healthy">✅</div>
          </div>
          <div class="stat-value-section">
            <div class="stat-value">{{ stats.up }}</div>
          </div>
          <div class="stat-progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: healthyPercent + '%', background: '#67C23A' }"></div>
            </div>
            <div class="stat-progress">
              <span>{{ healthyPercent }}% of total</span>
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :span="6">
        <div class="stat-card warning">
          <div class="stat-header">
            <div class="stat-label">Warning</div>
            <div class="stat-icon warning">⚠️</div>
          </div>
          <div class="stat-value-section">
            <div class="stat-value">{{ stats.warning }}</div>
          </div>
          <div class="stat-progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: warningPercent + '%', background: '#E6A23C' }"></div>
            </div>
            <div class="stat-progress">
              <span>{{ warningPercent }}% of total</span>
            </div>
          </div>
        </div>
      </el-col>
      
      <el-col :span="6">
        <div class="stat-card down">
          <div class="stat-header">
            <div class="stat-label">Down / Unknown</div>
            <div class="stat-icon down">❌</div>
          </div>
          <div class="stat-value-section">
            <div class="stat-value">{{ stats.down + stats.unknown }}</div>
          </div>
          <div class="stat-progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: downPercent + '%', background: '#F56C6C' }"></div>
            </div>
            <div class="stat-progress">
              <span v-if="stats.unknown > 0">{{ stats.down }} down, {{ stats.unknown }} unknown</span>
              <span v-else>{{ downPercent }}% of total</span>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <!-- 主要内容区：2个核心模块 -->
    <el-row :gutter="12" class="main-content">
      <!-- 模块1：状态分布 -->
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="card-title">
                <span>📊</span>
                <span>Status Distribution</span>
              </div>
            </div>
          </template>
          <div class="chart-container" ref="statusChartRef"></div>
        </el-card>
      </el-col>
      
      <!-- 模块2：资源分布 -->
      <el-col :span="12">
        <el-card class="chart-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="card-title">
                <span>🌐</span>
                <span>Resources Distribution</span>
              </div>
              <el-button text size="small" @click="$router.push('/projects')">Details →</el-button>
            </div>
          </template>
          <div class="chart-container" ref="resourceChartRef"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 模块3：系统概览 (只在全局视图时显示) -->
    <el-card class="bottom-card" shadow="never" v-if="showSystemOverview">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <span>⚡</span>
            <span>System Overview</span>
          </div>
        </div>
      </template>
      <el-row :gutter="12" class="overview-grid">
        <el-col :span="4">
          <div class="overview-item" @click="$router.push('/projects')">
            <div class="overview-icon projects">🌐</div>
            <div class="overview-content">
              <div class="overview-value">{{ metrics.projects }}</div>
              <div class="overview-label">Projects</div>
              <div class="overview-detail">{{ projectHealthSummary }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="overview-item" @click="$router.push('/hosts')">
            <div class="overview-icon hosts">🖥️</div>
            <div class="overview-content">
              <div class="overview-value">{{ metrics.hosts }}</div>
              <div class="overview-label">Hosts</div>
              <div class="overview-detail">{{ hostStatusSummary }}</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="overview-item" @click="$router.push('/graph')">
            <div class="overview-icon dependencies">🔗</div>
            <div class="overview-content">
              <div class="overview-value">{{ metrics.dependencies }}</div>
              <div class="overview-label">Dependencies</div>
              <div class="overview-detail">Cross-project links</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="overview-item" @click="$router.push('/grafana')">
            <div class="overview-icon dashboards">📊</div>
            <div class="overview-content">
              <div class="overview-value">{{ metrics.dashboards }}</div>
              <div class="overview-label">Dashboards</div>
              <div class="overview-detail">Grafana integrated</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="overview-item" @click="$router.push('/security')">
            <div class="overview-icon security">🔐</div>
            <div class="overview-content">
              <div class="overview-value">{{ metrics.securityConfigs }}</div>
              <div class="overview-label">Security Configs</div>
              <div class="overview-detail">{{ securityWarnings }} need attention</div>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="overview-item">
            <div class="overview-icon issues">⚠️</div>
            <div class="overview-content">
              <div class="overview-value">{{ stats.warning + stats.down }}</div>
              <div class="overview-label">Issues</div>
              <div class="overview-detail">{{ stats.down }} critical</div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, inject, watch, reactive, nextTick, type Ref } from 'vue';
import { useRouter } from 'vue-router';
import { Refresh, Loading, ArrowDown } from '@element-plus/icons-vue';
import { getProjects, type ProjectWithStats } from '../api/projects';
import { getHosts } from '../api/hosts';
import { getDependencies } from '../api/dependencies';
import { getGrafanaDashboards } from '../api/grafana-dashboards';
import { getSecurityConfigs, type SecurityConfig } from '../api/security-configs';
import { getSystemStats } from '../api/checks';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const router = useRouter();
const currentProjectId = inject<Ref<number | null>>('currentProjectId');

// 数据状态
const loading = ref(false);
const projects = ref<ProjectWithStats[]>([]);
const stats = reactive({ total: 0, up: 0, warning: 0, down: 0, unknown: 0 });
const securityConfigs = ref<SecurityConfig[]>([]);
const metrics = reactive({
  projects: 0,
  hosts: 0,
  dependencies: 0,
  dashboards: 0,
  securityConfigs: 0
});

// Auto-refresh 相关
const autoRefresh = ref(localStorage.getItem('dashboard_autoRefresh') === 'true');
const refreshInterval = ref(parseInt(localStorage.getItem('dashboard_refreshInterval') || '30'));
const countdown = ref(parseInt(localStorage.getItem('dashboard_refreshInterval') || '30'));
const lastUpdatedText = ref('Never');
let countdownTimer: number | null = null;

// Chart refs
const statusChartRef = ref<HTMLElement>();
const resourceChartRef = ref<HTMLElement>();
let statusChart: echarts.ECharts | null = null;
let resourceChart: echarts.ECharts | null = null;

// Computed
const healthyPercent = computed(() => {
  return stats.total ? Math.round((stats.up / stats.total) * 100) : 0;
});

const warningPercent = computed(() => {
  return stats.total ? Math.round((stats.warning / stats.total) * 100) : 0;
});

const downPercent = computed(() => {
  return stats.total ? Math.round(((stats.down + stats.unknown) / stats.total) * 100) : 0;
});

const progressPercent = computed(() => {
  if (!autoRefresh.value || refreshInterval.value === 0) return 100;
  return ((refreshInterval.value - countdown.value) / refreshInterval.value) * 100;
});

const projectHealthSummary = computed(() => {
  const healthy = projects.value.filter(p => p.healthy_count === p.service_count).length;
  return `${healthy} healthy`;
});

const hostStatusSummary = computed(() => {
  return 'All monitored';
});

const securityWarnings = computed(() => {
  return securityConfigs.value.filter(c => c.status === 'warning' || c.status === 'critical' || c.status === 'expired').length;
});

const showSystemOverview = computed(() => {
  return !currentProjectId || !currentProjectId.value;
});

// 初始化图表
const initStatusChart = () => {
  if (!statusChartRef.value) return;
  statusChart = echarts.init(statusChartRef.value);
  updateStatusChart();
};

const updateStatusChart = () => {
  if (!statusChart) return;
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      left: 'center',
      itemGap: 16
    },
    series: [
      {
        name: 'Status',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold'
          }
        },
        data: [
          { value: stats.up, name: 'Healthy', itemStyle: { color: '#67C23A' } },
          { value: stats.warning, name: 'Warning', itemStyle: { color: '#E6A23C' } },
          { value: stats.down, name: 'Down', itemStyle: { color: '#F56C6C' } },
          { value: stats.unknown, name: 'Unknown', itemStyle: { color: '#909399' } }
        ].filter(d => d.value > 0)
      }
    ]
  };
  statusChart.setOption(option);
};

const initResourceChart = () => {
  if (!resourceChartRef.value) return;
  resourceChart = echarts.init(resourceChartRef.value);
  updateResourceChart();
};

const updateResourceChart = () => {
  if (!resourceChart || projects.value.length === 0) return;
  
  const sortedProjects = [...projects.value].sort((a, b) => b.service_count - a.service_count);
  const projectNames = sortedProjects.map(p => p.name);
  const serviceCounts = sortedProjects.map(p => p.service_count);
  
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: '{b}: {c} services'
    },
    grid: {
      left: '5%',
      right: '5%',
      top: '10%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}'
      }
    },
    yAxis: {
      type: 'category',
      data: projectNames,
      axisLabel: {
        interval: 0,
        formatter: (value: string) => {
          return value.length > 12 ? value.substring(0, 12) + '...' : value;
        }
      }
    },
    series: [
      {
        name: 'Services',
        type: 'bar',
        data: serviceCounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#409EFF' },
            { offset: 1, color: '#67C23A' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '60%',
        label: {
          show: true,
          position: 'right',
          formatter: '{c}'
        }
      }
    ]
  };
  resourceChart.setOption(option);
};

// 刷新数据
const refreshData = async () => {
  loading.value = true;
  try {
    const projectId = currentProjectId?.value;
    
    // 获取统计数据
    const statsData = await getSystemStats(projectId || undefined);
    // 逐个更新属性以确保响应式
    stats.total = statsData.total;
    stats.up = statsData.up;
    stats.warning = statsData.warning;
    stats.down = statsData.down;
    stats.unknown = statsData.unknown || 0;
    stats.last24h = statsData.last24h;
    
    // 获取项目列表（用于资源分布图）
    if (!projectId) {
      projects.value = await getProjects();
      
      // 获取系统概览指标
      const [hostsData, depsData, dashboardsData, securityData] = await Promise.all([
        getHosts().catch(() => []),
        getDependencies().catch(() => []),
        getGrafanaDashboards().catch(() => []),
        getSecurityConfigs().catch(() => [])
      ]);
      
      metrics.projects = projects.value.length;
      metrics.hosts = hostsData.length;
      metrics.dependencies = depsData.length;
      metrics.dashboards = dashboardsData.length;
      metrics.securityConfigs = securityData.length;
      securityConfigs.value = securityData;
    } else {
      // 如果选择了项目，只获取该项目的数据
      const allProjects = await getProjects();
      projects.value = allProjects.filter(p => p.id === projectId);
      
      // 也需要更新当前项目的 security configs
      const securityData = await getSecurityConfigs().catch(() => []);
      securityConfigs.value = securityData;
    }
    
    // 更新图表
    await nextTick();
    updateStatusChart();
    updateResourceChart();
    
    // 更新最后更新时间
    lastUpdatedText.value = new Date().toLocaleTimeString('zh-CN');
    
    // 重置倒计时
    if (autoRefresh.value) {
      countdown.value = refreshInterval.value;
    }
  } catch (error) {
    console.error('Failed to refresh data:', error);
  } finally {
    loading.value = false;
  }
};

// Auto-refresh 控制
const handleAutoRefreshChange = (value: boolean) => {
  localStorage.setItem('dashboard_autoRefresh', value.toString());
  if (value) {
    countdown.value = refreshInterval.value;
    startCountdown();
  } else {
    stopCountdown();
  }
};

const handleRefreshIntervalChange = (value: number) => {
  refreshInterval.value = value;
  countdown.value = value;
  localStorage.setItem('dashboard_refreshInterval', value.toString());
  if (autoRefresh.value) {
    stopCountdown();
    startCountdown();
  }
};

const startCountdown = () => {
  stopCountdown();
  countdownTimer = window.setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      refreshData();
    }
  }, 1000);
};

const stopCountdown = () => {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
};

// Lifecycle
onMounted(async () => {
  await refreshData();
  await nextTick();
  initStatusChart();
  initResourceChart();
  
  if (autoRefresh.value) {
    startCountdown();
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    statusChart?.resize();
    resourceChart?.resize();
  });
});

onBeforeUnmount(() => {
  stopCountdown();
  statusChart?.dispose();
  resourceChart?.dispose();
});

// 监听项目切换
watch(currentProjectId, () => {
  refreshData();
}, { deep: true });
</script>

<style scoped>
.overview-dashboard {
  width: 100%;
  height: 100%;
  padding: 0;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 页面标题栏 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 10px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.page-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-icon {
  font-size: 28px;
}

.page-info {
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.page-subtitle {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

/* 刷新控制 */
.refresh-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.last-updated {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
}

.countdown-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.countdown-text {
  font-size: 11px;
  font-weight: 600;
  color: #409EFF;
  margin-bottom: 3px;
}

.countdown-bar {
  width: 100%;
  height: 3px;
  background: #e4e7ed;
  border-radius: 2px;
  overflow: hidden;
}

.countdown-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #409EFF 0%, #67C23A 100%);
  transition: width 1s linear;
}

/* 统计卡片 */
.stats-grid {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  cursor: pointer;
  height: 100%;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.stat-card.total {
  border-left: 4px solid #409EFF;
}

.stat-card.healthy {
  border-left: 4px solid #67C23A;
}

.stat-card.warning {
  border-left: 4px solid #E6A23C;
}

.stat-card.down {
  border-left: 4px solid #F56C6C;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 12px;
  color: #606266;
  font-weight: 500;
}

.stat-icon {
  font-size: 24px;
  opacity: 0.9;
}

.stat-value-section {
  margin-bottom: 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
}

.stat-progress-section {
  margin-top: 8px;
}

.progress-bar {
  width: 100%;
  height: 5px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.stat-progress {
  font-size: 10px;
  color: #909399;
}

/* 主要内容区 */
.main-content {
  margin-bottom: 12px;
  flex: 1;
  min-height: 0;
}

.chart-card {
  border-radius: 8px;
  border: none;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-card :deep(.el-card__header) {
  padding: 12px 16px;
  flex-shrink: 0;
}

.chart-card :deep(.el-card__body) {
  flex: 1;
  padding: 12px 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  width: 100%;
  flex: 1;
  min-height: 0;
}

/* 底部卡片 */
.bottom-card {
  border-radius: 8px;
  border: none;
  flex-shrink: 0;
}

.bottom-card :deep(.el-card__header) {
  padding: 12px 16px;
}

.bottom-card :deep(.el-card__body) {
  padding: 12px 16px;
}

.overview-grid {
  margin-top: 0;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #f8f9fb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.overview-item:hover {
  background: #e8eaf0;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.overview-icon {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.overview-icon.projects {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.overview-icon.hosts {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.overview-icon.dependencies {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.overview-icon.dashboards {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.overview-icon.security {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.overview-icon.issues {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
}

.overview-content {
  flex: 1;
  min-width: 0;
}

.overview-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1;
  margin-bottom: 3px;
}

.overview-label {
  font-size: 12px;
  color: #606266;
  font-weight: 500;
  margin-bottom: 2px;
}

.overview-detail {
  font-size: 10px;
  color: #909399;
}

/* 响应式 */
@media (max-width: 1400px) {
  .page-header {
    padding: 8px 12px;
  }
  
  .stat-card {
    padding: 10px 12px;
  }
  
  .stat-value {
    font-size: 24px;
  }
  
  .overview-icon {
    width: 42px;
    height: 42px;
    font-size: 28px;
  }
  
  .overview-value {
    font-size: 20px;
  }
}

@media (max-width: 1200px) {
  .overview-grid .el-col {
    flex: 0 0 33.333%;
    max-width: 33.333%;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 8px;
  }
  
  .refresh-controls {
    width: 100%;
    justify-content: space-between;
  }
  
  .main-content .el-col {
    flex: 0 0 100%;
    max-width: 100%;
    margin-bottom: 12px;
  }
  
  .overview-grid .el-col {
    flex: 0 0 50%;
    max-width: 50%;
  }
}

/* Loading 动画 */
.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  0% {
    transform: rotateZ(0deg);
  }
  100% {
    transform: rotateZ(360deg);
  }
}
</style>
