<template>
  <el-drawer :model-value="modelValue" size="min(760px, 100vw)" class="service-details-drawer"
    :title="details?.service.name || t('serviceDetails.title')" @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading" class="details-content">
      <div v-if="error" class="load-error" role="alert">
        <el-alert :title="error" type="error" :closable="false" />
        <el-button :icon="Refresh" @click="loadDetails">{{ t('common.refresh') }}</el-button>
      </div>
      <template v-if="details">
        <div class="status-line">
          <StatusBadge :status="details.service.enabled ? details.latest?.status || 'unknown' : 'unknown'" />
          <el-tag v-if="!details.service.enabled" type="info">{{ t('serviceDetails.paused') }}</el-tag>
          <el-tag v-if="details.service.host_enabled === 0" type="warning">{{ t('serviceDetails.hostPaused') }}</el-tag>
          <el-tag v-if="isStale" type="warning">{{ t('serviceDetails.stale') }}</el-tag>
          <span class="secondary">{{ t('serviceDetails.lastCheck') }}: {{ formatDate(details.latest?.checked_at) }}</span>
        </div>
        <el-alert v-if="details.latest?.error_message" :title="details.latest.error_message" type="error" :closable="false" class="check-error" />
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('serviceDetails.overview')" name="overview">
            <dl class="facts">
              <div v-for="fact in overviewFacts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div>
            </dl>
            <section class="detail-section">
              <h3>{{ t('serviceDetails.latestResult') }}</h3>
              <el-empty v-if="!details.latest" :description="t('serviceDetails.noChecks')" :image-size="60" />
              <template v-else>
                <dl class="facts">
                  <div><dt>{{ t('serviceDetails.duration') }}</dt><dd>{{ details.latest.response_time }} ms</dd></div>
                  <div><dt>{{ t('serviceDetails.lastCheck') }}</dt><dd>{{ formatDate(details.latest.checked_at) }}</dd></div>
                </dl>
                <el-collapse v-if="details.output_available && formatOutput(details.latest)">
                  <el-collapse-item :title="t('serviceDetails.output')" name="output"><pre>{{ formatOutput(details.latest) }}</pre></el-collapse-item>
                </el-collapse>
              </template>
            </section>
            <dl class="facts secondary">
              <div><dt>{{ t('serviceDetails.createdAt') }}</dt><dd>{{ formatDate(details.service.created_at) }}</dd></div>
              <div><dt>{{ t('serviceDetails.updatedAt') }}</dt><dd>{{ formatDate(details.service.updated_at) }}</dd></div>
              <div><dt>{{ t('serviceDetails.id') }}</dt><dd>{{ details.service.id }}</dd></div>
            </dl>
          </el-tab-pane>
          <el-tab-pane :label="t('serviceDetails.history')" name="history">
            <div class="history-toolbar">
              <span>{{ t('serviceDetails.recentChecks', { count: details.history.length }) }}</span>
              <el-select v-model="historyLimit" :aria-label="t('serviceDetails.recordCount')" style="width: 100px">
                <el-option :label="'20'" :value="20" /><el-option :label="'50'" :value="50" />
              </el-select>
            </div>
            <el-table :data="details.history.slice(0, historyLimit)" :empty-text="t('serviceDetails.noChecks')" row-key="id">
              <el-table-column v-if="details.output_available" type="expand" width="40">
                <template #default="scope"><pre class="history-output">{{ formatOutput(scope.row) || t('serviceDetails.noOutput') }}</pre></template>
              </el-table-column>
              <el-table-column :label="t('serviceDetails.lastCheck')" min-width="165"><template #default="scope">{{ formatDate(scope.row.checked_at) }}</template></el-table-column>
              <el-table-column :label="t('common.status')" width="100"><template #default="scope"><StatusBadge :status="scope.row.status" /></template></el-table-column>
              <el-table-column :label="t('serviceDetails.duration')" width="100"><template #default="scope">{{ scope.row.response_time }} ms</template></el-table-column>
              <el-table-column prop="error_message" :label="t('serviceDetails.message')" min-width="150" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="t('serviceDetails.dependencies')" name="dependencies">
            <section class="detail-section" v-for="direction in dependencyDirections" :key="direction.key">
              <h3>{{ direction.label }} <span class="secondary">({{ direction.rows.length }})</span></h3>
              <el-empty v-if="!direction.rows.length" :description="t('serviceDetails.noDependencies')" :image-size="50" />
              <div v-for="dependency in direction.rows" :key="dependency.id" class="dependency-row">
                <div class="dependency-heading">
                  <span>{{ direction.key === 'dependsOn' ? dependency.target_service_name || '-' : dependency.source_service_name || '-' }}</span>
                  <el-tag size="small" effect="plain">{{ dependency.dependency_type }}</el-tag>
                  <el-tag size="small" effect="plain">{{ t('serviceDetails.risk') }}: {{ dependency.risk_level }}</el-tag>
                </div>
                <div class="secondary">{{ direction.key === 'dependsOn' ? dependency.target_project_name : dependency.source_project_name }}</div>
                <p v-if="dependency.description">{{ dependency.description }}</p>
              </div>
            </section>
          </el-tab-pane>
          <el-tab-pane :label="t('serviceDetails.configuration')" name="configuration">
            <dl class="facts">
              <div><dt>{{ t('serviceDetails.monitoring') }}</dt><dd>{{ onOff(details.service.enabled) }}</dd></div>
              <div><dt>{{ t('serviceDetails.alerts') }}</dt><dd>{{ onOff(details.service.alert_enabled) }}</dd></div>
              <div><dt>{{ t('serviceDetails.schedule') }}</dt><dd>{{ details.service.schedule_type === 'timeRange' ? t('serviceDetails.timeRange') : t('serviceDetails.fixed') }}</dd></div>
              <div><dt>{{ t('serviceDetails.interval') }}</dt><dd>{{ details.service.check_interval }} s</dd></div>
              <div><dt>{{ t('serviceDetails.warningThreshold') }}</dt><dd>{{ details.service.warning_threshold }}</dd></div>
              <div><dt>{{ t('serviceDetails.errorThreshold') }}</dt><dd>{{ details.service.error_threshold }}</dd></div>
              <div><dt>{{ t('serviceDetails.triggerThreshold') }}</dt><dd>{{ details.service.failure_threshold ?? '-' }}</dd></div>
              <div><dt>{{ t('serviceDetails.failureCount') }}</dt><dd>{{ details.service.current_failure_count ?? '-' }}</dd></div>
            </dl>
            <section v-for="group in configurationGroups" :key="group.key" class="detail-section">
              <h3>{{ t(`serviceDetails.groups.${group.key}`) }}</h3>
              <dl class="facts">
                <div v-for="entry in group.entries" :key="entry.key"><dt>{{ fieldLabel(entry.key) }}</dt><dd><pre v-if="typeof entry.value === 'object'">{{ JSON.stringify(entry.value, null, 2) }}</pre><span v-else>{{ typeof entry.value === 'boolean' ? onOff(entry.value) : entry.value }}</span></dd></div>
              </dl>
            </section>
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-skeleton v-else-if="loading" :rows="8" animated />
    </div>
    <template #footer>
      <div class="detail-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadDetails">{{ t('common.refresh') }}</el-button>
        <el-button v-if="isAdmin && details" :icon="VideoPlay" :loading="running" :disabled="loading" @click="runNow">{{ t('services.btnRun') }}</el-button>
        <el-button v-if="isAdmin && details" type="primary" :icon="Edit" @click="emit('edit', details.service.id)">{{ t('common.edit') }}</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Edit, Refresh, VideoPlay } from '@element-plus/icons-vue';
