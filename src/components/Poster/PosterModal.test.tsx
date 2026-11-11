import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { translations } from '../../i18n/translations';
import { processAllFamilyData } from '../../processing/dataProcessor';
import PosterModal from './PosterModal';

jest.mock('../../context/FamilyTreeContext', () => ({
  ...jest.requireActual('../../context/FamilyTreeContext'), useFamilyTree: jest.fn(),
}));
jest.mock('../../context/LanguageContext', () => ({ useLanguage: jest.fn() }));
jest.mock('../../lib/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));

const t = translations.en;
const measureText = jest.fn((value: string) => ({ width: Array.from(value).length * 8 }));
const data = processAllFamilyData({ familyTrees: [{
  familyTreeId: 'test', familyTreeDisplayName: 'Example Family',
  members: [
    { id: 'dad', firstName: 'Ramchandra Vithoba', firstName_mr: 'रामचंद्र विठोबा', lastName: 'Family', gender: 'male', birthYear: 1930, deathYear: 2000 },
    { id: 'mom', firstName: 'Sita', firstName_mr: 'सीता', lastName: 'Family', gender: 'female', birthYear: 1935, deathYear: null },
    { id: 'son', firstName: 'Lav', firstName_mr: 'लव', lastName: 'Family', gender: 'male', birthYear: 1960, deathYear: null },
    { id: 'daughter', firstName: 'Uma', firstName_mr: 'उमा', lastName: 'Family', gender: 'female', birthYear: 1965, deathYear: null },
  ],
  relationships: {
    spouses: [{ spouse1Id: 'dad', spouse2Id: 'mom' }],
    parentChild: [{ parentId: 'dad', childId: 'son' }, { parentId: 'dad', childId: 'daughter' }],
  },
}] });
const descriptors = {
  width: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
  media: Object.getOwnPropertyDescriptor(window, 'matchMedia'),
  fetch: Object.getOwnPropertyDescriptor(globalThis, 'fetch'),
  fonts: Object.getOwnPropertyDescriptor(document, 'fonts'),
  objectUrl: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeUrl: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  decode: Object.getOwnPropertyDescriptor(Image.prototype, 'decode'),
};
let context: { state: { selectedMemberId: string | null }; currentTree: typeof data.familyTreesStyled[0] | null };

beforeEach(() => {
  jest.clearAllMocks();
  measureText.mockImplementation(value => ({ width: Array.from(value).length * 8 }));
  context = { state: { selectedMemberId: 'dad' }, currentTree: data.familyTreesStyled[0] };
  (useFamilyTree as jest.Mock).mockImplementation(() => context);
  (useLanguage as jest.Mock).mockReturnValue({ lang: 'en', t });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '', measureText: (value: string) => measureText(value), drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  jest.restoreAllMocks();
  const restore = (object: object, property: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) Object.defineProperty(object, property, descriptor);
    else Reflect.deleteProperty(object, property);
  };
  restore(window, 'innerWidth', descriptors.width);
  restore(window, 'matchMedia', descriptors.media);
  restore(globalThis, 'fetch', descriptors.fetch);
  restore(document, 'fonts', descriptors.fonts);
  restore(URL, 'createObjectURL', descriptors.objectUrl);
  restore(URL, 'revokeObjectURL', descriptors.revokeUrl);
  restore(Image.prototype, 'decode', descriptors.decode);
  document.body.classList.remove('poster-printing');
});

