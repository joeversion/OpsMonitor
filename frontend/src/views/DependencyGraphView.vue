<template>
  <div class="dependency-graph">
    <div class="page-header">
      <h1>🔗 Service Topology</h1>
      <div class="header-controls">
        <el-switch 
          v-model="showImpactAnalysis" 
          active-text="Impact Analysis"
          inactive-text=""
          style="margin-right: 12px;"
          :disabled="isAllProjectsMode"
        />
        <el-button @click="migrateDependencies" type="warning" v-if="hasLegacyDependencies && !isAllProjectsMode">
          <el-icon><Upload /></el-icon>
          Migrate Legacy Dependencies
        </el-button>
        <el-button @click="refreshGraph" type="primary" :disabled="isAllProjectsMode">
          <el-icon><Refresh /></el-icon>
          Refresh
        </el-button>
      </div>
    </div>
    
    <!-- Empty State: Require Project Selection -->
    <div v-if="isAllProjectsMode" class="empty-state-container">
      <div class="empty-state-card">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">Select a Project to View Topology</h3>
        <p class="empty-description">
          Service topology visualization requires a specific project context.
          Please select a project from the dropdown menu above to continue.
        </p>
        <div class="empty-hint">
          💡 Tip: You can switch projects using the project selector in the sidebar
        </div>
      </div>
    </div>

    <!-- Alert Annotations for Down Services - Enhanced Version -->
    <div v-if="!isAllProjectsMode && showImpactAnalysis && (displayAlerts.length > 0 || showDemoAlert)" class="alert-annotations">
      <!-- Demo Mode Toggle -->
      <div v-if="downServices.length === 0" class="demo-toggle">
        <el-button 
          size="small" 
          :type="showDemoAlert ? 'warning' : 'info'" 
          @click="toggleDemoMode"
        >
          {{ showDemoAlert ? '🔴 Exit Demo Mode' : '👁️ Preview Impact Alert (Demo)' }}
        </el-button>
      </div>
      
      <div 
        v-for="(alert, alertIndex) in displayAlerts" 
        :key="alert.serviceId" 
        class="alert-item-enhanced"
        :class="{ expanded: alert.expanded }"
      >
        <!-- Alert Header -->
        <div class="alert-header" @click="selectNodeById(alert.serviceId)">
          <span class="alert-icon">💡</span>
          <span class="alert-text">{{ alert.message }}</span>
          
          <!-- Impact Summary Badges -->
          <div class="impact-summary">
            <span v-if="alert.breakdown.critical > 0" class="impact-badge critical">
              🔴 {{ alert.breakdown.critical }} Critical
            </span>
            <span v-if="alert.breakdown.high > 0" class="impact-badge high">
              🟠 {{ alert.breakdown.high }} High
            </span>
            <span v-if="alert.breakdown.medium > 0" class="impact-badge medium">
              🟡 {{ alert.breakdown.medium }} Medium
            </span>
            <span v-if="alert.breakdown.low > 0" class="impact-badge low">
              🟢 {{ alert.breakdown.low }} Low
            </span>
            <span v-if="alert.affectedCount === 0" class="impact-badge none">
              No services affected
            </span>
          </div>
          
          <button 
            class="expand-btn" 
            @click.stop="toggleAlertExpansion(alertIndex)"
            v-if="alert.affectedCount > 0 || alert.impactDescription"
          >
            {{ alert.expanded ? 'Hide Details ▲' : 'View Details ▼' }}
          </button>
        </div>
        
        <!-- Service Impact Description (shown directly when no services affected) -->
        <div v-if="alert.affectedCount === 0 && alert.impactDescription && !alert.expanded" class="direct-impact-desc">
          <div class="impact-section-title">📝 Service Impact</div>
          <div class="impact-description-content">
            {{ alert.impactDescription }}
          </div>
        </div>
        
        <!-- Expanded Details -->
        <transition name="slide-down">
          <div v-if="alert.expanded" class="impact-details">
            <!-- Impact Summary Section (only show if there are affected services) -->
            <div v-if="alert.affectedCount > 0" class="impact-section">
              <div class="impact-section-title">📊 Impact Summary</div>
              <div class="impact-breakdown">
                <div class="breakdown-item">
                  <span class="breakdown-dot critical"></span>
                  <span class="breakdown-label">Critical</span>
                  <span class="breakdown-count">{{ alert.breakdown.critical }}</span>
                </div>
                <div class="breakdown-item">
                  <span class="breakdown-dot high"></span>
                  <span class="breakdown-label">High</span>
                  <span class="breakdown-count">{{ alert.breakdown.high }}</span>
                </div>
                <div class="breakdown-item">
                  <span class="breakdown-dot medium"></span>
                  <span class="breakdown-label">Medium</span>
                  <span class="breakdown-count">{{ alert.breakdown.medium }}</span>
                </div>
                <div class="breakdown-item">
                  <span class="breakdown-dot low"></span>
                  <span class="breakdown-label">Low</span>
                  <span class="breakdown-count">{{ alert.breakdown.low }}</span>
                </div>
              </div>
            </div>
            
            <!-- Impact Description Section (if available) -->
            <div v-if="alert.impactDescription" class="impact-section">
              <div class="impact-section-title">📝 Impact Description</div>
              <div class="impact-description-content">
                {{ alert.impactDescription }}
              </div>
            </div>
            
            <!-- Affected Services List (only show if there are affected services) -->
            <div v-if="alert.affectedCount > 0" class="impact-section">
              <div class="impact-section-title">📋 Affected Services</div>
              <div class="affected-list">
                <div 
                  v-for="affected in alert.affectedServices" 
                  :key="affected.id"
                  class="affected-item"
                  :class="affected.impactLevel"
                  @click="selectNodeById(affected.id)"
                >
                  <span class="affected-icon">
                    {{ affected.impactLevel === 'critical' ? '🔴' : 
                       affected.impactLevel === 'high' ? '🟠' : 
                       affected.impactLevel === 'medium' ? '🟡' : '🟢' }}
                  </span>
                  <div class="affected-info">
                    <div class="affected-name">{{ affected.name }}</div>
                    <div class="affected-reason">{{ affected.impactReason }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>
    
    <!-- Graph Container with Header -->
    <div v-if="!isAllProjectsMode" class="graph-container">
      
      <div class="graph-content-wrapper" style="display: flex; flex-direction: column; height: 100%;">
        <div class="graph-header">
        <div class="graph-title">
          <span>🔗</span>
          <span>Live Dependency View</span>
        </div>
        
        <!-- Integrated Stats -->
        <div class="graph-stats">
            <div class="stat-pill">
                <span class="stat-label">Total:</span>
                <span class="stat-value">{{ stats.total }}</span>
            </div>
            <div class="stat-pill healthy">
                <span class="stat-dot"></span>
                <span class="stat-label">Healthy:</span>
                <span class="stat-value">{{ stats.up }}</span>
            </div>
            <div class="stat-pill warning">
                <span class="stat-dot"></span>
                <span class="stat-label">Warning:</span>
                <span class="stat-value">{{ stats.warning }}</span>
            </div>
            <div class="stat-pill down">
                <span class="stat-dot"></span>
                <span class="stat-label">Down:</span>
                <span class="stat-value">{{ stats.down }}</span>
            </div>
            <div class="stat-pill unknown" v-if="stats.unknown > 0">
                <span class="stat-dot"></span>
                <span class="stat-label">Unknown:</span>
                <span class="stat-value">{{ stats.unknown }}</span>
            </div>
        </div>
        
        <div class="header-controls-right">
          <!-- Security Panel Toggle Button -->
          <button 
            v-if="projectSecurityConfigs.length > 0" 
            class="security-toggle-btn"
            :class="{ 'has-expiring': expiringConfigsCount > 0 }"
            @click="showSecurityPanel = !showSecurityPanel"
          >
            <span>🔐</span>
            <span class="toggle-label">{{ showSecurityPanel ? 'Hide' : 'Security' }}</span>
            <span v-if="expiringConfigsCount > 0" class="expiring-badge">{{ expiringConfigsCount }}</span>
            <span v-else class="config-badge">{{ projectSecurityConfigs.length }}</span>
          </button>
          
          <!-- Save Layout Button (only visible in edit mode) -->
          <el-button 
            v-if="isEditMode && isAdmin"
            type="success"
            size="small" 
            @click="saveLayout"
          >
            <el-icon><Check /></el-icon>
            Save Layout
          </el-button>
          
          <!-- Customize Layout / Exit Customization Button -->
          <el-button 
            v-if="isAdmin"
            :type="isEditMode ? 'default' : 'default'" 
            size="small" 
            @click="toggleEditMode"
          >
            {{ isEditMode ? 'Exit Customization' : 'Customize Layout' }}
          </el-button>
          
          <!-- Grid Toggle Button (only visible in edit mode) -->
          <el-button
            v-if="isEditMode && isAdmin"
            size="small"
            :type="showGrid ? 'primary' : 'default'"
            @click="showGrid = !showGrid"
            title="Toggle grid lines for alignment reference"
          >
            <span style="font-size: 16px;">{{ showGrid ? '⊞' : '⊡' }}</span>
          </el-button>
          
          <!-- Keyboard Shortcuts Hint (inline with header) -->
          <transition name="slide-down">
            <div v-if="isEditMode && isAdmin" class="shortcuts-hint-inline" :class="{ collapsed: !showShortcutsHint }">
              <div class="hint-title" @click="showShortcutsHint = !showShortcutsHint">
                <span>⌨️</span>
                <span v-if="showShortcutsHint">Quick Selection</span>
                <button class="hint-toggle-btn" @click.stop="showShortcutsHint = !showShortcutsHint">
                  {{ showShortcutsHint ? '−' : '?' }}
                </button>
              </div>
              <transition name="expand">
                <div v-if="showShortcutsHint" class="hint-content">
                  <div class="hint-item">
                    <kbd>Shift</kbd> + <span class="hint-action">Drag</span>
                    <span class="hint-desc">Box select</span>
                  </div>
                  <div class="hint-item">
                    <kbd>Ctrl/Cmd</kbd> + <span class="hint-action">Click</span>
                    <span class="hint-desc">Multi-select</span>
                  </div>
                  <div class="hint-item">
                    <kbd>Ctrl/Cmd</kbd> + <kbd>A</kbd>
                    <span class="hint-desc">Select all</span>
                  </div>
                  <div class="hint-item">
                    <kbd>Esc</kbd>
                    <span class="hint-desc">Clear</span>
                  </div>
                </div>
              </transition>
            </div>
          </transition>
        </div>
      </div>
      
      <div class="graph-canvas-wrapper">
        <InteractiveGraphCanvas 
          v-if="useInteractiveGraph"
          v-model:nodes="graphNodes"
          :links="graphLinks"
          :is-edit-mode="isEditMode && isAdmin"
          :selected-node-id="selectedNode?.id"
          :show-grid="showGrid"
          :readonly="!isAdmin"
          @select-node="handleNodeSelect"
          @add-link="handleAddLink"
          @update-link="handleUpdateLink"
          @delete-link="handleDeleteLink"
          @save-layout="saveLayout"
        />
        <LayeredGraphCanvas 
          v-else
          ref="canvasRef"
        >
          <!-- Impact Annotations (Floating Labels in Graph) -->
          <div v-if="showImpactAnalysis && downServices.length > 0" class="graph-annotations">
            <div 
              v-for="(alert, index) in serviceAlerts" 
              :key="alert.serviceId" 
              class="graph-annotation"
              :style="{ top: (80 + index * 60) + 'px' }"
            @click="selectNodeById(alert.serviceId)"
          >
            <span class="annotation-icon">💡</span>
            <span class="annotation-text">{{ alert.message }}</span>
          </div>
        </div>
        
        <!-- Right Click Context Menu -->
        <transition name="fade">
          <div 
            v-if="contextMenu.visible" 
            class="context-menu"
            :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
            @click.stop
          >
            <div class="context-menu-item" @click="handleContextMenuAction('view')">
              <span class="menu-icon">📋</span>
              <span>View Details</span>
            </div>
            <div class="context-menu-item" @click="handleContextMenuAction('focus')">
              <span class="menu-icon">🎯</span>
              <span>Focus Node</span>
            </div>
            <div class="context-menu-item" @click="handleContextMenuAction('dependencies')">
              <span class="menu-icon">🔗</span>
              <span>View Dependencies</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" @click="handleContextMenuAction('check')">
              <span class="menu-icon">🔄</span>
              <span>Manual Health Check</span>
            </div>
            <div v-if="contextMenu.node?.status === 'down'" class="context-menu-divider"></div>
            <div v-if="contextMenu.node?.status === 'down'" class="context-menu-item" @click="handleContextMenuAction('impact')">
              <span class="menu-icon">💡</span>
              <span>Add Impact Annotation</span>
            </div>
          </div>
        </transition>
        
        <!-- Quick Action Bar (Left Bottom) -->
        <div class="quick-bar">
          <button class="quick-btn" @click="showImpactAnalysis = !showImpactAnalysis">
            <span>💡</span>
            <span>{{ showImpactAnalysis ? 'Hide Analysis' : 'Impact Analysis' }}</span>
          </button>
          <button class="quick-btn" @click="refreshGraph">
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
        
        <!-- Node Detail Panel -->
        <transition name="slide">
          <div v-if="selectedNode" class="detail-panel">
            <div class="panel-header">
              <div class="panel-title">
                <span 
                  class="status-dot" 
                  :class="selectedNode.status"
                ></span>
                <span>{{ selectedNode.name }}</span>
              </div>
              <el-button :icon="Close" circle size="small" @click="selectedNode = null" />
            </div>
            <div class="panel-body">
              <div class="detail-row">
                <span class="label">Status</span>
                <el-tag :type="getStatusType(selectedNode.status)" size="small">
                  {{ selectedNode.status?.toUpperCase() || 'UNKNOWN' }}
                </el-tag>
              </div>
              <div class="detail-row">
                <span class="label">Host</span>
                <span class="value">{{ selectedNode.host }}:{{ selectedNode.port }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Response Time</span>
                <span class="value" :class="{ 'warning-text': isSlowResponse(selectedNode.responseTime) }">
                  {{ formatResponseTime(selectedNode.responseTime) }}
                </span>
              </div>
              <div class="detail-row">
                <span class="label">Last Check</span>
                <span class="value">{{ formatLastCheck(selectedNode.lastCheck) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Risk Level</span>
                <el-tag :type="getRiskType(selectedNode.riskLevel)" size="small">
                  {{ selectedNode.riskLevel?.toUpperCase() }}
                </el-tag>
              </div>
              
              <!-- Error Message for Down/Warning -->
              <div v-if="selectedNode.status === 'down' || selectedNode.status === 'warning'" class="error-section">
                <div class="error-label">
                  <el-icon v-if="selectedNode.status === 'down'" color="#f04438"><CircleClose /></el-icon>
                  <el-icon v-else color="#f79009"><Warning /></el-icon>
                  <span>{{ selectedNode.status === 'down' ? 'Error' : 'Warning' }}</span>
                </div>
                <div class="error-message">{{ selectedNode.errorMessage || 'Connection failed' }}</div>
              </div>
              
              <!-- Impact Analysis for Down Services -->
              <div v-if="selectedNode.status === 'down' && impactedServices.length > 0" class="impact-section">
                <div class="section-title">
                  <span>⚠️ Impact Analysis</span>
                  <el-tag type="danger" size="small">{{ impactedServices.length }} affected</el-tag>
                </div>
                <div class="impact-description">
                  Services that depend on this service may be affected
                </div>
                <div 
                  v-for="service in impactedServices" 
                  :key="service.id" 
                  class="dep-item impact"
                  @click="selectNodeById(service.id)"
                >
                  <span class="status-dot small" :class="service.status"></span>
                  <span class="dep-name">{{ service.name }}</span>
                  <el-tag :type="service.impactLevel === 'critical' ? 'danger' : 'warning'" size="small">
                    {{ service.impactLevel?.toUpperCase() }}
                  </el-tag>
                </div>
              </div>
              
              <!-- Dependencies -->
              <div class="dependency-section" v-if="nodeDependencies.length > 0">
                <div class="section-title">⬇️ Depends on ({{ nodeDependencies.length }})</div>
                <div 
                  v-for="dep in nodeDependencies" 
                  :key="dep.id" 
                  class="dep-item"
                  @click="selectNodeById(dep.id)"
                >
                  <span class="status-dot small" :class="dep.status"></span>
                  <span class="dep-name">{{ dep.name }}</span>
                  <el-tag v-if="dep.status === 'down'" type="danger" size="small">DOWN</el-tag>
                </div>
              </div>
              
              <!-- Dependents -->
              <div class="dependency-section" v-if="nodeDependents.length > 0">
                <div class="section-title">⬆️ Depended by ({{ nodeDependents.length }})</div>
                <div 
                  v-for="dep in nodeDependents" 
                  :key="dep.id" 
                  class="dep-item"
                  @click="selectNodeById(dep.id)"
                >
                  <span class="status-dot small" :class="dep.status"></span>
                  <span class="dep-name">{{ dep.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </LayeredGraphCanvas>
      
      <!-- Security Configs Panel - Inside graph area -->
      <transition name="slide-right">
        <div v-if="showSecurityPanel && projectSecurityConfigs.length > 0" class="security-cards-panel">
          <div class="security-panel-header">
            <div class="security-panel-title">
              <span>🔐</span>
              <span>Security Configs</span>
              <span class="config-count">({{ projectSecurityConfigs.length }})</span>
            </div>
            <div class="security-header-actions">
              <div class="security-filters">
                <button 
                  class="security-filter-btn" 
                  :class="{ active: securityFilter === 'all' }"
                  @click="securityFilter = 'all'"
                >All</button>
                <button 
                  class="security-filter-btn" 
                  :class="{ active: securityFilter === 'expiring' }"
                  @click="securityFilter = 'expiring'"
                >
                  Expiring
                  <span v-if="expiringConfigsCount > 0" class="filter-badge">{{ expiringConfigsCount }}</span>
                </button>
              </div>
              <button class="close-panel-btn" @click="showSecurityPanel = false">✕</button>
            </div>
          </div>
          
          <div class="security-cards-list">
            <div 
              v-for="config in filteredSecurityConfigs" 
              :key="config.id"
              class="security-card"
              :class="config.status"
              @click="highlightAffectedServices(config)"
            >
              <div class="security-card-header">
                <div class="security-card-name">{{ config.name }}</div>
                <span class="security-status-badge" :class="config.status">
                  {{ getSecurityStatusLabel(config.status) }}
                </span>
              </div>
              <div class="security-card-type">{{ getSecurityTypeLabel(config.type) }}</div>
              <div class="security-card-info">
                <span class="expiry-label">Expires:</span>
                <span class="expiry-date">{{ formatSecurityDate(config.expiry_date) }}</span>
                <span class="days-remaining" :class="config.status">
                  ({{ config.days_remaining > 0 ? config.days_remaining + ' days left' : 'Expired' }})
                </span>
              </div>
              <div v-if="config.affected_services?.length" class="security-card-services">
                <span class="affects-label">Affects:</span>
                <div class="service-tags">
                  <span 
                    v-for="serviceId in config.affected_services.slice(0, 3)" 
                    :key="serviceId"
                    class="service-tag"
                  >{{ getServiceName(serviceId) }}</span>
                  <span v-if="config.affected_services.length > 3" class="service-tag more">
                    +{{ config.affected_services.length - 3 }}
                  </span>
                </div>
              </div>
              <div v-if="config.notes" class="security-card-notes">
                <span class="notes-icon">📝</span>
                <span class="notes-text">{{ config.notes }}</span>
              </div>
            </div>
            
            <div v-if="filteredSecurityConfigs.length === 0" class="no-configs">
              <span>{{ securityFilter === 'expiring' ? 'No expiring configs in this project' : 'No security configs for this project' }}</span>
            </div>
          </div>
        </div>
      </transition>
      </div> <!-- End of graph-canvas-wrapper -->
      </div> <!-- End of graph-content-wrapper -->
    </div> <!-- End of graph-container -->
  </div> <!-- End of dependency-graph -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject, watch } from 'vue';
import { Graph } from '@antv/g6';
import { ElMessage } from 'element-plus';
import { createDependency, updateDependency, deleteDependency, migrateDependencies as migrateDeps } from '../api/dependencies';
import { getSecurityConfigs, type SecurityConfig } from '../api/security-configs';
import { Refresh, Close, CircleClose, Warning, Upload, Check } from '@element-plus/icons-vue';
import LayeredGraphCanvas from '../components/LayeredGraphCanvas.vue';
import InteractiveGraphCanvas from '../components/InteractiveGraphCanvas.vue';
import api from '../api';
import authUtils from '../utils/auth';
import {
  type ServiceLayer,
  layerColors,
  layerOrder,
  getServiceLayer,
  getServiceIcon,
  formatResponseTime as formatRT,
  isSlowResponse as isSlow,
  formatLastCheck as formatCheck,
  getStatusType as getStatusT,
  getRiskType as getRiskT
} from '../utils/graphUtils';

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

interface ServiceWithStatus {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'up' | 'down' | 'warning' | 'unknown';
  responseTime?: number;
  riskLevel: string;
  dependencies?: string[];
  errorMessage?: string;
  lastCheck?: string;
  layer?: string; // Business layer
  layout_x?: number;
  layout_y?: number;
  project_id?: string;  // Project ID for cross-project dependency detection
  project_name?: string;  // Project name for display
  isCrossProjectService?: boolean;  // Flag for services from other projects
  // Service-level alert customization
  impact_description?: string;
  custom_alert_template?: string;
}

interface ImpactedService extends ServiceWithStatus {
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  impactReason?: string;
  impactPath?: string[];
}

interface ImpactBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ServiceAlert {
  serviceId: string;
  serviceName: string;
  message: string;
  impactDescription?: string;  // Custom impact description from dependency config
  affectedCount: number;
  breakdown: ImpactBreakdown;
  affectedServices: ImpactedService[];
  expanded: boolean;
}

const canvasRef = ref<any>(null);
const container = computed(() => canvasRef.value?.graphContainer);
const selectedNode = ref<ServiceWithStatus | null>(null);
const allServices = ref<ServiceWithStatus[]>([]);
const showImpactAnalysis = ref(true);
const useInteractiveGraph = ref(true);
const isEditMode = ref(false);
const graphNodes = ref<any[]>([]);
const graphLinks = ref<any[]>([]);
let graph: Graph | null = null;

// Security Configs Panel
const securityConfigs = ref<SecurityConfig[]>([]);
const showSecurityPanel = ref(true);
const securityFilter = ref<'all' | 'expiring'>('all');
const allGlobalServices = ref<{ id: string; name: string; project_name?: string }[]>([]);
const showShortcutsHint = ref(true);
const showGrid = ref(false);

// Get service IDs of current project
const currentProjectServiceIds = computed(() => {
  return allServices.value.map(s => s.id);
});

// Filter configs that affect services in current project
const projectSecurityConfigs = computed(() => {
  const serviceIds = currentProjectServiceIds.value;
  if (serviceIds.length === 0) return [];
  
  return securityConfigs.value.filter(config => {
    if (!config.affected_services || config.affected_services.length === 0) {
      return false;
    }
    // Check if any affected service is in current project
    return config.affected_services.some(sid => serviceIds.includes(sid));
  });
});

const filteredSecurityConfigs = computed(() => {
  const configs = projectSecurityConfigs.value;
  if (securityFilter.value === 'expiring') {
    return configs.filter(c => c.status !== 'normal');
  }
  return configs;
});

const expiringConfigsCount = computed(() => {
  return projectSecurityConfigs.value.filter(c => c.status !== 'normal').length;
});

const getSecurityStatusLabel = (status: string) => {
  switch (status) {
    case 'normal': return 'Normal';
    case 'warning': return 'Warning';
    case 'critical': return 'Critical';
    case 'expired': return 'Expired';
    default: return status;
  }
};

const getSecurityTypeLabel = (type: string) => {
  switch (type) {
    case 'accesskey': return 'AccessKey';
    case 'ftp': return 'FTP Password';
    case 'ssl': return 'SSL Certificate';
    default: return type;
  }
};

const formatSecurityDate = (dateStr: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    year: 'numeric',
    month: 'short', 
    day: 'numeric' 
  });
};

const getServiceName = (serviceId: string) => {
  // First try current project services
  const service = allServices.value.find(s => s.id === serviceId);
  if (service) return service.name;
  
  // Then try global services list
  const globalService = allGlobalServices.value.find(s => s.id === serviceId);
  if (globalService) {
    return globalService.project_name 
      ? `${globalService.name} (${globalService.project_name})`
      : globalService.name;
  }
  
  return serviceId;
};

const highlightAffectedServices = (config: SecurityConfig) => {
  // TODO: Highlight affected services in the graph
  console.log('Highlight services:', config.affected_services);
};

const loadSecurityConfigs = async () => {
  try {
    // Load all services for name resolution
    const allServicesRes = await api.get('/services');
    allGlobalServices.value = allServicesRes.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      project_name: s.project_name
    }));
    
    securityConfigs.value = await getSecurityConfigs();
    console.log('Loaded security configs:', securityConfigs.value.length);
  } catch (error) {
    console.error('Failed to load security configs:', error);
  }
};

