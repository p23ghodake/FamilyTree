import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { supabase, requireSupabase } from '../lib/supabase';
import { FamilyTreeProvider, useFamilyTree, buildRawExport } from '../context/FamilyTreeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { RawFamilyData } from '../types/FamilyTypes';
import { translations } from '../i18n/translations';
import MemberFormModal from './TreeView/MemberFormModal';
import MemberDetailsPanel from './TreeView/MemberDetailsPanel';
import FloatingSearch from './SearchBar/FloatingSearch';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(), getSession: jest.fn(), refreshSession: jest.fn(),
      signOut: jest.fn(), signInWithOAuth: jest.fn(), signInWithPassword: jest.fn(),
    },
    functions: { invoke: jest.fn() },
  },
  requireSupabase: jest.fn(),
}));
jest.mock('../processing/transliteration', () => ({ transliterateToMarathi: jest.fn().mockResolvedValue('') }));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));

const { Response: FetchResponse } = jest.requireActual<{ Response: typeof Response }>('whatwg-fetch');
Object.defineProperty(globalThis, 'Response', { configurable: true, writable: true, value: FetchResponse });

const client = supabase as unknown as {
  auth: { onAuthStateChange: jest.Mock; getSession: jest.Mock; refreshSession: jest.Mock; signOut: jest.Mock };
  functions: { invoke: jest.Mock };
};
const t = translations.en;
const user = {
  id: 'test-admin', email: 'admin@example.test',
  identities: [{ provider: 'github', identity_data: { user_name: 'p23ghodake' } }],
};
const initialSession = {
  user,
  access_token: `h.${btoa(JSON.stringify({ sub: user.id, amr: [{ method: 'oauth' }] }))}.s`,
  refresh_token: 'test-refresh-token',
};
const rawData: RawFamilyData = { familyTrees: [{
  familyTreeId: 'test-tree', familyTreeDisplayName: 'Test Family',
  members: [
    { id: 'parent', firstName: 'Parent', lastName: 'Family', gender: 'male', birthYear: 1970, birthDate: '1970-02-03', deathYear: null },
    { id: 'child', firstName: 'Child', lastName: 'Family', gender: 'female', birthYear: 2000, deathYear: null },
  ],
  relationships: { spouses: [], parentChild: [{ parentId: 'parent', childId: 'child' }] },
}] };

let context: ReturnType<typeof useFamilyTree>;
let auth: ReturnType<typeof useAuth>;
let authListener: (event: string, session: unknown) => void;
let storedSession: unknown;
let remoteData: RawFamilyData;

function Probe() {
  context = useFamilyTree();
  auth = useAuth();
  return null;
}

function Harness() {
  return <LanguageProvider><AuthProvider><FamilyTreeProvider>
    <Probe /><MemberFormModal /><MemberDetailsPanel /><FloatingSearch />
  </FamilyTreeProvider></AuthProvider></LanguageProvider>;
}

function calls(method: 'GET' | 'PUT') {
  return client.functions.invoke.mock.calls.filter(([, options]) => options.method === method);
}

async function mountEditor() {
  render(<Harness />);
  await waitFor(() => expect(context.canEdit).toBe(true));
}

async function addMember(id: string) {
  const member = context.styleNewMember({ id, firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(context.currentTree?.members.some(m => m.id === id)).toBe(true));
  await waitFor(() => expect(context.isSaving).toBe(false));
}

function openParentDetailsStep() {
  act(() => context.dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'edit', targetId: 'parent' } }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t.wizardStepDetails) }));
}

