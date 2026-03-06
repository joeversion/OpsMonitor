<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Left Panel - Branding -->
      <div class="left-panel">
        <div class="brand-pattern"></div>
        <div class="brand-content">
          <div class="logo">
            <div class="logo-icon">
              <el-icon :size="28" color="#fff"><Monitor /></el-icon>
            </div>
            <span class="logo-text">OpsMonitor</span>
          </div>
          <h1 class="tagline" v-html="$t('login.brandTagline')"></h1>
          <p class="description">
            {{ $t('login.brandDesc') }}
          </p>
          <ul class="feature-list">
          <li>
            <div class="feature-icon"><el-icon :size="16"><Histogram /></el-icon></div>
            <span>{{ $t('login.feature1') }}</span>
          </li>
          <li>
            <div class="feature-icon"><el-icon :size="16"><Bell /></el-icon></div>
            <span>{{ $t('login.feature2') }}</span>
          </li>
          <li>
            <div class="feature-icon"><el-icon :size="16"><Share /></el-icon></div>
            <span>{{ $t('login.feature3') }}</span>
          </li>
          <li>
            <div class="feature-icon"><el-icon :size="16"><DataBoard /></el-icon></div>
            <span>{{ $t('login.feature4') }}</span>
          </li>
          </ul>
        </div>
      </div>

      <!-- Right Panel - Login/Register Form -->
      <div class="right-panel">
        <div class="form-container">
          <!-- Login Form -->
          <template v-if="!isRegisterMode">
            <div class="form-header">
              <h2>{{ $t('login.welcomeBack') }}</h2>
              <p>{{ $t('login.signInSubtitle') }}</p>
            </div>

            <el-form
              ref="formRef"
              :model="loginForm"
              :rules="rules"
              class="login-form"
              label-position="top"
              @submit.prevent="handleLogin"
            >
              <el-form-item :label="$t('login.labelUsernameEmail')" prop="username">
                <el-input
                  v-model="loginForm.username"
                  :placeholder="$t('login.placeholderUsernameEmail')"
                  size="large"
                  :prefix-icon="User"
                />
              </el-form-item>

              <el-form-item :label="$t('login.labelPassword')" prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  :placeholder="$t('login.placeholderPassword')"
                  size="large"
                  :prefix-icon="Lock"
                  show-password
                  @keyup.enter="handleLogin"
                />
              </el-form-item>

              <div class="form-options">
                <el-checkbox v-model="rememberMe">{{ $t('login.rememberMe') }}</el-checkbox>
                <a href="#" class="forgot-link">{{ $t('login.forgotPassword') }}</a>
              </div>

              <el-button
                type="primary"
                size="large"
                class="login-btn"
                :loading="loading"
                @click="handleLogin"
              >
                {{ $t('login.btnSignIn') }}
              </el-button>
            </el-form>

            <!-- SSO Section -->
            <div class="sso-section">
              <div class="sso-divider">{{ $t('login.ssoOr') }}</div>
              <div class="sso-buttons">
                <el-button size="large" class="sso-btn" disabled>
                  <el-icon :size="18"><School /></el-icon>
                  <span class="sso-text">{{ $t('login.ssoLdap') }}</span>
                  <span class="coming-soon">{{ $t('login.ssoComingSoon') }}</span>
                </el-button>
                <el-button size="large" class="sso-btn" disabled>
                  <el-icon :size="18"><Key /></el-icon>
                  <span class="sso-text">{{ $t('login.ssoOauth') }}</span>
                  <span class="coming-soon">{{ $t('login.ssoComingSoon') }}</span>
                </el-button>
              </div>
            </div>

            <!-- Switch to Register -->
            <div class="auth-switch">
              {{ $t('login.noAccount') }} <a @click="isRegisterMode = true">{{ $t('login.createAccount') }}</a>
            </div>
          </template>

          <!-- Register Form -->
          <template v-else>
            <div class="form-header">
              <h2>{{ $t('login.createAccount') }}</h2>
              <p>{{ $t('login.registerSubtitle') }}</p>
            </div>

            <!-- Registration Notice -->
            <el-alert
              type="success"
              :closable="false"
              class="register-notice"
            >
              <template #default>
                <div class="register-notice-content">
                  <el-icon><InfoFilled /></el-icon>
                  <span v-html="$t('login.registerNotice')"></span>
                </div>
              </template>
            </el-alert>

            <el-form
              ref="registerFormRef"
              :model="registerForm"
              :rules="registerRules"
              class="login-form"
              label-position="top"
              @submit.prevent="handleRegister"
            >
              <el-form-item :label="$t('login.labelUsername')" prop="username">
                <el-input
                  v-model="registerForm.username"
                  :placeholder="$t('login.placeholderUsername')"
                  size="large"
                  :prefix-icon="User"
                />
              </el-form-item>

              <el-form-item :label="$t('login.labelEmail')" prop="email">
                <el-input
                  v-model="registerForm.email"
                  :placeholder="$t('login.placeholderEmail')"
                  size="large"
                  :prefix-icon="Message"
                />
              </el-form-item>

              <el-form-item :label="$t('login.labelPassword')" prop="password">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  :placeholder="$t('login.placeholderRegPwd')"
                  size="large"
                  :prefix-icon="Lock"
                  show-password
                />
              </el-form-item>

              <el-form-item :label="$t('login.labelConfirmPwd')" prop="confirmPassword">
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  :placeholder="$t('login.placeholderConfirmPwd')"
                  size="large"
                  :prefix-icon="Lock"
                  show-password
                  @keyup.enter="handleRegister"
                />
              </el-form-item>

              <el-button
                type="primary"
                size="large"
                class="login-btn"
                :loading="loading"
                @click="handleRegister"
              >
                {{ $t('login.createAccount') }}
              </el-button>
            </el-form>

            <!-- Switch to Login -->
            <div class="auth-switch">
              {{ $t('login.hasAccount') }} <a @click="isRegisterMode = false">{{ $t('login.btnSignIn') }}</a>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="login-footer">
      OpsMonitor v1.1.0_beta.1 © 2026
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { User, Lock, Monitor, School, Key, Histogram, Bell, Share, DataBoard, Message, InfoFilled } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';
import authApi from '@/api/auth';
import authUtils from '@/utils/auth';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const formRef = ref<FormInstance>();
const registerFormRef = ref<FormInstance>();
const loading = ref(false);
const rememberMe = ref(false);
const isRegisterMode = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
});

