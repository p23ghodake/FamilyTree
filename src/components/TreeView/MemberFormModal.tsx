import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../lib/AuthContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { AlertTriangleIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, FemaleIcon, HelpCircleIcon, MaleIcon, Trash2Icon, XIcon } from '../Icons';
import { transliterateToMarathi } from '../../processing/transliteration';
import { findDuplicates } from '../../processing/duplicateDetection';
import { sanitizeImageUrl } from '../../processing/dataValidation';
import toast from 'react-hot-toast';
import { ageOnDate, getCurrentSpouseId, hasUnderageChildren } from '../../processing/spouseRules';
import { computeAge } from '../../processing/ageCalculation';
import YearPicker from '../YearPicker';
import { RelationshipSection, RelationshipType } from './RelationshipSection';
import { PhotoUploadSection } from './PhotoUploadSection';
import { MarriageHistorySection } from './MarriageHistorySection';
import { useDialog } from '../useDialog';
import './MemberFormModal.css';

// ─── Form field state ───

interface FormFields {
  firstName: string;
  lastName: string;
  firstName_mr: string;
  lastName_mr: string;
  gender: 'male' | 'female' | 'unknown';
  birthYear: string;
  birthMonth: string;   // '1'–'12' or ''
  birthDay: string;     // '1'–'31' or ''
  deathYear: string;
  deathMonth: string;
  deathDay: string;
  occupation: string;
  location: string;
  notes: string;
  imageUrl: string;
  isPrimaryInTree: boolean;
}

const EMPTY_FIELDS: FormFields = {
  firstName: '',
  lastName: '',
  firstName_mr: '',
  lastName_mr: '',
  gender: 'unknown',
  birthYear: '',
  birthMonth: '',
  birthDay: '',
  deathYear: '',
  deathMonth: '',
  deathDay: '',
  occupation: '',
  location: '',
  notes: '',
  imageUrl: '',
  isPrimaryInTree: false,
};

/** Parse "YYYY-MM-DD" or "YYYY-MM" into { month, day } parts (empty if absent) */
function parseDateParts(isoDate: string | null | undefined): { month: string; day: string } {
  if (!isoDate) return { month: '', day: '' };
  const parts = isoDate.split('-');
  return {
    month: parts[1] ? String(parseInt(parts[1], 10)) : '',
    day:   parts[2] ? String(parseInt(parts[2], 10)) : '',
  };
}

/** Build ISO date string from year + optional month + optional day */
function buildIsoDate(year: string, month: string, day: string): string | null {
  if (!year) return null;
  const y = year.padStart(4, '0');
  if (!month) return null;                      // only year → skip (birthYear covers it)
  const m = month.padStart(2, '0');
  if (!day) return `${y}-${m}`;               // year + month
  return `${y}-${m}-${day.padStart(2, '0')}`; // full date
}

function memberToFields(m: StyledFamilyMember): FormFields {
  const bParts = parseDateParts(m.birthDate);
  const dParts = parseDateParts(m.deathDate);
  return {
    firstName: m.firstName,
    lastName: m.lastName,
    firstName_mr: m.firstName_mr ?? '',
    lastName_mr: m.lastName_mr ?? '',
    gender: m.gender as 'male' | 'female' | 'unknown',
    birthYear:  m.birthYear !== null ? String(m.birthYear) : '',
    birthMonth: bParts.month,
    birthDay:   bParts.day,
    deathYear:  m.deathYear !== null ? String(m.deathYear) : '',
    deathMonth: dParts.month,
    deathDay:   dParts.day,
    occupation: m.occupation ?? '',
    location:   m.location ?? '',
    notes:      m.notes ?? '',
    imageUrl:   m.imageUrl ?? '',
    isPrimaryInTree: m.isPrimaryInTree ?? false,
  };
}

// ─── Unique ID generator ───

