import { findRelationshipPath, computeRelationship } from './relationshipFinder';
import { StyledFamilyMember, StyledRelationships } from '../types/FamilyTypes';

// ─── Minimal test fixtures ───

const m = (id: string, gender: 'male' | 'female' | 'unknown' = 'unknown'): StyledFamilyMember =>
  ({ id, gender, parentIds: [], childrenIds: [], spouseIds: [] } as unknown as StyledFamilyMember);

const emptyRels = (): StyledRelationships => ({ spouses: [], parentChild: [] });

const parentChildRels = (pairs: [string, string][]): StyledRelationships => ({
  spouses: [],
  parentChild: pairs.map(([parentId, childId]) => ({ parentId, childId } as any)),
});

const spouseRels = (pairs: [string, string][]): StyledRelationships => ({
  spouses: pairs.map(([s1, s2]) => ({ spouse1Id: s1, spouse2Id: s2, status: 'current' } as any)),
  parentChild: [],
});

const combinedRels = (
  pc: [string, string][],
  sp: [string, string][]
): StyledRelationships => ({
  parentChild: pc.map(([p, c]) => ({ parentId: p, childId: c } as any)),
  spouses: sp.map(([s1, s2]) => ({ spouse1Id: s1, spouse2Id: s2, status: 'current' } as any)),
});

// ─── findRelationshipPath ───

describe('findRelationshipPath', () => {
  it('returns single-element path when source === target', () => {
    const members = [m('a')];
    const path = findRelationshipPath('a', 'a', members, emptyRels());
    expect(path).toEqual(['a']);
  });

  it('returns null when no connection exists', () => {
    const members = [m('a'), m('b')];
    const path = findRelationshipPath('a', 'b', members, emptyRels());
    expect(path).toBeNull();
  });

  it('finds a direct parent-child path', () => {
    const members = [m('parent'), m('child')];
    const rels = parentChildRels([['parent', 'child']]);
    const path = findRelationshipPath('parent', 'child', members, rels);
    expect(path).toEqual(['parent', 'child']);
  });

  it('finds a grandparent path', () => {
    const members = [m('gp'), m('parent'), m('child')];
    const rels = parentChildRels([['gp', 'parent'], ['parent', 'child']]);
    const path = findRelationshipPath('gp', 'child', members, rels);
    expect(path).toEqual(['gp', 'parent', 'child']);
  });

  it('finds a sibling path (via shared parent)', () => {
    const members = [m('parent'), m('sib1'), m('sib2')];
    const rels = parentChildRels([['parent', 'sib1'], ['parent', 'sib2']]);
    const path = findRelationshipPath('sib1', 'sib2', members, rels);
    expect(path).toEqual(['sib1', 'parent', 'sib2']);
  });

  it('finds a spouse path', () => {
    const members = [m('a'), m('b')];
    const rels = spouseRels([['a', 'b']]);
    const path = findRelationshipPath('a', 'b', members, rels);
    expect(path).toEqual(['a', 'b']);
  });

  it('returns the shortest path (BFS)', () => {
    // a → b → c AND a → d → c (same length); also a → b → e → c (longer)
    const members = [m('a'), m('b'), m('c'), m('d'), m('e')];
    const rels = parentChildRels([['a', 'b'], ['a', 'd'], ['b', 'c'], ['d', 'c'], ['b', 'e'], ['e', 'c']]);
    const path = findRelationshipPath('a', 'c', members, rels);
    expect(path?.length).toBe(3); // shortest is length 3
  });
});

// ─── computeRelationship labels ───