describe('poster UX', () => {
it('groups poster family and appearance settings in the desktop sidebar', () => {
  render(<PosterModal onClose={jest.fn()} />);
  const sidebar = screen.getByRole('complementary', { name: t.posterCustomize });
  expect(within(sidebar).getByRole('group', { name: t.posterFamilyControls })).toBeTruthy();
  expect(within(sidebar).getByRole('group', { name: t.posterAppearance })).toBeTruthy();
  expect(within(sidebar).getAllByRole('radio')).toHaveLength(4);
  expect((screen.getByRole('radio', { name: t.posterThemeNames.autumn }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('100%');
  expect(screen.queryByRole('button', { name: t.posterCustomize })).toBeNull();
});

it('filters starting people without changing the poster until a person is selected', () => {
  render(<PosterModal onClose={jest.fn()} />);
  const search = screen.getByRole('searchbox', { name: t.posterFindPerson });
  fireEvent.change(search, { target: { value: 'Lav' } });
  const picker = screen.getByRole('combobox', { name: t.posterStartFrom }) as HTMLSelectElement;
  expect(picker.value).toBe('');
  expect(within(picker).getByRole('option', { name: /Lav/ })).toBeTruthy();
  fireEvent.change(picker, { target: { value: 'son' } });
  expect(picker.value).toBe('son');
  expect((search as HTMLInputElement).value).toBe('');
  fireEvent.change(search, { target: { value: 'no-such-person' } });
  expect(screen.getByText(t.posterNoMatches)).toBeTruthy();
  expect(picker.disabled).toBe(true);
});

it.each(['heritage', 'readable'])('keeps long names on one line at the original %s font size', style => {
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: t.posterNameStyle }), { target: { value: style } });
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const name = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === 'Ramchandra Vithoba');
  expect(name.style.fontFamily).toBe(style === 'readable' ? 'Georgia, serif' : "'Poster Great Vibes', 'Brush Script MT', cursive");
  expect(name.style.fontSize).toBe(style === 'readable' ? '18px' : '23px');
  expect(within(name).queryByText((_content, element) => element?.tagName === 'tspan')).toBeNull();
  expect(name.hasAttribute('textLength')).toBe(false);
  const outline = within(image).getByText((_content, element) => element?.tagName === 'path' && element.getAttribute('fill') === 'url(#poster-tag-focus)');
  const path = outline.getAttribute('d')!;
  expect(Number(path.match(/H([-\d.]+)/)![1]) - Number(path.match(/^M([-\d.]+),/)![1]) + 3 + 18).toBeGreaterThanOrEqual(174);
});

it.each(['Dnyaneshwarsheth', 'Tarachandsheth', 'KesarBai (Vatsalabai)'])('does not split the example name %s', firstName => {
  context.currentTree = {
    ...data.familyTreesStyled[0],
    members: data.familyTreesStyled[0].members.map(member => member.id === 'dad' ? { ...member, firstName } : member),
  };
  render(<PosterModal onClose={jest.fn()} />);
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const name = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === firstName);
  expect(within(name).queryByText((_content, element) => element?.tagName === 'tspan')).toBeNull();
  expect(name.hasAttribute('textLength')).toBe(false);
});

it('fits an oversized grapheme without clipping it or crowding adjacent cards', () => {
  const name = 'क्ष्'.repeat(12) + 'क्षि';
  measureText.mockImplementation(value => value === name ? {
    width: 600, actualBoundingBoxLeft: 300, actualBoundingBoxRight: 300,
    actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 30,
  } : { width: Array.from(value).length * 8 });
  context.currentTree = {
    ...data.familyTreesStyled[0],
    members: data.familyTreesStyled[0].members.map(member => member.id === 'dad' ? { ...member, firstName: name } : member),
  };
  render(<PosterModal onClose={jest.fn()} />);
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const outline = within(image).getByText((_content, element) => element?.tagName === 'path' && element.getAttribute('fill') === 'url(#poster-tag-focus)');
  const path = outline.getAttribute('d')!;
  const start = Number(path.match(/^M([-\d.]+),/)![1]);
  const end = Number(path.match(/H([-\d.]+)/)![1]);
  expect(end - start + 3 + 18).toBeGreaterThanOrEqual(630);
  expect(Number(image.getAttribute('viewBox')!.split(' ')[2])).toBeGreaterThan(1200);
  const label = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === name);
  expect(label.style.fontSize).toBe('23px');
  expect(label.hasAttribute('textLength')).toBe(false);
  const top = Number(path.match(/^M[-\d.]+,([-\d.]+)/)![1]);
  expect(Number(label.getAttribute('y')) - top).toBeGreaterThanOrEqual(81);
});

