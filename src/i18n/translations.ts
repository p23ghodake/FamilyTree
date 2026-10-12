// ─── All user-visible UI strings in English and Marathi ───

type Translations = {
  // ── MemberFormModal ──
  modalTitleEdit: string;
  modalTitleAddChild: string;
  modalTitleAddSpouse: string;
  modalTitleAddMember: string;
  close: string;
  months: string[];  // 12-element array of month names
  // Validation
  firstNameRequired: string;
  lastNameRequired: string;
  invalidYear: string;
  deathBeforeBirth: string;
  // Relationship section
  sectionRelationship: string;
  relNone: string;
  relChildOf: string;
  relSpouseOf: string;
  relParentOf: string;
  chooseMember: string;
  bornAbbrev: string;
  belowMarriageAge: (name: string, age: number, minAge: number) => string;
  labelParent: string;
  labelSpouse: string;
  labelChild: string;
  // Name section
  sectionEnglishName: string;
  labelFirstName: string;
  placeholderFirstName: string;
  labelLastName: string;
  placeholderLastName: string;
  sectionMarathiName: string;
  labelFirstNameMr: string;
  labelLastNameMr: string;
  // Gender
  labelGender: string;
  optionMale: string;
  optionFemale: string;
  optionUnknown: string;
  labelPrimary: string;
  // Dates
  sectionDates: string;
  hintDates: string;
  labelBirth: string;
  labelDeath: string;
  hintDeathBlank: string;
  labelDay: string;
  labelMonth: string;
  labelYear: string;
  // Details
  sectionDetails: string;
  labelOccupation: string;
  placeholderOccupation: string;
  labelLocation: string;
  placeholderLocation: string;
  labelPhoto: string;
  removePhoto: string;
  uploadPhoto: string;
  pasteUrl: string;
  placeholderUrl: string;
  labelNotes: string;
  placeholderNotes: string;
  // Marriage history
  sectionMarriageHistory: string;
  marriageCount: (count: number) => string;
  marriedYear: (year: number | null) => string;
  currentMarriage: string;
  formerMarriage: string;
  endMarriage: string;
  placeholderEndYear: string;
  optionDivorce: string;
  optionDeath: string;
  optionAnnulment: string;
  optionSeparation: string;
  // Buttons
  btnConfirm: string;
  btnCancel: string;
  btnSaving: string;
  btnSaveChanges: string;
  btnDelete: string;
  btnDeleteMember: string;
  confirmDeleteMember: string;
  btnYesDelete: string;

  // ── TopBar ──
  metaFormat: (generations: number, members: number) => string;
  tooltipAddMember: string;
  tooltipUndo: string;
  tooltipUndoDisabled: string;
  tooltipRedo: string;
  tooltipRedoDisabled: string;
  tooltipTracer: string;
  tooltipStats: string;
  tooltipAvatarStyle: string;
  tooltipShare: string;
  shareTitle: string;
  shareNoData: string;
  shareQrHint: string;
  shareQrTooLargeTitle: string;
  shareQrTooLargeSub: (sizeKb: string) => string;
  shareCopy: string;
  shareCopied: string;
  shareNoteQr: string;
  shareNoteLink: string;
  tooltipTimeline: string;
  tooltipPrint: string;
  tooltipMore: string;
  menuExportJson: string;
  menuExportImage: string;
  menuShare: string;
  menuTimeline: string;
  menuPrint: string;
  tooltipExportJson: string;
  tooltipExportImage: string;
  tooltipReset: string;
  confirmReset: string;
  alertExportFailed: string;
  alertImageInvalidUrl: string;

  // ── FilterPanel ──
  filtersTitle: string;
  filterClear: string;
  filterLivingOnly: string;
  filterHideFemale: string;
  filterMarriageEligible: string;
  filtersOnCount: (count: number) => string;
  filterAnyLocation: string;
  labelFemale: string;
  labelMale: string;

  // ── StatsPanel ──
  statMembers: string;
  statGenerations: string;
  statYearSpan: string;
  statAvgLifespan: string;
  statYrs: string;
  sectionMembersPerGen: string;
  genLabel: (n: number) => string;
  sectionGenderDist: string;
  genderMale: (n: number) => string;
  genderFemale: (n: number) => string;
  genderUnknown: (n: number) => string;
  sectionTopLocations: string;
  sectionTopOccupations: string;
  sectionRecords: string;
  recordOldest: (name: string) => string;
  recordYoungest: (name: string) => string;
  statsFilteredNotice: (shown: number, total: number) => string;

  // ── FloatingSearch ──
  searchPlaceholder: string;
  searchExpandTooltip: string;
  searchCollapseTooltip: string;
  searchResultsHeader: (count: number, query: string) => string;
  searchAllMembersHeader: (total: number) => string;
  searchNoResults: (query: string) => string;
  searchFiltersActive: string;
  searchAdvancedFilters: string;
  genFormat: (n: number) => string;

  // ── PersonNode (TreeView) ──
  present: string;
  unknownYear: string;
  menuEdit: string;
  menuAddChild: string;
  menuAddSpouse: string;
  menuEditSpouse: string;
  tooltipSpouseChildrenAge: string;
  alertAlreadyHasSpouse: string;
  labelMarriageDate: string;
  menuDelete: string;
  confirmDeleteNode: string;
  tooltipMarriageAge: (minAge: number, age: number) => string;
  badgeMarriageEligible: (req: string) => string;

  // ── RelationshipPanel ──
  tracerTitle: string;
  tracerReset: string;
  tracerStep1: string;
  tracerStep2: string;
  tracerHops: (n: number) => string;
  tracerNoConnection: string;
  tracerHopParent: string;
  tracerHopChild: string;
  tracerHopSpouse: string;
  tracerActiveBanner: string;

  // ── Timeline ──
  tlFilterBirths: string;
  tlFilterDeaths: string;
  tlFilterMarriages: string;
  tlVerbBorn: string;
  tlVerbDied: string;
  tlVerbMarried: string;
  tlEmpty: string;
  tlEmptyHint: string;
  tlEventsShown: (n: number) => string;
  tlBirthsCount: (n: number) => string;
  tlDeathsCount: (n: number) => string;
  tlMarriagesCount: (n: number) => string;
  tlTooltipMeta: (verb: string, year: number) => string;

  // ── Layout ──
  loadingTree: string;
  errorLoadTree: string;
  printMembers: string;
  printPrinted: string;
  // ── TreeView zoom controls ──
  tooltipZoomIn: string;
  tooltipZoomOut: string;
  tooltipZoomReset: string;
  tooltipLineageFocus: string;
  tooltipFitToScreen: string;
  // ── TreeView empty / lineage banner ──
  selectTreePrompt: string;
  ariaFamilyTree: string;
  lineageBannerActive: string;
  lineageBannerInactive: string;
  lineageExit: string;
  // ── TopBar ──
  toastResetSuccess: string;
  toastUndo: string;
  toastRedo: string;
  tooltipSwitchLangToMr: string;
  tooltipSwitchLangToEn: string;
  langLabelMr: string;
  langLabelEn: string;
  avatarGroupSilhouette: string;
  avatarGroupOther: string;
  avatarStyleClassic: string;
  avatarStyleFlat: string;
  avatarStyleBold: string;
  avatarStyleInitials: string;
  avatarStyleEmoji: string;
  // ── RelationshipPanel legend ──
  legendBlood: string;
  legendMarriage: string;
  // ── Duplicate detection ──
  dupWarningTitle: (n: number) => string;
  dupHigh: string;
  dupMedium: string;
  dupHint: string;
  // ── Tour / Walkthrough ──
  tourTitle: string;
  tooltipTour: string;
  tourNext: string;
  tourBack: string;
  tourSkip: string;
  tourDone: string;
  tourStepTitles: string[];
  tourStepBodies: string[];
  // ── ThemeSwitcher ──
  tooltipThemePrefix: string;
  ariaLabelSwitchTheme: string;
  themePickerTitle: string;
  themeLight: string;
  themeDark: string;
  themeSepia: string;
  themeForest: string;
  themeOcean: string;
  themeSunset: string;
  // ── PersonNode ──
  ariaKeyboardHint: string;
  tracerSelectHint1: string;
  tracerSelectHint2: string;
  // ── FloatingSearch clear ──
  searchClear: string;
  // ── MemberFormModal date parts ──
  labelBirthDay: string;
  labelBirthMonth: string;
  labelBirthYear: string;
  labelDeathDay: string;
  labelDeathMonth: string;
  labelDeathYear: string;
  // ── Auth & login ──
  authSignIn: string;
  authSignOut: string;
  authChecking: string;
  authSignInTooltip: string;
  authFailed: string;
  loginTitle: string;
  loginSubtitle: string;
  loginGitHubHint: string;
  loginEmailOption: string;
  loginEmailHint: string;
  loginEmailTitle: string;
  loginEmailSubtitle: string;
  loginEmailPlaceholder: string;
  loginCapsLock: string;
  loginInvalid: string;
  loginGitHubOpening: string;
  loginEmail: string;
  loginPassword: string;
  loginPasswordPlaceholder: string;
  loginShowPassword: string;
  loginSigningIn: string;
  loginGitHub: string;
  loginFailed: string;
  loginGitHubFailed: string;
  loginBrowseNote: string;
  // ── Save & load messages ──
  saveSignInRequired: string;
  saveNoPermission: string;
  saveNotReady: string;
  saveFailed: (error: string) => string;
  saveConflict: string;
  saveConflictReloadFailed: (error: string) => string;
  loadFailed: (error: string) => string;
  resetAdminOnly: string;
  deleteAdminOnly: string;
  shareOpenFailed: (error: string) => string;
  shareInvalidLink: string;
  importInvalidJson: string;
  importFailed: (error: string) => string;
  importRepaired: (count: number) => string;
  importProcessFailed: string;
  // ── Member details panel ──
  detailsPanelLabel: (name: string) => string;
  detailsDiedAbbrev: string;
  detailsAge: (age: number) => string;
  detailsAgeAtDeath: (age: number) => string;
  detailsParents: string;
  detailsSpouses: string;
  detailsChildren: string;
  detailsFormerSpouse: string;
  detailsMore: string;
  detailsLess: string;
  // ── Year picker ──
  yearPrevDecade: string;
  yearNextDecade: string;
  yearToday: (year: number) => string;
  yearJumpTo: (year: number) => string;
  yearClear: string;
  // ── Photo upload ──
  photoNotImage: string;
  photoProcessFailed: string;
  photoProcessing: string;
  // ── Header ──
  viewTree: string;
  viewTrace: string;
  viewStats: string;
  headerViews: string;
  headerAddMember: string;
  headerShareTree: string;
  headerMenu: string;
  headerUndo: string;
  headerRedo: string;
  settingsTitle: string;
  settingsDisplay: string;
  settingsLanguage: string;
  settingsAvatarStyle: string;
  settingsTour: string;
  settingsAdmin: string;
  settingsResetShared: string;
  accountMenu: (name: string) => string;
  wizardSteps: string;
  wizardStepRelation: string;
  wizardStepWho: string;
  wizardStepDetails: string;
  wizardStepOf: (n: number, total: number) => string;
  wizardQRelation: string;
  wizardQWho: string;
  wizardQWhoEdit: string;
  wizardQDetails: string;
  wizardOptional: string;
  relTileChild: string;
  relTileSpouse: string;
  relTileParent: string;
  relTileNone: string;
  relSearchLabel: string;
  relNoMatches: string;
  marathiTag: string;
  marathiNotSet: string;
  marathiDone: string;
  photoAdd: string;
  photoChange: string;
  photoOptionalHint: string;
  hintYearEnough: string;
  labelLiving: string;
  labelPhotoLink: string;
  btnBack: string;
  btnNext: string;
  btnSkipAdd: string;
  btnAddNamed: (name: string) => string;
};

