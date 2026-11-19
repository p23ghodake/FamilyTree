import fs from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import { TextEncoder, TextDecoder } from 'util';
import ts from 'typescript';
import * as serverDates from '../../supabase/functions/_shared/dateValidation';
import { RawFamilyData } from '../types/FamilyTypes';

const fetchTypes = jest.requireActual<{ Request: typeof Request; Response: typeof Response }>('whatwg-fetch');
const token = `h.${btoa(JSON.stringify({ sub: 'test-admin', amr: [{ method: 'oauth' }] }))}.s`;
const validData = (): RawFamilyData => ({ familyTrees: [{
  familyTreeId: 'test', familyTreeDisplayName: 'Test',
  members: [{ id: 'a', firstName: 'Anil', lastName: 'Family', gender: 'male', birthYear: 1950, deathYear: null }],
  relationships: { spouses: [], parentChild: [] },
}] });

let handler: (request: Request) => Promise<Response>;
let fetchMock: jest.Mock;
let secrets: Record<string, string>;

function loadServerValidation() {
  const source = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', '_shared', 'familyDataValidation.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  const validationExports: { validateFamilyData?: (data: unknown) => string | null } = {};
  runInNewContext(compiled.outputText, {
    exports: validationExports,
    URL,
    require: (specifier: string) => {
      if (specifier !== './dateValidation.ts') throw new Error(`Unexpected validation import: ${specifier}`);
      return serverDates;
    },
  });
  if (!validationExports.validateFamilyData) throw new Error('Family-data validator was not exported.');
  return validationExports;
}

beforeEach(() => {
  secrets = {
    GITHUB_TOKEN: 'test-github-token', SUPABASE_URL: 'https://auth.example.test',
    SUPABASE_ANON_KEY: 'test-public-key', ALLOWED_GITHUB_USERS: 'p23ghodake', ADMIN_USERS: 'p23ghodake',
  };
  fetchMock = jest.fn(async (_url, options) => new fetchTypes.Response(JSON.stringify(options.method === 'PUT'
    ? { content: { sha: 'saved-sha' } }
    : { id: 'test-admin', identities: [{ provider: 'github', identity_data: { user_name: 'p23ghodake' } }] })));
  const source = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', 'family-data', 'index.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  runInNewContext(compiled.outputText, {
    Deno: {
      env: { get: (name: string) => secrets[name] },
      serve: (callback: typeof handler) => { handler = callback; },
    },
    fetch: fetchMock, Response: fetchTypes.Response, TextEncoder, TextDecoder, atob, btoa, console, exports: {},
    require: (specifier: string) => {
      if (specifier !== '../_shared/familyDataValidation.ts') throw new Error(`Unexpected import: ${specifier}`);
      return loadServerValidation();
    },
  });
});

it('returns administrator capabilities from configured server identities only', async () => {
  fetchMock.mockImplementation(async (url, options) => {
    if (String(url).includes('/auth/v1/user')) {
      return new fetchTypes.Response(JSON.stringify({
        id: 'test-admin',
        identities: [{ provider: 'github', identity_data: { user_name: 'p23ghodake' } }],
      }));
    }
    if (options.method === 'PUT') return new fetchTypes.Response(JSON.stringify({ content: { sha: 'saved-sha' } }));
    return new fetchTypes.Response(JSON.stringify({
      sha: 'file-sha',
      content: btoa(JSON.stringify(validData())),
      encoding: 'base64',
    }));
  });

  const request = new fetchTypes.Request('https://function.example.test/family-data', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const response = await handler(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ isAdmin: true, canDelete: true, canEdit: true });

  delete secrets.ADMIN_USERS;
  const withoutAdminConfig = await handler(request);
  expect(withoutAdminConfig.status).toBe(200);
  expect(await withoutAdminConfig.json()).toMatchObject({ isAdmin: false, canDelete: false, canEdit: true });
});

function saveRequest(data: RawFamilyData) {
  return new fetchTypes.Request('https://function.example.test/family-data', {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, sha: 'original-sha' }),
  });
}

it.each([
  { birthDate: '1950-02-31' },
  { birthYear: 1950.5 },
  { birthDate: '1950-12-31', deathYear: 1950, deathDate: '1950-01-01' },
  { birthDate: '1951-01-01' },
])('returns HTTP 400 without writing invalid dates: %j', async changes => {
  const data = validData();
  Object.assign(data.familyTrees[0].members[0], changes);
  const response = await handler(saveRequest(data));
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/date|year|birth/);
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(0);
});

it('rejects malformed family data without writing it', async () => {
  const invalidCases: Array<(data: RawFamilyData) => void> = [
    data => { (data.familyTrees[0].members[0] as unknown as Record<string, unknown>).gender = 'other'; },
    data => { (data.familyTrees[0].members[0] as unknown as Record<string, unknown>).imageUrl = 'javascript:alert(1)'; },
    data => { data.familyTrees[0].relationships!.parentChild.push({ parentId: 'missing', childId: 'a' }); },
    data => { data.familyTrees[0].members.push({ ...data.familyTrees[0].members[0] }); },
    data => { (data as unknown as { settings: unknown }).settings = { connectorStyle: 'unknown' }; },
  ];

  for (const mutate of invalidCases) {
    const data = validData();
    mutate(data);
    const response = await handler(saveRequest(data));
    expect(response.status).toBe(400);
  }
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(0);
});

it('saves deceased status with an unknown death date to the documented default target', async () => {
  const data = validData();
  data.familyTrees[0].members[0].isDeceased = true;
  const response = await handler(saveRequest(data));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sha: 'saved-sha' });
  const write = fetchMock.mock.calls.find(([, options]) => options.method === 'PUT')!;
  expect(write[0]).toBe('https://api.github.com/repos/p23ghodake/FamilyTree-Data/contents/g_familyData.json');
  const body = JSON.parse(write[1].body);
  expect(JSON.parse(atob(body.content)).familyTrees[0].members[0].isDeceased).toBe(true);
  expect(body.sha).toBe('original-sha');
});
