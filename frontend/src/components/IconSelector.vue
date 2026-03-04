<template>
  <div class="icon-selector">
    <el-popover
      placement="bottom-start"
      :width="420"
      trigger="click"
      popper-class="icon-selector-popover"
    >
      <template #reference>
        <div class="icon-display" :class="{ 'has-icon': modelValue }">
          <span class="icon-preview">
            <Icon v-if="isIconifyIcon(modelValue)" :icon="modelValue" :width="20" />
            <span v-else>{{ modelValue || '🔧' }}</span>
          </span>
          <span class="icon-label">{{ modelValue ? 'Change Icon' : 'Select Icon' }}</span>
          <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
        </div>
      </template>
      
      <div class="icon-picker">
        <div class="icon-picker-header">
          <span>Select an Icon</span>
          <el-button 
            v-if="modelValue" 
            size="small" 
            text 
            @click="handleClear"
          >
            Clear
          </el-button>
        </div>
        
        <el-tabs v-model="activeCategory" type="card">
          <el-tab-pane 
            v-for="category in categories" 
            :key="category.name" 
            :label="category.label" 
            :name="category.name"
          >
            <div class="icon-grid" :class="{ 'icon-grid-large': category.type === 'iconify' }">
              <div 
                v-for="icon in category.icons" 
                :key="icon.value"
                class="icon-item"
                :class="{ active: modelValue === icon.value, 'icon-item-large': category.type === 'iconify' }"
                @click="handleSelect(icon.value)"
                :title="icon.label"
              >
                <Icon v-if="category.type === 'iconify'" :icon="icon.value" :width="32" />
                <span v-else class="icon-emoji">{{ icon.value }}</span>
                <span v-if="icon.label" class="icon-name">{{ icon.label }}</span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-popover>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const activeCategory = ref('database');

const isIconifyIcon = (value?: string) => {
  return value && value.includes(':');
};

const categories = [
  {
    name: 'database',
    label: 'Databases',
    type: 'iconify',
    icons: [
      { value: 'logos:mysql', label: 'MySQL' },
      { value: 'logos:postgresql', label: 'PostgreSQL' },
      { value: 'logos:mongodb-icon', label: 'MongoDB' },
      { value: 'logos:redis', label: 'Redis' },
      { value: 'logos:mariadb-icon', label: 'MariaDB' },
      { value: 'devicon:microsoftsqlserver', label: 'SQL Server' },
      { value: 'logos:oracle', label: 'Oracle' },
      { value: 'logos:sqlite', label: 'SQLite' },
      { value: 'logos:elasticsearch', label: 'Elasticsearch' },
      { value: 'logos:cassandra', label: 'Cassandra' },
      { value: 'devicon:couchbase', label: 'Couchbase' },
      { value: 'logos:influxdb', label: 'InfluxDB' }
    ]
  },
  {
    name: 'web',
    label: 'Web & API',
    type: 'iconify',
    icons: [
      { value: 'logos:nginx', label: 'Nginx' },
      { value: 'logos:apache', label: 'Apache' },
      { value: 'devicon:express', label: 'Express' },
      { value: 'logos:nodejs-icon', label: 'Node.js' },
      { value: 'logos:java', label: 'Java' },
      { value: 'logos:spring-icon', label: 'Spring' },
      { value: 'logos:django-icon', label: 'Django' },
      { value: 'logos:flask', label: 'Flask' },
      { value: 'logos:fastapi-icon', label: 'FastAPI' },
      { value: 'logos:laravel', label: 'Laravel' },
      { value: 'logos:dotnet', label: '.NET' },
      { value: 'logos:tomcat', label: 'Tomcat' },
      { value: 'logos:graphql', label: 'GraphQL' }
    ]
  },
  {
    name: 'messaging',
    label: 'Messaging',
    type: 'iconify',
    icons: [
      { value: 'logos:kafka-icon', label: 'Kafka' },
      { value: 'logos:rabbitmq-icon', label: 'RabbitMQ' },
      { value: 'devicon:apachepulsar', label: 'Pulsar' },
      { value: 'simple-icons:apacherocketmq', label: 'RocketMQ' },
      { value: 'logos:activemq', label: 'ActiveMQ' },
      { value: 'devicon:nats', label: 'NATS' },
      { value: 'simple-icons:apacheflink', label: 'Flink' },
      { value: 'logos:aws-sqs', label: 'AWS SQS' }
    ]
  },
  {
    name: 'infra',
    label: 'Infrastructure',
    type: 'iconify',
    icons: [
      { value: 'logos:docker-icon', label: 'Docker' },
      { value: 'logos:kubernetes', label: 'Kubernetes' },
      { value: 'logos:jenkins', label: 'Jenkins' },
      { value: 'logos:gitlab', label: 'GitLab' },
      { value: 'logos:github-icon', label: 'GitHub' },
      { value: 'logos:prometheus', label: 'Prometheus' },
      { value: 'logos:grafana', label: 'Grafana' },
      { value: 'logos:terraform-icon', label: 'Terraform' },
      { value: 'logos:ansible', label: 'Ansible' },
      { value: 'logos:consul', label: 'Consul' },
      { value: 'logos:vault-icon', label: 'Vault' },
      { value: 'logos:istio', label: 'Istio' }
    ]
  },
  {
    name: 'cloud',
    label: 'Cloud',
    type: 'iconify',
    icons: [
      { value: 'logos:aws', label: 'AWS' },
      { value: 'logos:azure-icon', label: 'Azure' },
      { value: 'logos:google-cloud', label: 'GCP' },
      { value: 'logos:alibaba-cloud', label: 'Alibaba Cloud' },
      { value: 'logos:tencent-qq', label: 'Tencent Cloud' },
      { value: 'logos:digitalocean-icon', label: 'DigitalOcean' },
      { value: 'logos:heroku-icon', label: 'Heroku' },
      { value: 'logos:cloudflare-icon', label: 'Cloudflare' }
    ]
  },
  {
    name: 'monitoring',
    label: 'Monitoring',
    type: 'iconify',
    icons: [
      { value: 'logos:prometheus', label: 'Prometheus' },
      { value: 'logos:grafana', label: 'Grafana' },
      { value: 'logos:sentry-icon', label: 'Sentry' },
      { value: 'logos:datadog', label: 'Datadog' },
      { value: 'devicon:newrelic', label: 'New Relic' },
      { value: 'logos:zabbix', label: 'Zabbix' },
      { value: 'simple-icons:splunk', label: 'Splunk' },
      { value: 'logos:kibana', label: 'Kibana' }
    ]
  },
  {
    name: 'cache',
    label: 'Cache & Search',
    type: 'iconify',
    icons: [
      { value: 'logos:redis', label: 'Redis' },
      { value: 'logos:memcached', label: 'Memcached' },
      { value: 'logos:elasticsearch', label: 'Elasticsearch' },
      { value: 'logos:algolia', label: 'Algolia' },
      { value: 'simple-icons:apachesolr', label: 'Apache Solr' }
    ]
  },
  {
    name: 'emoji',
    label: 'Emoji',
    type: 'emoji',
    icons: [
      { value: '🌐', label: 'Web' },
      { value: '⚙️', label: 'Service' },
      { value: '🗄️', label: 'Database' },
      { value: '📨', label: 'Message' },
      { value: '☁️', label: 'Cloud' },
      { value: '🔧', label: 'Tool' },
      { value: '📊', label: 'Monitor' },
      { value: '🔐', label: 'Security' },
      { value: '⚡', label: 'Fast' },
      { value: '🚀', label: 'Launch' },
      { value: '💾', label: 'Storage' },
      { value: '🔗', label: 'Link' },
      { value: '📦', label: 'Package' },
      { value: '🛡️', label: 'Shield' },
      { value: '🔔', label: 'Alert' },
      { value: '👁️', label: 'Watch' }
    ]
  }
];

