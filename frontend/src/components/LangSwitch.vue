<template>
  <el-dropdown trigger="click" @command="handleCommand">
    <div class="lang-switch-btn">
      <el-icon :size="16"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/></svg></el-icon>
      <span class="lang-label">{{ currentLabel }}</span>
      <el-icon :size="12"><ArrowDown /></el-icon>
    </div>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="en-US" :class="{ 'is-selected': currentLocale === 'en-US' }">
          <span class="lang-flag">🇺🇸</span>
          <span>English</span>
          <el-icon v-if="currentLocale === 'en-US'" class="lang-check"><Check /></el-icon>
        </el-dropdown-item>
        <el-dropdown-item command="zh-CN" :class="{ 'is-selected': currentLocale === 'zh-CN' }">
          <span class="lang-flag">🇨🇳</span>
          <span>简体中文</span>
          <el-icon v-if="currentLocale === 'zh-CN'" class="lang-check"><Check /></el-icon>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDown, Check } from '@element-plus/icons-vue';
import { setLocale } from '../i18n';

const { locale } = useI18n();

const currentLocale = computed(() => locale.value);
const currentLabel = computed(() => locale.value === 'zh-CN' ? '中文' : 'EN');

function handleCommand(lang: string) {
  setLocale(lang as 'en-US' | 'zh-CN');
}
</script>

<style scoped>
.lang-switch-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #666;
  border: 1px solid #dcdfe6;
  transition: all 0.2s;
  background: #fff;
  user-select: none;
  height: 32px;
}

.lang-switch-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.lang-label {
  font-weight: 500;
  min-width: 24px;
  text-align: center;
}

.lang-flag {
  font-size: 16px;
  margin-right: 6px;
}

.lang-check {
  margin-left: auto;
  color: var(--el-color-primary);
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 150px;
}

:deep(.el-dropdown-menu__item.is-selected) {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}
</style>
