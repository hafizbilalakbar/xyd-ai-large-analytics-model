/**
 * Permission catalog and route access rules.
 *
 * The catalog mirrors the permission tree of the original application: one
 * group per sidebar page, where each group lists the page access and operation
 * permissions that can be granted to a role. Groups for pages the original
 * app keeps administrator-only ("Real-time Lock Monitoring" and
 * "Permission Management") are not part of the configurable tree.
 */

export interface PermissionCatalogItem {
  readonly id: string;
  readonly label: string;
}

export interface PermissionGroup {
  readonly key: string;
  readonly label: string;
  readonly route: string;
  readonly items: readonly PermissionCatalogItem[];
}

export interface RouteAccessRule {
  /** Route path segment, e.g. `sample-search` for `/sample-search`. */
  readonly segment: string;
  /** Any single permission in this list grants access to the route. */
  readonly anyOf: readonly string[];
  /** When true, only the built-in administrator may open the route. */
  readonly adminOnly: boolean;
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    key: 'dashboard',
    label: 'Homepage Overview',
    route: '/dashboard',
    items: [{ id: 'dashboard:view', label: 'View the homepage overview' }],
  },
  {
    key: 'sample-search',
    label: 'Sample Query',
    route: '/sample-search',
    items: [
      { id: 'sample:view', label: 'View samples, details and classification' },
      { id: 'formula:view', label: 'View formula parsing' },
      { id: 'sample:correct', label: 'Annotation correction' },
    ],
  },
  {
    key: 'low-confidence-review',
    label: 'Low Confidence Review',
    route: '/low-confidence-review',
    items: [{ id: 'lowconf:view', label: 'Low confidence review' }],
  },
  {
    key: 'data-import',
    label: 'Data Import',
    route: '/data-import',
    items: [{ id: 'replay:import', label: 'Import replay data' }],
  },
  {
    key: 'data-export',
    label: 'Data Export',
    route: '/data-export',
    items: [{ id: 'export:run', label: 'Run data exports' }],
  },
  {
    key: 'parameters-and-formulas',
    label: 'Parameter & Formula Configuration',
    route: '/parameters-and-formulas',
    items: [
      { id: 'failuretype:manage', label: 'Failure mode management' },
      { id: 'config:manage', label: 'Parameter/formula configuration' },
    ],
  },
  {
    key: 'training-tasks',
    label: 'Training Task Management',
    route: '/training-tasks',
    items: [{ id: 'training:manage', label: 'Training management' }],
  },
  {
    key: 'version-management',
    label: 'Version Management',
    route: '/version-management',
    items: [
      { id: 'model:view', label: 'View model versions' },
      { id: 'model:manage', label: 'Activate/roll back models' },
    ],
  },
  {
    key: 'logs-and-monitoring',
    label: 'Logs & Monitoring',
    route: '/logs-and-monitoring',
    items: [{ id: 'log:view', label: 'View logs and monitoring' }],
  },
];

export const ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  { segment: 'dashboard', anyOf: ['dashboard:view'], adminOnly: false },
  { segment: 'realtime-monitoring', anyOf: [], adminOnly: true },
  {
    segment: 'sample-search',
    anyOf: ['sample:view', 'formula:view', 'sample:correct'],
    adminOnly: false,
  },
  { segment: 'low-confidence-review', anyOf: ['lowconf:view'], adminOnly: false },
  { segment: 'data-import', anyOf: ['replay:import'], adminOnly: false },
  { segment: 'data-export', anyOf: ['export:run'], adminOnly: false },
  {
    segment: 'parameters-and-formulas',
    anyOf: ['failuretype:manage', 'config:manage'],
    adminOnly: false,
  },
  { segment: 'training-tasks', anyOf: ['training:manage'], adminOnly: false },
  {
    segment: 'version-management',
    anyOf: ['model:view', 'model:manage'],
    adminOnly: false,
  },
  { segment: 'logs-and-monitoring', anyOf: ['log:view'], adminOnly: false },
  { segment: 'permission-management', anyOf: [], adminOnly: true },
];

export function routeRuleForSegment(segment: string): RouteAccessRule | null {
  const normalized = segment.replace(/^\//, '').toLowerCase();
  if (normalized === '') {
    return ROUTE_ACCESS_RULES.find((rule) => rule.segment === 'dashboard') ?? null;
  }
  return ROUTE_ACCESS_RULES.find((rule) => rule.segment === normalized) ?? null;
}