const findCategoryForIcon = (icon: string): string | null => {
  for (const category of categories) {
    if (category.icons.some(item => item.value === icon)) {
      return category.name;
    }
  }
  return null;
};

const handleSelect = (icon: string) => {
  console.log('✅ Icon selected:', icon);
  emit('update:modelValue', icon);
};

const handleClear = () => {
  console.log('🗑️ Icon cleared');
  emit('update:modelValue', '');
};

// Debug: Watch modelValue changes
watch(() => props.modelValue, (newVal, oldVal) => {
  console.log('🔍 IconSelector modelValue changed:', { 
    from: oldVal, 
    to: newVal,
    type: typeof newVal 
  });
  // Auto-switch to correct category when value changes
  if (newVal) {
    const category = findCategoryForIcon(newVal);
    if (category) {
      console.log('📂 Auto-switching to category:', category);
      activeCategory.value = category;
    }
  }
}, { immediate: true });

// Debug: Log on mount
onMounted(() => {
  console.log('🎨 IconSelector mounted with modelValue:', props.modelValue);
});
</script>

<style scoped>
.icon-selector {
  display: inline-block;
}

.icon-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 1px 11px;
  height: 32px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  min-width: 140px;
  box-sizing: border-box;
}

.icon-display:hover {
  border-color: #409eff;
  background: #f5f7fa;
}

.icon-display.has-icon {
  border-color: #409eff;
}

.icon-preview {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-label {
  font-size: 13px;
  color: #606266;
  flex: 1;
}

.dropdown-icon {
  color: #909399;
  font-size: 12px;
  transition: transform 0.2s;
}

.icon-display:hover .dropdown-icon {
  transform: translateY(2px);
}

.icon-picker {
  width: 100%;
}

.icon-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
}

.icon-grid-large {
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 44px;
  padding: 6px;
  font-size: 24px;
  border: 1px solid #e4e7ec;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}

.icon-item-large {
  min-height: 64px;
  padding: 10px;
}

.icon-emoji {
  font-size: 24px;
}

.icon-name {
  font-size: 11px;
  color: #606266;
  text-align: center;
  line-height: 1.2;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
  transform: scale(1.05);
}

.icon-item.active {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

:deep(.el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.el-tabs__item) {
  font-size: 12px;
  padding: 0 12px;
  height: 32px;
  line-height: 32px;
}

:deep(.el-tabs__content) {
  padding-top: 8px;
}
</style>
