import { findRelationshipPath, computeRelationship, describeRelationship } from './relationshipFinder';
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
    expect(r?.label).toBe('Paternal grandfather');
    expect(r?.labelMr).toBe('आजोबा');
  });

  it('pg2 → me: Grandmother / आजी', () => {
    const r = rel('pg2');
    expect(r?.label).toBe('Paternal grandmother');
    expect(r?.labelMr).toBe('आजी');
  });

  // ── Great-grandparents ────────────────────────────────────────────────────
  it('gg1 → me: great-grandfather / पणजोबा', () => {
    const r = rel('gg1');
    expect(r?.label).toBe('Great-grandfather');
    expect(r?.labelMr).toBe('पणजोबा');
  });

  it('gg2 → me: great-grandmother / पणजी', () => {
    const r = rel('gg2');
    expect(r?.label).toBe('Great-grandmother');
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
    expect(r?.label).toBe('Paternal uncle');
    expect(r?.labelMr).toBe('काका');
  });

  it('aatya → me: Aunt / आत्या', () => {
    const r = rel('aatya');
    expect(r?.label).toBe('Paternal aunt');
    expect(r?.labelMr).toBe('आत्या');
  });

  // ── Maternal uncle / aunt ─────────────────────────────────────────────────
  it('mama → me: Uncle / मामा', () => {
    const r = rel('mama');
    expect(r?.label).toBe('Maternal uncle');
    expect(r?.labelMr).toBe('मामा');
  });

  it('mavshi → me: Aunt / मावशी', () => {
    const r = rel('mavshi');
    expect(r?.label).toBe('Maternal aunt');
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

  it('bhavoji → me: Brother-in-law / मेव्हणा (sister\'s husband)', () => {
    const r = rel('bhavoji');
    expect(r?.label).toBe('Brother-in-law');
    expect(r?.labelMr).toBe('मेव्हणा');
  });

  // ── Step-relations ────────────────────────────────────────────────────────
  it('step_dad → me: Stepfather / सावत्र वडील', () => {
    const r = rel('step_dad');
    expect(r?.label).toBe('Stepfather');
    expect(r?.labelMr).toBe('सावत्र वडील');
  });

  it('step_bro → me: Stepbrother / सावत्र भाऊ', () => {
    const r = rel('step_bro');
    expect(r?.label).toBe('Stepbrother');
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
  it('2nd cousin is a plain cousin (male source)', () => {
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
    expect(r?.label).toBe('Cousin');
    expect(r?.labelMr).toBe('चुलत भाऊ');
  });

  it('2nd cousin is a plain cousin (female source)', () => {
    const all = [
      m('d2_ca'), m('d2_a1'), m('d2_a2'), m('d2_src', 'female'),
      m('d2_b1'), m('d2_b2'), m('d2_tgt'),
    ];
    const rels = parentChildRels([
      ['d2_ca', 'd2_a1'], ['d2_a1', 'd2_a2'], ['d2_a2', 'd2_src'],
      ['d2_ca', 'd2_b1'], ['d2_b1', 'd2_b2'], ['d2_b2', 'd2_tgt'],
    ]);
    const r = computeRelationship('d2_src', 'd2_tgt', all, rels);
    expect(r?.label).toBe('Cousin');
    expect(r?.labelMr).toBe('चुलत बहीण');
  });

  it('parent\'s cousin is an uncle on the father\'s side — male source', () => {
    // source 5 levels from CA, target 6 levels; the target's father is the source's cousin
    const all = [
      m('f_ca'),
      m('f_a1'), m('f_a2'), m('f_a3'), m('f_a4'), m('f_src', 'male'),
      m('f_b1'), m('f_b2'), m('f_b3'), m('f_b4'), m('f_b5', 'male'), m('f_tgt'),
    ];
    const rels = parentChildRels([
      ['f_ca', 'f_a1'], ['f_a1', 'f_a2'], ['f_a2', 'f_a3'], ['f_a3', 'f_a4'], ['f_a4', 'f_src'],
      ['f_ca', 'f_b1'], ['f_b1', 'f_b2'], ['f_b2', 'f_b3'], ['f_b3', 'f_b4'], ['f_b4', 'f_b5'], ['f_b5', 'f_tgt'],
    ]);
    const r = computeRelationship('f_src', 'f_tgt', all, rels);
    expect(r?.label).toBe('Uncle');
    expect(r?.labelMr).toBe('काका');
  });

  it('parent\'s cousin is an aunt on the mother\'s side — female source', () => {
    const all = [
      m('g_ca'),
      m('g_a1'), m('g_a2'), m('g_a3'), m('g_a4'), m('g_src', 'female'),
      m('g_b1'), m('g_b2'), m('g_b3'), m('g_b4'), m('g_b5', 'female'), m('g_tgt'),
    ];
    const rels = parentChildRels([
      ['g_ca', 'g_a1'], ['g_a1', 'g_a2'], ['g_a2', 'g_a3'], ['g_a3', 'g_a4'], ['g_a4', 'g_src'],
      ['g_ca', 'g_b1'], ['g_b1', 'g_b2'], ['g_b2', 'g_b3'], ['g_b3', 'g_b4'], ['g_b4', 'g_b5'], ['g_b5', 'g_tgt'],
    ]);
    const r = computeRelationship('g_src', 'g_tgt', all, rels);
    expect(r?.label).toBe('Aunt');
    expect(r?.labelMr).toBe('मावशी');
  });

  describe('cousin one generation apart (Durgesh / Yash shape)', () => {
    // CA → a1 → a2 → cousin → kid;  CA → b1 → b2 → elder   (cousin and elder share a great-grandparent)
    const all = [
      m('n_ca', 'male'), m('n_a1', 'male'), m('n_a2', 'male'), m('n_cousin', 'male'), m('n_kid', 'male'),
      m('n_b1', 'male'), m('n_b2', 'male'), m('n_elder', 'male'), m('n_sis', 'female'), m('n_sis_kid', 'female'),
      m('n_aunt', 'female'),
    ];
    const rels = parentChildRels([
      ['n_ca', 'n_a1'], ['n_a1', 'n_a2'], ['n_a2', 'n_cousin'], ['n_cousin', 'n_kid'], ['n_a2', 'n_sis'], ['n_sis', 'n_sis_kid'],
      ['n_ca', 'n_b1'], ['n_b1', 'n_b2'], ['n_b2', 'n_elder'], ['n_b2', 'n_aunt'],
    ]);
    const r = (a: string, b: string) => computeRelationship(a, b, all, rels);

    it('names the cousin\'s son a nephew and the elder his uncle', () => {
      expect(r('n_kid', 'n_elder')).toMatchObject({ label: 'Nephew', labelMr: 'पुतण्या' });
      expect(r('n_elder', 'n_kid')).toMatchObject({ label: 'Uncle', labelMr: 'काका' });
    });

    it('uses भाचा/भाची through a female cousin or for a female elder', () => {
      expect(r('n_sis_kid', 'n_elder')).toMatchObject({ label: 'Niece', labelMr: 'भाची' });
      expect(r('n_kid', 'n_aunt')).toMatchObject({ label: 'Nephew', labelMr: 'भाचा' });
      expect(r('n_aunt', 'n_kid')).toMatchObject({ label: 'Aunt', labelMr: 'आत्या' });
    });
  });

  it('keeps cousins two or more generations apart as Cousin', () => {
    const all = [m('k_ca'), m('k_a1'), m('k_a2'), m('k_a3'), m('k_src', 'male'), m('k_b1'), m('k_tgt')];
    const rels = parentChildRels([
      ['k_ca', 'k_a1'], ['k_a1', 'k_a2'], ['k_a2', 'k_a3'], ['k_a3', 'k_src'], ['k_ca', 'k_b1'], ['k_b1', 'k_tgt'],
    ]);
    expect(computeRelationship('k_src', 'k_tgt', all, rels)).toMatchObject({ label: 'Cousin', labelMr: 'चुलत भाऊ' });
  });

  it('3rd cousin is a plain cousin (same level, unknown gender)', () => {
    // source & target both 4 levels from CA
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
    expect(r?.label).toBe('Cousin');
    expect(r?.labelMr).toBe('चुलत भावंड');
  });
});

// ─── Reference-table validation: sides, reverse direction, precedence ───

describe('Relationship reference rules', () => {
  const people = [
    m('pgf', 'male'), m('pgm', 'female'), m('mgf', 'male'), m('mgm', 'female'),
    m('dad', 'male'), m('mom', 'female'),
    m('kaka', 'male'), m('mama', 'male'), m('aatya', 'female'), m('mavshi', 'female'),
    m('me', 'male'), m('sis', 'female'), m('bro', 'male'),
    m('sis_son', 'male'), m('sis_dau', 'female'), m('bro_son', 'male'), m('bro_dau', 'female'),
    m('sis_h', 'male'), m('bro_w', 'female'),
    m('w', 'female'), m('w_bro', 'male'), m('w_sis', 'female'),
    m('h_bro', 'male'), m('h_bro_w', 'female'), m('h_sis', 'female'),
    m('me_f', 'female'),
    m('lone', 'male'),
  ];
  const rels = combinedRels(
    [
      ['pgf', 'dad'], ['pgm', 'dad'], ['pgf', 'kaka'], ['pgf', 'aatya'],
      ['mgf', 'mom'], ['mgm', 'mom'], ['mgf', 'mama'], ['mgf', 'mavshi'],
      ['dad', 'me'], ['mom', 'me'], ['dad', 'sis'], ['mom', 'sis'], ['dad', 'bro'], ['mom', 'bro'],
      ['dad', 'me_f'], ['mom', 'me_f'],
      ['sis', 'sis_son'], ['sis', 'sis_dau'], ['bro', 'bro_son'], ['bro', 'bro_dau'],
      ['w_p', 'w'], ['w_p', 'w_bro'], ['w_p', 'w_sis'],
      ['h_p', 'h_bro'], ['h_p', 'h_sis'], ['h_p', 'h'],
    ],
    [['sis', 'sis_h'], ['bro', 'bro_w'], ['me', 'w'], ['h', 'me_f'], ['h_bro', 'h_bro_w'], ['dad', 'mom']]
  );
  const all = [...people, m('w_p', 'male'), m('h_p', 'male'), m('h', 'male')];
  const r = (a: string, b: string) => computeRelationship(a, b, all, rels);

  it('splits grandparents by side', () => {
    expect(r('pgf', 'me')).toMatchObject({ label: 'Paternal grandfather', labelMr: 'आजोबा' });
    expect(r('pgm', 'me')).toMatchObject({ label: 'Paternal grandmother', labelMr: 'आजी' });
    expect(r('mgf', 'me')).toMatchObject({ label: 'Maternal grandfather', labelMr: 'आजोबा' });
    expect(r('mgm', 'me')).toMatchObject({ label: 'Maternal grandmother', labelMr: 'आजी' });
  });

  it('splits uncles and aunts by side', () => {
    expect(r('kaka', 'me')).toMatchObject({ label: 'Paternal uncle', labelMr: 'काका' });
    expect(r('aatya', 'me')).toMatchObject({ label: 'Paternal aunt', labelMr: 'आत्या' });
    expect(r('mama', 'me')).toMatchObject({ label: 'Maternal uncle', labelMr: 'मामा' });
    expect(r('mavshi', 'me')).toMatchObject({ label: 'Maternal aunt', labelMr: 'मावशी' });
  });

  it('reverse direction: nephew/niece of uncle and aunt', () => {
    expect(r('me', 'kaka')?.labelMr).toBe('पुतण्या');
    expect(r('me_f', 'mama')?.labelMr).toBe('भाची');
  });

  it('siblings\' children and spouses', () => {
    expect(r('bro_son', 'me')?.labelMr).toBe('पुतण्या');
    expect(r('bro_dau', 'me')?.labelMr).toBe('पुतणी');
    expect(r('sis_son', 'me')?.labelMr).toBe('भाचा');
    expect(r('sis_dau', 'me')?.labelMr).toBe('भाची');
    expect(r('bro_w', 'me')?.labelMr).toBe('वहिनी');
    expect(r('sis_h', 'me')?.labelMr).toBe('मेव्हणा');
  });

  it('spouse uses पती / पत्नी', () => {
    expect(r('me', 'w')?.labelMr).toBe('पती');
    expect(r('w', 'me')?.labelMr).toBe('पत्नी');
  });

  it('husband\'s siblings and their wives (woman\'s perspective)', () => {
    expect(r('h_bro', 'me_f')?.labelMr).toBe('दीर');
    expect(r('h_sis', 'me_f')?.labelMr).toBe('नणंद');
    expect(r('h_bro_w', 'me_f')?.labelMr).toBe('जाऊ');
  });

  it('wife\'s siblings', () => {
    expect(r('w_bro', 'me')?.labelMr).toBe('मेव्हणा');
    expect(r('w_sis', 'me')?.labelMr).toBe('मेव्हणी');
  });

  it('names a grandfather\'s brother चुलत आजोबा', () => {
    const pp = [m('a', 'male'), m('b', 'male'), m('c', 'male'), m('d', 'male'), m('e', 'male')];
    const rr = parentChildRels([['a', 'b'], ['a', 'c'], ['b', 'd'], ['d', 'e']]);
    expect(computeRelationship('c', 'e', pp, rr)).toMatchObject({ label: 'Great-uncle', labelMr: 'चुलत आजोबा' });
  });

  it('missing parent gender: side is not guessed', () => {
    const pp = [m('g', 'male'), m('p', 'unknown'), m('c', 'male')];
    const res = computeRelationship('g', 'c', pp, parentChildRels([['g', 'p'], ['p', 'c']]));
    expect(res?.label).toBe('Grandfather');
    expect(res?.labelMr).toBe('आजोबा');
  });

  it('returns null for unconnected people', () => {
    expect(r('lone', 'me')).toBeNull();
  });

  it('blood relationship wins over a marriage route', () => {
    // x and y are first cousins who are also married
    const pp = [m('gp', 'male'), m('u1', 'male'), m('u2', 'male'), m('x', 'male'), m('y', 'female')];
    const rr = combinedRels(
      [['gp', 'u1'], ['gp', 'u2'], ['u1', 'x'], ['u2', 'y']],
      [['x', 'y']]
    );
    const res = computeRelationship('x', 'y', pp, rr);
    expect(res?.directions).toEqual(['spouse']);
    const res2 = computeRelationship('u1', 'y', pp, rr);
    expect(res2?.directions).not.toContain('spouse');
  });
});

// ─── Audit fixes: marriage paths, Marathi terms, distant relatives, ended marriages ───

describe('Relationship audit fixes', () => {
  const people = [
    m('gggp', 'male'), m('gggu', 'male'), m('ggp', 'male'), m('ggu', 'male'), m('gp', 'male'), m('gm', 'female'),
    m('mggp', 'male'), m('mgu', 'male'), m('mgp', 'male'),
    m('dad', 'male'), m('mom', 'female'), m('kaka', 'male'), m('kaku', 'female'), m('aatya', 'female'), m('atoba', 'male'),
    m('mama', 'male'), m('late', 'female'),
    m('me', 'male'), m('me_f', 'female'), m('bro', 'male'), m('sis', 'female'), m('ex', 'female'),
    m('bro_son', 'male'), m('bro_son_w', 'female'), m('bro_son_son', 'male'), m('sis_son', 'male'),
    m('cousin', 'male'), m('cousin_w', 'female'), m('cousin_son', 'male'),
    m('w', 'female'), m('wp', 'male'), m('wgp', 'male'),
    m('son', 'male'), m('dil', 'female'), m('dilp', 'male'), m('dilm', 'female'),
    m('stepgm', 'female'), m('half', 'male'), m('mom2', 'female'),
    m('lonely', 'male'), m('solo', 'female'), m('kid', 'male'),
  ];
  const pc: [string, string][] = [
    ['gggp', 'ggp'], ['gggp', 'gggu'], ['ggp', 'gp'], ['ggp', 'ggu'], ['mggp', 'mgp'], ['mggp', 'mgu'],
    ['gp', 'dad'], ['gm', 'dad'], ['gp', 'kaka'], ['gm', 'kaka'], ['gp', 'aatya'], ['gm', 'aatya'],
    ['mgp', 'mom'], ['mgp', 'mama'],
    ['dad', 'me'], ['mom', 'me'], ['dad', 'me_f'], ['mom', 'me_f'], ['dad', 'bro'], ['mom', 'bro'], ['dad', 'sis'], ['mom', 'sis'],
    ['bro', 'bro_son'], ['bro_son', 'bro_son_son'], ['sis', 'sis_son'], ['kaka', 'cousin'], ['kaku', 'cousin'], ['cousin', 'cousin_son'],
    ['wgp', 'wp'], ['wp', 'w'], ['me', 'son'], ['w', 'son'], ['dilp', 'dil'], ['dilm', 'dil'],
    ['dad', 'half'], ['mom2', 'half'], ['lonely', 'kid'], ['solo', 'kid'],
  ];
  const current: [string, string][] = [
    ['gp', 'gm'], ['dad', 'mom'], ['kaka', 'kaku'], ['aatya', 'atoba'], ['me', 'w'], ['son', 'dil'], ['dilp', 'dilm'],
    ['gp', 'stepgm'], ['dad', 'mom2'], ['bro_son', 'bro_son_w'], ['cousin', 'cousin_w'],
  ];
  const rels: StyledRelationships = {
    parentChild: pc.map(([parentId, childId]) => ({ parentId, childId } as any)),
    spouses: [
      ...current.map(([spouse1Id, spouse2Id]) => ({ spouse1Id, spouse2Id, status: 'current' } as any)),
      { spouse1Id: 'bro', spouse2Id: 'ex', status: 'former', endReason: 'divorce' } as any,
      { spouse1Id: 'mama', spouse2Id: 'late', status: 'former', endReason: 'death' } as any,
    ],
  };
  const r = (a: string, b: string) => computeRelationship(a, b, people, rels);

  it('names an uncle or aunt by marriage from both sides', () => {
    expect(r('kaku', 'me')).toMatchObject({ label: 'Aunt by marriage', labelMr: 'काकू' });
    expect(r('atoba', 'me')).toMatchObject({ label: 'Uncle by marriage', labelMr: 'आतोबा' });
    expect(r('me', 'kaku')).toMatchObject({ label: 'Nephew by marriage', labelMr: 'पुतण्या' });
    expect(r('me', 'atoba')).toMatchObject({ label: 'Nephew by marriage', labelMr: 'भाचा' });
  });

  it('names a cousin\'s child and the cousin\'s uncle\'s wife by marriage', () => {
    expect(r('w', 'cousin_son')).toMatchObject({ label: 'Aunt by marriage', labelMr: 'काकू' });
    expect(r('cousin_son', 'w')).toMatchObject({ label: 'Nephew by marriage', labelMr: 'पुतण्या' });
  });

  it('names co-parents-in-law व्याही and विहीण', () => {
    expect(r('dilp', 'me')).toMatchObject({ label: 'Co-father-in-law', labelMr: 'व्याही' });
    expect(r('dilm', 'me')).toMatchObject({ label: 'Co-mother-in-law', labelMr: 'विहीण' });
  });

  it('uses भाचा for a woman\'s brother\'s son and पुतण्या for a man\'s', () => {
    expect(r('bro_son', 'me_f')).toMatchObject({ label: 'Nephew', labelMr: 'भाचा' });
    expect(r('bro_son', 'me')?.labelMr).toBe('पुतण्या');
    expect(r('sis_son', 'me_f')?.labelMr).toBe('भाचा');
  });

  it('names great-great relatives instead of showing arrows', () => {
    expect(r('gggu', 'me')?.label).toBe('Great-great-uncle');
    expect(r('me', 'gggu')?.label).toBe('Great-great-nephew');
    expect(r('gggp', 'me')).toMatchObject({ label: 'Great-great-grandfather', labelMr: 'खापरपणजोबा' });
  });

  it('uses Marathi terms for great-uncles, great-nephews and in-laws', () => {
    expect(r('ggu', 'me')).toMatchObject({ label: 'Great-uncle', labelMr: 'चुलत आजोबा' });
    expect(r('mgu', 'me')?.labelMr).toBe('आईचे काका');
    expect(r('bro_son_son', 'me')).toMatchObject({ label: 'Great-nephew', labelMr: 'पुतण्याचा मुलगा' });
    expect(r('bro_son_son', 'me_f')?.labelMr).toBe('भाच्याचा मुलगा');
    expect(r('wgp', 'me')).toMatchObject({ label: 'Grandfather-in-law', labelMr: 'आजेसासरे' });
    expect(r('bro_son_w', 'me')).toMatchObject({ label: 'Niece-in-law', labelMr: 'पुतणसून' });
    expect(r('cousin_w', 'me')).toMatchObject({ label: 'Cousin-in-law', labelMr: 'चुलत वहिनी' });
  });

  it('names step-grandparents and step-grandchildren', () => {
    expect(r('stepgm', 'me')).toMatchObject({ label: 'Step-grandmother', labelMr: 'सावत्र आजी' });
    expect(r('me', 'stepgm')).toMatchObject({ label: 'Step-grandson', labelMr: 'सावत्र नातू' });
  });

  it('marks ended marriages, but not a marriage ended by death', () => {
    expect(r('ex', 'bro')).toMatchObject({ label: 'Ex-wife', labelMr: 'माजी पत्नी' });
    expect(r('ex', 'me')).toMatchObject({ label: 'Former sister-in-law', labelMr: 'माजी वहिनी' });
    expect(r('late', 'mama')).toMatchObject({ label: 'Wife', labelMr: 'पत्नी' });
  });

  it('distinguishes half-siblings from full siblings', () => {
    expect(r('half', 'me')).toMatchObject({ label: 'Half-brother', labelMr: 'सावत्र भाऊ' });
    expect(r('bro', 'me')).toMatchObject({ label: 'Brother', labelMr: 'भाऊ' });
  });

  it('does not call two parents of the same child siblings', () => {
    expect(r('lonely', 'solo')).toMatchObject({ label: 'Relative', labelMr: 'नातेवाईक' });
  });

  it('describes the relationship as a sentence in English and Marathi', () => {
    expect(describeRelationship(r('dad', 'me')!, 'Ravi', 'Amit', 'en', 'male')).toBe("Ravi is Amit's father.");
    expect(describeRelationship(r('kaku', 'me')!, 'Kavita', 'Amit', 'en', 'female')).toBe("Kavita is Amit's aunt by marriage.");
    expect(describeRelationship(r('dad', 'me')!, 'रवी', 'अमित', 'mr', 'male')).toBe('रवी अमितचे वडील आहेत.');
    expect(describeRelationship(r('sis', 'me')!, 'सीमा', 'अमित', 'mr', 'female')).toBe('सीमा अमितची बहीण आहे.');
    expect(describeRelationship(r('bro', 'me')!, 'राहुल', 'अमित', 'mr', 'male')).toBe('राहुल अमितचा भाऊ आहे.');
    expect(describeRelationship(r('bro_son_son', 'me')!, 'ओम', 'अमित', 'mr', 'male')).toBe('ओम अमितच्या पुतण्याचा मुलगा आहे.');
  });
});
