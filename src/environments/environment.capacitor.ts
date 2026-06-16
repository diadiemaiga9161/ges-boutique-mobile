export const environment = {
  production: true,
  appName: 'Ges Lafia',
  version: '1.0.0',
  enableDebug: false,
  isCapacitor: true,
  apiUrl: '/api',

  boutiques: [
    { nom: 'Fatma Zahara',      url: 'https://fatmazahara.mg-consulting.site' },
    { nom: 'Moh',               url: 'https://moh.mg-consulting.site' },
    { nom: 'Magaouba Kabala',   url: 'https://magaoubakabala.mg-consulting.site' },
    { nom: 'Baran Djim',        url: 'https://barandjim.mg-consulting.site' },
    { nom: 'Bou Bandjim',       url: 'https://boubandjim.mg-consulting.site' },
  ],

  tokenKey: 'boutique_auth_token',
  userKey: 'boutique_user_data',

  boutique: {
    currency: 'FCFA',
    timezone: 'Africa/Abidjan',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm'
  }
};
