export const environment = {
  production: true,
  appName: 'Ges Lafia',
  version: '1.0.0',
  enableDebug: false,
  isCapacitor: false,
  apiUrl: '/api',

  boutiques: [] as { nom: string; url: string }[],

  tokenKey: 'boutique_auth_token',
  userKey: 'boutique_user_data',

  boutique: {
    currency: 'FCFA',
    timezone: 'Africa/Abidjan',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm'
  }
};