function failedResponse(status: number) {
  return { data: null, error: { message: 'Request failed', context: new FetchResponse('{}', { status }) } };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('app-lang', 'en');
  storedSession = initialSession;
  remoteData = JSON.parse(JSON.stringify(rawData));
  client.auth.onAuthStateChange.mockImplementation(listener => {
    authListener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  client.auth.getSession.mockImplementation(async () => ({ data: { session: storedSession }, error: null }));
  client.auth.refreshSession.mockImplementation(async () => {
    storedSession = { ...initialSession, access_token: initialSession.access_token + '-refreshed' };
    authListener('TOKEN_REFRESHED', storedSession);
    return { data: { session: storedSession }, error: null };
  });
  client.auth.signOut.mockImplementation(async () => {
    storedSession = null;
    authListener('SIGNED_OUT', null);
    return { error: null };
  });
  (requireSupabase as jest.Mock).mockReturnValue(client);
  client.functions.invoke.mockImplementation(async (_name, options) => {
    if (options.method === 'PUT') {
      remoteData = JSON.parse(JSON.stringify(options.body.data));
      return { data: { sha: 'saved' }, error: null };
    }
    return { data: { data: remoteData, sha: 'original', canEdit: true, limited: false }, error: null };
  });
});

it('keeps a successful save visible after the service refreshes a 401 token', async () => {
  await mountEditor();
  let finishPut!: (response: unknown) => void;
  let submittedData!: RawFamilyData;
  let attempts = 0;
  client.functions.invoke.mockImplementation(async (_name, options) => {
    if (options.method === 'GET') return { data: { data: remoteData, sha: 'original', canEdit: true }, error: null };
    if (++attempts === 1) return failedResponse(401);
    submittedData = options.body.data;
    return new Promise(resolve => { finishPut = resolve; });
  });
  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(calls('PUT')).toHaveLength(2));
  expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(calls('GET')).toHaveLength(1);
  expect(context.currentTree?.members.map(m => m.id)).not.toContain('new');
  remoteData = submittedData;
  await act(async () => finishPut({ data: { sha: 'saved' }, error: null }));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(context.currentTree?.members.map(m => m.id)).toContain('new');
  expect(context.canUndo).toBe(true);
  expect(calls('GET')).toHaveLength(1);
});

it('preserves undo history and an unsaved form on a same-user token refresh', async () => {
  await mountEditor();
  await addMember('new');
  act(() => context.dispatch({ type: 'OPEN_MEMBER_FORM', payload: { mode: 'edit', targetId: 'parent' } }));
  fireEvent.change(screen.getByLabelText(new RegExp(t.labelFirstName)), { target: { value: 'Unsaved' } });
  await act(async () => client.auth.refreshSession());
  expect(context.canEdit).toBe(true);
  expect(context.canUndo).toBe(true);
  expect(context.state.memberFormMode).toBe('edit');
  expect((screen.getByLabelText(new RegExp(t.labelFirstName)) as HTMLInputElement).value).toBe('Unsaved');
  expect(calls('GET')).toHaveLength(1);
});

it('immediately redacts birth dates, history and the form on sign-out even if reload fails', async () => {
  await mountEditor();
  await addMember('one');
  await addMember('two');
  act(() => context.undo());
  await waitFor(() => expect(context.canRedo).toBe(true));
  expect(context.canUndo).toBe(true);
  act(() => context.dispatch({ type: 'SELECT_MEMBER', payload: 'parent' }));
  expect(screen.getByRole('complementary').textContent).toContain('3 February');
  openParentDetailsStep();
  let failLoad!: (error: Error) => void;
  client.functions.invoke.mockImplementationOnce(() => new Promise((_resolve, reject) => { failLoad = reject; }));
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => auth.signOut());
    expect(auth.session).toBeNull();
    expect(context.limitedView).toBe(true);
    expect(context.canEdit).toBe(false);
    expect(context.cloudReady).toBe(false);
    expect(context.state.memberFormMode).toBeNull();
    expect(context.state.past).toHaveLength(0);
    expect(context.state.future).toHaveLength(0);
    expect(context.currentTree?.members[0]).toMatchObject({ birthYear: 1970 });
    expect(context.currentTree?.members[0].birthDate).toBeUndefined();
    expect(buildRawExport(context.state.data!).familyTrees[0].members[0].birthDate).toBeUndefined();
    expect(screen.getByRole('complementary').textContent).not.toContain('3 February');
    await act(async () => failLoad(new Error('Offline')));
    await waitFor(() => expect(context.cloudError).toBe('Offline'));
    expect(context.currentTree?.members[0].birthDate).toBeUndefined();
  } finally {
    consoleError.mockRestore();
  }
});

it('accepts a successful limited visitor reload without restoring private dates', async () => {
  await mountEditor();
  const visitorData = JSON.parse(JSON.stringify(rawData));
  delete visitorData.familyTrees[0].members[0].birthDate;
  client.functions.invoke.mockResolvedValueOnce({ data: { data: visitorData, sha: '', canEdit: false, limited: true }, error: null });
  await act(async () => auth.signOut());
  await waitFor(() => expect(calls('GET')).toHaveLength(2));
  expect(context.limitedView).toBe(true);
  expect(context.currentTree?.members[0].birthDate).toBeUndefined();
});

