<template>
  <div class="alert-config">
    <div class="header">
      <h1>{{ $t('alerts.title') }}</h1>
    </div>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('alerts.cardEmail') }}</span>
        </div>
      </template>
      <el-form :model="config" label-width="120px">
        <el-form-item :label="$t('alerts.labelSmtpHost')">
          <el-input v-model="config.smtp_host" placeholder="smtp.example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item :label="$t('alerts.labelSmtpPort')">
          <el-input v-model="config.smtp_port" placeholder="587" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item :label="$t('alerts.labelUsername')">
          <el-input v-model="config.smtp_user" placeholder="user@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item :label="$t('alerts.labelPassword')">
          <el-input v-model="config.smtp_pass" type="password" show-password :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item :label="$t('alerts.labelFrom')">
          <el-input v-model="config.smtp_from" placeholder="monitor@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item :label="$t('alerts.labelTo')">
          <el-input v-model="config.smtp_to" placeholder="admin@example.com" :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item v-if="isAdmin">
          <el-button type="primary" @click="saveConfig">{{ $t('alerts.btnSave') }}</el-button>
          <el-button @click="testEmail">{{ $t('alerts.btnTestEmail') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('alerts.cardTeams') }}</span>
        </div>
      </template>
      <el-form :model="config" label-width="120px">
        <el-form-item :label="$t('alerts.labelWebhook')">
          <el-input v-model="config.teams_webhook" placeholder="https://outlook.office.com/webhook/..." :disabled="!isAdmin" />
        </el-form-item>
        <el-form-item v-if="isAdmin">
          <el-button type="primary" @click="saveConfig">{{ $t('alerts.btnSave') }}</el-button>
          <el-button @click="testTeams">{{ $t('alerts.btnTestTeams') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>{{ $t('alerts.cardHistory') }}</span>
          <el-button :icon="Refresh" circle @click="loadAlerts" />
        </div>
      </template>
      <el-table :data="alerts" style="width: 100%">
        <el-table-column prop="created_at" :label="$t('alerts.colTime')" width="180">
          <template #default="scope">
            {{ new Date(scope.row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="service_name" :label="$t('alerts.colService')" width="150" />
        <el-table-column prop="type" :label="$t('alerts.colType')" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'down' ? 'danger' : (scope.row.type === 'recovery' ? 'success' : 'warning')">
              {{ alertTypeLabel(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" :label="$t('alerts.colMessage')" />
        <el-table-column :label="$t('alerts.colNotified')" width="100">
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
import { useI18n } from 'vue-i18n';
import { getLocale } from '../i18n';
import api from '../api';
import authUtils from '../utils/auth';

const { t } = useI18n();

// Alert type label for history table
const alertTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    down: t('statusLabels.down'),
    recovery: t('statusLabels.recovery'),
    warning: t('statusLabels.warning'),
  };
  return map[type] || type.toUpperCase();
};

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
    ElMessage.error(t('alerts.msgLoadFailed'));
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
    ElMessage.success(t('alerts.msgSaved'));
  } catch (error) {
    ElMessage.error(t('alerts.msgSaveFailed'));
  }
};

const testEmail = async () => {
  if (!config.smtp_to) {
    ElMessage.warning(t('alerts.msgEnterTo'));
    return;
  }
  try {
    await api.post('/config/notifications/test', {
      type: 'email',
      target: config.smtp_to,
      lang: getLocale()
    });
    ElMessage.success(t('alerts.msgEmailSent'));
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || t('alerts.msgEmailFailed');
    ElMessage.error(errorMsg);
  }
};

const testTeams = async () => {
  if (!config.teams_webhook) {
    ElMessage.warning(t('alerts.msgEnterWebhook'));
    return;
  }
  try {
    await api.post('/config/notifications/test', {
      type: 'teams',
      target: config.teams_webhook,
      lang: getLocale()
    });
    ElMessage.success(t('alerts.msgTeamsSent'));
  } catch (error) {
    ElMessage.error(t('alerts.msgTeamsFailed'));
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