function generateId(): string {
  return `member-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

type StepId = 'relation' | 'who' | 'details';
type FormErrors = Partial<Record<keyof FormFields | 'relationship', string>>;

function stepOfError(key: string): StepId {
  if (key === 'relationship') return 'relation';
  return key === 'firstName' || key === 'lastName' ? 'who' : 'details';
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// ─── Modal Component ───

const MemberFormModal: React.FC = () => {
  const { state, dispatch, currentTree, styleNewMember, isSaving, canEdit } = useFamilyTree();
  const { isAdmin } = useAuth();
  const { t } = useLanguage();
  const { memberFormMode, memberFormTargetId } = state;

  const targetMember = memberFormMode && memberFormTargetId && currentTree
    ? currentTree.members.find(m => m.id === memberFormTargetId) ?? null
    : null;

  const isEdit = memberFormMode === 'edit';
  const editMember = isEdit ? targetMember : null;
  const isStandaloneAdd = memberFormMode === 'add';
  const steps: StepId[] = isStandaloneAdd ? ['relation', 'who', 'details'] : ['who', 'details'];

  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [living, setLiving] = useState(true);
  const [editingMarathi, setEditingMarathi] = useState(false);

  // Relationship state — only used when mode === 'add'
  const [relationType, setRelationType] = useState<RelationshipType>('none');
  const [relatedMemberId, setRelatedMemberId] = useState<string>('');

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;

  // Pre-fill form when opening
  useEffect(() => {
    if (!memberFormMode) return;
    if (isEdit && editMember) {
      setFields(memberToFields(editMember));
      setLiving(editMember.deathYear === null && !editMember.deathDate);
    } else {
      const lastName = targetMember?.lastName ?? '';
      setFields({ ...EMPTY_FIELDS, lastName });
      setLiving(true);
    }
    setRelationType('none');
    setRelatedMemberId('');
    setErrors({});
    setStepIndex(0);
    setEditingMarathi(false);
    setConfirmingDelete(false);
  }, [memberFormMode, memberFormTargetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Members available to link as a relationship target
  const members = currentTree?.members;
  const allMembers = useMemo(() => members ?? [], [members]);

  // Duplicate detection — only while adding (not editing)
  const duplicates = useMemo(() => {
    if (isEdit) return [];
    return findDuplicates(
      fields.firstName,
      fields.lastName,
      fields.birthYear ? parseInt(fields.birthYear) : null,
      allMembers,
    );
  }, [isEdit, fields.firstName, fields.lastName, fields.birthYear, allMembers]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const handleNameBlur = useCallback(async (field: 'firstName' | 'lastName') => {
    const value = fields[field];
    const mrField = field === 'firstName' ? 'firstName_mr' : 'lastName_mr';
    if (value && !fields[mrField]) {
      const transliterated = await transliterateToMarathi(value);
      if (transliterated) {
        // Don't overwrite a Marathi name typed while the request was in flight.
        setFields(prev => prev[mrField] ? prev : { ...prev, [mrField]: transliterated });
      }
    }
  }, [fields]);

  const collectErrors = (): FormErrors => {
    const errs: FormErrors = {};
    if (!fields.firstName.trim()) errs.firstName = t.firstNameRequired;
    if (!fields.lastName.trim()) errs.lastName = t.lastNameRequired;
    const by = parseInt(fields.birthYear);
    const dy = living ? NaN : parseInt(fields.deathYear);
    if (fields.birthYear && isNaN(by)) errs.birthYear = t.invalidYear;
    if (!living && fields.deathYear && isNaN(dy)) errs.deathYear = t.invalidYear;
    if (fields.birthYear && !isNaN(by) && !isNaN(dy) && dy < by) {
      errs.deathYear = t.deathBeforeBirth;
    }
    const url = fields.imageUrl.trim();
    if (url && sanitizeImageUrl(url) === null) {
      errs.imageUrl = t.alertImageInvalidUrl;
    }
    const targetId = isStandaloneAdd ? relatedMemberId : memberFormTargetId;
    const needsTarget = !isEdit && ((isStandaloneAdd && relationType !== 'none') || memberFormMode === 'addChild' || memberFormMode === 'addSpouse');
    const relatedMember = allMembers.find(member => member.id === targetId);
    if (needsTarget && !relatedMember) errs.relationship = t.chooseMember;
    const addingSpouse = memberFormMode === 'addSpouse' || (isStandaloneAdd && relationType === 'spouseOf');
    if (addingSpouse) {
      const newAge = ageOnDate(buildIsoDate(fields.birthYear, fields.birthMonth, fields.birthDay))
        ?? computeAge(fields.birthYear ? by : null, isNaN(dy) ? null : dy);
      const minAge = fields.gender === 'female' ? 18 : 21;
      if (newAge !== null && newAge < minAge) {
        errs.birthYear = t.belowMarriageAge(`${fields.firstName} ${fields.lastName}`, newAge, minAge);
      }
      if (relatedMember) {
        const relatedAge = ageOnDate(relatedMember.birthDate) ?? relatedMember.age;
        const relatedMinAge = relatedMember.gender === 'female' ? 18 : 21;
        if (relatedAge !== null && relatedAge < relatedMinAge) {
          errs.relationship = t.belowMarriageAge(relatedMember.fullName, relatedAge, relatedMinAge);
        }
      }
    }
    return errs;
  };

  const goToStep = (index: number) => {
    setErrors({});
    setConfirmingDelete(false);
    setStepIndex(index);
  };

  const handleNext = () => {
    const stepErrors = Object.fromEntries(
      Object.entries(collectErrors()).filter(([key]) => stepOfError(key) === step),
    ) as FormErrors;
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleSave = () => {
    if (isSaving || !canEdit || !currentTree) return;
    const errs = collectErrors();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstStep = steps.find(s => Object.keys(errs).some(key => stepOfError(key) === s));
      if (firstStep) setStepIndex(steps.indexOf(firstStep));
      return;
    }
    setErrors({});

    const rawPartial: Parameters<typeof styleNewMember>[0] = {
      id: isEdit && editMember ? editMember.id : generateId(),
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      firstName_mr: fields.firstName_mr.trim() || undefined,
      lastName_mr: fields.lastName_mr.trim() || undefined,
      gender: fields.gender,
      birthYear: fields.birthYear ? parseInt(fields.birthYear) : null,
      deathYear: !living && fields.deathYear ? parseInt(fields.deathYear) : null,
      birthDate: buildIsoDate(fields.birthYear, fields.birthMonth, fields.birthDay),
      deathDate: living ? null : buildIsoDate(fields.deathYear, fields.deathMonth, fields.deathDay),
      occupation: fields.occupation.trim() || null,
      location: fields.location.trim() || null,
      notes: fields.notes.trim() || null,
      imageUrl: fields.imageUrl.trim() || null,
      isPrimaryInTree: fields.isPrimaryInTree,
      // Preserve existing relationship data for edits
      ...(isEdit && editMember ? {
        spouseId: editMember.spouseId,
        parentIds: editMember.parentIds,
        childrenIds: editMember.childrenIds,
        middleName: editMember.middleName,
        middleName_mr: editMember.middleName_mr,
        generationIndex: editMember.generationIndex,
      } : {}),
    };

    const styledMember = styleNewMember(rawPartial);

    if (isEdit) {
      dispatch({ type: 'UPDATE_MEMBER', payload: { treeId: currentTree.familyTreeId, member: styledMember } });
      return;
    }

    let relType: 'child' | 'spouse' | undefined;
    let relatedId: string | undefined;

    if (memberFormMode === 'addChild') {
      relType = 'child'; relatedId = memberFormTargetId ?? undefined;
    } else if (memberFormMode === 'addSpouse') {
      relType = 'spouse'; relatedId = memberFormTargetId ?? undefined;
    } else if (isStandaloneAdd && relatedMemberId) {
      if (relationType === 'childOf') {
        relType = 'child'; relatedId = relatedMemberId;
      } else if (relationType === 'spouseOf') {
        relType = 'spouse'; relatedId = relatedMemberId;
      } else if (relationType === 'parentOf') {
        dispatch({
          type: 'ADD_MEMBER',
          payload: { treeId: currentTree.familyTreeId, member: styledMember, relatedId: relatedMemberId, relType: 'parentOf' },
        });
        return;
      }
    }

    if (relType === 'spouse' && relatedId &&
        (getCurrentSpouseId(currentTree, relatedId) || hasUnderageChildren(currentTree, relatedId))) {
      toast.error(getCurrentSpouseId(currentTree, relatedId) ? t.alertAlreadyHasSpouse : t.tooltipSpouseChildrenAge);
      return;
    }

    dispatch({
      type: 'ADD_MEMBER',
      payload: { treeId: currentTree.familyTreeId, member: styledMember, relatedId, relType },
    });
  };

  const handleDelete = () => {
    if (isSaving || !canEdit || !isAdmin || !isEdit || !editMember || !currentTree) return;
    dispatch({ type: 'DELETE_MEMBER', payload: { treeId: currentTree.familyTreeId, memberId: editMember.id } });
  };

  const handleClose = useCallback(() => {
    if (isSaving) return;
    setConfirmingDelete(false);
    dispatch({ type: 'CLOSE_MEMBER_FORM' });
  }, [dispatch, isSaving]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const returnMemberIdRef = useRef<string | null>(null);
  if (memberFormMode) returnMemberIdRef.current = memberFormTargetId;
  const focusReturnMember = useCallback(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-member-id]'));
    return nodes.find(node => node.dataset.memberId === returnMemberIdRef.current)?.querySelector<HTMLElement>('.pnode__circle') ?? null;
  }, []);
  useDialog(dialogRef, handleClose, !!memberFormMode, focusReturnMember);

  // Move focus to the new step's starting point so keyboard and screen-reader users follow along.
  const shownStepRef = useRef(stepIndex);
  useEffect(() => {
    if (shownStepRef.current === stepIndex) return;
    shownStepRef.current = stepIndex;
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [stepIndex]);

  if (!memberFormMode) return null;

  const title = memberFormMode === 'edit' ? t.modalTitleEdit
    : memberFormMode === 'addChild' ? t.modalTitleAddChild
    : memberFormMode === 'addSpouse' ? t.modalTitleAddSpouse
    : t.modalTitleAddMember;
  const contextLabel = !targetMember ? ''
    : memberFormMode === 'addChild' ? `${t.relChildOf} ${targetMember.fullName}`
    : memberFormMode === 'addSpouse' ? `${t.relSpouseOf} ${targetMember.fullName}`
    : targetMember.fullName;
  const subtitle = [isEdit ? '' : t.wizardStepOf(stepIndex + 1, steps.length), contextLabel].filter(Boolean).join(' · ');
  const stepLabels: Record<StepId, string> = {
    relation: t.wizardStepRelation,
    who: t.wizardStepWho,
    details: t.wizardStepDetails,
  };
  const firstName = fields.firstName.trim();
  const addLabel = firstName ? t.btnAddNamed(firstName) : t.headerAddMember;
  const marathiName = `${fields.firstName_mr} ${fields.lastName_mr}`.trim();
  const locked = isSaving || !canEdit;

  const genderOptions = [
    { value: 'male',    label: t.optionMale,    icon: <MaleIcon size={14} className="mf-seg__icon--male" /> },
    { value: 'female',  label: t.optionFemale,  icon: <FemaleIcon size={14} className="mf-seg__icon--female" /> },
    { value: 'unknown', label: t.optionUnknown, icon: <HelpCircleIcon size={14} /> },
  ] as const;

  const renderDate = (kind: 'birth' | 'death') => {
    const isBirth = kind === 'birth';
    const yearKey = isBirth ? 'birthYear' : 'deathYear';
    const monthKey = isBirth ? 'birthMonth' : 'deathMonth';
    const dayKey = isBirth ? 'birthDay' : 'deathDay';
    return (
      <div className="mf-field">
        <span className="mf-label">
          {isBirth ? t.labelBirth : t.labelDeath}
          {isBirth && <span className="mf-hint"> · {t.hintYearEnough}</span>}
        </span>
        <div className="mf-date">
          <div className="mf-date__year">
            <YearPicker
              value={fields[yearKey]}
              onChange={v => set(yearKey, v)}
              placeholder={t.labelYear}
              ariaLabel={isBirth ? t.labelBirthYear : t.labelDeathYear}
              hasError={Boolean(errors[yearKey])}
              clearable={!isBirth}
            />
          </div>
          <select
            className="mf-input mf-select"
            value={fields[monthKey]}
            onChange={e => set(monthKey, e.target.value)}
            aria-label={isBirth ? t.labelBirthMonth : t.labelDeathMonth}
          >
            <option value="">{t.labelMonth}</option>
            {t.months.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
          </select>
          <select
            className="mf-input mf-select"
            value={fields[dayKey]}
            onChange={e => set(dayKey, e.target.value)}
            aria-label={isBirth ? t.labelBirthDay : t.labelDeathDay}
          >
            <option value="">{t.labelDay}</option>
            {DAYS.map(d => <option key={d} value={String(d)}>{d}</option>)}
          </select>
        </div>
        {errors[yearKey] && <span className="mf-err" role="alert">{errors[yearKey]}</span>}
      </div>
    );
  };

  const renderTextField = (key: 'firstName' | 'lastName' | 'occupation' | 'location', label: string, placeholder: string, required = false) => {
    const id = `member-form-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
    const errorId = `${key}-err`;
    return (
      <div className="mf-field">
        <label className="mf-label" htmlFor={id}>
          {label} {required && <span className="mf-req" aria-hidden="true">*</span>}
        </label>
        <input
          id={id}
          type="text"
          value={fields[key]}
          onChange={e => set(key, e.target.value)}
          onBlur={key === 'firstName' || key === 'lastName' ? () => handleNameBlur(key) : undefined}
          className={`mf-input${errors[key] ? ' mf-input--err' : ''}`}
          placeholder={placeholder}
          aria-required={required || undefined}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? errorId : undefined}
          data-autofocus={key === 'firstName' || undefined}
        />
        {errors[key] && <span id={errorId} className="mf-err">{errors[key]}</span>}
      </div>
    );
  };

  return (
    <div className="member-form__overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div ref={dialogRef} className="member-form" role="dialog" aria-modal="true" aria-label={title}>
        <div className="member-form__grab" aria-hidden="true" />
        <div className="member-form__header">
          <div className="member-form__heading">
            <h2 className="member-form__title">{title}</h2>
            {subtitle && <span className="member-form__context">{subtitle}</span>}
          </div>
          <button className="member-form__close" onClick={handleClose} disabled={isSaving} aria-label={t.close}><XIcon size={16} /></button>
        </div>

        <ol className="mf-steps" aria-label={t.wizardSteps}>
          {steps.map((s, i) => {
            const done = !isEdit && i < stepIndex;
            return (
              <li key={s} className={`mf-step${i === stepIndex ? ' mf-step--on' : ''}${done ? ' mf-step--done' : ''}`}>
                <button
                  type="button"
                  className="mf-step__btn"
                  onClick={() => goToStep(i)}
                  disabled={i === stepIndex || (!isEdit && i > stepIndex)}
                  aria-current={i === stepIndex ? 'step' : undefined}
                >
                  <span className="mf-step__num" aria-hidden="true">{done ? <CheckIcon size={12} /> : i + 1}</span>
                  <span className="mf-step__label">{stepLabels[s]}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="member-form__body">
          <fieldset className="mf-fieldset" disabled={locked}>
            {errors.relationship && step !== 'relation' && (
              <span className="mf-err" role="alert">{errors.relationship}</span>
            )}

            {step === 'relation' && (
              <>
                <h3 className="mf-q">{t.wizardQRelation}</h3>
                <RelationshipSection
                  allMembers={allMembers}
                  relationType={relationType}
                  relatedMemberId={relatedMemberId}
                  error={errors.relationship}
                  onRelationTypeChange={type => { setRelationType(type); setRelatedMemberId(''); setErrors(prev => ({ ...prev, relationship: undefined })); }}
                  onRelatedMemberChange={id => { setRelatedMemberId(id); setErrors(prev => ({ ...prev, relationship: undefined })); }}
                />
              </>
            )}

            {step === 'who' && (
              <>
                <h3 className="mf-q">{isEdit ? t.wizardQWhoEdit : t.wizardQWho}</h3>
                <PhotoUploadSection
                  imageUrl={fields.imageUrl}
                  gender={fields.gender}
                  birthYear={fields.birthYear}
                  onImageChange={url => set('imageUrl', url)}
                />
                <div className="mf-row">
                  {renderTextField('firstName', t.labelFirstName, t.placeholderFirstName, true)}
                  {renderTextField('lastName', t.labelLastName, t.placeholderLastName, true)}
                </div>

                {editingMarathi ? (
                  <div className="mf-mr-edit">
                    <div className="mf-row">
                      <div className="mf-field">
                        <label className="mf-label" htmlFor="member-form-first-name-mr">{t.labelFirstNameMr}</label>
                        <input id="member-form-first-name-mr" type="text" className="mf-input" lang="mr"
                          value={fields.firstName_mr} onChange={e => set('firstName_mr', e.target.value)} />
                      </div>
                      <div className="mf-field">
                        <label className="mf-label" htmlFor="member-form-last-name-mr">{t.labelLastNameMr}</label>
                        <input id="member-form-last-name-mr" type="text" className="mf-input" lang="mr"
                          value={fields.lastName_mr} onChange={e => set('lastName_mr', e.target.value)} />
                      </div>
                    </div>
                    <button type="button" className="mf-link" onClick={() => setEditingMarathi(false)}>{t.marathiDone}</button>
                  </div>
                ) : (
                  <div className="mf-mr">
                    <span className="mf-mr__tag" lang="mr">{t.marathiTag}</span>
                    <span className={marathiName ? 'mf-mr__name' : 'mf-mr__name mf-mr__name--empty'} lang={marathiName ? 'mr' : undefined}>
                      {marathiName || t.marathiNotSet}
                    </span>
                    <button type="button" className="mf-link" onClick={() => setEditingMarathi(true)} aria-label={`${t.menuEdit}: ${t.sectionMarathiName}`}>
                      {t.menuEdit}
                    </button>
                  </div>
                )}

                <div className="mf-field">
                  <span className="mf-label" id="member-form-gender-label">{t.labelGender}</span>
                  <div className="mf-seg" role="group" aria-labelledby="member-form-gender-label">
                    {genderOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={fields.gender === option.value}
                        onClick={() => set('gender', option.value)}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!isEdit && duplicates.length > 0 && (
                  <div className="member-form__dup-warning" role="alert">
                    <div className="member-form__dup-header">
                      <AlertTriangleIcon size={13} />
                      <span>{t.dupWarningTitle(duplicates.length)}</span>
                    </div>
                    <ul className="member-form__dup-list">
                      {duplicates.map(d => (
                        <li key={d.member.id} className="member-form__dup-item">
                          <img src={d.member.imageConfig.finalImageUrl} alt="" className="member-form__dup-avatar" />
                          <div className="member-form__dup-info">
                            <span className="member-form__dup-name">{d.member.fullName}</span>
                            <span className="member-form__dup-meta">
                              {[d.member.birthYear ? `${t.bornAbbrev} ${d.member.birthYear}` : '', d.member.generationIndex !== null ? t.genFormat(d.member.generationIndex) : '']
                                .filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <span className={`member-form__dup-badge member-form__dup-badge--${d.level}`}>
                            {d.level === 'high' ? t.dupHigh : t.dupMedium}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <span className="member-form__dup-hint">{t.dupHint}</span>
                  </div>
                )}
              </>
            )}

            {step === 'details' && (
              <>
                <h3 className="mf-q" tabIndex={-1} data-autofocus>
                  {t.wizardQDetails} <span className="mf-hint">{t.wizardOptional}</span>
                </h3>
                {renderDate('birth')}
                <button type="button" role="switch" aria-checked={living} className="mf-switch" onClick={() => setLiving(v => !v)}>
                  <span className="mf-switch__track" aria-hidden="true" />
                  {t.labelLiving}
                </button>
                {!living && renderDate('death')}
                <div className="mf-row">
                  {renderTextField('occupation', t.labelOccupation, t.placeholderOccupation)}
                  {renderTextField('location', t.labelLocation, t.placeholderLocation)}
                </div>
                <div className="mf-field">
                  <label className="mf-label" htmlFor="member-form-notes">{t.labelNotes}</label>
                  <textarea
                    id="member-form-notes"
                    value={fields.notes}
                    onChange={e => set('notes', e.target.value)}
                    className="mf-input mf-textarea"
                    rows={3}
                    placeholder={t.placeholderNotes}
                  />
                </div>
                <div className="mf-field">
                  <label className="mf-label" htmlFor="member-form-photo-url">{t.labelPhotoLink}</label>
                  <input
                    id="member-form-photo-url"
                    type="url"
                    value={fields.imageUrl.startsWith('data:') ? '' : fields.imageUrl}
                    onChange={e => set('imageUrl', e.target.value)}
                    className={`mf-input${errors.imageUrl ? ' mf-input--err' : ''}`}
                    placeholder={t.placeholderUrl}
                    aria-invalid={errors.imageUrl ? true : undefined}
                  />
                  {errors.imageUrl && <span className="mf-err" role="alert">{errors.imageUrl}</span>}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fields.isPrimaryInTree}
                  className="mf-switch"
                  onClick={() => set('isPrimaryInTree', !fields.isPrimaryInTree)}
                >
                  <span className="mf-switch__track" aria-hidden="true" />
                  {t.labelPrimary}
                </button>
                {isEdit && editMember && currentTree && (
                  <MarriageHistorySection editMemberId={editMember.id} currentTree={currentTree} />
                )}
              </>
            )}
          </fieldset>
        </div>

        <div className="member-form__footer">
          {isEdit ? (
            !isAdmin ? null : confirmingDelete ? (
              <div className="member-form__delete-confirm">
                <span className="member-form__delete-confirm__label">{t.confirmDeleteMember}</span>
                <button className="member-form__btn member-form__btn--danger member-form__btn--sm" onClick={handleDelete} disabled={locked}>
                  {t.btnYesDelete}
                </button>
                <button className="member-form__btn member-form__btn--ghost member-form__btn--sm" onClick={() => setConfirmingDelete(false)}>
                  {t.btnCancel}
                </button>
              </div>
            ) : (
              <button className="member-form__btn member-form__btn--danger" onClick={() => setConfirmingDelete(true)} disabled={locked}>
                <Trash2Icon size={14} />
                {t.btnDeleteMember}
              </button>
            )
          ) : stepIndex === 0 ? (
            <button className="member-form__btn member-form__btn--ghost" onClick={handleClose} disabled={isSaving}>{t.btnCancel}</button>
          ) : (
            <button className="member-form__btn member-form__btn--ghost" onClick={() => goToStep(stepIndex - 1)} disabled={isSaving}>
              <ChevronLeftIcon size={14} />
              {t.btnBack}
            </button>
          )}
          <div className="member-form__footer-right">
            {isEdit && (!isAdmin || !confirmingDelete) && (
              <button className="member-form__btn member-form__btn--ghost" onClick={handleClose} disabled={isSaving}>{t.btnCancel}</button>
            )}
            {!isEdit && step === 'who' && !isLastStep && !isSaving && (
              <button className="member-form__btn member-form__btn--secondary" onClick={handleSave} disabled={locked}>{t.btnSkipAdd}</button>
            )}
            {isSaving ? (
              <button className="member-form__btn member-form__btn--primary" disabled>{t.btnSaving}</button>
            ) : isEdit ? (
              <button className="member-form__btn member-form__btn--primary" onClick={handleSave} disabled={locked}>{t.btnSaveChanges}</button>
            ) : isLastStep ? (
              <button className="member-form__btn member-form__btn--primary" onClick={handleSave} disabled={locked}>
                <CheckIcon size={14} />
                {addLabel}
              </button>
            ) : (
              <button className="member-form__btn member-form__btn--primary" onClick={handleNext} disabled={locked}>
                {t.btnNext}
                <ChevronRightIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberFormModal;