it('redacts the old view during an account switch before the new load completes', async () => {
  await mountEditor();
  let finishLoad!: (response: unknown) => void;
  client.functions.invoke.mockImplementationOnce(() => new Promise(resolve => { finishLoad = resolve; }));
  act(() => authListener('SIGNED_IN', { ...initialSession, user: { ...user, id: 'different-user' } }));
  expect(context.currentTree?.members[0].birthDate).toBeUndefined();
  expect(context.canEdit).toBe(false);
  const nextData = JSON.parse(JSON.stringify(rawData)) as RawFamilyData;
  nextData.familyTrees[0].members[0].birthDate = '1970-05-06';
  await act(async () => finishLoad({ data: { data: nextData, sha: 'new-user', canEdit: true }, error: null }));
  expect(context.currentTree?.members[0].birthDate).toBe('1970-05-06');
});

it('discards a late privileged conflict reload after sign-out', async () => {
  await mountEditor();
  let finishConflict!: (response: unknown) => void;
  client.functions.invoke.mockResolvedValueOnce(failedResponse(409));
  client.functions.invoke.mockImplementationOnce(() => new Promise(resolve => { finishConflict = resolve; }));
  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(calls('GET')).toHaveLength(2));
  client.functions.invoke.mockResolvedValueOnce({ data: { data: rawData, sha: '', canEdit: false, limited: true }, error: null });
  await act(async () => auth.signOut());
  await act(async () => finishConflict({ data: { data: rawData, sha: 'privileged', canEdit: true, limited: false }, error: null }));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(context.currentTree?.members[0].birthDate).toBeUndefined();
  expect(context.canEdit).toBe(false);
  expect(context.cloudReady).toBe(false);
  expect(context.limitedView).toBe(true);
});

it('updates permission flags when conflict recovery returns limited data', async () => {
  await mountEditor();
  client.functions.invoke.mockResolvedValueOnce(failedResponse(409));
  client.functions.invoke.mockResolvedValueOnce({ data: { data: rawData, sha: '', limited: true, canEdit: false }, error: null });
  const member = context.styleNewMember({ id: 'new', firstName: 'New', lastName: 'Family', gender: 'unknown' });
  act(() => context.dispatch({ type: 'ADD_MEMBER', payload: { treeId: 'test-tree', member } }));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(context.canEdit).toBe(false);
  expect(context.cloudReady).toBe(false);
  expect(context.limitedView).toBe(true);
  expect(context.currentTree?.members[0].birthDate).toBeUndefined();
});

it('persists deceased status without a death year through save and reload', async () => {
  await mountEditor();
  openParentDetailsStep();
  fireEvent.click(screen.getByRole('switch', { name: t.labelLiving }));
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  await waitFor(() => expect(context.state.memberFormMode).toBeNull());
  expect(remoteData.familyTrees[0].members[0]).toMatchObject({ isDeceased: true, deathYear: null });
  expect(context.currentTree?.members[0].age).toBeNull();
  act(() => context.resetData());
  await waitFor(() => expect(calls('GET')).toHaveLength(2));
  await waitFor(() => expect(context.canEdit).toBe(true));
  openParentDetailsStep();
  expect(screen.getByRole('switch', { name: t.labelLiving }).getAttribute('aria-checked')).toBe('false');
  act(() => context.dispatch({ type: 'CLOSE_MEMBER_FORM' }));
  act(() => context.dispatch({ type: 'SELECT_MEMBER', payload: 'parent' }));
  expect(screen.getByRole('complementary').textContent).toContain(t.tlVerbDied);
  expect(screen.getByRole('complementary').textContent).not.toContain(t.detailsAge(new Date().getFullYear() - 1970));
  act(() => context.dispatch({ type: 'SET_ADVANCED_FILTER', payload: { livingOnly: true } }));
  expect(context.advancedMatchedIds.has('parent')).toBe(false);
  act(() => context.dispatch({ type: 'SET_ADVANCED_FILTER', payload: { livingOnly: false, marriageEligible: true } }));
  expect(context.advancedMatchedIds.has('parent')).toBe(false);
});

it('clears death information when a deceased member is changed back to living', async () => {
  Object.assign(remoteData.familyTrees[0].members[0], { isDeceased: true, deathYear: 2020, deathDate: '2020-04-01' });
  await mountEditor();
  openParentDetailsStep();
  fireEvent.click(screen.getByRole('switch', { name: t.labelLiving }));
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  await waitFor(() => expect(context.state.memberFormMode).toBeNull());
  expect(remoteData.familyTrees[0].members[0]).toMatchObject({ isDeceased: false, deathYear: null });
  expect(remoteData.familyTrees[0].members[0].deathDate).toBeUndefined();
  expect(context.currentTree?.members[0].age).toBe(new Date().getFullYear() - 1970);
});

