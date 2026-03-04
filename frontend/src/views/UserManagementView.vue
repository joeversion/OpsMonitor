<template>
  <div class="user-management">
    <div class="page-header">
      <h1>User Management</h1>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        Add User
      </el-button>
    </div>

    <!-- Stats Cards -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #ecf5ff; color: #409EFF;">
            <el-icon :size="24"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">Total Users</div>
            <div class="stat-value">{{ stats.total }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #fdf6ec; color: #E6A23C;">
            <el-icon :size="24"><Avatar /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">Administrators</div>
            <div class="stat-value" style="color: #E6A23C">{{ stats.admins }}</div>
          </div>
        </div>
      </el-col>
      <el-col :span="8">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f0f9eb; color: #67C23A;">
            <el-icon :size="24"><Tickets /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-label">Viewers</div>
            <div class="stat-value" style="color: #67C23A">{{ stats.viewers }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- Filters -->
    <el-card class="filter-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input
            v-model="searchQuery"
            placeholder="Search users..."
            :prefix-icon="Search"
            clearable
          />
        </el-col>
        <el-col :span="6">
          <el-select v-model="filterRole" placeholder="Filter by Role" clearable style="width: 100%">
            <el-option label="Admin" value="admin" />
            <el-option label="Viewer" value="viewer" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filterStatus" placeholder="Filter by Status" clearable style="width: 100%">
            <el-option label="Active" value="active" />
            <el-option label="Inactive" value="inactive" />
          </el-select>
        </el-col>
      </el-row>
    </el-card>

    <!-- Users Table -->
    <el-card>
      <el-table :data="paginatedUsers" v-loading="loading" style="width: 100%">
        <el-table-column label="No." width="60" align="center">
          <template #default="{ $index }">
            {{ (currentPage - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="username" label="Username" min-width="150" />
        <el-table-column prop="email" label="Email" min-width="200">
          <template #default="{ row }">
            {{ row.email || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="role" label="Role" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'warning' : 'info'">
              {{ row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="Status" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="Last Login" width="180">
          <template #default="{ row }">
            {{ formatDate(row.last_login_at) }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="showEditDialog(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button size="small" @click="showPasswordDialog(row)">
                <el-icon><Key /></el-icon>
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="handleDelete(row)"
                :disabled="row.id === currentUser?.id"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 15, 20, 50]"
          :total="filteredUsers.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <!-- Add/Edit User Dialog -->
    <el-dialog
      v-model="userDialogVisible"
      :title="isEditing ? 'Edit User' : 'Add User'"
      width="500px"
    >
      <el-form
        ref="userFormRef"
        :model="userForm"
        :rules="userRules"
        label-width="100px"
      >
        <el-form-item label="Username" prop="username">
          <el-input v-model="userForm.username" />
        </el-form-item>
        <el-form-item label="Email" prop="email">
          <el-input v-model="userForm.email" />
        </el-form-item>
        <el-form-item v-if="!isEditing" label="Password" prop="password">
          <el-input v-model="userForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="Role" prop="role">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option label="Admin" value="admin" />
            <el-option label="Viewer" value="viewer" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isEditing" label="Status" prop="status">
          <el-select v-model="userForm.status" style="width: 100%">
            <el-option label="Active" value="active" />
            <el-option label="Inactive" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="handleSaveUser" :loading="saving">
          {{ isEditing ? 'Update' : 'Create' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Reset Password Dialog -->
    <el-dialog v-model="passwordDialogVisible" title="Reset Password" width="400px">
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="120px"
      >
        <el-form-item label="New Password" prop="password">
          <el-input v-model="passwordForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="Confirm" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">Cancel</el-button>
        <el-button type="primary" @click="handleResetPassword" :loading="saving">
          Reset Password
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, User, Avatar, Tickets, Search, Edit, Key, Delete } from '@element-plus/icons-vue';
import usersApi, { type User as UserType, type CreateUserRequest, type UpdateUserRequest } from '@/api/users';
import authUtils from '@/utils/auth';

const loading = ref(false);
const saving = ref(false);
const users = ref<UserType[]>([]);
const searchQuery = ref('');
const filterRole = ref('');
const filterStatus = ref('');
const currentUser = authUtils.getUser();

// Stats
const stats = computed(() => ({
  total: users.value.length,
  admins: users.value.filter(u => u.role === 'admin').length,
  viewers: users.value.filter(u => u.role === 'viewer').length,
}));

// Pagination
const pageSize = ref(15);
const currentPage = ref(1);

// Filtered users
const filteredUsers = computed(() => {
  return users.value.filter(user => {
    const matchesSearch = !searchQuery.value ||
      user.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.value.toLowerCase()));
    const matchesRole = !filterRole.value || user.role === filterRole.value;
    const matchesStatus = !filterStatus.value || user.status === filterStatus.value;
    return matchesSearch && matchesRole && matchesStatus;
  });
});

// Paginated users
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredUsers.value.slice(start, end);
});

// User Dialog
const userDialogVisible = ref(false);
const isEditing = ref(false);
const editingUserId = ref<number | null>(null);
const userFormRef = ref<FormInstance>();
const userForm = reactive({
  username: '',
  email: '',
  password: '',
  role: 'viewer' as 'admin' | 'viewer',
  status: 'active' as 'active' | 'inactive',
});

const userRules: FormRules = {
  username: [
    { required: true, message: 'Please enter username', trigger: 'blur' },
    { min: 3, max: 50, message: 'Username must be 3-50 characters', trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: 'Please enter a valid email', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Please enter password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
  ],
  role: [
    { required: true, message: 'Please select a role', trigger: 'change' },
  ],
};

// Password Dialog
const passwordDialogVisible = ref(false);
const passwordUserId = ref<number | null>(null);
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  password: '',
  confirmPassword: '',
});

const passwordRules: FormRules = {
  password: [
    { required: true, message: 'Please enter new password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Please confirm password', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.password) {
          callback(new Error('Passwords do not match'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
};

const fetchUsers = async () => {
  loading.value = true;
  try {
    users.value = await usersApi.getAll();
  } catch (error) {
    ElMessage.error('Failed to load users');
  } finally {
    loading.value = false;
  }
};

const showAddDialog = () => {
  isEditing.value = false;
  editingUserId.value = null;
  userForm.username = '';
  userForm.email = '';
  userForm.password = '';
  userForm.role = 'viewer';
  userForm.status = 'active';
  userDialogVisible.value = true;
};

const showEditDialog = (user: UserType) => {
  isEditing.value = true;
  editingUserId.value = user.id;
  userForm.username = user.username;
  userForm.email = user.email || '';
  userForm.password = '';
  userForm.role = user.role;
  userForm.status = user.status;
  userDialogVisible.value = true;
};

const showPasswordDialog = (user: UserType) => {
  passwordUserId.value = user.id;
  passwordForm.password = '';
  passwordForm.confirmPassword = '';
  passwordDialogVisible.value = true;
};

const handleSaveUser = async () => {
  if (!userFormRef.value) return;
  
  await userFormRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      if (isEditing.value && editingUserId.value) {
        const data: UpdateUserRequest = {
          username: userForm.username,
          email: userForm.email || undefined,
          role: userForm.role,
          status: userForm.status,
        };
        await usersApi.update(editingUserId.value, data);
        ElMessage.success('User updated successfully');
      } else {
        const data: CreateUserRequest = {
          username: userForm.username,
          email: userForm.email || undefined,
          password: userForm.password,
          role: userForm.role,
        };
        await usersApi.create(data);
        ElMessage.success('User created successfully');
      }
      userDialogVisible.value = false;
      await fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Operation failed';
      ElMessage.error(message);
    } finally {
      saving.value = false;
    }
  });
};

const handleResetPassword = async () => {
  if (!passwordFormRef.value || !passwordUserId.value) return;

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return;

    saving.value = true;
    try {
      await usersApi.updatePassword(passwordUserId.value!, { password: passwordForm.password });
      ElMessage.success('Password reset successfully');
      passwordDialogVisible.value = false;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to reset password';
      ElMessage.error(message);
    } finally {
      saving.value = false;
    }
  });
};

const handleDelete = async (user: UserType) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to delete user "${user.username}"?`,
      'Confirm Delete',
      { type: 'warning' }
    );

    await usersApi.delete(user.id);
    ElMessage.success('User deleted successfully');
    await fetchUsers();
  } catch (error: any) {
    if (error !== 'cancel') {
      const message = error.response?.data?.error || 'Failed to delete user';
      ElMessage.error(message);
    }
  }
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.user-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.stats-row {
  margin-bottom: 20px;
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

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
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

.filter-card {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
