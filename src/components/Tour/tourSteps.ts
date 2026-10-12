export interface TourStep {
  selector: string | null;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Demo clip in public/tour/, recorded with a fictional family. */
  media?: string;
}

// Comma-separated selectors list desktop and phone targets; the first visible one is highlighted.
export const TOUR_STEPS: TourStep[] = [
  { selector: null,                                                placement: 'center' }, // 0: welcome
  { selector: '[data-tour="views"], [data-tour="menu"]',          placement: 'bottom' }, // 1: views
  { selector: '.pnode__circle',                                    placement: 'right',  media: 'details.gif' },    // 2: person & details
  { selector: '.floating-search',                                  placement: 'bottom', media: 'search.gif' },     // 3: search & filters
  { selector: '[data-tour="trace"]',                               placement: 'bottom', media: 'trace.gif' },      // 4: relationship tracer
  { selector: '[data-tour="add-member"], [data-tour="sign-in"]',  placement: 'bottom', media: 'add-member.gif' }, // 5: add member / sign in
  { selector: '[data-tour="settings"], [data-tour="menu"]',       placement: 'bottom', media: 'language.gif' },   // 6: settings & sharing
  { selector: '.zoom-controls',                                    placement: 'left'   }, // 7: zoom & navigation
];