// Context menu state
const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  node: ServiceWithStatus | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  node: null
});

const currentProjectId = inject<{ value: string | undefined }>('currentProjectId');

// 上下文模式：All Projects 时需要提示用户选择项目
const isAllProjectsMode = computed(() => !currentProjectId?.value);

// Watch for project switch, refresh data
watch(
  () => currentProjectId?.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      console.log('Project changed from', oldVal, 'to', newVal);
      // Refresh graph data
      refreshGraph();
    }
  }
);

// Statistics data
const stats = computed(() => {
  const result = { total: 0, up: 0, warning: 0, down: 0, unknown: 0 };
  allServices.value.forEach(s => {
    result.total++;
    if (s.status === 'up') result.up++;
    else if (s.status === 'warning') result.warning++;
    else if (s.status === 'down') result.down++;
    else result.unknown++;
  });
  return result;
});

// Check if there are legacy dependencies (temporary link IDs)
const hasLegacyDependencies = computed(() => {
  return graphLinks.value.some(link => link.id.startsWith('link-'));
});

// Down services list
const downServices = computed(() => {
  return allServices.value.filter(s => s.status === 'down');
});

// Demo alert for testing when no services are down
const demoAlert = ref<ServiceAlert | null>(null);
const showDemoAlert = ref(false);