import { getServiceDetails, type ServiceDetails } from '../api/services';
import { runCheck, type CheckResult } from '../api/checks';
import authUtils from '../utils/auth';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{ modelValue: boolean; serviceId: string | null }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  edit: [id: string];
  checked: [id: string, result: CheckResult];
}>();
const { t, te, locale } = useI18n();
const details = ref<ServiceDetails | null>(null);
const activeTab = ref('overview');
const loading = ref(false);
const running = ref(false);
const error = ref('');
const historyLimit = ref(20);
const isAdmin = computed(() => authUtils.isAdmin());
let controller: AbortController | null = null;
let generation = 0;

const timestamp = (value: string) => Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
const formatDate = (value?: string | null) => value && Number.isFinite(timestamp(value))
  ? new Date(timestamp(value)).toLocaleString(locale.value) : '-';
const onOff = (value: unknown) => t(value ? 'serviceDetails.enabled' : 'serviceDetails.disabled');
const isStale = computed(() => {
  const data = details.value;
  return !!data?.latest && !!data.service.enabled && data.service.schedule_type !== 'timeRange'
    && Date.parse(data.fetched_at) - timestamp(data.latest.checked_at) > Math.max(data.service.check_interval * 2, 60) * 1000;
});
const overviewFacts = computed(() => {
  const service = details.value?.service;
  if (!service) return [];
  return [
    { label: t('serviceDetails.description'), value: service.description || '-' },
    { label: t('serviceDetails.project'), value: service.project_name || '-' },
    { label: t('serviceDetails.target'), value: ['tcp', 'http', 'https'].includes(service.check_type) ? `${service.host}:${service.port}` : service.host },
    { label: t('serviceDetails.host'), value: service.host_name || '-' },
    { label: t('serviceDetails.checkType'), value: service.service_type === 'ssh' ? `SSH / ${service.ssh_check_type || service.check_type}` : service.check_type.toUpperCase() },
    { label: t('serviceDetails.connection'), value: service.host_connection_type || '-' },
    { label: t('serviceDetails.risk'), value: service.risk_level },
    { label: t('serviceDetails.layer'), value: service.layer || '-' },
    { label: t('serviceDetails.impact'), value: service.impact_description || '-' }
  ];
});
const dependencyDirections = computed(() => [
  { key: 'dependsOn', label: t('serviceDetails.dependsOn'), rows: (details.value?.dependencies.dependsOn || []).filter(dependency => dependency.target_service_id && !dependency.target_resource_id) },
  { key: 'dependedBy', label: t('serviceDetails.dependedBy'), rows: (details.value?.dependencies.dependedBy || []).filter(dependency => dependency.target_service_id && !dependency.target_resource_id) }
]);
const configurationGroups = computed(() => Object.entries(details.value?.configuration || {})
  .filter(([, value]) => Object.keys(value).length)
  .map(([key, value]) => ({ key, entries: Object.entries(value).map(([field, entry]) => ({ key: field, value: entry })) })));