describe('computeRelationship — relationship labels', () => {
  it('returns "Same person" for self', () => {
    const members = [m('a', 'male')];
    const result = computeRelationship('a', 'a', members, emptyRels());
    expect(result?.label).toBe('Same person');
    expect(result?.hops).toBe(0);
  });

  it('labels Father correctly', () => {
    const father = m('dad', 'male');
    const child = m('kid');
    const rels = parentChildRels([['dad', 'kid']]);
    const result = computeRelationship('dad', 'kid', [father, child], rels);
    expect(result?.label).toBe('Father');
  });

  it('labels Mother correctly', () => {
    const mother = m('mom', 'female');
    const child = m('kid');
    const rels = parentChildRels([['mom', 'kid']]);
    const result = computeRelationship('mom', 'kid', [mother, child], rels);
    expect(result?.label).toBe('Mother');
  });

  it('labels Son correctly', () => {
    const son = m('s', 'male');
    const parent = m('p');
    const rels = parentChildRels([['p', 's']]);
    const result = computeRelationship('s', 'p', [son, parent], rels);
    expect(result?.label).toBe('Son');
  });

  it('labels Daughter correctly', () => {
    const daughter = m('d', 'female');
    const parent = m('p');
    const rels = parentChildRels([['p', 'd']]);
    const result = computeRelationship('d', 'p', [daughter, parent], rels);
    expect(result?.label).toBe('Daughter');
  });

  it('labels Grandfather correctly', () => {
    const gf = m('gf', 'male');
    const p = m('p');
    const c = m('c');
    const rels = parentChildRels([['gf', 'p'], ['p', 'c']]);
    const result = computeRelationship('gf', 'c', [gf, p, c], rels);
    expect(result?.label).toBe('Grandfather');
  });

  it('labels Husband correctly', () => {
    const husband = m('h', 'male');
    const wife = m('w', 'female');
    const rels = spouseRels([['h', 'w']]);
    const result = computeRelationship('h', 'w', [husband, wife], rels);
    expect(result?.label).toBe('Husband');
  });

  it('labels Wife correctly', () => {
    const husband = m('h', 'male');
    const wife = m('w', 'female');
    const rels = spouseRels([['h', 'w']]);
    const result = computeRelationship('w', 'h', [husband, wife], rels);
    expect(result?.label).toBe('Wife');
  });

  it('labels Brother correctly', () => {
    const bro = m('bro', 'male');
    const sis = m('sis', 'female');
    const p = m('p');
    const rels = parentChildRels([['p', 'bro'], ['p', 'sis']]);
    const result = computeRelationship('bro', 'sis', [bro, sis, p], rels);
    expect(result?.label).toBe('Brother');
  });

  it('returns null when no path exists', () => {
    const members = [m('a'), m('b')];
    const result = computeRelationship('a', 'b', members, emptyRels());
    expect(result).toBeNull();
  });

  it('reports correct hop count', () => {
    const members = [m('gp'), m('parent'), m('child')];
    const rels = parentChildRels([['gp', 'parent'], ['parent', 'child']]);
    const result = computeRelationship('gp', 'child', members, rels);
    expect(result?.hops).toBe(2);
  });
});

// ─── Marathi labels — computeRelationship ───