const toggleDemoMode = () => {
  showDemoAlert.value = !showDemoAlert.value;
  if (showDemoAlert.value && allServices.value.length > 0) {
    // Create a demo alert using first service
    const demoService = allServices.value[0];
    const mockAffected: ImpactedService[] = allServices.value.slice(1, 6).map((s, i) => ({
      ...s,
      impactLevel: i === 0 ? 'critical' : i < 2 ? 'high' : i < 4 ? 'medium' : 'low',
      impactReason: i === 0 ? 'Direct dependency (risk: critical)' : `Via ${demoService.name} (depth: ${i})`,
      impactPath: [demoService.name, s.name]
    })) as ImpactedService[];
    
    demoAlert.value = {
      serviceId: demoService.id,
      serviceName: demoService.name,
      message: `[DEMO] ${demoService.name} service is down`,
      affectedCount: mockAffected.length,
      breakdown: calculateBreakdown(mockAffected),
      affectedServices: mockAffected,
      expanded: false
    };
  } else {
    demoAlert.value = null;
  }
};

// Combined alerts (real + demo)
const displayAlerts = computed(() => {
  const alerts = [...serviceAlerts.value];
  if (showDemoAlert.value && demoAlert.value) {
    alerts.unshift(demoAlert.value);
  }
  return alerts;
});

// Service alert information with detailed breakdown
const serviceAlerts = ref<ServiceAlert[]>([]);

