export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelogData: ChangelogEntry[] = [
  {
    version: 'v0.6 Beta',
    date: '2025-12-15',
    changes: [
      'Lightning strikes (thanks to Blitzortung) 🎉',
      'Reload Warning Data every 3 minutes',
      'Separate Warning Thunderstorm Filter',
      'More area coverage',
      'SEO Improvements',
    ]
  },
  {
    version: 'v0.5 Beta',
    date: '2025-12-14',
    changes: [
      'More area coverage',
    ]
  },
  {
    version: 'v0.4 Beta',
    date: '2025-12-14',
    changes: [
      'Added QNA',
      'Toggle RainViewer layer',
      'More area coverage',
      'Change location Decode logic',
      'Some Animations improvements',
    ]
  },
  {
    version: 'v0.3 Beta',
    date: '2025-12-14',
    changes: [
        'More area coverage',
        'Fix Raw Warning Data Ui issue',
        'Fix Mobile initial load issue',
    ]
  },
  {
    version: 'v0.2 Beta',
    date: '2025-12-14',
    changes: [
        'Added Change log',
        'Added Map Label',
        'More area coverage',
        'Change location Decode logic',
    ]
  },
  {
    version: 'v0.1 Beta',
    date: '2025-12-13',
    changes: [
      'Initial beta release',
      'Integrated MapLibre GL for Malaysia map',
      'Added RainViewer radar layer',
      'Implemented MetMalaysia warning integration',
      'Added "About" panel'
    ]
  }
];
