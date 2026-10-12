export interface TourStep {
  selector: string | null;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

// Comma-separated selectors list desktop and phone targets; the first visible one is highlighted.
export const TOUR_STEPS: TourStep[] = [
  { selector: null,                                                placement: 'center' }, // 0: welcome
  { selector: '[data-tour="views"], [data-tour="menu"]',          placement: 'bottom' }, // 1: views
  { selector: '.pnode__circle',                                    placement: 'right'  }, // 2: person & details
  { selector: '.floating-search',                                  placement: 'bottom' }, // 3: search & filters
  { selector: '[data-tour="trace"]',                               placement: 'bottom' }, // 4: relationship tracer
  { selector: '[data-tour="add-member"], [data-tour="sign-in"]',  placement: 'bottom' }, // 5: add member / sign in
  { selector: '[data-tour="settings"], [data-tour="menu"]',       placement: 'bottom' }, // 6: settings & sharing
  { selector: '.zoom-controls',                                    placement: 'left'   }, // 7: zoom & navigation
];