// Compute service alerts when down services change
watch(downServices, () => {
  serviceAlerts.value = downServices.value.map(service => {
    const affected = getAffectedServicesEnhanced(service.id, service.name);
    const breakdown = calculateBreakdown(affected);
    
    // Find dependency links where this service is the target (services depending on this service)
    const relatedLinks = graphLinks.value.filter(link => link.target === service.id);
    
    // Get the full service object to access service-level impact_description
    const fullService = allServices.value.find(s => s.id === service.id);
    
    // Service-level impact description takes priority
    const serviceImpactDesc = (fullService as any)?.impact_description;
    
    // Collect impact descriptions from dependencies (as secondary info)
    const depImpactDescriptions = relatedLinks
      .filter(link => link.impact_description)
      .map(link => {
        const sourceService = allServices.value.find(s => s.id === link.source);
        return `${sourceService?.name || 'Unknown'}: ${link.impact_description}`;
      });
    
    // Combine: service-level first, then dependency-level
    let combinedImpactDesc: string | undefined;
    if (serviceImpactDesc) {
      combinedImpactDesc = serviceImpactDesc;
      if (depImpactDescriptions.length > 0) {
        combinedImpactDesc += ' | Dependency impacts: ' + depImpactDescriptions.join('; ');
      }
    } else if (depImpactDescriptions.length > 0) {
      combinedImpactDesc = depImpactDescriptions.join('; ');
    }
    
    // Use service-level custom alert template first, then dependency-level
    const serviceCustomTemplate = (fullService as any)?.custom_alert_template;
    const depCustomTemplate = relatedLinks.find(link => link.custom_alert_template)?.custom_alert_template;
    const customTemplate = serviceCustomTemplate || depCustomTemplate;
    
    let message = `${service.name} service is down`;
    if (customTemplate) {
      message = customTemplate
        .replace(/\{service_name\}/g, service.name)
        .replace(/\{affected_count\}/g, String(affected.length))
        .replace(/\{risk_level\}/g, service.riskLevel || 'unknown')
        .replace(/\{status\}/g, 'down')
        .replace(/\{host\}/g, (fullService as any)?.host || '')
        .replace(/\{port\}/g, String((fullService as any)?.port || ''))
        .replace(/\{impact_description\}/g, serviceImpactDesc || '')
        .replace(/\{down_time\}/g, new Date().toLocaleTimeString());
    }
    
    return {
      serviceId: service.id,
      serviceName: service.name,
      message,
      impactDescription: combinedImpactDesc,
      affectedCount: affected.length,
      breakdown,
      affectedServices: affected,
      expanded: false
    };
  });
}, { immediate: true });

// Toggle alert expansion
const toggleAlertExpansion = (alertIndex: number) => {
  // If demo mode is on and it's the first alert (demo alert)
  if (showDemoAlert.value && demoAlert.value && alertIndex === 0) {
    demoAlert.value.expanded = !demoAlert.value.expanded;
  } else {
    // Adjust index if demo alert is shown
    const realIndex = showDemoAlert.value && demoAlert.value ? alertIndex - 1 : alertIndex;
    if (realIndex >= 0 && realIndex < serviceAlerts.value.length) {
      serviceAlerts.value[realIndex].expanded = !serviceAlerts.value[realIndex].expanded;
    }
  }
};

// Calculate breakdown by impact level
const calculateBreakdown = (affected: ImpactedService[]): ImpactBreakdown => {
  return {
    critical: affected.filter(s => s.impactLevel === 'critical').length,
    high: affected.filter(s => s.impactLevel === 'high').length,
    medium: affected.filter(s => s.impactLevel === 'medium').length,
    low: affected.filter(s => s.impactLevel === 'low').length
  };
};

// Enhanced function to calculate affected services with detailed impact levels
const getAffectedServicesEnhanced = (
  serviceId: string, 
  sourceName: string,
  depth: number = 0, 
  visited: Set<string> = new Set(),
  path: string[] = [],
  rootServiceRiskLevel?: string // Risk level of the original down service
): ImpactedService[] => {
  if (visited.has(serviceId)) return [];
  visited.add(serviceId);
  
  const affected: ImpactedService[] = [];
  const currentPath = [...path, sourceName];
  
  // Get root service risk level if this is the first call (depth === 0)
  // The root service is the one that's down
  let effectiveRiskLevel = rootServiceRiskLevel;
  if (depth === 0) {
    const rootService = allServices.value.find(s => s.id === serviceId);
    effectiveRiskLevel = rootService?.riskLevel || 'medium';
  }
  
  // Find services that depend ON this service (this service is their target/dependency)
  // If serviceId is down, services that depend on it will be affected
  // In graphLinks: source depends on target, so we need to find where target === serviceId
  const directDependents = allServices.value.filter(s => {
    // Check legacy dependencies (s.dependencies contains IDs that s depends on)
    if (s.dependencies?.includes(serviceId)) return true;
    // Check new dependency links: source depends on target
    // So if serviceId is the target, source is affected
    return graphLinks.value.some(link => 
      link.source === s.id && link.target === serviceId
    );
  });
  
  directDependents.forEach(dependent => {
    // Impact level uses the DOWN SERVICE's risk_level, not the dependency link's risk_level
    // This is consistent regardless of depth
    const impactLevel = (effectiveRiskLevel || 'medium') as 'critical' | 'high' | 'medium' | 'low';
    
    const impactReason = depth === 0 
      ? `Direct dependency (service risk: ${effectiveRiskLevel})`
      : `Via ${currentPath[currentPath.length - 1]} (depth: ${depth + 1})`;
    
    affected.push({
      ...dependent,
      impactLevel,
      impactReason,
      impactPath: [...currentPath, dependent.name]
    });
    
    // Recursively find indirect dependencies (max 3 levels)
    if (depth < 2) {
      const indirect = getAffectedServicesEnhanced(
        dependent.id, 
        dependent.name,
        depth + 1, 
        visited,
        currentPath,
        effectiveRiskLevel // Pass the root service's risk level
      );
      indirect.forEach(s => {
        if (!affected.find(a => a.id === s.id)) {
          affected.push(s);
        }
      });
    }
  });
  
  return affected;
};

// Impact analysis for currently selected node
const impactedServices = computed((): ImpactedService[] => {
  if (!selectedNode.value || selectedNode.value.status !== 'down') return [];
  return getAffectedServicesEnhanced(selectedNode.value.id, selectedNode.value.name);
});

const nodeDependencies = computed(() => {
  if (!selectedNode.value || !selectedNode.value.dependencies) return [];
  return selectedNode.value.dependencies
    .map(depId => allServices.value.find(s => s.id === depId))
    .filter(Boolean) as ServiceWithStatus[];
});

const nodeDependents = computed(() => {
  if (!selectedNode.value) return [];
  return allServices.value.filter(s => 
    s.dependencies?.includes(selectedNode.value!.id)
  );
});

// Use shared utility functions
const getStatusType = getStatusT;
const getRiskType = getRiskT;
const formatResponseTime = formatRT;
const isSlowResponse = isSlow;
const formatLastCheck = formatCheck;

const toggleEditMode = async () => {
  if (isEditMode.value) {
    // Exiting edit mode - do NOT auto save, user must click Save button explicitly
    isEditMode.value = false;
    ElMessage.info('Exited customization mode');
  } else {
    // Entering edit mode
    isEditMode.value = true;
    ElMessage.info('Entered customization mode: drag nodes, create/delete connections');
  }
};

const saveLayout = async () => {
  try {
    const projectId = currentProjectId?.value;
    const layoutData = graphNodes.value.map(node => ({
      id: node.id,
      layout_x: Math.round(node.x || 0),
      layout_y: Math.round(node.y || 0),
      // Mark cross-project services with the viewing project ID
      isCrossProjectService: node.isCrossProjectService || false,
      viewingProjectId: node.isCrossProjectService ? projectId : undefined
    }));
    
    console.log('Saving layout data:', layoutData);
    
    // Use batch API for better performance
    const response = await api.post('/services/layout', layoutData);
    console.log('Layout save response:', response.data);
    
    ElMessage.success('Layout saved successfully');
    
    // Refresh graph data to ensure UI is in sync with database
    // This is important after dependency type updates in edit mode
    await refreshGraph();
  } catch (error: any) {
    console.error('Failed to save layout:', error);
    console.error('Error response:', error.response?.data);
    ElMessage.error('Failed to save layout: ' + (error.response?.data?.error || error.message));
  }
};

const handleAddLink = async (payload: { source: string, target: string, dependencyType?: string }) => {
  const { source: sourceId, target: targetId, dependencyType = 'depends' } = payload;
  try {
    const newDep = await createDependency({
      source_service_id: sourceId,
      target_service_id: targetId,
      dependency_type: dependencyType
    });
    
    // Update local state
    const sourceService = allServices.value.find(s => s.id === sourceId);
    if (sourceService) {
      if (!sourceService.dependencies) sourceService.dependencies = [];
      if (!sourceService.dependencies.includes(targetId)) {
        sourceService.dependencies.push(targetId);
      }
    }
    
    // Add to graphLinks
    graphLinks.value.push({
      id: newDep.id,
      source: sourceId,
      target: targetId,
      dependencyType: dependencyType,
      status: allServices.value.find(s => s.id === targetId)?.status
    });
    
    ElMessage.success('Dependency created');
  } catch (error) {
    console.error('Failed to create dependency:', error);
    ElMessage.error('Failed to create dependency');
  }
};

