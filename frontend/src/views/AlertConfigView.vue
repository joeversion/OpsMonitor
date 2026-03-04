<template>
  <div class="alert-config">
    <div class="header">
      <h1>Alert Configuration</h1>
    </div>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>Email Notification (SMTP)</span>
        </div>
      </template>
      <el-form :model="config" label-width="120px">
        <el-form-item label="SMTP Host">
          <el-input v-model="config.smtp_host" placeholder="smtp.example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item label="SMTP Port">
          <el-input v-model="config.smtp_port" placeholder="587" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item label="Username">
          <el-input v-model="config.smtp_user" placeholder="user@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item label="Password">
          <el-input v-model="config.smtp_pass" type="password" show-password :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item label="From Address">
          <el-input v-model="config.smtp_from" placeholder="monitor@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item label="To Address">
          <el-input v-model="config.smtp_to" placeholder="admin@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item v-if="isAdmin">
          <el-button type="primary" @click="saveConfig">Save</el-button>
          <el-button @click="testEmail">Test Email</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>Teams Notification</span>
        </div>
      </template>
      <el-form :model="config" label-width="120px">
        <el-form-item label="Webhook URL">
          <el-input v-model="config.teams_webhook" placeholder="https://outlook.office.com/webhook/..." :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item v-if="isAdmin">
          <el-button type="primary" @click="saveConfig">Save</el-button>
          <el-button @click="testTeams">Test Teams</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>Alert History</span>
          <el-button :icon="Refresh" circle @click="loadAlerts" />
        </div>
      </template>
      <el-table :data="alerts" style="width: 100%">
        <el-table-column prop="created_at" label="Time" width="180">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="service_name" label="Service" width="150" />
        <el-table-column prop="type" label="Type" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'down' ? 'danger' : (scope.row.type === 'recovery' ? 'success' : 'warning')">
              {{ scope.row.type.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="Message" />
        <el-table-column label="Notified" width="100">
          <template #default="scope">
            <el-icon v-if="scope.row.notified"><Check /></el-icon>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, Check } from '@element-plus/icons-vue';
import api from '../api';
import authUtils from '../utils/auth';

// Permission check
const isAdmin = computed(() => authUtils.isAdmin());

interface Alert {
  id: string;
  service_name: string;
  type: string;
  message: string;
  created_at: string;
  notified: number;
}

const config = reactive({
  smtp_host: '',
  smtp_port: '',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  smtp_to: '',
  teams_webhook: ''
});

const alerts = ref<Alert[]>([]);

const loadConfig = async () => {
  try {
    const res = await api.get('/config/notifications');
    Object.assign(config, res.data);
  } catch (error) {
    ElMessage.error('Failed to load configuration');
  }
};

const loadAlerts = async () => {
  try {
    const res = await api.get('/alerts');
    alerts.value = res.data;
  } catch (error) {
    console.error(error);
  }
};

const saveConfig = async () => {
  try {
    await api.put('/config/notifications', config);
    ElMessage.success('Configuration saved');
  } catch (error) {
    ElMessage.error('Failed to save configuration');
  }
};

const testEmail = async () => {
  if (!config.smtp_to) {
    ElMessage.warning('Please enter "To Address" first');
    return;
  }
  try {
    await api.post('/config/notifications/test', {
      type: 'email',
      target: config.smtp_to
    });
    ElMessage.success('Test email sent');
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || 'Failed to send test email';
    ElMessage.error(errorMsg);
  }
};

const testTeams = async () => {
  if (!config.teams_webhook) {
    ElMessage.warning('Please enter Webhook URL first');
    return;
  }
  try {
    await api.post('/config/notifications/test', {
      type: 'teams',
      target: config.teams_webhook
    });
    ElMessage.success('Test notification sent');
  } catch (error) {
    ElMessage.error('Failed to send test notification');
  }
};

onMounted(() => {
  loadConfig();
  loadAlerts();
});
</script>

<style scoped>
.alert-config {
  padding: 20px;
}
.config-card {
  margin-bottom: 20px;
  max-width: 800px;
}
</style>
