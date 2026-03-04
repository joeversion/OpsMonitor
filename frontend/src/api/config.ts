import api from './index';

export interface GeneralSettings {
  defaultInterval: number;
  warningThreshold: number;
  errorThreshold: number;
  dataRetentionDays: number;
}

export const getGeneralSettings = async (): Promise<GeneralSettings> => {
  const response = await api.get('/config/general');
  return response.data;
};

export const updateGeneralSettings = async (settings: Partial<GeneralSettings>): Promise<void> => {
  await api.put('/config/general', settings);
};

export const getNotificationConfig = async () => {
  const response = await api.get('/config/notifications');
  return response.data;
};

export const updateNotificationConfig = async (config: any) => {
  await api.put('/config/notifications', config);
};

export const testEmail = async (target: string) => {
  await api.post('/config/notifications/test', { type: 'email', target });
};

export const testTeams = async (target: string) => {
  await api.post('/config/notifications/test', { type: 'teams', target });
};