it('fits cursive overhang and tall accents even in a short name', () => {
  const name = 'Wyatt';
  measureText.mockImplementation(value => value === name ? {
    width: 50, actualBoundingBoxLeft: 60, actualBoundingBoxRight: 28,
    actualBoundingBoxAscent: 35, actualBoundingBoxDescent: 12,
  } : { width: Array.from(value).length * 8 });
  context.currentTree = {
    ...data.familyTreesStyled[0],
    members: data.familyTreesStyled[0].members.map(member => member.id === 'dad' ? { ...member, firstName: name } : member),
  };
  render(<PosterModal onClose={jest.fn()} />);
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const outline = within(image).getByText((_content, element) => element?.tagName === 'path' && element.getAttribute('fill') === 'url(#poster-tag-focus)');
  const path = outline.getAttribute('d')!;
  const start = Number(path.match(/^M([-\d.]+),/)![1]);
  const end = Number(path.match(/H([-\d.]+)/)![1]);
  expect(end - start + 3 + 18).toBeGreaterThanOrEqual(150);
  const label = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === name);
  const top = Number(path.match(/^M[-\d.]+,([-\d.]+)/)![1]);
  expect(Number(label.getAttribute('y')) - top).toBeGreaterThanOrEqual(46);
});

it('remeasures unchanged names when additional fonts finish loading', async () => {
  const fonts = Object.assign(document.createDocumentFragment(), { load: jest.fn().mockResolvedValue([]), ready: Promise.resolve() });
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  const name = 'क्ष्'.repeat(10) + 'मि';
  let inkWidth = 50;
  measureText.mockImplementation(value => value === name ? {
    width: inkWidth, actualBoundingBoxLeft: inkWidth / 2, actualBoundingBoxRight: inkWidth / 2,
    actualBoundingBoxAscent: 23, actualBoundingBoxDescent: 6,
  } : { width: Array.from(value).length * 8 });
  context.currentTree = {
    ...data.familyTreesStyled[0],
    members: data.familyTreesStyled[0].members.map(member => member.id === 'dad' ? { ...member, firstName: name } : member),
  };
  render(<PosterModal onClose={jest.fn()} />);
  await waitFor(() => expect(measureText.mock.calls.filter(call => call[0] === name).length).toBeGreaterThan(1));
  inkWidth = 300;
  fireEvent(fonts, new Event('loadingdone'));
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const outline = within(image).getByText((_content, element) => element?.tagName === 'path' && element.getAttribute('fill') === 'url(#poster-tag-focus)');
  const path = outline.getAttribute('d')!;
  expect(Number(path.match(/H([-\d.]+)/)![1]) - Number(path.match(/^M([-\d.]+),/)![1]) + 3 + 18).toBeGreaterThanOrEqual(330);
});

it('keeps an unbreakable name on its card when canvas measurement is unavailable', () => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const name = 'क्ष्'.repeat(6) + 'क्षि';
  context.currentTree = {
    ...data.familyTreesStyled[0],
    members: data.familyTreesStyled[0].members.map(member => member.id === 'dad' ? { ...member, firstName: name } : member),
  };
  render(<PosterModal onClose={jest.fn()} />);
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  const outline = within(image).getByText((_content, element) => element?.tagName === 'path' && element.getAttribute('fill') === 'url(#poster-tag-focus)');
  const path = outline.getAttribute('d')!;
  expect(Number(path.match(/H([-\d.]+)/)![1]) - Number(path.match(/^M([-\d.]+),/)![1]) + 3 + 18).toBeGreaterThan(158);
  expect(within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === name)).toBeTruthy();
});