describe('Marathi labels — computeRelationship', () => {
  // ── Shared family fixture ────────────────────────────────────────────────
  const members: StyledFamilyMember[] = [
    m('gg1', 'male'),   m('gg2', 'female'),          // great-grandparents
    m('pg1', 'male'),   m('pg2', 'female'),           // paternal grandparents
    m('mg1', 'male'),   m('mg2', 'female'),           // maternal grandparents
    m('dad', 'male'),   m('kaka', 'male'),  m('aatya', 'female'),   // paternal
    m('mom', 'female'), m('mama', 'male'),  m('mavshi', 'female'),  // maternal
    m('me', 'male'),    m('me_f', 'female'),          // target (male & female)
    m('bro', 'male'),   m('sis', 'female'),           // siblings
    m('kaku', 'female'),  m('atoba', 'male'),         // paternal uncle/aunt spouses
    m('mami', 'female'),  m('maavsa', 'male'),        // maternal uncle/aunt spouses
    m('chulat_bhai', 'male'),  m('chulat_behen', 'female'), // paternal uncle's kids
    m('aatye_bhai', 'male'),                          // paternal aunt's kid
    m('mame_bhai', 'male'),                           // maternal uncle's kid
    m('mavas_bhai', 'male'),                          // maternal aunt's kid
    m('spouse', 'female'),                            // me's wife
    m('sasre', 'male'),  m('sasu', 'female'),         // parents-in-law
    m('dev', 'male'),    m('nanand', 'female'),       // husband's siblings (दीर/नणंद)
    m('wife_bro', 'male'), m('wife_sis', 'female'),   // wife's siblings (मेव्हणा/मेव्हणी)
    m('son_me', 'male'), m('daughter_me', 'female'),  // me's children
    m('javaai', 'male'), m('sun_me', 'female'),       // children's spouses
    m('natoo', 'male'),  m('nat', 'female'),           // grandchildren
    m('step_dad', 'male'), m('step_bro', 'male'),     // step-family
    m('vahini', 'female'), m('bhavoji', 'male'),      // siblings' spouses
  ];

  const pcPairs: [string, string][] = [
    // great-grandparents → paternal grandparents
    ['gg1', 'pg1'], ['gg2', 'pg1'],
    // paternal grandparents → dad's generation
    ['pg1', 'dad'],  ['pg1', 'kaka'],  ['pg1', 'aatya'],
    ['pg2', 'dad'],  ['pg2', 'kaka'],  ['pg2', 'aatya'],
    // maternal grandparents → mom's generation
    ['mg1', 'mom'],  ['mg1', 'mama'],  ['mg1', 'mavshi'],
    ['mg2', 'mom'],  ['mg2', 'mama'],  ['mg2', 'mavshi'],
    // me's nuclear family
    ['dad', 'me'],   ['mom', 'me'],
    ['dad', 'me_f'], ['mom', 'me_f'],
    ['dad', 'bro'],  ['mom', 'bro'],
    ['dad', 'sis'],  ['mom', 'sis'],
    // paternal cousins
    ['kaka', 'chulat_bhai'],  ['kaku', 'chulat_bhai'],
    ['kaka', 'chulat_behen'], ['kaku', 'chulat_behen'],
    ['aatya', 'aatye_bhai'],  ['atoba', 'aatye_bhai'],
    // maternal cousins
    ['mama', 'mame_bhai'],    ['mami', 'mame_bhai'],
    ['mavshi', 'mavas_bhai'], ['maavsa', 'mavas_bhai'],
    // in-laws
    ['sasre', 'spouse'],   ['sasu', 'spouse'],
    ['sasre', 'dev'],      ['sasu', 'dev'],
    ['sasre', 'nanand'],   ['sasu', 'nanand'],
    ['sasre', 'wife_bro'], ['sasu', 'wife_bro'],
    ['sasre', 'wife_sis'], ['sasu', 'wife_sis'],
    // me's children and grandchildren
    ['me', 'son_me'],      ['spouse', 'son_me'],
    ['me', 'daughter_me'], ['spouse', 'daughter_me'],
    ['son_me', 'natoo'],   ['sun_me', 'natoo'],
    ['son_me', 'nat'],     ['sun_me', 'nat'],
    // step-family
    ['step_dad', 'step_bro'],
  ];

  const spPairs: [string, string][] = [
    ['pg1', 'pg2'],
    ['mg1', 'mg2'],
    ['dad', 'mom'],
    ['kaka', 'kaku'],
    ['atoba', 'aatya'],
    ['mama', 'mami'],
    ['maavsa', 'mavshi'],
    ['me', 'spouse'],
    ['javaai', 'daughter_me'],
    ['son_me', 'sun_me'],
    ['mom', 'step_dad'],
    ['bro', 'vahini'],
    ['bhavoji', 'sis'],
  ];

  const rels = combinedRels(pcPairs, spPairs);

  // helper: call as computeRelationship(sourceId, 'me', members, rels)
  const rel = (sourceId: string, config?: Parameters<typeof computeRelationship>[4]) =>
    computeRelationship(sourceId, 'me', members, rels, config);

  // ── Same person / no connection ──────────────────────────────────────────
  it('same person returns तीच व्यक्ती', () => {
    const r = computeRelationship('me', 'me', members, rels);
    expect(r?.label).toBe('Same person');
    expect(r?.labelMr).toBe('तीच व्यक्ती');
  });

  it('no connection returns null', () => {
    const isolated = m('isolated');
    const r = computeRelationship('isolated', 'me', [...members, isolated], rels);
    expect(r).toBeNull();
  });

  // ── Parents ───────────────────────────────────────────────────────────────
  it('dad → me: Father / वडील', () => {
    const r = rel('dad');
    expect(r?.label).toBe('Father');
    expect(r?.labelMr).toBe('वडील');
  });

  it('mom → me: Mother / आई', () => {
    const r = rel('mom');
    expect(r?.label).toBe('Mother');
    expect(r?.labelMr).toBe('आई');
  });

  // ── Grandparents ──────────────────────────────────────────────────────────
  it('pg1 → me: Grandfather / आजोबा', () => {
    const r = rel('pg1');
    expect(r?.label).toBe('Grandfather');
    expect(r?.labelMr).toBe('आजोबा');
  });

  it('pg2 → me: Grandmother / आजी', () => {
    const r = rel('pg2');
    expect(r?.label).toBe('Grandmother');
    expect(r?.labelMr).toBe('आजी');
  });

  // ── Great-grandparents ────────────────────────────────────────────────────
  it('gg1 → me: great-grandfather / पणजोबा', () => {
    const r = rel('gg1');
    expect(r?.label).toBe('Great-Grandfather');
    expect(r?.labelMr).toBe('पणजोबा');
  });

  it('gg2 → me: great-grandmother / पणजी', () => {
    const r = rel('gg2');
    expect(r?.label).toBe('Great-Grandmother');
    expect(r?.labelMr).toBe('पणजी');
  });

  // ── Siblings ──────────────────────────────────────────────────────────────
  it('bro → me: Brother / भाऊ', () => {
    const r = rel('bro');
    expect(r?.label).toBe('Brother');
    expect(r?.labelMr).toBe('भाऊ');
  });

  it('sis → me: Sister / बहीण', () => {
    const r = rel('sis');
    expect(r?.label).toBe('Sister');
    expect(r?.labelMr).toBe('बहीण');
  });

  // ── Children ──────────────────────────────────────────────────────────────
  it('son_me → me: Son / मुलगा', () => {
    const r = rel('son_me');
    expect(r?.label).toBe('Son');
    expect(r?.labelMr).toBe('मुलगा');
  });

  it('daughter_me → me: Daughter / मुलगी', () => {
    const r = rel('daughter_me');
    expect(r?.label).toBe('Daughter');
    expect(r?.labelMr).toBe('मुलगी');
  });

  // ── Grandchildren ─────────────────────────────────────────────────────────
  it('natoo → me: Grandson / नातू', () => {
    const r = rel('natoo');
    expect(r?.label).toBe('Grandson');
    expect(r?.labelMr).toBe('नातू');
  });

  it('nat → me: Granddaughter / नात', () => {
    const r = rel('nat');
    expect(r?.label).toBe('Granddaughter');
    expect(r?.labelMr).toBe('नात');
  });

  // ── Paternal uncle / aunt ─────────────────────────────────────────────────
  it('kaka → me: Uncle / काका', () => {
    const r = rel('kaka');
    expect(r?.label).toBe('Uncle');
    expect(r?.labelMr).toBe('काका');
  });

  it('aatya → me: Aunt / आत्या', () => {
    const r = rel('aatya');
    expect(r?.label).toBe('Aunt');
    expect(r?.labelMr).toBe('आत्या');
  });

  // ── Maternal uncle / aunt ─────────────────────────────────────────────────
  it('mama → me: Uncle / मामा', () => {
    const r = rel('mama');
    expect(r?.label).toBe('Uncle');
    expect(r?.labelMr).toBe('मामा');
  });

  it('mavshi → me: Aunt / मावशी', () => {
    const r = rel('mavshi');
    expect(r?.label).toBe('Aunt');
    expect(r?.labelMr).toBe('मावशी');
  });

  // ── Uncle / aunt spouses ──────────────────────────────────────────────────
  it('kaku → me: काकू', () => {
    const r = rel('kaku');
    expect(r?.labelMr).toBe('काकू');
  });

  it('atoba → me: आतोबा (default config)', () => {
    const r = rel('atoba');
    expect(r?.labelMr).toBe('आतोबा');
  });

  it('atoba → me: आत्याचे पती (useAtobaForAatyaHusband=false)', () => {
    const r = rel('atoba', { useAtobaForAatyaHusband: false, useMaavsaForMaavshiHusband: true });
    expect(r?.labelMr).toBe('आत्याचे पती');
  });

  it('mami → me: मामी', () => {
    const r = rel('mami');
    expect(r?.labelMr).toBe('मामी');
  });

  it('maavsa → me: मावसा (default config)', () => {
    const r = rel('maavsa');
    expect(r?.labelMr).toBe('मावसा');
  });

  it('maavsa → me: मावशीचे पती (useMaavsaForMaavshiHusband=false)', () => {
    const r = rel('maavsa', { useAtobaForAatyaHusband: true, useMaavsaForMaavshiHusband: false });
    expect(r?.labelMr).toBe('मावशीचे पती');
  });

  // ── Cousins ───────────────────────────────────────────────────────────────
  it('chulat_bhai → me: चुलत भाऊ', () => {
    expect(rel('chulat_bhai')?.labelMr).toBe('चुलत भाऊ');
  });

  it('chulat_behen → me: चुलत बहीण', () => {
    expect(rel('chulat_behen')?.labelMr).toBe('चुलत बहीण');
  });

  it('aatye_bhai → me: आत्ये भाऊ', () => {
    expect(rel('aatye_bhai')?.labelMr).toBe('आत्ये भाऊ');
  });

  it('mame_bhai → me: मामे भाऊ', () => {
    expect(rel('mame_bhai')?.labelMr).toBe('मामे भाऊ');
  });

  it('mavas_bhai → me: मावस भाऊ', () => {
    expect(rel('mavas_bhai')?.labelMr).toBe('मावस भाऊ');
  });

  // ── Parents-in-law ────────────────────────────────────────────────────────
  it('sasre → me: Father-in-law / सासरे', () => {
    const r = rel('sasre');
    expect(r?.label).toBe('Father-in-law');
    expect(r?.labelMr).toBe('सासरे');
  });

  it('sasu → me: Mother-in-law / सासू', () => {
    const r = rel('sasu');
    expect(r?.label).toBe('Mother-in-law');
    expect(r?.labelMr).toBe('सासू');
  });

  // ── Children-in-law ───────────────────────────────────────────────────────
  it('javaai → me: Son-in-law / जावई', () => {
    const r = rel('javaai');
    expect(r?.label).toBe('Son-in-law');
    expect(r?.labelMr).toBe('जावई');
  });

  it('sun_me → me: Daughter-in-law / सून', () => {
    const r = rel('sun_me');
    expect(r?.label).toBe('Daughter-in-law');
    expect(r?.labelMr).toBe('सून');
  });

  // ── Siblings-in-law via spouse ────────────────────────────────────────────
  it('wife_bro → me: Brother-in-law / मेव्हणा', () => {
    const r = rel('wife_bro');
    expect(r?.label).toBe('Brother-in-law');
    expect(r?.labelMr).toBe('मेव्हणा');
  });

  it('wife_sis → me: Sister-in-law / मेव्हणी', () => {
    const r = rel('wife_sis');
    expect(r?.label).toBe('Sister-in-law');
    expect(r?.labelMr).toBe('मेव्हणी');
  });

  // ── Siblings' spouses ─────────────────────────────────────────────────────
  it('vahini → me: Sister-in-law / वहिनी', () => {
    const r = rel('vahini');
    expect(r?.label).toBe('Sister-in-law');
    expect(r?.labelMr).toBe('वहिनी');
  });

  it('bhavoji → me: Brother-in-law / भावोजी', () => {
    const r = rel('bhavoji');
    expect(r?.label).toBe('Brother-in-law');
    expect(r?.labelMr).toBe('भावोजी');
  });

  // ── Step-relations ────────────────────────────────────────────────────────
  it('step_dad → me: Step-father / सावत्र वडील', () => {
    const r = rel('step_dad');
    expect(r?.label).toBe('Step-father');
    expect(r?.labelMr).toBe('सावत्र वडील');
  });

  it('step_bro → me: Step-brother / सावत्र भाऊ', () => {
    const r = rel('step_bro');
    expect(r?.label).toBe('Step-brother');
    expect(r?.labelMr).toBe('सावत्र भाऊ');
  });

  // ── Unknown gender fallback ───────────────────────────────────────────────
  it('unknown gender parent → me2: पालक', () => {
    const u_parent = m('u_parent', 'unknown');
    const me2 = m('me2', 'male');
    const r = computeRelationship('u_parent', 'me2', [u_parent, me2],
      parentChildRels([['u_parent', 'me2']]));
    expect(r?.labelMr).toBe('पालक');
  });

  // ── Side-unknown fallback (bridge parent gender unknown) ──────────────────
  it('uncle via unknown-gender parent → नातेवाईक', () => {
    const gp_uk     = m('gp_uk', 'male');
    const parent_uk = m('parent_uk', 'unknown');
    const uncle_uk  = m('uncle_uk', 'male');
    const me3       = m('me3', 'male');
    const r = computeRelationship('uncle_uk', 'me3',
      [gp_uk, parent_uk, uncle_uk, me3],
      parentChildRels([
        ['gp_uk', 'parent_uk'],
        ['gp_uk', 'uncle_uk'],
        ['parent_uk', 'me3'],
      ]));
    expect(r?.labelMr).toBe('नातेवाईक');
  });
});

