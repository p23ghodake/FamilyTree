export interface TourStep {
  selector: string | null;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const TOUR_STEPS: TourStep[] = [
  { selector: null,                       placement: 'center' }, // 0: welcome
  { selector: '[data-tour="add-member"]', placement: 'bottom' }, // 1: add member
  { selector: '.pnode__circle',           placement: 'right'  }, // 2: person node
  { selector: '.floating-search',         placement: 'top'    }, // 3: search & filter
  { selector: '[data-tour="trace"]',      placement: 'bottom' }, // 4: relationship tracer
  { selector: '.zoom-controls',           placement: 'left'   }, // 5: zoom & navigation
];