const handleUpdateLink = async (payload: { id: string, dependencyType?: string, linkDirection?: string }) => {
  const { id, dependencyType, linkDirection } = payload;
  
  // Check if this is a real dependency (has UUID) or a fallback link (has "link-" prefix)
  if (id.startsWith('link-')) {
    ElMessage({
      message: 'This is a legacy dependency. To edit it, please delete and recreate in Customize Layout mode.',
      type: 'info',
      duration: 5000,
      showClose: true
    });
    return;
  }
  
  try {
    // Build update payload based on what's provided
    const updatePayload: { dependency_type?: string; link_direction?: string } = {};
    if (dependencyType) updatePayload.dependency_type = dependencyType;
    if (linkDirection) updatePayload.link_direction = linkDirection;
    
    await updateDependency(id, updatePayload);
    
    // Update local state
    const linkIndex = graphLinks.value.findIndex(l => l.id === id);
    if (linkIndex >= 0) {
      if (dependencyType) graphLinks.value[linkIndex].dependencyType = dependencyType;
      if (linkDirection) graphLinks.value[linkIndex].linkDirection = linkDirection as any;
    }
    
    const updateMessage = linkDirection ? 'Link direction updated' : 'Dependency type updated';
    ElMessage.success(updateMessage);
  } catch (error: any) {
    console.error('Failed to update dependency:', error);
    ElMessage.error(error.response?.data?.error || 'Failed to update dependency');
  }
};

const migrateDependencies = async () => {
  const loading = ElMessage({
    message: 'Migrating legacy dependencies...',
    type: 'info',
    duration: 0,
    iconClass: 'el-icon-loading'
  });
  
  try {
    const result = await migrateDeps();
    loading.close();
    
    ElMessage.success(`Migration completed! Migrated: ${result.migrated}, Skipped: ${result.skipped}`);
    
    // Refresh the graph to load newly migrated dependencies
    await refreshGraph();
  } catch (error: any) {
    loading.close();
    console.error('Failed to migrate dependencies:', error);
    ElMessage.error(error.response?.data?.error || 'Failed to migrate dependencies');
  }
};

const handleDeleteLink = async (link: { id: string, source: string, target: string }) => {
  try {
    await deleteDependency(link.id);
    
    // Update local state - remove from graphLinks
    graphLinks.value = graphLinks.value.filter(l => l.id !== link.id);
    
    // Update service dependencies
    const sourceService = allServices.value.find(s => s.id === link.source);
    if (sourceService && sourceService.dependencies) {
      sourceService.dependencies = sourceService.dependencies.filter(d => d !== link.target);
    }
    
    ElMessage.success('Dependency deleted');
  } catch (error) {
    console.error('Failed to delete dependency:', error);
    ElMessage.error('Failed to delete dependency');
  }
};

const autoLayout = () => {
  refreshGraph();
};


const handleNodeSelect = (node: any) => {
  if (node && node.id) {
    selectNodeById(node.id);
  }
};

const initGraph = async (data: any) => {
  if (!container.value) {
    console.warn('Container not ready, retrying...');
    setTimeout(() => initGraph(data), 100);
    return;
  }

  // Ensure container has valid size to prevent Canvas from being too large
  const width = Math.max(container.value.clientWidth || 800, 100);
  const height = Math.max(container.value.clientHeight || 600, 100);

  console.log('Initializing graph with size:', width, 'x', height);

  try {
    graph = new Graph({
      container: container.value,
      width: width,
      height: height,
    
    // Use fixed layered layout
    layout: {
      type: 'dagre',
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 120,
      // Group nodes into different ranks by layer
      nodeOrder: (node: any) => {
        return node.data?.layerIndex ?? 1;
      },
      // Force nodes in the same layer to be in the same rank
      ranker: 'tight-tree'
    },
    
    node: {
      type: 'rect',
      style: {
        size: [200, 70],
        radius: 12,
        fill: (d: any) => {
          const status = d.data?.status || 'unknown';
          if (status === 'down') return '#fef3f2';
          if (status === 'warning') return '#fffbeb';
          if (status === 'unknown') return '#f2f4f7';
          return '#ffffff';
        },
        stroke: (d: any) => {
          const status = d.data?.status || 'unknown';
          // If status is down, use red border
          if (status === 'down') return '#f04438';
          // If status is warning, use yellow border
          if (status === 'warning') return '#f79009';
          // If status is unknown, use gray border
          if (status === 'unknown') return '#98a2b3';
          // Otherwise set border color based on layer
          const layer = (d.data?.layer || 'backend') as ServiceLayer;
          return layerColors[layer] || layerColors.backend;
        },
        lineWidth: 2,
        labelText: (d: any) => {
          const name = d.data?.name || d.id;
          // 优先使用自定义图标，如果没有则使用默认图标
          const customIcon = d.data?.icon;
          const defaultIcon = getServiceIcon(name);
          const icon = customIcon || defaultIcon;
          const responseTime = d.data?.responseTime;
          const port = d.data?.port;
          const status = d.data?.status || 'unknown';
          
          // Display format: icon name \n port info + response time/error
          let rtText = '';
          if (status === 'down') {
            rtText = '⚠ Connection refused';
          } else if (status === 'unknown') {
            rtText = '? No data';
          } else if (responseTime) {
            if (responseTime > 500) {
              rtText = `⚠ ${responseTime}ms avg`;
            } else {
              rtText = `${responseTime}ms avg`;
            }
          }
          return `${icon}  ${name}\n:${port}  ${rtText}`;
        },
        labelFill: (d: any) => {
          const status = d.data?.status || 'unknown';
          if (status === 'down') return '#b42318';
          if (status === 'unknown') return '#475467';
          return '#101828';
        },
        labelFontSize: 12,
        labelFontWeight: 600,
        labelPlacement: 'center',
        cursor: 'pointer',
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowBlur: 10,
        shadowOffsetY: 3,
      },
    },
    
    edge: {
      style: {
        stroke: (d: any) => {
          const targetNode = allServices.value.find(s => s.id === d.target);
          const sourceNode = allServices.value.find(s => s.id === d.source);
          const status = targetNode?.status || 'unknown';
          // If target node is down, use red
          if (status === 'down') return '#f04438';
          // If target node is warning, use yellow
          if (status === 'warning') return '#f79009';
          // If target node is unknown, use gray
          if (status === 'unknown') return '#98a2b3';
          // If source node is down, connection is broken
          if (sourceNode?.status === 'down') return '#d0d5dd';
          // Normal status uses green
          return '#12b76a';
        },
        lineWidth: 2,
        lineDash: (d: any) => {
          const targetNode = allServices.value.find(s => s.id === d.target);
          if (targetNode?.status === 'down') return [6, 4];
          if (targetNode?.status === 'warning') return [4, 2];
          if (targetNode?.status === 'unknown') return [4, 4];
          return undefined;
        },
        endArrow: (d: any) => {
          const targetNode = allServices.value.find(s => s.id === d.target);
          const status = targetNode?.status || 'unknown';
          let color = '#12b76a';
          if (status === 'down') color = '#f04438';
          else if (status === 'warning') color = '#f79009';
          else if (status === 'unknown') color = '#98a2b3';
          
          return {
            fill: color,
            path: 'M 0,0 L 8,4 L 8,-4 Z',
          } as any;
        },
      },
    },
    
    behaviors: [
      'drag-canvas',
      'zoom-canvas',
      'drag-element',
    ],
    
    autoFit: 'view',
    // padding: [80, 360, 100, 80], // top, right(for detail panel), bottom(for quick bar), left
    
    data: data
  });

  // Listen for node click events
  graph.on('node:click', (event: any) => {
    // Close context menu
    contextMenu.value.visible = false;
    
    const nodeId = event.itemId || event.target?.id;
    if (nodeId) {
      const service = allServices.value.find(s => s.id === nodeId);
      if (service) {
        selectedNode.value = service;
      }
    }
  });
  
  // Listen for node right-click events
  graph.on('node:contextmenu', (event: any) => {
    event.preventDefault?.();
    const nodeId = event.itemId || event.target?.id;
    if (nodeId) {
      const service = allServices.value.find(s => s.id === nodeId);
      if (service) {
        // Get mouse position relative to container
        const containerRect = container.value?.getBoundingClientRect();
        const x = (event.client?.x || event.clientX || 0) - (containerRect?.left || 0);
        const y = (event.client?.y || event.clientY || 0) - (containerRect?.top || 0);
        
        contextMenu.value = {
          visible: true,
          x,
          y,
          node: service
        };
      }
    }
  });

  // Listen for canvas click events, deselect and close context menu
  graph.on('canvas:click', () => {
    selectedNode.value = null;
    contextMenu.value.visible = false;
  });

  console.log('Rendering graph with data:', data);
  await graph.render();
  console.log('Graph rendered successfully');
  
  setTimeout(() => {
    if (graph) {
      console.log('Fitting view');
      // 自适应图形内容，但设置较大的 minZoom 避免过度缩小
      // minZoom 0.6 确保不同项目显示大小更接近
      graph.fitView({ 
        padding: 20,
        rules: {
          minZoom: 0.6,  // 提高到 0.6，使不同项目显示更统一
          maxZoom: 2
        }
      });
    }
  }, 100);
  
  } catch (err) {
    console.error('Graph initialization error:', err);
  }
};

const transformData = (services: ServiceWithStatus[]) => {
  const nodes = services.map(s => {
    // @ts-ignore - layer property might not be in ServiceWithStatus type definition yet but is in API response
    const layer = getServiceLayer(s.name, s.layer);
    return {
      id: s.id,
      data: {
        name: s.name,
        status: s.status,
        host: s.host,
        port: s.port,
        responseTime: s.responseTime,
        riskLevel: s.riskLevel,
        errorMessage: s.errorMessage,
        layer: layer,
        // Set layer index for dagre layout sorting
        layerIndex: layerOrder.indexOf(layer),
        layout_x: s.layout_x,
        layout_y: s.layout_y,
        // Cross-project service properties
        isCrossProjectService: s.isCrossProjectService,
        project_id: s.project_id,
        project_name: s.project_name,
        // Custom icon for topology view
        icon: s.icon
      }
    };
  });

  const edges: any[] = [];
  services.forEach(s => {
    if (s.dependencies && s.dependencies.length > 0) {
      s.dependencies.forEach(depId => {
        // Only add edges where target node exists
        const targetNode = services.find(t => t.id === depId);
        if (targetNode) {
          edges.push({
            source: s.id,
            target: depId,
            status: targetNode.status
          });
        }
      });
    }
  });

  return { nodes, edges };
};

