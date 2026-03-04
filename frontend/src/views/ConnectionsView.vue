<template>
  <div class="connections-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">Connections</h1>
        <p class="page-desc">SSH / connection profiles (view scoped to project if selected)</p>
      </div>
      <div>
        <el-button type="primary" :icon="Plus" @click="showAddConnection = true">Add Connection</el-button>
      </div>
    </div>

    <!-- Filter/Stats Bar if needed -->
    <div class="filter-bar">
      <div class="filter-item">
        <span class="filter-label">Scope:</span>
        <el-tag>{{ currentProjectId ? 'Project' : 'Global' }}</el-tag>
      </div>
    </div>

    <div class="table-container">
      <el-table :data="filteredConnections" style="width: 100%">
        <el-table-column prop="name" label="Name" sortable />
        <el-table-column prop="type" label="Type" width="150" />
        <el-table-column prop="project" label="Project" width="200">
          <template #default="scope">
            {{ scope.row.project || 'Global' }}
          </template>
        </el-table-column>
        <el-table-column prop="hostId" label="Associated Host" width="200">
           <template #default="scope">
             {{ getHostNameById(scope.row.hostId) || '-' }}
           </template>
        </el-table-column>
        <el-table-column label="Actions" width="200" align="right">
          <template #default="scope">
            <el-button size="small" @click="openEditConnection(scope.row)">Edit</el-button>
            <el-button size="small" type="danger" @click="confirmDeleteConnection(scope.row)">Delete</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredConnections.length === 0" class="empty-state">
        <p>No connections found for current scope.</p>
      </div>
    </div>

    <!-- Add/Edit Dialog -->
    <el-dialog 
      v-model="showAddConnection" 
      :title="connectionForm.id ? 'Edit Connection' : 'Add Connection'"
      width="600px"
      @close="resetForm">
      <el-form :model="connectionForm" label-width="120px">
        <el-form-item label="Name">
          <el-input v-model="connectionForm.name" placeholder="e.g. deploy-key-prod" />
        </el-form-item>
        <el-form-item label="Type">
          <el-select v-model="connectionForm.type" style="width: 100%">
            <el-option label="SSH Key" value="ssh-key" />
            <el-option label="Jump Host" value="jump-host" />
          </el-select>
        </el-form-item>
        <el-form-item label="Project (Optional)">
           <el-select v-model="connectionForm.projectId" placeholder="Global (or select project)" clearable style="width: 100%">
             <el-option 
               v-for="p in projects" 
               :key="p.id" 
               :label="p.name" 
               :value="p.id" 
             />
           </el-select>
        </el-form-item>
        <el-form-item label="Host (Optional)">
           <el-select v-model="connectionForm.hostId" placeholder="Select host" clearable style="width: 100%">
             <el-option 
               v-for="h in hosts" 
               :key="h.id" 
               :label="h.name" 
               :value="h.id" 
             />
           </el-select>
        </el-form-item>
        <el-form-item label="Details">
          <el-input 
            v-model="connectionForm.details" 
            type="textarea" 
            :rows="4" 
            placeholder="Key content or host details..." 
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddConnection = false">Cancel</el-button>
        <el-button type="primary" @click="saveConnection">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getProjects, type ProjectWithStats } from '../api/projects'; // Reuse existing API types if possible
import hostsApi from '../api/hosts';
import type { Host } from '../types/host';

// Inject context
const currentProjectId = inject('currentProjectId');

// Mock Data State (Since no backend API exists for this specific entity yet)
// In a real app, this would be fetched from /api/connections
const connections = ref([
  { id: 1, name: 'deploy-key-nova', type: 'ssh-key', project: 'Nova Platform', projectId: '1', hostId: '2', details: 'rsa-key...' },
  { id: 2, name: 'jump-proxy', type: 'jump-host', project: null, projectId: null, hostId: null, details: 'jump.example.com:22' }
]);

const projects = ref<ProjectWithStats[]>([]);
const hosts = ref<Host[]>([]);
const showAddConnection = ref(false);

const connectionForm = ref({
  id: null as number | null,
  name: '',
  type: 'ssh-key',
  projectId: null as string | null,
  project: null as string | null, // Store name for simple display
  hostId: null as string | null,
  details: ''
});

// Fetch supporting data
onMounted(async () => {
    try {
        projects.value = await getProjects();
        // Fetch all hosts or project specific hosts
        hosts.value = await hostsApi.getAll(); 
    } catch (e) {
        console.error("Failed to load metadata", e);
    }
});

const filteredConnections = computed(() => {
  let list = connections.value;
  // If a project is selected in the global context, filter by it
  // Note: currentProjectId is injected as a Ref
  const cPid = (currentProjectId as any)?.value;
  if (cPid) {
    // Filter by projectId (string comparison)
    // Note: Mock data uses number/string loosely, ensure compatibility
    // Our mock data has projectId '1' (string) or 1 (number). Let's convert to string.
    list = list.filter(c => c.projectId && String(c.projectId) === String(cPid));
  }
  return list;
});

const getHostNameById = (id: string | null) => {
    if (!id) return null;
    const h = hosts.value.find(x => x.id === id);
    return h ? h.name : id;
};

const openEditConnection = (row: any) => {
    connectionForm.value = { ...row };
    showAddConnection.value = true;
};

const resetForm = () => {
    connectionForm.value = { id: null, name: '', type: 'ssh-key', projectId: null, project: null, hostId: null, details: '' };
};

const saveConnection = () => {
    if (!connectionForm.value.name) {
        ElMessage.warning('Name is required');
        return;
    }
    
    // Update project name based on ID
    if (connectionForm.value.projectId) {
        const p = projects.value.find(x => String(x.id) === String(connectionForm.value.projectId));
        connectionForm.value.project = p ? p.name : null;
    } else {
        connectionForm.value.project = null;
    }

    if (connectionForm.value.id) {
        // Edit
        const idx = connections.value.findIndex(c => c.id === connectionForm.value.id);
        if (idx !== -1) {
            connections.value[idx] = { ...connectionForm.value } as any;
             ElMessage.success('Connection updated (Mock)');
        }
    } else {
        // Add
        const newId = Math.max(...connections.value.map(c => c.id), 0) + 1;
        connections.value.push({ ...connectionForm.value, id: newId } as any);
        ElMessage.success('Connection added (Mock)');
    }
    showAddConnection.value = false;
};

const confirmDeleteConnection = (row: any) => {
    ElMessageBox.confirm(`Delete connection ${row.name}?`, 'Confirm', {
        type: 'warning'
    }).then(() => {
        connections.value = connections.value.filter(c => c.id !== row.id);
        ElMessage.success('Connection deleted (Mock)');
    }).catch(() => {});
};
</script>

<style scoped>
.connections-view {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #303133;
}
.page-desc {
  color: #909399;
  font-size: 14px;
  margin: 0;
}
.filter-bar {
  margin-bottom: 20px;
  background: white;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-label {
    font-size: 14px;
    color: #666;
}
.table-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}
.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}
</style>
