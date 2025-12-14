export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelogData: ChangelogEntry[] = [
  {
    version: 'v0.3 Beta',
    date: '2025-12-12',
    changes: [
        'More area coverage',
        'Fix Raw Warning Data Ui issue',
        'Fix Mobile initial load issue',
    ]
  },
  {
    version: 'v0.2 Beta',
    date: '2025-12-12',
    changes: [
        'Added Change log',
        'Added Map Label',
        'More area coverage',
        'Change location Decode logic',
    ]
  },
  {
    version: 'v0.1 Beta',
    date: '2025-12-11',
    changes: [
      'Initial beta release',
      'Integrated MapLibre GL for Malaysia map',
      'Added RainViewer radar layer',
      'Implemented MetMalaysia warning integration',
      'Added "About" panel'
    ]
  }
];