it('localizes the poster controls and preserves Marathi names', () => {
  (useLanguage as jest.Mock).mockReturnValue({ lang: 'mr', t: translations.mr });
  render(<PosterModal onClose={jest.fn()} />);
  expect(screen.getByRole('group', { name: translations.mr.posterAppearance })).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: translations.mr.posterNameStyle }), { target: { value: 'readable' } });
  const image = screen.getByRole('img', { name: translations.mr.posterFamilyName('Family') });
  const name = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === 'रामचंद्र विठोबा');
  expect(within(name).queryByText((_content, element) => element?.tagName === 'tspan')).toBeNull();
  expect(name.hasAttribute('textLength')).toBe(false);
});

it('leaves room between the heart and readable Marathi spouse names', () => {
  (useLanguage as jest.Mock).mockReturnValue({ lang: 'mr', t: translations.mr });
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: translations.mr.posterNameStyle }), { target: { value: 'readable' } });
  const image = screen.getByRole('img', { name: translations.mr.posterFamilyName('Family') });
  const heart = within(image).getByText('♥');
  const spouse = within(image).getByText((_content, element) => element?.tagName === 'text' && element.textContent === 'सीता');
  expect(Number(spouse.getAttribute('y')) - Number(heart.getAttribute('y'))).toBeGreaterThanOrEqual(22);
});

it('resets the poster to 100% and makes Fit an idempotent action', () => {
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: t.tooltipZoomIn }));
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('125%');
  fireEvent.click(screen.getByRole('button', { name: t.posterResetView }));
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('100%');
  const fit = screen.getByRole('button', { name: t.posterFit });
  fireEvent.click(fit);
  fireEvent.click(fit);
  expect(fit.getAttribute('aria-pressed')).toBe('true');
});

it('does not zoom in when zoom-out is requested below the nominal minimum', () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const viewBox = this.classList.contains('poster-sheet') ? screen.getByRole('img', { name: t.posterFamilyName('Family') }).getAttribute('viewBox')?.split(' ').map(Number) : null;
    return { x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 400, width: viewBox ? viewBox[2] * 0.05 : 500, height: viewBox ? viewBox[3] * 0.05 : 400, toJSON: () => ({}) };
  });
  render(<PosterModal onClose={jest.fn()} />);
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('5%');
  expect((screen.getByRole('button', { name: t.tooltipZoomOut }) as HTMLButtonElement).disabled).toBe(true);
  const image = screen.getByRole('img', { name: t.posterFamilyName('Family') });
  fireEvent.wheel(image, { ctrlKey: true, deltaY: 100 });
  expect(screen.getByRole('button', { name: t.posterFit }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('5%');
});

it('opens a mobile sheet, traps focus, and dismisses it before closing the poster', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  const close = jest.fn();
  render(<PosterModal onClose={close} />);
  expect(screen.queryByRole('combobox', { name: t.posterNameStyle })).toBeNull();
  const customize = screen.getByRole('button', { name: t.posterCustomize });
  customize.focus();
  fireEvent.click(customize);
  const sheet = screen.getByRole('dialog', { name: t.posterCustomize });
  const closeSheet = within(sheet).getByRole('button', { name: t.posterCloseCustomization });
  const done = within(sheet).getByRole('button', { name: t.posterDone });
  expect(closeSheet.matches(':focus')).toBe(true);
  fireEvent.keyDown(closeSheet, { key: 'Tab', shiftKey: true });
  expect(done.matches(':focus')).toBe(true);
  fireEvent.keyDown(done, { key: 'Tab' });
  expect(closeSheet.matches(':focus')).toBe(true);
  fireEvent.keyDown(closeSheet, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog', { name: t.posterCustomize })).toBeNull();
  expect(customize.matches(':focus')).toBe(true);
  fireEvent.keyDown(customize, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});

it('keeps mobile customization changes after Done and adapts to desktop resizing', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: t.posterCustomize }));
  fireEvent.click(screen.getByRole('radio', { name: t.posterThemeNames.spring }));
  fireEvent.click(screen.getByRole('button', { name: t.posterDone }));
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  fireEvent(window, new Event('resize'));
  expect(screen.getByRole('complementary', { name: t.posterCustomize })).toBeTruthy();
  expect((screen.getByRole('radio', { name: t.posterThemeNames.spring }) as HTMLInputElement).checked).toBe(true);
});