const refreshGraph = async () => {
  // Don't load data in All Projects mode
  if (isAllProjectsMode.value) {
    console.log('Skipping graph refresh: All Projects mode requires project selection');
    allServices.value = [];
    graphNodes.value = [];
    graphLinks.value = [];
    return;
  }
  
  try {
    console.log('Refreshing graph...');
    // Get service data with status
    const projectId = currentProjectId?.value;
    let url = '/services';
    if (projectId) {
      url = `/projects/${projectId}/services`;
    }
    
    const res = await api.get(url);
    const services = res.data;
    
    // Also get all services for cross-project dependency resolution
    const allServicesRes = await api.get('/services');
    const allServicesData = allServicesRes.data as any[];
    
    if (!services || !Array.isArray(services) || services.length === 0) {
      console.warn('No services returned from API or invalid format');
      allServices.value = [];
      graphNodes.value = [];
      graphLinks.value = [];
      return;
    }
    
    // Get latest check status
    const checksRes = await api.get('/checks/latest');
    const latestChecks = checksRes.data as Record<string, { 
      status: string; 
      response_time: number;
      error_message?: string;
      checked_at?: string;
    }>;
    console.log('Latest checks loaded:', Object.keys(latestChecks).length);
    
    // Get dependency details
    const depsRes = await api.get('/dependencies');
    const dependencies = depsRes.data as Array<{
      id: string;
      source_service_id: string;
      target_service_id: string;
      dependency_type: string;
      risk_level: string;
      impact_description?: string;
      custom_alert_template?: string;
    }>;
    console.log('Dependencies loaded:', dependencies.length);
    
    // Get current project service IDs
    const currentProjectServiceIds = new Set(services.map((s: any) => s.id));
    
    // Find cross-project dependencies (where source is in current project but target is not)
    const crossProjectTargetIds = new Set<string>();
    dependencies.forEach(dep => {
      if (currentProjectServiceIds.has(dep.source_service_id) && !currentProjectServiceIds.has(dep.target_service_id)) {
        crossProjectTargetIds.add(dep.target_service_id);
      }
    });
    
    // Get cross-project target services from allServicesData
    const crossProjectServices = allServicesData.filter((s: any) => crossProjectTargetIds.has(s.id));
    console.log('Cross-project services loaded:', crossProjectServices.length);
    
    // Get cross-project layouts for this viewing project
    let crossProjectLayouts: Record<string, { layout_x: number; layout_y: number }> = {};
    if (projectId && crossProjectServices.length > 0) {
      try {
        const layoutsRes = await api.get(`/services/cross-project-layouts/${projectId}`);
        const layouts = layoutsRes.data as Array<{ service_id: string; layout_x: number; layout_y: number }>;
        crossProjectLayouts = layouts.reduce((acc, l) => {
          acc[l.service_id] = { layout_x: l.layout_x, layout_y: l.layout_y };
          return acc;
        }, {} as Record<string, { layout_x: number; layout_y: number }>);
        console.log('Cross-project layouts loaded:', Object.keys(crossProjectLayouts).length);
      } catch (err) {
        console.warn('Failed to load cross-project layouts:', err);
      }
    }
    
    // Combine current project services with cross-project target services
    const combinedServices = [...services, ...crossProjectServices];
    
    // Merge services and status
    allServices.value = combinedServices.map((s: any) => {
      // Handle dependencies that may be a string
      let deps: string[] = [];
      if (s.dependencies) {
        if (typeof s.dependencies === 'string') {
          try {
            deps = JSON.parse(s.dependencies);
          } catch {
            deps = [];
          }
        } else if (Array.isArray(s.dependencies)) {
          deps = s.dependencies;
        }
      }
      
      // Mark if this is a cross-project service (external to current project)
      const isCrossProjectService = crossProjectTargetIds.has(s.id);
      
      // For cross-project services, use the layout from crossProjectLayouts if available
      const crossLayout = isCrossProjectService ? crossProjectLayouts[s.id] : null;
      
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        port: s.port,
        status: latestChecks[s.id]?.status || 'unknown',
        responseTime: latestChecks[s.id]?.response_time,
        errorMessage: latestChecks[s.id]?.error_message,
        lastCheck: latestChecks[s.id]?.checked_at,
        riskLevel: s.risk_level,
        layer: isCrossProjectService ? 'external' : (s.layer || 'backend'), // Mark external services
        dependencies: deps,
        // Use cross-project layout if available, otherwise fall back to service's own layout
        layout_x: crossLayout?.layout_x ?? s.layout_x,
        layout_y: crossLayout?.layout_y ?? s.layout_y,
        project_id: s.project_id,  // Include project_id for cross-project detection
        project_name: s.project_name,  // Include project name for display
        isCrossProjectService,  // Flag for cross-project service
        // Service-level alert customization
        impact_description: s.impact_description,
        custom_alert_template: s.custom_alert_template,
        // Custom icon for topology view
        icon: s.icon
      };
    });
    
    const data = transformData(allServices.value);
    
    // Update reactive state for InteractiveGraphCanvas
    const mappedNodes = [];
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const nodeData = node.data || {};
      const x = nodeData.layout_x || autoLayoutPosition(node.id, data.nodes, 'x');
      const y = nodeData.layout_y || autoLayoutPosition(node.id, data.nodes, 'y');
      mappedNodes.push({
        id: node.id,
        name: nodeData.name || '',
        layer: nodeData.layer || 'backend',
        status: nodeData.status || 'unknown',
        port: nodeData.port,
        responseTime: nodeData.responseTime,
        host: nodeData.host,
        riskLevel: nodeData.riskLevel,
        errorMessage: nodeData.errorMessage,
        isCrossProjectService: nodeData.isCrossProjectService,  // Cross-project service flag
        project_id: nodeData.project_id,
        project_name: nodeData.project_name,  // Project name for display
        icon: nodeData.icon,  // Custom icon for topology view
        data: nodeData,
        x,
        y
      });
    }
    graphNodes.value = mappedNodes;
    
    // Build graphLinks from service_dependencies table or fallback to services.dependencies field
    if (dependencies.length > 0) {
      graphLinks.value = dependencies
        .filter(dep => dep.target_service_id) // Only service-to-service deps
        .map(dep => {
          const sourceService = allServices.value.find(s => s.id === dep.source_service_id);
          const targetService = allServices.value.find(s => s.id === dep.target_service_id);
          const isCrossProject = sourceService?.project_id !== targetService?.project_id;
          return {
            id: dep.id,
            source: dep.source_service_id,
            target: dep.target_service_id,
            dependencyType: dep.dependency_type,
            riskLevel: dep.risk_level,
            linkDirection: dep.link_direction || 'normal',  // 连线方向
            status: targetService?.status,
            impact_description: dep.impact_description,
            custom_alert_template: dep.custom_alert_template,
            isCrossProject  // Cross-project dependency flag
          };
        });
    } else {
      // Fallback: build links from services.dependencies field
      const links: any[] = [];
      let linkId = 0;
      allServices.value.forEach(service => {
        if (service.dependencies && service.dependencies.length > 0) {
          service.dependencies.forEach(depId => {
            const targetService = allServices.value.find(s => s.id === depId);
            if (targetService) {
              const isCrossProject = service.project_id !== targetService.project_id;
              links.push({
                id: `link-${linkId++}`,
                source: service.id,
                target: depId,
                dependencyType: 'depends',
                status: targetService.status,
                isCrossProject  // Cross-project dependency flag
              });
            }
          });
        }
      });
      graphLinks.value = links;
    }
    
    // Only use G6 graph when not using InteractiveGraphCanvas
    if (!useInteractiveGraph.value) {
      if (graph) {
        console.log('Updating existing graph');
        graph.setData(data);
        await graph.render();
        setTimeout(() => {
          if (graph) {
            graph.fitView({ 
              padding: 20,
              rules: {
                minZoom: 0.6,  // 提高 minZoom 使显示更统一
                maxZoom: 2
              }
            });
          }
        }, 500);
      } else {
        console.log('Initializing new graph');
        await initGraph(data);
      }
    }
    
    // Load security configs after services are loaded
    await loadSecurityConfigs();
  } catch (error) {
    console.error('Failed to load graph data', error);
  }
};

// Auto layout helper for nodes without saved position
const autoLayoutPosition = (nodeId: string, allNodes: any[], axis: 'x' | 'y'): number => {
  const nodeIndex = allNodes.findIndex(n => n.id === nodeId);
  const node = allNodes[nodeIndex];
  const layer = node?.data?.layer || 'backend';
  const layerIndex = layerOrder.indexOf(layer);
  
  // Group by layer
  const nodesInSameLayer = allNodes.filter(n => (n.data?.layer || 'backend') === layer);
  const indexInLayer = nodesInSameLayer.findIndex(n => n.id === nodeId);
  
  if (axis === 'x') {
    const nodeWidth = 200;
    const gap = 60;
    const startX = 100;
    return startX + indexInLayer * (nodeWidth + gap);
  } else {
    const layerHeight = 140;
    const startY = 60;
    return startY + layerIndex * layerHeight;
  }
};

const selectNodeById = (id: string) => {
  const service = allServices.value.find(s => s.id === id);
  if (service) {
    selectedNode.value = service;
  }
};

