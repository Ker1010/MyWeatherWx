export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelogData: ChangelogEntry[] = [
  {
    version: 'v1.4',
    date: '2026-01-31',
    changes: [
      'Localized Forecast Descriptions',
      'Removed PWA Notification',
      'SEO Improvements',
    ]
  },
  {
    version: 'v1.3',
    date: '2026-01-10',
    changes: [
      'QNA Section Improvements',
      'Add Copyright Info',
      'Remove Discord Server',
      'SEO Improvements',
    ]
  },
  {
    version: 'v1.2',
    date: '2026-01-03',
    changes: [
      'Add Forecast',
      'Add New Translate Language (Chinese)',
      'Add Radar Color Scheme',
      'Add Probe Tool (Desktop Only)',
    ]
  },
  {
    version: 'v1.1',
    date: '2025-12-21',
    changes: [
      'Add Snowfall (happy holiday)',
      'More area coverage',
    ]
  },
  {
    version: 'v1.0',
    date: '2025-12-18',
    changes: [
      'Redesign Control Panel',
      'Redesign Warning Popup',
      'PWA notification',
      'Some Animations improvements',
      'Added Default active warnings',
      'Translate Language (English/Bahasa Melayu)',
      'Draw function',
      'More area coverage',
      'Playback function',
      'Reload RainViewer Data every 3 minutes',
      'Discord server ready!',
    ]
  },
  {
    version: 'v0.8 Beta',
    date: '2025-12-16',
    changes: [
      'Change location Decode logic',
      'Mapping Performance Improvements',
    ]
  },
  {
    version: 'v0.7 Beta',
    date: '2025-12-15',
    changes: [
      'More area coverage',
      'SEO Improvements',
    ]
  },
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