const registerForm = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const rules = computed<FormRules>(() => ({
  username: [
    { required: true, message: t('login.valRequiredUsername'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('login.valRequiredPwd'), trigger: 'blur' },
  ],
}));

const validateConfirmPassword = (rule: any, value: string, callback: any) => {
  if (value !== registerForm.password) {
    callback(new Error(t('login.valPwdMismatch')));
  } else {
    callback();
  }
};

const registerRules = computed<FormRules>(() => ({
  username: [
    { required: true, message: t('login.valRequiredRegUsername'), trigger: 'blur' },
    { min: 3, max: 50, message: t('login.valUsernameLength'), trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9._]+$/, message: t('login.valUsernamePattern'), trigger: 'blur' },
  ],
  email: [
    { required: true, message: t('login.valRequiredEmail'), trigger: 'blur' },
    { type: 'email', message: t('login.valEmailFormat'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('login.valRequiredPwd'), trigger: 'blur' },
    { min: 6, message: t('login.valPwdMinLength'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('login.valRequiredConfirm'), trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}));

const handleLogin = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    loading.value = true;
    try {
      const response = await authApi.login({
        username: loginForm.username,
        password: loginForm.password,
      });

      // Save auth data
      authUtils.saveAuth(response.token, response.user);

      ElMessage.success(t('login.msgLoginSuccess'));

      // Redirect to original page or dashboard
      const redirect = (route.query.redirect as string) || '/';
      router.push(redirect);
    } catch (error: any) {
      const message = error.response?.data?.error || t('login.msgLoginFailed');
      ElMessage.error(message);
    } finally {
      loading.value = false;
    }
  });
};

const handleRegister = async () => {
  if (!registerFormRef.value) return;

  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return;

    loading.value = true;
    try {
      const response = await authApi.register({
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
      });

      // Save auth data for immediate login
      authUtils.saveAuth(response.token, response.user);

      ElMessage.success(t('login.msgRegisterSuccess'));

      // Redirect to dashboard
      const redirect = (route.query.redirect as string) || '/';
      router.push(redirect);
    } catch (error: any) {
      const message = error.response?.data?.error || t('login.msgRegisterFailed');
      ElMessage.error(message);
    } finally {
      loading.value = false;
    }
  });
};

onMounted(() => {
  // Check if already logged in
  if (authUtils.isAuthenticated()) {
    router.push('/');
  }
});
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #001529 0%, #003a70 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: '';
  position: absolute;
  top: -200px;
  right: -100px;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.1);
}

.login-page::after {
  content: '';
  position: absolute;
  bottom: -150px;
  left: -100px;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.1);
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  min-height: 600px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 1;
}

/* Left Panel */
.left-panel {
  flex: 1;
  background: linear-gradient(135deg, #001529 0%, #002140 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.brand-pattern {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.1;
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(64, 158, 255, 0.4) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(64, 158, 255, 0.3) 0%, transparent 50%);
}

.brand-content {
  position: relative;
  z-index: 1;
}

.logo {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 40px;
}

.logo-icon {
  width: 56px;
  height: 56px;
  background: #409EFF;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.tagline {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.3;
  margin: 0 0 20px 0;
}

.description {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  margin: 0 0 40px 0;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.feature-icon {
  width: 32px;
  height: 32px;
  background: rgba(64, 158, 255, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #409EFF;
}

/* Right Panel */
.right-panel {
  flex: 1;
  padding: 60px 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-container {
  width: 100%;
  max-width: 360px;
}

.form-header {
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 8px 0;
}

.form-header p {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.login-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.forgot-link {
  font-size: 13px;
  color: #409EFF;
  text-decoration: none;
}

.forgot-link:hover {
  text-decoration: underline;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
}

/* SSO Section */
.sso-section {
  margin-top: 32px;
}

.sso-divider {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin-bottom: 20px;
  position: relative;
}

.sso-divider::before,
.sso-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background: #dcdfe6;
}

.sso-divider::before {
  left: 0;
}

.sso-divider::after {
  right: 0;
}

.sso-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sso-btn {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 0 16px;
  position: relative;
}

.sso-btn .sso-text {
  font-size: 14px;
  font-weight: 500;
}

.sso-btn .coming-soon {
  position: absolute;
  right: 16px;
  font-size: 11px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
}

/* Auth Switch */
.auth-switch {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  color: #909399;
}

.auth-switch a {
  color: #409EFF;
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
}

.auth-switch a:hover {
  text-decoration: underline;
}

/* Register Notice */
.register-notice {
  margin-bottom: 20px;
}

.register-notice :deep(.el-alert__content) {
  width: 100%;
}

.register-notice-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.register-notice-content .el-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

/* Footer */
.login-footer {
  margin-top: 24px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

/* Responsive */
@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
  }

  .left-panel {
    padding: 40px 30px;
  }

  .tagline {
    font-size: 28px;
  }

  .right-panel {
    padding: 40px 30px;
  }
}
</style>