const fitView = () => {
  if (graph) {
    // 自适应缩放，但不低于 0.6 倍
    graph.fitView({ 
      padding: 20,
      rules: {
        minZoom: 0.6,
        maxZoom: 2
      }
    });
  }
};

// Zoom controls
const zoomIn = () => {
  if (graph) {
    const zoom = graph.getZoom();
    graph.zoomTo(zoom * 1.2);
  }
};

const zoomOut = () => {
  if (graph) {
    const zoom = graph.getZoom();
    graph.zoomTo(zoom * 0.8);
  }
};

// Context menu handler
const handleContextMenuAction = async (action: string) => {
  const node = contextMenu.value.node;
  contextMenu.value.visible = false;
  
  if (!node) return;
  
  switch (action) {
    case 'view':
      selectedNode.value = node;
      break;
    case 'focus':
      // Focus on this node
      if (graph) {
        graph.focusElement(node.id);
      }
      break;
    case 'dependencies':
      selectedNode.value = node;
      break;
    case 'check':
      // Manual health check
      try {
        await api.post(`/checks/${node.id}`);
        setTimeout(() => refreshGraph(), 1000);
      } catch (err) {
        console.error('Health check failed:', err);
      }
      break;
    case 'impact':
      // Add impact annotation - select node and enable impact analysis
      selectedNode.value = node;
      showImpactAnalysis.value = true;
      break;
  }
};

// Global listener to close context menu
const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

onMounted(() => {
  console.log('Component mounted');
  // Delay a bit to let DOM fully render
  setTimeout(() => {
    console.log('Canvas ref:', canvasRef.value);
    console.log('Container:', container.value);
    // Only load data if a specific project is selected
    if (!isAllProjectsMode.value) {
      refreshGraph();
    }
  }, 100);
  window.addEventListener('resize', handleResize);
  window.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', closeContextMenu);
  if (graph) {
    graph.destroy();
  }
});

const handleResize = () => {
  if (graph && container.value) {
    // Ensure valid size during resize
    const width = Math.max(container.value.clientWidth || 800, 100);
    const height = Math.max(container.value.clientHeight || 600, 100);
    graph.resize(width, height);
    // 自适应缩放，不低于 0.6 倍
    graph.fitView({ 
      padding: 20,
      rules: {
        minZoom: 0.6,
        maxZoom: 2
      }
    });
  }
};
</script>

<style scoped>
.dependency-graph {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

.graph-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.edit-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #fff;
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid #e4e7ec;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #344054;
}
.tool-btn:hover { background: #f9fafb; }
.tool-btn.active { background: #eff6ff; color: #409EFF; border-color: #b3d8ff; }
.tool-btn.btn-success { background: #ecfdf5; color: #027a48; border-color: #d1fae5; }

.divider {
  width: 1px;
  height: 20px;
  background: #e4e7ec;
  margin: 0 4px;
}

.header-controls-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
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
  align-items: center;
  gap: 10px;
}

/* Alert Annotations - Impact analysis prompt cards */
.alert-annotations {
  padding: 0 20px 16px;
}

/* Enhanced Alert Item */
.alert-item-enhanced {
  background: linear-gradient(135deg, #fff8e6 0%, #fff3cd 100%);
  border: 1px solid #ffd666;
  border-left: 4px solid #e6a23c;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.alert-item-enhanced:hover {
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.2);
}

.alert-item-enhanced:last-child {
  margin-bottom: 0;
}

.alert-item-enhanced .alert-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
}

.alert-item-enhanced .alert-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.alert-item-enhanced .alert-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #8a6d3b;
  line-height: 1.5;
}