// ─── Marathi labels — distant relatives (cousins beyond 1st) ───

describe('Marathi labels — distant relatives', () => {
  it('2nd cousin (male source)', () => {
    // CA → A1 → A2 → source;  CA → B1 → B2 → target  (both 3 levels from CA)
    const all = [
      m('d_ca'), m('d_a1'), m('d_a2'), m('d_src', 'male'),
      m('d_b1'), m('d_b2'), m('d_tgt'),
    ];
    const rels = parentChildRels([
      ['d_ca', 'd_a1'], ['d_a1', 'd_a2'], ['d_a2', 'd_src'],
      ['d_ca', 'd_b1'], ['d_b1', 'd_b2'], ['d_b2', 'd_tgt'],
    ]);
    const r = computeRelationship('d_src', 'd_tgt', all, rels);
    expect(r?.label).toBe('2nd cousin');
    expect(r?.labelMr).toBe('दुसरे चुलत भाऊ');
  });

  it('2nd cousin (female source)', () => {
    const all = [
      m('d2_ca'), m('d2_a1'), m('d2_a2'), m('d2_src', 'female'),
      m('d2_b1'), m('d2_b2'), m('d2_tgt'),
    ];
    const rels = parentChildRels([
      ['d2_ca', 'd2_a1'], ['d2_a1', 'd2_a2'], ['d2_a2', 'd2_src'],
      ['d2_ca', 'd2_b1'], ['d2_b1', 'd2_b2'], ['d2_b2', 'd2_tgt'],
    ]);
    const r = computeRelationship('d2_src', 'd2_tgt', all, rels);
    expect(r?.label).toBe('2nd cousin');
    expect(r?.labelMr).toBe('दुसरे चुलत बहीण');
  });

  it('4th cousin 1x removed — male source (the reported bug)', () => {
    // source 5 levels from CA, target 6 levels → "4th cousin 1x removed"
    const all = [
      m('f_ca'),
      m('f_a1'), m('f_a2'), m('f_a3'), m('f_a4'), m('f_src', 'male'),
      m('f_b1'), m('f_b2'), m('f_b3'), m('f_b4'), m('f_b5'), m('f_tgt'),
    ];
    const rels = parentChildRels([
      ['f_ca', 'f_a1'], ['f_a1', 'f_a2'], ['f_a2', 'f_a3'], ['f_a3', 'f_a4'], ['f_a4', 'f_src'],
      ['f_ca', 'f_b1'], ['f_b1', 'f_b2'], ['f_b2', 'f_b3'], ['f_b3', 'f_b4'], ['f_b4', 'f_b5'], ['f_b5', 'f_tgt'],
    ]);
    const r = computeRelationship('f_src', 'f_tgt', all, rels);
    expect(r?.label).toBe('4th cousin 1x removed');
    expect(r?.labelMr).toBe('चौथे चुलत भाऊ, 1 पिढी दूर');
  });

  it('4th cousin 1x removed — female source', () => {
    const all = [
      m('g_ca'),
      m('g_a1'), m('g_a2'), m('g_a3'), m('g_a4'), m('g_src', 'female'),
      m('g_b1'), m('g_b2'), m('g_b3'), m('g_b4'), m('g_b5'), m('g_tgt'),
    ];
    const rels = parentChildRels([
      ['g_ca', 'g_a1'], ['g_a1', 'g_a2'], ['g_a2', 'g_a3'], ['g_a3', 'g_a4'], ['g_a4', 'g_src'],
      ['g_ca', 'g_b1'], ['g_b1', 'g_b2'], ['g_b2', 'g_b3'], ['g_b3', 'g_b4'], ['g_b4', 'g_b5'], ['g_b5', 'g_tgt'],
    ]);
    const r = computeRelationship('g_src', 'g_tgt', all, rels);
    expect(r?.label).toBe('4th cousin 1x removed');
    expect(r?.labelMr).toBe('चौथे चुलत बहीण, 1 पिढी दूर');
  });

  it('3rd cousin (same level, unknown gender)', () => {
    // source & target both 4 levels from CA → "3rd cousin"
    const all = [
      m('t_ca'),
      m('t_a1'), m('t_a2'), m('t_a3'), m('t_src'),
      m('t_b1'), m('t_b2'), m('t_b3'), m('t_tgt'),
    ];
    const rels = parentChildRels([
      ['t_ca', 't_a1'], ['t_a1', 't_a2'], ['t_a2', 't_a3'], ['t_a3', 't_src'],
      ['t_ca', 't_b1'], ['t_b1', 't_b2'], ['t_b2', 't_b3'], ['t_b3', 't_tgt'],
    ]);
    const r = computeRelationship('t_src', 't_tgt', all, rels);
    expect(r?.label).toBe('3rd cousin');
    expect(r?.labelMr).toBe('तिसरे चुलत भावंड');
  });
});