const fieldLabel = (key: string) => te(`serviceDetails.fields.${key}`) ? t(`serviceDetails.fields.${key}`) : key;
const formatOutput = (result: CheckResult) => [
  result.output,
  result.stdout ? `${t('serviceDetails.stdout')}\n${result.stdout}` : '',
  result.stderr ? `${t('serviceDetails.stderr')}\n${result.stderr}` : '',
  result.details && Object.keys(result.details).length ? JSON.stringify(result.details, null, 2) : ''
].filter(Boolean).join('\n\n');

async function loadDetails() {
  if (!props.modelValue || !props.serviceId) return;
  controller?.abort();
  controller = new AbortController();
  const request = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const response = await getServiceDetails(props.serviceId, controller.signal);
    if (request === generation) details.value = response;
  } catch (failure: any) {
    if (request === generation && failure.code !== 'ERR_CANCELED') {
      error.value = t(failure.response?.status === 404 ? 'serviceDetails.notFound' : 'serviceDetails.loadFailed');
    }
  } finally {
    if (request === generation) loading.value = false;
  }
}

async function runNow() {
  if (!props.serviceId || running.value) return;
  const id = props.serviceId;
  running.value = true;
  try {
    await runCheck(id);
    const refreshed = await getServiceDetails(id);
    if (refreshed.latest) emit('checked', id, refreshed.latest);
    if (props.modelValue && props.serviceId === id) {
      controller?.abort();
      generation++;
      details.value = refreshed;
      error.value = '';
      loading.value = false;
    }
    ElMessage.success(t('serviceDetails.checkCompleted'));
  } catch (_) {
    ElMessage.error(t('serviceDetails.checkFailed'));
  } finally {
    running.value = false;
  }
}

watch(() => [props.modelValue, props.serviceId] as const, ([open]) => {
  controller?.abort();
  generation++;
  details.value = null;
  error.value = '';
  activeTab.value = 'overview';
  loading.value = false;
  historyLimit.value = 20;
  if (open) void loadDetails();
}, { immediate: true });
onUnmounted(() => { controller?.abort(); generation++; });
</script>

<style scoped>
.details-content { min-height: 200px; }
.status-line, .dependency-heading, .detail-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.status-line { margin-bottom: 16px; }
.secondary { color: var(--el-text-color-secondary); font-size: 12px; }
.check-error { margin-bottom: 16px; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; margin: 16px 0; }
.facts > div { min-width: 0; }
dt { color: var(--el-text-color-secondary); font-size: 12px; margin-bottom: 5px; }
dd { margin: 0; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
.detail-section { padding: 12px 0; border-top: 1px solid var(--el-border-color-lighter); }
h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
pre { margin: 0; padding: 12px; background: var(--el-fill-color-light); font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 320px; overflow: auto; }
.history-output { margin: 12px; }
.history-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13px; }
.dependency-row { padding: 12px 0; border-bottom: 1px solid var(--el-border-color-lighter); overflow-wrap: anywhere; }
.dependency-row p { margin: 8px 0; font-size: 13px; }
.dependency-heading { margin-bottom: 6px; font-size: 14px; }
.load-error { display: grid; gap: 12px; margin-bottom: 16px; }
.detail-actions { justify-content: flex-end; }
.detail-actions .el-button { margin-left: 0; }
@media (max-width: 540px) { .facts { grid-template-columns: minmax(0, 1fr); gap: 14px; } }
</style>