it('selects a valid poster root when family data arrives after opening', () => {
  context.currentTree = null;
  const view = render(<PosterModal onClose={jest.fn()} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  context.currentTree = data.familyTreesStyled[0];
  view.rerender(<PosterModal onClose={jest.fn()} />);
  expect((screen.getByRole('combobox', { name: t.posterStartFrom }) as HTMLSelectElement).value).toBe('dad');
  fireEvent.wheel(screen.getByRole('img', { name: t.posterFamilyName('Family') }), { ctrlKey: true, deltaY: -100 });
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('122%');
});

it('measures Fit after late-arriving data even when the poster dimensions stay unchanged', () => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const viewBox = this.classList.contains('poster-sheet') ? screen.getByRole('img', { name: t.posterFamilyName('Family') }).getAttribute('viewBox')?.split(' ').map(Number) : null;
    return { x: 0, y: 0, left: 0, top: 0, right: 500, bottom: 400, width: viewBox ? viewBox[2] * 0.5 : 500, height: viewBox ? viewBox[3] * 0.5 : 400, toJSON: () => ({}) };
  });
  context.currentTree = null;
  const view = render(<PosterModal onClose={jest.fn()} />);
  context.currentTree = processAllFamilyData({ familyTrees: [{
    familyTreeId: 'single', familyTreeDisplayName: 'Family',
    members: [{ id: 'dad', firstName: 'Ram', lastName: 'Family', gender: 'male', birthYear: null, deathYear: null }],
    relationships: { parentChild: [], spouses: [] },
  }] }).familyTreesStyled[0];
  view.rerender(<PosterModal onClose={jest.fn()} />);
  expect(screen.getByRole('status', { name: t.posterZoomLevel }).textContent).toBe('50%');
});

it('rejects unsuccessful poster-font responses and re-enables the controls', async () => {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: jest.fn().mockResolvedValue({ ok: false, status: 404 }) });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<PosterModal onClose={jest.fn()} />);
  const download = screen.getByRole('button', { name: t.posterDownload });
  const nameStyle = screen.getByRole('combobox', { name: t.posterNameStyle });
  fireEvent.click(download);
  expect(nameStyle.matches(':disabled')).toBe(true);
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.alertExportFailed));
  expect((download as HTMLButtonElement).disabled).toBe(false);
  expect(nameStyle.matches(':disabled')).toBe(false);
});

it('exports the readable, single-line SVG as PNG without editor controls', async () => {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }) }) });
  Object.defineProperty(Image.prototype, 'decode', { configurable: true, value: jest.fn().mockResolvedValue(undefined) });
  const objectUrl = jest.fn().mockReturnValue('blob:poster');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: objectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['png'], { type: 'image/png' })));
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.change(screen.getByRole('combobox', { name: t.posterNameStyle }), { target: { value: 'readable' } });
  fireEvent.click(screen.getByRole('button', { name: t.posterDownload }));
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  const svg = objectUrl.mock.calls[0][0] as Blob;
  const serialized = await new Promise<string>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(svg);
  });
  expect(serialized).toContain('Georgia, serif');
  expect(serialized).toContain('text-rendering: geometricPrecision');
  expect(serialized).not.toContain('<tspan');
  expect(serialized).toContain('Ramchandra Vithoba');
  expect(serialized).not.toContain('poster-sidebar');
  expect(serialized).not.toContain('poster-zoom-dock');
  expect(toast.error).not.toHaveBeenCalled();
});

it('prints the poster and removes the print-only state afterwards', () => {
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  render(<PosterModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: t.menuPrint }));
  expect(print).toHaveBeenCalledTimes(1);
  expect(document.body.classList.contains('poster-printing')).toBe(true);
  fireEvent(window, new Event('afterprint'));
  expect(document.body.classList.contains('poster-printing')).toBe(false);
});
});