/* Impact Summary Badges */
.impact-summary {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.impact-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.impact-badge.critical {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

.impact-badge.high {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #f5dab1;
}

.impact-badge.medium {
  background: #fdf6ec;
  color: #b88230;
  border: 1px solid #f5dab1;
}

.impact-badge.low {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

.impact-badge.none {
  background: #f4f4f5;
  color: #909399;
  border: 1px solid #dcdfe6;
}

.expand-btn {
  background: none;
  border: none;
  color: #409eff;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  white-space: nowrap;
}

.expand-btn:hover {
  background: rgba(64, 158, 255, 0.1);
  color: #66b1ff;
}

/* Impact Details Section */
.impact-details {
  background: rgba(255,255,255,0.7);
  padding: 16px 18px;
  border-top: 1px dashed #f5dab1;
}

/* Direct Impact Description (shown when no services affected) */
.direct-impact-desc {
  background: rgba(255,255,255,0.7);
  padding: 12px 18px;
  border-top: 1px dashed #f5dab1;
  margin-top: 8px;
}

.direct-impact-desc .impact-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 8px;
}

.direct-impact-desc .impact-description-content {
  margin-bottom: 0;
}

.impact-section {
  margin-bottom: 16px;
}

.impact-section:last-child {
  margin-bottom: 0;
}

.impact-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 10px;
  text-transform: uppercase;
}

/* Impact Breakdown Stats */
.impact-breakdown {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.breakdown-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.breakdown-dot.critical { background: #f56c6c; }
.breakdown-dot.high { background: #e6a23c; }
.breakdown-dot.medium { background: #f2c97d; }
.breakdown-dot.low { background: #67c23a; }

.breakdown-label {
  font-size: 13px;
  color: #606266;
}

.breakdown-count {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

/* Impact Description Content */
.impact-description-content {
  background: #fff8e6;
  border: 1px solid #ffeeba;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 14px;
  color: #856404;
  line-height: 1.5;
  white-space: pre-wrap;
}

/* Affected Services List */
.affected-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.affected-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border-left: 3px solid;
  cursor: pointer;
  transition: all 0.2s;
}

.affected-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.affected-item.critical {
  border-left-color: #f56c6c;
}

.affected-item.high {
  border-left-color: #e6a23c;
}

.affected-item.medium {
  border-left-color: #f2c97d;
}

.affected-item.low {
  border-left-color: #67c23a;
}

.affected-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.affected-info {
  flex: 1;
  min-width: 0;
}

.affected-name {
  font-weight: 500;
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.affected-reason {
  font-size: 11px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Demo mode toggle */
.demo-toggle {
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #f0f9ff;
  border: 1px dashed #409eff;
  border-radius: 8px;
}

/* Keyboard Shortcuts Hint Inline with Header */
.shortcuts-hint-inline {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-left: 12px;
  color: #333;
  transition: all 0.2s ease;
  max-width: 240px;
}

.shortcuts-hint-inline.collapsed {
  max-width: auto;
}

.hint-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  color: #666;
  transition: background 0.2s;
}

.hint-title:hover {
  background: rgba(0, 0, 0, 0.03);
}

.collapsed .hint-title {
  border-bottom: none;
}

.hint-toggle-btn {
  margin-left: auto;
  background: #f0f0f0;
  border: 1px solid #ddd;
  color: #666;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hint-toggle-btn:hover {
  background: #e0e0e0;
  border-color: #ccc;
  transform: scale(1.05);
}

.hint-content {
  padding: 8px 14px 12px;
  border-top: 1px solid #f0f0f0;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
}

.hint-item:last-child {
  margin-bottom: 0;
}

.hint-item kbd {
  background: linear-gradient(to bottom, #fff 0%, #f5f5f5 100%);
  padding: 3px 7px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid #ccc;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-family: monospace;
  color: #333;
}

.hint-action {
  font-style: italic;
  color: #888;
}

.hint-desc {
  margin-left: auto;
  color: #888;
  font-size: 11px;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 200px;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.demo-toggle {
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #f0f9ff;
  border: 1px dashed #409eff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Legacy alert-item style kept for backwards compatibility */
.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: #fef3c7;
  border-radius: 8px;
  border: 1px solid #fcd34d;
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.alert-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.alert-item:last-child {
  margin-bottom: 0;
}

.alert-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.alert-text {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #92400e;
  line-height: 1.5;
}

/* Overview Stats */
.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 0 20px 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e7ec;
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.stat-icon.total {
  background: #eff8ff;
  color: #175cd3;
}

.stat-icon.healthy {
  background: #ecfdf3;
  color: #027a48;
}

.stat-icon.warning {
  background: #fffaeb;
  color: #b54708;
}

.stat-icon.down {
  background: #fef3f2;
  color: #b42318;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #101828;
}

.stat-value.healthy {
  color: #12b76a;
}

.stat-value.warning {
  color: #f79009;
}

.stat-value.down {
  color: #f04438;
}

.stat-label {
  font-size: 13px;
  color: #667085;
}

/* Empty State Styles */
.empty-state-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  padding: 40px 20px;
}

.empty-state-card {
  max-width: 500px;
  text-align: center;
  padding: 48px 32px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.6;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
}

.empty-description {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 24px 0;
}

.empty-hint {
  font-size: 13px;
  color: #909399;
  background: #f4f4f5;
  padding: 12px 16px;
  border-radius: 6px;
  display: inline-block;
}

/* Graph Container */
.graph-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e4e7ec;
  margin: 0 16px 16px;
  overflow: hidden;
}

.graph-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ec;
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #344054;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.up { background: #12b76a; }
.legend-dot.warning { background: #f79009; }
.legend-dot.down { background: #f04438; }
.legend-dot.unknown { background: #98a2b3; }

/* Layer Tags */
.layer-tag {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.layer-tag.frontend { background: #eff6ff; color: #3b82f6; border: 1px solid #3b82f6; }
.layer-tag.backend { background: #ecfdf5; color: #10b981; border: 1px solid #10b981; }
.layer-tag.database { background: #fffbeb; color: #f59e0b; border: 1px solid #f59e0b; }
.layer-tag.external { background: #f5f3ff; color: #8b5cf6; border: 1px solid #8b5cf6; }

/* Graph Canvas */
.graph-canvas {
  flex: 1;
  position: relative;
  min-height: 500px;
  background: linear-gradient(180deg, #fafbfc 0%, #f5f7fa 100%);
  isolation: isolate; /* Create new stacking context */
  overflow: hidden; /* Prevent canvas overflow */
  contain: layout size; /* CSS containment optimization */
}

/* Legacy: Graph Wrapper (keep for compatibility) */
.graph-wrapper {
  flex: 1;
  position: relative;
  margin: 16px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  overflow: hidden;
}

/* Layer Backgrounds */
.layer-backgrounds {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.layer-bg {
  position: absolute;
  left: 0;
  right: 0;
  border-bottom: 1px dashed #e4e7ec;
  padding: 8px 20px;
}

.layer-bg .layer-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.9;
}

.layer-bg.frontend {
  background: rgba(59, 130, 246, 0.04);
}
.layer-bg.frontend .layer-label {
  color: #3b82f6;
}

.layer-bg.backend {
  background: rgba(16, 185, 129, 0.04);
}
.layer-bg.backend .layer-label {
  color: #10b981;
}

.layer-bg.database {
  background: rgba(245, 158, 11, 0.04);
}
.layer-bg.database .layer-label {
  color: #f59e0b;
}

.layer-bg.external {
  background: rgba(139, 92, 246, 0.04);
}
.layer-bg.external .layer-label {
  color: #8b5cf6;
}

/* Constrain G6 Canvas - do not force size modification */
.graph-canvas :deep(canvas) {
  max-width: 100%;
  max-height: 100%;
  pointer-events: auto;
}

.graph-canvas :deep(.g6-component-tooltip),
.graph-canvas :deep(.g6-component-contextmenu) {
  z-index: 100 !important;
}

/* Graph Annotations - Floating labels inside graph */
.graph-annotations {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 200; /* Increase z-index to ensure above canvas */
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 280px;
  pointer-events: none; /* Allow click through container */
}

.graph-annotation {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: auto; /* Annotation itself is clickable */
}

.graph-annotation:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
  background: #fef9c3;
}

.annotation-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.annotation-text {
  font-size: 12px;
  color: #92400e;
  line-height: 1.4;
  font-weight: 500;
}

/* Detail Panel */
.detail-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 320px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  z-index: 150; /* Increase z-index to ensure above canvas */
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #e4e7ec;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.panel-title {
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.small {
  width: 8px;
  height: 8px;
}

.status-dot.up { background: #12b76a; }
.status-dot.warning { background: #f79009; }
.status-dot.down { background: #f04438; }
.status-dot.unknown { background: #98a2b3; }

.panel-body {
  padding: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f2f4f7;
}

.detail-row .label {
  color: #667085;
  font-size: 13px;
}

.detail-row .value {
  color: #101828;
  font-size: 13px;
  font-weight: 500;
}

.detail-row .value.warning-text {
  color: #f79009;
}

/* Error Section */
.error-section {
  margin-top: 12px;
  padding: 12px;
  background: #fef3f2;
  border-radius: 8px;
  border: 1px solid #fee4e2;
}

.error-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #b42318;
  margin-bottom: 6px;
}

.error-message {
  font-size: 13px;
  color: #7a271a;
  font-family: monospace;
}

/* Impact Section */
.impact-section {
  margin-top: 16px;
  padding: 12px;
  background: #fff4ed;
  border-radius: 8px;
  border: 1px solid #fec84b;
}

.impact-section .section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.impact-description {
  font-size: 12px;
  color: #93370d;
  margin: 8px 0 12px;
}

.dep-item.impact {
  background: #fff;
  border: 1px solid #fec84b;
}

.dependency-section {
  margin-top: 16px;
}

.section-title {
  font-size: 12px;
  color: #667085;
  font-weight: 500;
  margin-bottom: 8px;
}

.dep-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.dep-item:hover {
  background: #f2f4f7;
}

.dep-name {
  font-size: 13px;
  color: #344054;
  flex: 1;
}

/* Transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Context Menu - Right click menu */
.context-menu {
  position: absolute;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  min-width: 160px;
  z-index: 200;
  overflow: hidden;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: #344054;
  cursor: pointer;
  transition: background 0.15s;
}

.context-menu-item:hover {
  background: #f9fafb;
}

.context-menu-item .menu-icon {
  font-size: 14px;
}

.context-menu-divider {
  height: 1px;
  background: #e4e7ec;
  margin: 4px 0;
}

.context-menu-item.danger {
  color: #f04438;
}

.context-menu-item.danger:hover {
  background: #fef3f2;
}

/* Integrated Stats */
.graph-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: auto;
  padding-left: 20px;
  border-left: 1px solid #e4e7ec;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: #344054;
}

.stat-pill.healthy { background: #ecfdf5; border-color: #d1fae5; color: #027a48; }
.stat-pill.warning { background: #fffbeb; border-color: #fef3c7; color: #b54708; }
.stat-pill.down { background: #fef3f2; border-color: #fee4e2; color: #b42318; }
.stat-pill.unknown { background: #f2f4f7; border-color: #e4e7ec; color: #475467; }

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.stat-pill.healthy .stat-dot { background: #12b76a; }
.stat-pill.warning .stat-dot { background: #f79009; }
.stat-pill.down .stat-dot { background: #f04438; }
.stat-pill.unknown .stat-dot { background: #98a2b3; }

/* Graph Controls */
.graph-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 150; /* Increase z-index to ensure above canvas */
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

/* Quick Action Bar - Bottom left quick actions */
.quick-bar {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  gap: 10px;
  z-index: 200;
  background: rgba(255, 255, 255, 0.95);
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  font-size: 13px;
  color: #344054;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.quick-btn:hover {
  background: #f9fafb;
  border-color: #d0d5dd;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.quick-btn:active {
  background: #f2f4f7;
}

/* Fade transition for context menu */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Security Cards Panel - Inside graph canvas wrapper */
.security-cards-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 280px;
  max-height: calc(100% - 80px);
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.security-panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid #e4e7ec;
  background: #f8f9fa;
}

.security-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #101828;
  margin-bottom: 10px;
}

.security-panel-title .config-count {
  font-weight: 400;
  color: #667085;
  font-size: 12px;
}

.security-header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.security-filters {
  display: flex;
  gap: 6px;
}

.security-filter-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: #e9ecef;
  font-size: 12px;
  color: #667085;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.security-filter-btn:hover {
  background: #dee2e6;
}

.security-filter-btn.active {
  background: #667eea;
  color: white;
}

.filter-badge {
  background: rgba(255,255,255,0.3);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.close-panel-btn {
  background: none;
  border: none;
  color: #667085;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
}

.close-panel-btn:hover {
  background: #e9ecef;
  color: #344054;
}

.security-cards-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.security-card {
  padding: 12px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.security-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #667eea;
}

.security-card.normal {
  border-left: 4px solid #22c55e;
}

.security-card.warning {
  border-left: 4px solid #f59e0b;
}

.security-card.critical {
  border-left: 4px solid #ef4444;
}

.security-card.expired {
  border-left: 4px solid #6b7280;
  background: #f9fafb;
}

.security-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.security-card-name {
  font-weight: 600;
  font-size: 13px;
  color: #1a1a2e;
  flex: 1;
  margin-right: 8px;
}

.security-card-type {
  display: inline-block;
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.security-card-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  flex-wrap: wrap;
}

.expiry-label {
  color: #9ca3af;
}

.expiry-date {
  font-weight: 500;
  color: #374151;
}

.days-remaining {
  font-weight: 600;
}

.days-remaining.normal { color: #22c55e; }
.days-remaining.warning { color: #f59e0b; }
.days-remaining.critical { color: #ef4444; }
.days-remaining.expired { color: #6b7280; }

.security-card-services {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e9ecef;
  font-size: 11px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.affects-label {
  color: #6b7280;
  white-space: nowrap;
}

.service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.service-tag {
  display: inline-block;
  padding: 2px 6px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 4px;
  font-size: 10px;
}

.service-tag.more {
  background: #f3f4f6;
  color: #6b7280;
}

.security-card-notes {
  margin-top: 8px;
  padding: 6px 8px;
  background: #f9fafb;
  border-radius: 4px;
  font-size: 11px;
  color: #6b7280;
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.security-card-notes .notes-icon {
  flex-shrink: 0;
}

.security-card-notes .notes-text {
  line-height: 1.4;
  word-break: break-word;
}

.security-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.security-status-badge.normal {
  background: #dcfce7;
  color: #16a34a;
}

.security-status-badge.warning {
  background: #fef3c7;
  color: #d97706;
}

.security-status-badge.critical {
  background: #fee2e2;
  color: #ef4444;
}

.security-status-badge.expired {
  background: #e5e7eb;
  color: #6b7280;
}

.no-configs {
  text-align: center;
  padding: 24px 16px;
  color: #667085;
  font-size: 13px;
}

/* Security Toggle Button in Header */
.security-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 6px;
  font-size: 13px;
  color: #344054;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.security-toggle-btn:hover {
  background: #f9fafb;
  border-color: #d0d5dd;
}

.security-toggle-btn.has-expiring {
  background: #fef3f2;
  border-color: #f04438;
  color: #b42318;
}

.security-toggle-btn .toggle-label {
  font-weight: 500;
}

.security-toggle-btn .expiring-badge {
  padding: 2px 6px;
  background: #f04438;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.security-toggle-btn .config-badge {
  padding: 2px 6px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

/* Slide right transition for security panel */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
