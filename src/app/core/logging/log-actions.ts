/**
 * Single source of truth for page names and action names used in audit logs.
 * All log wording must come from here so lines are always consistent.
 */

export const LOG_PAGES = {
  dashboard: 'Homepage Overview',
  realtimeMonitoring: 'Real-time Lock Monitoring',
  sampleSearch: 'Sample Query',
  lowConfidenceReview: 'Low Confidence Review',
  dataImport: 'Data Import',
  dataExport: 'Data Export',
  parametersAndFormulas: 'Parameter & Formula Configuration',
  trainingTasks: 'Training Task Management',
  versionManagement: 'Version Management',
  logsAndMonitoring: 'Logs & Monitoring',
  permissionManagement: 'Permission Management',
} as const;

export const LOG_ACTIONS = {
  authLogin: 'auth.login',
  authLoginFailed: 'auth.login.failed',
  authLogout: 'auth.logout',
  authSessionExpired: 'auth.session.expired',
  uiNavigate: 'ui.navigate',
  accessDenied: 'access.denied',
  roleCreate: 'role.create',
  roleUpdate: 'role.update',
  rolePermissions: 'role.permissions',
  roleDelete: 'role.delete',
  userCreate: 'user.create',
  userUpdate: 'user.update',
  userDelete: 'user.delete',
  userEnable: 'user.enable',
  userDisable: 'user.disable',
  userImport: 'user.import',
  templateDownload: 'template.download',
  logsExport: 'logs.export',
  logsClear: 'logs.clear',
} as const;

export const ROUTE_TO_PAGE: Readonly<Record<string, string>> = {
  '/dashboard': LOG_PAGES.dashboard,
  '/realtime-monitoring': LOG_PAGES.realtimeMonitoring,
  '/sample-search': LOG_PAGES.sampleSearch,
  '/low-confidence-review': LOG_PAGES.lowConfidenceReview,
  '/data-import': LOG_PAGES.dataImport,
  '/data-export': LOG_PAGES.dataExport,
  '/parameters-and-formulas': LOG_PAGES.parametersAndFormulas,
  '/training-tasks': LOG_PAGES.trainingTasks,
  '/version-management': LOG_PAGES.versionManagement,
  '/logs-and-monitoring': LOG_PAGES.logsAndMonitoring,
  '/permission-management': LOG_PAGES.permissionManagement,
};