it('rejects a retained January 31 after the month changes to February', async () => {
  await mountEditor();
  openParentDetailsStep();
  fireEvent.change(screen.getByLabelText(t.labelBirthMonth), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthDay), { target: { value: '31' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthMonth), { target: { value: '2' } });
  const day = screen.getByLabelText(t.labelBirthDay) as HTMLSelectElement;
  expect(day.value).toBe('31');
  expect(day.selectedOptions[0].disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  expect(screen.getByRole('alert').textContent).toBe(t.invalidDate);
  expect(calls('PUT')).toHaveLength(0);
});

it('rejects a retained leap day after the year changes from 2000 to 1900', async () => {
  await mountEditor();
  openParentDetailsStep();
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthDay), { target: { value: '29' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: '1900' } });
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  expect(screen.getByRole('alert').textContent).toBe(t.invalidDate);
  expect(calls('PUT')).toHaveLength(0);
});

it('accepts a valid leap day', async () => {
  await mountEditor();
  openParentDetailsStep();
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthDay), { target: { value: '29' } });
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  await waitFor(() => expect(context.state.memberFormMode).toBeNull());
  expect(remoteData.familyTrees[0].members[0].birthDate).toBe('2000-02-29');
});

it('blocks a death before birth within the same year', async () => {
  await mountEditor();
  openParentDetailsStep();
  fireEvent.change(screen.getByLabelText(t.labelBirthYear), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthMonth), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText(t.labelBirthDay), { target: { value: '31' } });
  fireEvent.click(screen.getByRole('switch', { name: t.labelLiving }));
  fireEvent.change(screen.getByLabelText(t.labelDeathYear), { target: { value: '2000' } });
  fireEvent.change(screen.getByLabelText(t.labelDeathMonth), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(t.labelDeathDay), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: t.btnSaveChanges }));
  expect(screen.getByRole('alert').textContent).toBe(t.deathBeforeBirth);
  expect(calls('PUT')).toHaveLength(0);
});

it.each(['Enter', ' '])('activates a focused search-result button with a native %s click', async key => {
  await mountEditor();
  fireEvent.click(screen.getByRole('button', { name: t.searchExpandTooltip }));
  const result = screen.getByRole('button', { name: /Child/ });
  act(() => result.focus());
  fireEvent.keyDown(result, { key });
  fireEvent.keyUp(result, { key });
  // jsdom does not synthesize the browser's native keyboard click.
  fireEvent.click(result, { detail: 0 });
  expect(context.state.selectedMemberId).toBe('child');
});

it('selects a pointer result exactly once when the tracer is active', async () => {
  await mountEditor();
  act(() => context.dispatch({ type: 'TOGGLE_REL_MODE' }));
  act(() => screen.getByRole('textbox', { name: t.searchPlaceholder }).focus());
  const result = screen.getByRole('button', { name: /Child/ });
  fireEvent.mouseDown(result);
  expect(context.state.relSource).toBeNull();
  fireEvent.mouseUp(result);
  fireEvent.click(result);
  expect(context.state.selectedMemberId).toBe('child');
  expect(context.state.relSource).toBe('child');
  expect(context.state.relTarget).toBeNull();
});

it('documents the same GitHub repository and file as the Edge Function defaults', () => {
  const readme = fs.readFileSync(path.join(process.cwd(), 'README.md'), 'utf8');
  const edgeFunction = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', 'family-data', 'index.ts'), 'utf8');
  const documentedRepo = readme.match(/access token restricted to `([^`]+)`/)?.[1];
  const owner = edgeFunction.match(/const GITHUB_OWNER = '([^']+)'/)?.[1];
  const repo = edgeFunction.match(/const GITHUB_REPO = [^\n]+\?\? '([^']+)'/)?.[1];
  const file = edgeFunction.match(/const GITHUB_FILE_PATH = [^\n]+\?\? '([^']+)'/)?.[1];
  expect(documentedRepo).toBe(`${owner}/${repo}`);
  expect(readme).toContain(`Its default Contents API target is \`${file}\` in \`${owner}/${repo}\``);
});
