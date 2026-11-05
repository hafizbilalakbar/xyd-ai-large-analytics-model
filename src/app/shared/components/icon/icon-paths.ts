export type IconName =
  | 'home'
  | 'activity'
  | 'search'
  | 'eye'
  | 'download'
  | 'upload'
  | 'sliders'
  | 'cpu'
  | 'layers'
  | 'terminal'
  | 'shield'
  | 'menu'
  | 'chevron-left'
  | 'logout'
  | 'user'
  | 'close'
  | 'check'
  | 'alert'
  | 'refresh';

export const ICON_PATHS: Record<IconName, readonly string[]> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  activity: ['M3 12h4l2.5 6 4-13 2.5 7h5'],
  search: ['M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13', 'M15.2 15.2 21 21'],
  eye: [
    'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z',
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  ],
  download: ['M12 3v12', 'M7.5 10.5 12 15l4.5-4.5', 'M4 17v3h16v-3'],
  upload: ['M12 15V3', 'M7.5 7.5 12 3l4.5 4.5', 'M4 17v3h16v-3'],
  sliders: ['M4 7h6', 'M14 7h6', 'M12 5v4', 'M4 17h10', 'M18 17h2', 'M16 15v4'],
  cpu: [
    'M7 7h10v10H7z',
    'M9 3v4',
    'M15 3v4',
    'M9 17v4',
    'M15 17v4',
    'M3 9h4',
    'M3 15h4',
    'M17 9h4',
    'M17 15h4',
  ],
  layers: ['M12 3 3 8l9 5 9-5-9-5Z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
  terminal: ['M4 5h16v14H4z', 'M8 9l3 3-3 3', 'M13 15h3'],
  shield: [
    'M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z',
    'M9 12l2 2 4-4',
  ],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'chevron-left': ['M14.5 6 8.5 12l6 6'],
  logout: ['M10 12h10', 'M17 8l4 4-4 4', 'M14 4H5v16h9'],
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4.5 21a7.5 7.5 0 0 1 15 0'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  check: ['M5 12.5 9.5 17 19 7.5'],
  alert: ['M12 3 2.5 20h19L12 3Z', 'M12 9v5', 'M12 17.5h.01'],
  refresh: ['M1 12a11 11 0 0 0 8.595 10.69l-.447 2.237A13 13 0 0 1 1 12zM22.405 12a11 11 0 0 0-8.595-10.69l.447-2.237A13 13 0 0 1 23 12z'],
};