export const translations: Record<'en' | 'mr', Translations> = {
  en: {
    // MemberFormModal
    modalTitleEdit: 'Edit Member',
    modalTitleAddChild: 'Add Child',
    modalTitleAddSpouse: 'Add Spouse',
    modalTitleAddMember: 'Add Member',
    close: 'Close',
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    firstNameRequired: 'First name is required',
    lastNameRequired: 'Last name is required',
    invalidYear: 'Must be a valid year',
    deathBeforeBirth: 'Death year cannot be before birth year',
    sectionRelationship: 'Relationship',
    relNone: 'None',
    relChildOf: 'Child of',
    relSpouseOf: 'Spouse of',
    relParentOf: 'Parent of',
    chooseMember: '— choose a member —',
    bornAbbrev: 'b.',
    belowMarriageAge: (name, age, minAge) => `⚠️ ${name} is ${age} — below legal marriage age (${minAge}+)`,
    labelParent: 'Parent',
    labelSpouse: 'Spouse',
    labelChild: 'Child',
    sectionEnglishName: 'English Name',
    labelFirstName: 'First Name',
    placeholderFirstName: 'First name',
    labelLastName: 'Last Name',
    placeholderLastName: 'Last name',
    sectionMarathiName: 'Marathi Name (optional)',
    labelFirstNameMr: 'First Name (मराठी)',
    labelLastNameMr: 'Last Name (मराठी)',
    labelGender: 'Gender',
    optionMale: 'Male',
    optionFemale: 'Female',
    optionUnknown: 'Unknown',
    labelPrimary: 'Primary member in tree',
    sectionDates: 'Dates',
    hintDates: 'Full date stored · only year shown in tree',
    labelBirth: 'Birth',
    labelDeath: 'Death',
    hintDeathBlank: 'Leave blank if living',
    labelDay: 'Day',
    labelMonth: 'Month',
    labelYear: 'Year',
    sectionDetails: 'Details',
    labelOccupation: 'Occupation',
    placeholderOccupation: 'e.g. Farmer, Teacher',
    labelLocation: 'Location',
    placeholderLocation: 'City / Region / Country',
    labelPhoto: 'Photo',
    removePhoto: 'Remove photo',
    uploadPhoto: '📁 Upload from device',
    pasteUrl: 'or paste a URL',
    placeholderUrl: 'https://example.com/photo.jpg',
    labelNotes: 'Notes',
    placeholderNotes: 'Any additional notes...',
    sectionMarriageHistory: 'Marriage History',
    marriageCount: (n) => `${n} marriage${n !== 1 ? 's' : ''}`,
    marriedYear: (y) => y ? `Married ${y}` : 'Year unknown',
    currentMarriage: '● Current',
    formerMarriage: '✕ Former',
    endMarriage: 'End marriage',
    placeholderEndYear: 'End year',
    optionDivorce: 'Divorce',
    optionDeath: 'Death',
    optionAnnulment: 'Annulment',
    optionSeparation: 'Separation',
    btnConfirm: 'Confirm',
    btnCancel: 'Cancel',
    btnSaving: 'Saving…',
    btnSaveChanges: '✓ Save Changes',
    btnDelete: 'Delete',
    btnDeleteMember: 'Delete Member',
    confirmDeleteMember: 'Delete this member?',
    btnYesDelete: 'Yes, Delete',
    // TopBar
    metaFormat: (g, m) => `${g} Generations · ${m} Members`,
    tooltipAddMember: 'Add new member to the family tree',
    tooltipUndo: 'Undo last change (Ctrl+Z)',
    tooltipUndoDisabled: 'Nothing to undo',
    tooltipRedo: 'Redo last undone change (Ctrl+Y)',
    tooltipRedoDisabled: 'Nothing to redo',
    tooltipTracer: 'Trace relationship — click two members to find their connection',
    tooltipStats: 'Toggle statistics — members, generations, gender split, locations',
    tooltipExportJson: 'Export as familyData.json — downloads a copy of all data',
    tooltipExportImage: 'Export tree as PNG image (high-res 2×)',
    tooltipAvatarStyle: 'Avatar style — choose how members are displayed',
    tooltipShare: 'Share — generate QR code link',
    shareTitle: 'Share Family Tree',
    shareNoData: 'No tree data loaded.',
    shareQrHint: 'Scan to open this family tree on any device',
    shareQrTooLargeTitle: 'Tree too large for QR code',
    shareQrTooLargeSub: (kb) => `Your tree data is ${kb} KB compressed — above the ~2.5 KB QR limit. Use the link below to share instead.`,
    shareCopy: 'Copy',
    shareCopied: '✓ Copied',
    shareNoteQr: '✓ Paste this link in any browser to open the tree',
    shareNoteLink: '💡 Tip: paste this link in any browser to open the tree',
    tooltipTimeline: 'Family Timeline',
    tooltipPrint: 'Print family tree',
    tooltipMore: 'More actions',
    menuExportJson: 'Export JSON',
    menuExportImage: 'Export PNG',
    menuShare: 'Share',
    menuTimeline: 'Timeline',
    menuPrint: 'Print',
    tooltipReset: 'Replace all shared family trees on GitHub with the original bundled data',
    confirmReset: 'Replace ALL shared family trees on GitHub with the original bundled data? This affects every user and removes changes made since that snapshot.',
    alertExportFailed: 'Export failed. Try zooming out then retry.',
    alertImageInvalidUrl: 'Invalid photo URL. Use https://, http://, or upload a file.',
    // FilterPanel
    filtersTitle: 'Filters',
    filterClear: 'Clear',
    filterLivingOnly: 'Living members only',
    filterHideFemale: 'Hide females',
    filterMarriageEligible: 'Marriage eligible',
    filtersOnCount: (count) => `${count} filter${count !== 1 ? 's' : ''} on`,
    filterAnyLocation: 'Any place',
    labelFemale: 'women',
    labelMale: 'men',
    // StatsPanel
    statMembers: 'Members',
    statGenerations: 'Generations',
    statYearSpan: 'Year Span',
    statAvgLifespan: 'Avg Lifespan',
    statYrs: 'yrs',
    sectionMembersPerGen: 'Members per Generation',
    genLabel: (n) => `G${n}`,
    sectionGenderDist: 'Gender Distribution',
    genderMale: (n) => `Male: ${n}`,
    genderFemale: (n) => `Female: ${n}`,
    genderUnknown: (n) => `Unknown: ${n}`,
    sectionTopLocations: 'Top Locations',
    sectionTopOccupations: 'Top Occupations',
    sectionRecords: 'Records',
    recordOldest: (name) => `Oldest: ${name}`,
    recordYoungest: (name) => `Youngest: ${name}`,
    statsFilteredNotice: (shown, total) => `Showing stats for ${shown} of ${total} members (filtered)`,
    // FloatingSearch
    searchPlaceholder: 'Search members…',
    searchExpandTooltip: 'Search members (press /)',
    searchCollapseTooltip: 'Close search',
    searchResultsHeader: (count, query) => `${count} result${count !== 1 ? 's' : ''} for "${query}"`,
    searchAllMembersHeader: (total) => `All members · ${total}`,
    searchNoResults: (query) => `No results for "${query}"`,
    searchFiltersActive: 'Filters active — click to edit',
    searchAdvancedFilters: 'Advanced filters',
    genFormat: (n) => `Gen ${n}`,
    // PersonNode
    present: 'Present',
    unknownYear: '?',
    menuEdit: 'Edit',
    menuAddChild: 'Add Child',
    menuAddSpouse: 'Add Spouse',
    menuEditSpouse: 'Edit Spouse',
    tooltipSpouseChildrenAge: 'Spouse options are unavailable while a son is under 21 or a daughter is under 18',
    alertAlreadyHasSpouse: 'This person already has a spouse. Edit the existing spouse instead.',
    labelMarriageDate: 'Marriage date',
    menuDelete: 'Delete',
    confirmDeleteNode: 'Delete member?',
    tooltipMarriageAge: (minAge, age) => `Legal marriage age: ${minAge}+ years (current age: ${age})`,
    badgeMarriageEligible: (req) => `Marriage eligible · ${req}`,
    // RelationshipPanel
    tracerTitle: 'Relationship Tracer',
    tracerReset: 'Reset',
    tracerStep1: 'Click or search for a person',
    tracerStep2: 'Click or search for another person',
    tracerHops: (n) => `${n} hop${n !== 1 ? 's' : ''} apart`,
    tracerNoConnection: 'No connection found between these members',
    tracerHopParent: 'Parent ↑',
    tracerHopChild: 'Child ↓',
    tracerHopSpouse: 'Marriage ♥',
    tracerActiveBanner: '🔗 Relationship Tracer active — click or search for two people to find their connection',
    tlFilterBirths: 'Births',
    tlFilterDeaths: 'Deaths',
    tlFilterMarriages: 'Marriages',
    tlVerbBorn: 'Born',
    tlVerbDied: 'Died',
    tlVerbMarried: 'Married',
    tlEmpty: 'No events to display.',
    tlEmptyHint: 'Add birth years, death years, or marriage years to see them here.',
    tlEventsShown: (n) => `${n} event${n !== 1 ? 's' : ''} shown`,
    tlBirthsCount: (n) => `${n} birth${n !== 1 ? 's' : ''}`,
    tlDeathsCount: (n) => `${n} death${n !== 1 ? 's' : ''}`,
    tlMarriagesCount: (n) => `${n} marriage${n !== 1 ? 's' : ''}`,
    tlTooltipMeta: (verb, year) => `${verb} in ${year}`,
    // Layout
    loadingTree: 'Loading family tree data...',
    errorLoadTree: 'Failed to load family tree data',
    printMembers: 'members',
    printPrinted: 'Printed',
    // TreeView zoom controls
    tooltipZoomIn: 'Zoom in',
    tooltipZoomOut: 'Zoom out',
    tooltipZoomReset: 'Reset zoom to 100%',
    tooltipLineageFocus: 'Lineage Focus — click a member to highlight their direct line',
    tooltipFitToScreen: 'Fit entire tree to screen',
    // TreeView empty / lineage banner
    selectTreePrompt: 'Select a family tree to view',
    ariaFamilyTree: 'Family tree',
    lineageBannerActive: 'Lineage Focus — showing direct ancestors, descendants & spouses',
    lineageBannerInactive: 'Lineage Focus — click any member to highlight their direct line',
    lineageExit: 'Exit lineage focus',
    // TopBar
    toastResetSuccess: 'Family tree reset to original data.',
    toastUndo: 'Change undone',
    toastRedo: 'Change redone',
    tooltipSwitchLangToMr: 'Switch to Marathi',
    tooltipSwitchLangToEn: 'Switch to English',
    langLabelMr: 'मराठी',
    langLabelEn: 'EN',
    avatarGroupSilhouette: 'Silhouette',
    avatarGroupOther: 'Other',
    avatarStyleClassic: 'Classic',
    avatarStyleFlat: 'Flat',
    avatarStyleBold: 'Bold',
    avatarStyleInitials: 'Initials',
    avatarStyleEmoji: 'Emoji',
    // RelationshipPanel legend
    legendBlood: 'Blood',
    legendMarriage: 'Marriage',
    // Duplicate detection
    dupWarningTitle: (n) => `${n} possible duplicate${n !== 1 ? 's' : ''} found`,
    dupHigh: 'Strong match',
    dupMedium: 'Possible match',
    dupHint: 'These look similar — add anyway?',
    // Tour / Walkthrough
    tourTitle: 'Feature Tour',
    tooltipTour: 'Take a guided tour of the features',
    tourNext: 'Next →',
    tourBack: '← Back',
    tourSkip: 'Skip tour',
    tourDone: 'Done ✓',
    tourStepTitles: [
      'Welcome to Family Tree 🌳',   //  0: welcome
      'Add a Family Member',          //  1: add member
      'Person Nodes',                 //  2: person node
      'Search & Filter',              //  3: search
      'Relationship Tracer',          //  4: trace
      'Zoom & Navigation',            //  5: zoom
    ],
    tourStepBodies: [
      'This quick tour covers the essentials — you can re-run it anytime from the ? button.',
      'Click here to add someone new — enter their name, dates, photo, and relationship to others.',
      'Each circle shows a person\'s name and birth/death years, colour-coded by age group. Click to select; right-arrow opens the menu.',
      'Search by name or use advanced filters to narrow by gender, location, or occupation.',
      'Click two people to instantly see how they are related — cousins, great-aunts, and more — in English or Marathi.',
      'Zoom with the buttons or scroll wheel. Drag or swipe with one finger to pan; pinch to zoom on touch. Hit Fit to see the whole tree.',
    ],
    // ThemeSwitcher
    tooltipThemePrefix: 'Theme',
    ariaLabelSwitchTheme: 'Switch theme',
    themePickerTitle: 'Choose Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSepia: 'Sepia',
    themeForest: 'Forest',
    themeOcean: 'Ocean',
    themeSunset: 'Sunset',
    // PersonNode
    ariaKeyboardHint: 'Press Enter to select, ArrowRight to open menu, Arrow keys to navigate.',
    tracerSelectHint1: 'Click to select as Person 1',
    tracerSelectHint2: 'Click to select as Person 2',
    // FloatingSearch clear
    searchClear: 'Clear search',
    // MemberFormModal date parts
    labelBirthDay: 'Birth day',
    labelBirthMonth: 'Birth month',
    labelBirthYear: 'Birth year',
    labelDeathDay: 'Death day',
    labelDeathMonth: 'Death month',
    labelDeathYear: 'Death year',
    // Auth & login
    authSignIn: 'Sign in',
    authSignOut: 'Sign out',
    authChecking: 'Checking…',
    authSignInTooltip: 'Sign in to edit and save family data',
    authFailed: 'Authentication failed.',
    loginTitle: 'Sign in to edit',
    loginSubtitle: 'Approved family editors can add and update members.',
    loginGitHubHint: 'One tap if you use GitHub',
    loginEmailOption: 'Continue with email',
    loginEmailHint: 'Use your email and password',
    loginEmailTitle: 'Sign in with email',
    loginEmailSubtitle: 'Enter the email your family admin approved.',
    loginEmailPlaceholder: 'name@email.com',
    loginCapsLock: 'Caps Lock is on',
    loginInvalid: 'Email or password is incorrect. Try again.',
    loginGitHubOpening: 'Opening GitHub…',
    loginEmail: 'Email',
    loginPassword: 'Password',
    loginPasswordPlaceholder: 'Enter your password',
    loginShowPassword: 'Show password',
    loginSigningIn: 'Signing in…',
    loginGitHub: 'Continue with GitHub',
    loginFailed: 'Sign in failed.',
    loginGitHubFailed: 'GitHub sign in failed.',
    loginBrowseNote: 'Just looking? You can browse without an account.',
    // Save & load messages
    saveSignInRequired: 'Sign in before changing family data.',
    saveNoPermission: 'You do not have permission to change this family data.',
    saveNotReady: 'Family data is not ready to save. Reload the latest data and try again.',
    saveFailed: (error) => `Family data was not saved: ${error}`,
    saveConflict: 'Another user saved changes first. The latest data has been loaded; please reapply your change.',
    saveConflictReloadFailed: (error) => `Save conflict detected, and the latest data could not be loaded: ${error}`,
    loadFailed: (error) => `Could not load the latest family data: ${error}`,
    resetAdminOnly: 'Only an administrator can reset shared family data.',
    deleteAdminOnly: 'Only an administrator can delete family members.',
    shareOpenFailed: (error) => `Could not open shared tree: ${error}`,
    shareInvalidLink: 'Could not open shared tree: the link is invalid.',
    importInvalidJson: 'Import failed — the file is not valid JSON.',
    importFailed: (error) => `Import failed — ${error}`,
    importRepaired: (count) => `Imported data includes ${count} repaired item(s); the save is in progress.`,
    importProcessFailed: 'Import failed — the data could not be processed.',
    // Member details panel
    detailsPanelLabel: (name) => `Details for ${name}`,
    detailsDiedAbbrev: 'd.',
    detailsAge: (age) => `${age} yrs`,
    detailsAgeAtDeath: (age) => `aged ${age}`,
    detailsParents: 'Parents',
    detailsSpouses: 'Spouses',
    detailsChildren: 'Children',
    detailsFormerSpouse: 'former',
    detailsMore: 'More',
    detailsLess: 'Less',
    // Year picker
    yearPrevDecade: 'Previous decade',
    yearNextDecade: 'Next decade',
    yearToday: (year) => `Today (${year})`,
    yearJumpTo: (year) => `Jump to ${year}`,
    yearClear: 'Clear',
    // Photo upload
    photoNotImage: 'Choose an image file.',
    photoProcessFailed: 'This image could not be processed. Try another file.',
    photoProcessing: 'Processing photo…',
    // Header
    viewTree: 'Tree',
    viewTrace: 'Trace',
    viewStats: 'Statistics',
    headerViews: 'Views',
    headerAddMember: 'Add member',
    headerShareTree: 'Share tree',
    headerMenu: 'Menu',
    headerUndo: 'Undo',
    headerRedo: 'Redo',
    settingsTitle: 'Settings',
    settingsDisplay: 'Display',
    settingsLanguage: 'Language',
    settingsAvatarStyle: 'Avatar style',
    settingsTour: 'Take the tour',
    settingsAdmin: 'Admin',
    settingsResetShared: 'Reset shared data…',
    accountMenu: (name) => `Account and settings for ${name}`,
    wizardSteps: 'Steps',
    wizardStepRelation: 'Relationship',
    wizardStepWho: 'Who',
    wizardStepDetails: 'Dates & details',
    wizardStepOf: (n, total) => `Step ${n} of ${total}`,
    wizardQRelation: 'How are they related?',
    wizardQWho: 'Who are you adding?',
    wizardQWhoEdit: 'Name and gender',
    wizardQDetails: 'A few more details',
    wizardOptional: '(all optional)',
    relTileChild: 'Child',
    relTileSpouse: 'Spouse',
    relTileParent: 'Parent',
    relTileNone: 'Not linked',
    relSearchLabel: 'Search by name',
    relNoMatches: 'No matching members',
    marathiTag: 'मराठी',
    marathiNotSet: 'Not added yet',
    marathiDone: 'Done',
    photoAdd: 'Add photo',
    photoChange: 'Change photo',
    photoOptionalHint: 'A photo is optional. Tap the circle to add one.',
    hintYearEnough: 'year is enough',
    labelLiving: 'Living',
    labelPhotoLink: 'Photo link',
    btnBack: 'Back',
    btnNext: 'Next',
    btnSkipAdd: 'Skip & add',
    btnAddNamed: (name) => `Add ${name}`,
  },

  mr: {
    // MemberFormModal
    modalTitleEdit: 'सदस्य संपादित करा',
    modalTitleAddChild: 'मूल जोडा',
    modalTitleAddSpouse: 'जोडीदार जोडा',
    modalTitleAddMember: 'सदस्य जोडा',
    close: 'बंद करा',
    months: ['जानेवारी','फेब्रुवारी','मार्च','एप्रिल','मे','जून','जुलै','ऑगस्ट','सप्टेंबर','ऑक्टोबर','नोव्हेंबर','डिसेंबर'],
    firstNameRequired: 'पहिले नाव आवश्यक आहे',
    lastNameRequired: 'आडनाव आवश्यक आहे',
    invalidYear: 'वैध वर्ष असणे आवश्यक आहे',
    deathBeforeBirth: 'मृत्यू वर्ष जन्म वर्षापूर्वी असू शकत नाही',
    sectionRelationship: 'नाते',
    relNone: 'काहीही नाही',
    relChildOf: 'यांचे मूल',
    relSpouseOf: 'यांचा जोडीदार',
    relParentOf: 'यांचे पालक',
    chooseMember: '— सदस्य निवडा —',
    bornAbbrev: 'ज.',
    belowMarriageAge: (name, age, minAge) => `⚠️ ${name} चे वय ${age} आहे — कायदेशीर विवाह वयापेक्षा कमी (${minAge}+)`,
    labelParent: 'पालक',
    labelSpouse: 'जोडीदार',
    labelChild: 'मूल',
    sectionEnglishName: 'इंग्रजी नाव',
    labelFirstName: 'पहिले नाव',
    placeholderFirstName: 'पहिले नाव',
    labelLastName: 'आडनाव',
    placeholderLastName: 'आडनाव',
    sectionMarathiName: 'मराठी नाव (पर्यायी)',
    labelFirstNameMr: 'पहिले नाव (मराठी)',
    labelLastNameMr: 'आडनाव (मराठी)',
    labelGender: 'लिंग',
    optionMale: 'पुरुष',
    optionFemale: 'महिला',
    optionUnknown: 'अज्ञात',
    labelPrimary: 'झाडातील प्राथमिक सदस्य',
    sectionDates: 'तारखा',
    hintDates: 'संपूर्ण तारीख साठवली · फक्त वर्ष दाखवले',
    labelBirth: 'जन्म',
    labelDeath: 'मृत्यू',
    hintDeathBlank: 'जिवंत असल्यास रिकामे सोडा',
    labelDay: 'दिवस',
    labelMonth: 'महिना',
    labelYear: 'वर्ष',
    sectionDetails: 'तपशील',
    labelOccupation: 'व्यवसाय',
    placeholderOccupation: 'उदा. शेतकरी, शिक्षक',
    labelLocation: 'स्थान',
    placeholderLocation: 'शहर / प्रदेश / देश',
    labelPhoto: 'फोटो',
    removePhoto: 'फोटो काढा',
    uploadPhoto: '📁 डिव्हाइसवरून अपलोड करा',
    pasteUrl: 'किंवा URL पेस्ट करा',
    placeholderUrl: 'https://example.com/photo.jpg',
    labelNotes: 'टिपणी',
    placeholderNotes: 'कोणत्याही अतिरिक्त टिपणी...',
    sectionMarriageHistory: 'विवाह इतिहास',
    marriageCount: (n) => n === 1 ? '१ विवाह' : `${n} विवाह`,
    marriedYear: (y) => y ? `विवाह ${y}` : 'वर्ष अज्ञात',
    currentMarriage: '● सध्याचे',
    formerMarriage: '✕ माजी',
    endMarriage: 'विवाह संपवा',
    placeholderEndYear: 'शेवट वर्ष',
    optionDivorce: 'घटस्फोट',
    optionDeath: 'मृत्यू',
    optionAnnulment: 'रद्दीकरण',
    optionSeparation: 'विभक्त',
    btnConfirm: 'पुष्टी करा',
    btnCancel: 'रद्द करा',
    btnSaving: 'जतन होत आहे…',
    btnSaveChanges: '✓ बदल जतन करा',
    btnDelete: 'हटवा',
    btnDeleteMember: 'सदस्य हटवा',
    confirmDeleteMember: 'हा सदस्य हटवायचे?',
    btnYesDelete: 'हो, हटवा',
    // TopBar
    metaFormat: (g, m) => `${g} पिढ्या · ${m} सदस्य`,
    tooltipAddMember: 'कुटुंब वृक्षात नवीन सदस्य जोडा',
    tooltipUndo: 'शेवटचा बदल पूर्ववत करा (Ctrl+Z)',
    tooltipUndoDisabled: 'पूर्ववत करण्यासारखे काही नाही',
    tooltipRedo: 'पुन्हा करा (Ctrl+Y)',
    tooltipRedoDisabled: 'पुन्हा करण्यासारखे काही नाही',
    tooltipTracer: 'नाते शोधा — दोन सदस्यांवर क्लिक करा',
    tooltipStats: 'आकडेवारी दाखवा/लपवा',
    tooltipExportJson: 'familyData.json म्हणून निर्यात करा',
    tooltipExportImage: 'वृक्ष PNG प्रतिमा म्हणून निर्यात करा',
    tooltipAvatarStyle: 'अवतार शैली — सदस्य कसे दाखवायचे ते निवडा',
    tooltipShare: 'शेअर करा — QR कोड लिंक तयार करा',
    shareTitle: 'कुटुंब वृक्ष शेअर करा',
    shareNoData: 'कोणताही वृक्ष डेटा लोड केलेला नाही.',
    shareQrHint: 'कोणत्याही डिव्हाइसवर हा कुटुंब वृक्ष उघडण्यासाठी स्कॅन करा',
    shareQrTooLargeTitle: 'वृक्ष QR कोडसाठी खूप मोठा आहे',
    shareQrTooLargeSub: (kb) => `तुमचा वृक्ष डेटा ${kb} KB संकुचित आहे — ~2.5 KB QR मर्यादेपेक्षा जास्त. त्याऐवजी खालील लिंक वापरून शेअर करा.`,
    shareCopy: 'कॉपी करा',
    shareCopied: '✓ कॉपी केले',
    shareNoteQr: '✓ ही लिंक कोणत्याही ब्राउझरमध्ये पेस्ट करा',
    shareNoteLink: '💡 टीप: ही लिंक कोणत्याही ब्राउझरमध्ये पेस्ट करा',
    tooltipTimeline: 'कौटुंबिक टाइमलाइन',
    tooltipPrint: 'कुटुंब वृक्ष प्रिंट करा',
    tooltipMore: 'अधिक क्रिया',
    menuExportJson: 'JSON निर्यात',
    menuExportImage: 'PNG निर्यात',
    menuShare: 'शेअर करा',
    menuTimeline: 'टाइमलाइन',
    menuPrint: 'प्रिंट',
    tooltipReset: 'GitHub वरील सर्व सामायिक कुटुंब वृक्ष मूळ डेटाने बदला',
    confirmReset: 'GitHub वरील सर्व सामायिक कुटुंब वृक्ष मूळ डेटाने बदलायचे? याचा सर्व वापरकर्त्यांवर परिणाम होईल आणि मूळ डेटानंतरचे बदल हटवले जातील.',
    alertExportFailed: 'निर्यात अयशस्वी. झूम आउट करून पुन्हा प्रयत्न करा.',
    alertImageInvalidUrl: 'अवैध फोटो URL. https://, http:// वापरा किंवा फाइल अपलोड करा.',
    // FilterPanel
    filtersTitle: 'फिल्टर',
    filterClear: 'साफ करा',
    filterLivingOnly: 'फक्त जिवंत सदस्य',
    filterHideFemale: 'महिला लपवा',
    filterMarriageEligible: 'विवाहयोग्य',
    filtersOnCount: (count) => `${count} फिल्टर सुरू`,
    filterAnyLocation: 'कोणतेही ठिकाण',
    labelFemale: 'महिला',
    labelMale: 'पुरुष',
    // StatsPanel
    statMembers: 'सदस्य',
    statGenerations: 'पिढ्या',
    statYearSpan: 'वर्ष कालावधी',
    statAvgLifespan: 'सरासरी आयुष्य',
    statYrs: 'वर्षे',
    sectionMembersPerGen: 'प्रति पिढी सदस्य',
    genLabel: (n) => `पिढी ${n}`,
    sectionGenderDist: 'लिंग वितरण',
    genderMale: (n) => `पुरुष: ${n}`,
    genderFemale: (n) => `महिला: ${n}`,
    genderUnknown: (n) => `अज्ञात: ${n}`,
    sectionTopLocations: 'मुख्य स्थाने',
    sectionTopOccupations: 'मुख्य व्यवसाय',
    sectionRecords: 'नोंदी',
    recordOldest: (name) => `सर्वात जुने: ${name}`,
    recordYoungest: (name) => `सर्वात लहान: ${name}`,
    statsFilteredNotice: (shown, total) => `${total} पैकी ${shown} सदस्यांचे आकडे दाखवत आहे (फिल्टर केलेले)`,
    // FloatingSearch
    searchPlaceholder: 'सदस्य शोधा…',
    searchExpandTooltip: 'सदस्य शोधा (/ दाबा)',
    searchCollapseTooltip: 'शोध बंद करा',
    searchResultsHeader: (count, query) => `"${query}" साठी ${count} निकाल`,
    searchAllMembersHeader: (total) => `सर्व सदस्य · ${total}`,
    searchNoResults: (query) => `"${query}" साठी कोणताही निकाल नाही`,
    searchFiltersActive: 'फिल्टर सक्रिय — संपादनासाठी क्लिक करा',
    searchAdvancedFilters: 'प्रगत फिल्टर',
    genFormat: (n) => `पिढी ${n}`,
    // PersonNode
    present: 'सध्या',
    unknownYear: '?',
    menuEdit: 'संपादित करा',
    menuAddChild: 'मूल जोडा',
    menuAddSpouse: 'जोडीदार जोडा',
    menuEditSpouse: 'जोडीदार संपादित करा',
    tooltipSpouseChildrenAge: 'मुलगा 21 वर्षांखालील किंवा मुलगी 18 वर्षांखालील असताना जोडीदार पर्याय उपलब्ध नाहीत',
    alertAlreadyHasSpouse: 'या व्यक्तीला आधीच जोडीदार आहे. कृपया विद्यमान जोडीदार संपादित करा.',
    labelMarriageDate: 'विवाह तारीख',
    menuDelete: 'हटवा',
    confirmDeleteNode: 'सदस्य हटवायचे?',
    tooltipMarriageAge: (minAge, age) => `कायदेशीर विवाह वय: ${minAge}+ वर्षे (सध्याचे वय: ${age})`,
    badgeMarriageEligible: (req) => `विवाहयोग्य · ${req}`,
    // RelationshipPanel
    tracerTitle: 'नाते शोधक',
    tracerReset: 'रीसेट',
    tracerStep1: 'व्यक्तीवर क्लिक करा किंवा शोधा',
    tracerStep2: 'दुसऱ्या व्यक्तीवर क्लिक करा किंवा शोधा',
    tracerHops: (n) => `${n} स्तर दूर`,
    tracerNoConnection: 'या सदस्यांमध्ये कोणताही संबंध आढळला नाही',
    tracerHopParent: 'पालक ↑',
    tracerHopChild: 'मूल ↓',
    tracerHopSpouse: 'विवाह ♥',
    tracerActiveBanner: '🔗 नाते शोधक सक्रिय — संबंध शोधण्यासाठी दोन व्यक्तींवर क्लिक करा किंवा त्यांना शोधा',
    tlFilterBirths: 'जन्म',
    tlFilterDeaths: 'मृत्यू',
    tlFilterMarriages: 'विवाह',
    tlVerbBorn: 'जन्म झाला',
    tlVerbDied: 'निधन झाले',
    tlVerbMarried: 'विवाह झाला',
    tlEmpty: 'दाखवण्यासाठी कोणतेही कार्यक्रम नाहीत.',
    tlEmptyHint: 'येथे पाहण्यासाठी जन्म वर्षे, मृत्यू वर्षे किंवा विवाह वर्षे जोडा.',
    tlEventsShown: (n) => `${n} कार्यक्रम दाखवले`,
    tlBirthsCount: (n) => `${n} जन्म`,
    tlDeathsCount: (n) => `${n} मृत्यू`,
    tlMarriagesCount: (n) => `${n} विवाह`,
    tlTooltipMeta: (verb, year) => `${year} मध्ये ${verb}`,
    // Layout
    loadingTree: 'कुटुंब वृक्ष डेटा लोड होत आहे...',
    errorLoadTree: 'कुटुंब वृक्ष डेटा लोड करण्यात अयशस्वी',
    printMembers: 'सदस्य',
    printPrinted: 'मुद्रित',
    // TreeView zoom controls
    tooltipZoomIn: 'झूम इन',
    tooltipZoomOut: 'झूम आउट',
    tooltipZoomReset: 'झूम १००% वर रीसेट करा',
    tooltipLineageFocus: 'वंश फोकस — थेट रेषा दाखवण्यासाठी सदस्यावर क्लिक करा',
    tooltipFitToScreen: 'संपूर्ण वृक्ष स्क्रीनवर बसवा',
    // TreeView empty / lineage banner
    selectTreePrompt: 'पाहण्यासाठी कुटुंब वृक्ष निवडा',
    ariaFamilyTree: 'कुटुंब वृक्ष',
    lineageBannerActive: 'वंश फोकस — थेट पूर्वज, वंशज आणि जोडीदार दाखवत आहे',
    lineageBannerInactive: 'वंश फोकस — थेट रेषा दाखवण्यासाठी कोणत्याही सदस्यावर क्लिक करा',
    lineageExit: 'वंश फोकस बाहेर पडा',
    // TopBar
    toastResetSuccess: 'कुटुंब वृक्ष मूळ डेटावर रीसेट केला.',
    toastUndo: 'बदल पूर्ववत केला',
    toastRedo: 'बदल पुन्हा केला',
    tooltipSwitchLangToMr: 'मराठीत बदला',
    tooltipSwitchLangToEn: 'इंग्रजीत बदला',
    langLabelMr: 'मराठी',
    langLabelEn: 'EN',
    avatarGroupSilhouette: 'सिल्हूट',
    avatarGroupOther: 'इतर',
    avatarStyleClassic: 'क्लासिक',
    avatarStyleFlat: 'फ्लॅट',
    avatarStyleBold: 'बोल्ड',
    avatarStyleInitials: 'आद्याक्षरे',
    avatarStyleEmoji: 'इमोजी',
    // RelationshipPanel legend
    legendBlood: 'रक्त',
    legendMarriage: 'विवाह',
    // Duplicate detection
    dupWarningTitle: (n) => `${n} संभाव्य डुप्लिकेट आढळले`,
    dupHigh: 'जुळणारे',
    dupMedium: 'शक्यतो जुळणारे',
    dupHint: 'हे समान वाटतात — तरीही जोडायचे?',
    // Tour / Walkthrough
    tourTitle: 'वैशिष्ट्ये दौरा',
    tooltipTour: 'वैशिष्ट्यांचा मार्गदर्शित दौरा घ्या',
    tourNext: 'पुढे →',
    tourBack: '← मागे',
    tourSkip: 'दौरा वगळा',
    tourDone: 'पूर्ण ✓',
    tourStepTitles: [
      'कुटुंब वृक्षात स्वागत 🌳',   //  0: welcome
      'कुटुंब सदस्य जोडा',           //  1: add member
      'व्यक्ती नोड्स',                //  2: person node
      'शोध आणि फिल्टर',               //  3: search
      'नाते शोधक',                    //  4: trace
      'झूम आणि नेव्हिगेशन',           //  5: zoom
    ],
    tourStepBodies: [
      'हा जलद दौरा मुख्य वैशिष्ट्ये दाखवतो — ? बटणाद्वारे कधीही पुन्हा चालवा.',
      'नवीन सदस्य जोडण्यासाठी येथे क्लिक करा — नाव, तारखा, फोटो आणि इतरांशी नाते प्रविष्ट करा.',
      'प्रत्येक वर्तुळ व्यक्तीचे नाव आणि जन्म/मृत्यू वर्षे दाखवते, वयोगटानुसार रंगीत. निवडण्यासाठी क्लिक करा.',
      'नावाने शोधा किंवा लिंग, स्थान किंवा व्यवसायानुसार सदस्य शोधण्यासाठी प्रगत फिल्टर वापरा.',
      'दोन व्यक्तींवर क्लिक करा आणि ते कसे संबंधित आहेत ते पाहा — चुलत भाऊ, आत्या — इंग्रजी किंवा मराठीत.',
      'बटणांनी किंवा स्क्रोल व्हीलने झूम करा. एका बोटाने पान करा; टचवर पिंच करून झूम करा. संपूर्ण वृक्ष पाहण्यासाठी Fit वापरा.',
    ],
    // ThemeSwitcher
    tooltipThemePrefix: 'थीम',
    ariaLabelSwitchTheme: 'थीम बदला',
    themePickerTitle: 'थीम निवडा',
    themeLight: 'उजळ',
    themeDark: 'गडद',
    themeSepia: 'सेपिया',
    themeForest: 'जंगल',
    themeOcean: 'समुद्र',
    themeSunset: 'सूर्यास्त',
    // PersonNode
    ariaKeyboardHint: 'निवडण्यासाठी Enter दाबा, मेनू उघडण्यासाठी ArrowRight दाबा, नेव्हिगेट करण्यासाठी Arrow keys वापरा.',
    tracerSelectHint1: 'व्यक्ती १ म्हणून निवडण्यासाठी क्लिक करा',
    tracerSelectHint2: 'व्यक्ती २ म्हणून निवडण्यासाठी क्लिक करा',
    // FloatingSearch clear
    searchClear: 'शोध साफ करा',
    // MemberFormModal date parts
    labelBirthDay: 'जन्म दिवस',
    labelBirthMonth: 'जन्म महिना',
    labelBirthYear: 'जन्म वर्ष',
    labelDeathDay: 'मृत्यू दिवस',
    labelDeathMonth: 'मृत्यू महिना',
    labelDeathYear: 'मृत्यू वर्ष',
    // Auth & login
    authSignIn: 'साइन इन',
    authSignOut: 'साइन आउट',
    authChecking: 'तपासत आहे…',
    authSignInTooltip: 'कौटुंबिक माहिती संपादित व जतन करण्यासाठी साइन इन करा',
    authFailed: 'प्रमाणीकरण अयशस्वी.',
    loginTitle: 'संपादनासाठी साइन इन करा',
    loginSubtitle: 'मान्यताप्राप्त कौटुंबिक संपादक सदस्य जोडू व अद्ययावत करू शकतात.',
    loginGitHubHint: 'GitHub वापरत असल्यास एका टॅपमध्ये',
    loginEmailOption: 'ईमेलने पुढे जा',
    loginEmailHint: 'तुमचा ईमेल व पासवर्ड वापरा',
    loginEmailTitle: 'ईमेलने साइन इन करा',
    loginEmailSubtitle: 'कुटुंब प्रशासकाने मान्य केलेला ईमेल टाका.',
    loginEmailPlaceholder: 'name@email.com',
    loginCapsLock: 'Caps Lock चालू आहे',
    loginInvalid: 'ईमेल किंवा पासवर्ड चुकीचा आहे. पुन्हा प्रयत्न करा.',
    loginGitHubOpening: 'GitHub उघडत आहे…',
    loginEmail: 'ईमेल',
    loginPassword: 'पासवर्ड',
    loginPasswordPlaceholder: 'तुमचा पासवर्ड टाका',
    loginShowPassword: 'पासवर्ड दाखवा',
    loginSigningIn: 'साइन इन होत आहे…',
    loginGitHub: 'GitHub ने पुढे जा',
    loginFailed: 'साइन इन अयशस्वी.',
    loginGitHubFailed: 'GitHub साइन इन अयशस्वी.',
    loginBrowseNote: 'फक्त पाहत आहात? खात्याशिवाय कुटुंब वृक्ष पाहू शकता.',
    // Save & load messages
    saveSignInRequired: 'कौटुंबिक माहिती बदलण्यापूर्वी साइन इन करा.',
    saveNoPermission: 'ही कौटुंबिक माहिती बदलण्याची तुम्हाला परवानगी नाही.',
    saveNotReady: 'माहिती जतन करण्यास तयार नाही. नवीनतम माहिती पुन्हा लोड करून प्रयत्न करा.',
    saveFailed: (error) => `कौटुंबिक माहिती जतन झाली नाही: ${error}`,
    saveConflict: 'दुसऱ्या वापरकर्त्याने आधी बदल जतन केले. नवीनतम माहिती लोड केली आहे; कृपया तुमचा बदल पुन्हा करा.',
    saveConflictReloadFailed: (error) => `जतन करताना संघर्ष झाला आणि नवीनतम माहिती लोड झाली नाही: ${error}`,
    loadFailed: (error) => `नवीनतम कौटुंबिक माहिती लोड झाली नाही: ${error}`,
    resetAdminOnly: 'सामायिक माहिती फक्त प्रशासक रीसेट करू शकतो.',
    deleteAdminOnly: 'कुटुंबातील सदस्य फक्त प्रशासक हटवू शकतो.',
    shareOpenFailed: (error) => `शेअर केलेला वृक्ष उघडता आला नाही: ${error}`,
    shareInvalidLink: 'शेअर केलेला वृक्ष उघडता आला नाही: लिंक अवैध आहे.',
    importInvalidJson: 'आयात अयशस्वी — फाइल वैध JSON नाही.',
    importFailed: (error) => `आयात अयशस्वी — ${error}`,
    importRepaired: (count) => `आयात केलेल्या माहितीत ${count} दुरुस्त्या केल्या; जतन सुरू आहे.`,
    importProcessFailed: 'आयात अयशस्वी — माहितीवर प्रक्रिया करता आली नाही.',
    // Member details panel
    detailsPanelLabel: (name) => `${name} यांची माहिती`,
    detailsDiedAbbrev: 'मृ.',
    detailsAge: (age) => `${age} वर्षे`,
    detailsAgeAtDeath: (age) => `वय ${age}`,
    detailsParents: 'पालक',
    detailsSpouses: 'जोडीदार',
    detailsChildren: 'मुले',
    detailsFormerSpouse: 'पूर्वीचे',
    detailsMore: 'अधिक',
    detailsLess: 'कमी',
    // Year picker
    yearPrevDecade: 'मागील दशक',
    yearNextDecade: 'पुढील दशक',
    yearToday: (year) => `आज (${year})`,
    yearJumpTo: (year) => `${year} वर जा`,
    yearClear: 'साफ करा',
    // Photo upload
    photoNotImage: 'प्रतिमा फाइल निवडा.',
    photoProcessFailed: 'या प्रतिमेवर प्रक्रिया करता आली नाही. दुसरी फाइल वापरा.',
    photoProcessing: 'फोटोवर प्रक्रिया होत आहे…',
    // Header
    viewTree: 'वृक्ष',
    viewTrace: 'नाते शोधा',
    viewStats: 'आकडेवारी',
    headerViews: 'दृश्ये',
    headerAddMember: 'सदस्य जोडा',
    headerShareTree: 'वृक्ष शेअर करा',
    headerMenu: 'मेनू',
    headerUndo: 'पूर्ववत',
    headerRedo: 'पुन्हा करा',
    settingsTitle: 'सेटिंग्ज',
    settingsDisplay: 'प्रदर्शन',
    settingsLanguage: 'भाषा',
    settingsAvatarStyle: 'अवतार शैली',
    settingsTour: 'दौरा सुरू करा',
    settingsAdmin: 'प्रशासक',
    settingsResetShared: 'सामायिक माहिती रीसेट करा…',
    accountMenu: (name) => `${name} यांचे खाते आणि सेटिंग्ज`,
    wizardSteps: 'पायऱ्या',
    wizardStepRelation: 'नाते',
    wizardStepWho: 'कोण',
    wizardStepDetails: 'तारखा व तपशील',
    wizardStepOf: (n, total) => `पायरी ${n} / ${total}`,
    wizardQRelation: 'त्यांचे नाते काय आहे?',
    wizardQWho: 'तुम्ही कोणाला जोडत आहात?',
    wizardQWhoEdit: 'नाव आणि लिंग',
    wizardQDetails: 'आणखी काही तपशील',
    wizardOptional: '(सर्व पर्यायी)',
    relTileChild: 'मूल',
    relTileSpouse: 'जोडीदार',
    relTileParent: 'पालक',
    relTileNone: 'नाते नाही',
    relSearchLabel: 'नावाने शोधा',
    relNoMatches: 'जुळणारे सदस्य नाहीत',
    marathiTag: 'मराठी',
    marathiNotSet: 'अद्याप जोडलेले नाही',
    marathiDone: 'झाले',
    photoAdd: 'फोटो जोडा',
    photoChange: 'फोटो बदला',
    photoOptionalHint: 'फोटो पर्यायी आहे. जोडण्यासाठी वर्तुळावर टॅप करा.',
    hintYearEnough: 'फक्त वर्ष पुरेसे',
    labelLiving: 'हयात',
    labelPhotoLink: 'फोटो लिंक',
    btnBack: 'मागे',
    btnNext: 'पुढे',
    btnSkipAdd: 'वगळा व जोडा',
    btnAddNamed: (name) => `${name} जोडा`,
  },
};
