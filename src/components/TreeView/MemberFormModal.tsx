import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFamilyTree } from '../../context/FamilyTreeContext';
import { useLanguage } from '../../context/LanguageContext';
import { StyledFamilyMember } from '../../types/FamilyTypes';
import { AlertTriangleIcon, Trash2Icon, XIcon } from '../Icons';
import { transliterateToMarathi } from '../../processing/transliteration';
import { findDuplicates } from '../../processing/duplicateDetection';
import { sanitizeImageUrl } from '../../processing/dataValidation';
import YearPicker from '../YearPicker';
import { RelationshipSection } from './RelationshipSection';
import { PhotoUploadSection } from './PhotoUploadSection';
import { MarriageHistorySection } from './MarriageHistorySection';
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

type RelationshipType = 'none' | 'childOf' | 'spouseOf' | 'parentOf';

// ─── Modal Component ───

const MemberFormModal: React.FC = () => {
  const { state, dispatch, currentTree, styleNewMember } = useFamilyTree();
  const { t } = useLanguage();
  const { memberFormMode, memberFormTargetId } = state;

  const targetMember = memberFormMode && memberFormTargetId && currentTree
    ? currentTree.members.find(m => m.id === memberFormTargetId) ?? null
    : null;

  const isEdit = memberFormMode === 'edit';
  const editMember = isEdit ? targetMember : null;
  const isStandaloneAdd = memberFormMode === 'add';

  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Relationship state — only used when mode === 'add'
  const [relationType, setRelationType] = useState<RelationshipType>('none');
  const [relatedMemberId, setRelatedMemberId] = useState<string>('');

  // Pre-fill form when opening
  useEffect(() => {
    if (!memberFormMode) return;
    if (isEdit && editMember) {
      setFields(memberToFields(editMember));
    } else {
      const lastName = targetMember?.lastName ?? '';
      setFields({ ...EMPTY_FIELDS, lastName });
    }
    setRelationType('none');
    setRelatedMemberId('');
    setErrors({});
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

    // Only auto-transliterate if the user hasn't already typed a Marathi name.
    // Capture both values before the async call so we can guard against stale writes:
    // if the user typed into the MR field while the request was in flight, don't overwrite.
    if (value && !fields[mrField]) {
      const transliterated = await transliterateToMarathi(value);
      if (transliterated) {
        // Guard: only write if MR field is still empty (user didn't type during the await)
        setFields(prev => prev[mrField] ? prev : { ...prev, [mrField]: transliterated });
      }
    }
  }, [fields]);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormFields, string>> = {};
    if (!fields.firstName.trim()) errs.firstName = t.firstNameRequired;
    if (!fields.lastName.trim()) errs.lastName = t.lastNameRequired;
    const by = parseInt(fields.birthYear);
    const dy = parseInt(fields.deathYear);
    if (fields.birthYear && isNaN(by)) errs.birthYear = t.invalidYear;
    if (fields.deathYear && isNaN(dy)) errs.deathYear = t.invalidYear;
    if (fields.birthYear && fields.deathYear && !isNaN(by) && !isNaN(dy) && dy < by) {
      errs.deathYear = t.deathBeforeBirth;
    }
    const url = fields.imageUrl.trim();
    if (url && sanitizeImageUrl(url) === null) {
      errs.imageUrl = t.alertImageInvalidUrl;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate() || !currentTree) return;
    setSaving(true);

    const rawPartial: Parameters<typeof styleNewMember>[0] = {
      id: isEdit && editMember ? editMember.id : generateId(),
      firstName: fields.firstName.trim(),
      lastName: fields.lastName.trim(),
      firstName_mr: fields.firstName_mr.trim() || undefined,
      lastName_mr: fields.lastName_mr.trim() || undefined,
      gender: fields.gender,
      birthYear: fields.birthYear ? parseInt(fields.birthYear) : null,
      deathYear: fields.deathYear ? parseInt(fields.deathYear) : null,
      birthDate: buildIsoDate(fields.birthYear, fields.birthMonth, fields.birthDay),
      deathDate: buildIsoDate(fields.deathYear, fields.deathMonth, fields.deathDay),
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
        generationIndex: editMember.generationIndex,
      } : {}),
    };

    const styledMember = styleNewMember(rawPartial);

    if (isEdit) {
      dispatch({ type: 'UPDATE_MEMBER', payload: { treeId: currentTree.familyTreeId, member: styledMember } });
    } else {
      // Determine relationship from context menu mode OR from standalone form selection
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
            payload: {
              treeId: currentTree.familyTreeId,
              member: styledMember,
              relatedId: relatedMemberId,
              relType: 'parentOf',
            },
          });
          setSaving(false);
          return;
        }
      }

      dispatch({
        type: 'ADD_MEMBER',
        payload: {
          treeId: currentTree.familyTreeId,
          member: styledMember,
          relatedId,
          relType,
        },
      });
    }
    setSaving(false);
  };

  const handleDelete = () => {
    if (!isEdit || !editMember || !currentTree) return;
    dispatch({ type: 'DELETE_MEMBER', payload: { treeId: currentTree.familyTreeId, memberId: editMember.id } });
  };

  const handleClose = () => {
    setConfirmingDelete(false);
    dispatch({ type: 'CLOSE_MEMBER_FORM' });
  };

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!memberFormMode) return null;

  const title = memberFormMode === 'edit' ? t.modalTitleEdit
    : memberFormMode === 'addChild' ? t.modalTitleAddChild
    : memberFormMode === 'addSpouse' ? t.modalTitleAddSpouse
    : t.modalTitleAddMember;
  const contextLabel = targetMember && memberFormMode !== 'edit'
    ? `${targetMember.fullName}`
    : '';

  return (
    <div className="member-form__overlay" onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="member-form" role="dialog" aria-modal="true" aria-label={title}>
        {/* Header */}
        <div className="member-form__header">
          <h2 className="member-form__title">
            {title}
            {contextLabel && <span className="member-form__context">{contextLabel}</span>}
          </h2>
          <button className="member-form__close" onClick={handleClose} aria-label={t.close}><XIcon size={15} /></button>
        </div>

        {/* Body */}
        <div className="member-form__body">

          {/* Relationship — only for standalone Add */}
          {isStandaloneAdd && (
            <RelationshipSection
              allMembers={allMembers}
              relationType={relationType}
              relatedMemberId={relatedMemberId}
              onRelationTypeChange={(t) => { setRelationType(t); setRelatedMemberId(''); }}
              onRelatedMemberChange={setRelatedMemberId}
            />
          )}

          {/* Names — English */}
          <div className="member-form__section">
            <h3 className="member-form__section-title">{t.sectionEnglishName}</h3>
            <div className="member-form__row">
              <div className="member-form__field">
                <label>{t.labelFirstName} <span className="member-form__req" aria-label="required">*</span></label>
                <input
                  type="text"
                  value={fields.firstName}
                  onChange={e => set('firstName', e.target.value)}
                  onBlur={() => handleNameBlur('firstName')}
                  className={errors.firstName ? 'member-form__input member-form__input--err' : 'member-form__input'}
                  placeholder={t.placeholderFirstName}
                  aria-required="true"
                  aria-describedby={errors.firstName ? 'firstName-err' : undefined}
                />
                {errors.firstName && <span id="firstName-err" className="member-form__err">{errors.firstName}</span>}
              </div>
              <div className="member-form__field">
                <label>{t.labelLastName} <span className="member-form__req" aria-label="required">*</span></label>
                <input
                  type="text"
                  value={fields.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  onBlur={() => handleNameBlur('lastName')}
                  className={errors.lastName ? 'member-form__input member-form__input--err' : 'member-form__input'}
                  placeholder={t.placeholderLastName}
                  aria-required="true"
                  aria-describedby={errors.lastName ? 'lastName-err' : undefined}
                />
                {errors.lastName && <span id="lastName-err" className="member-form__err">{errors.lastName}</span>}
              </div>
            </div>
          </div>

          {/* Duplicate detection warning */}
          {!isEdit && duplicates.length > 0 && (
            <div className="member-form__dup-warning" role="alert">
              <div className="member-form__dup-header">
                <AlertTriangleIcon size={13} />
                <span>{t.dupWarningTitle(duplicates.length)}</span>
              </div>
              <ul className="member-form__dup-list">
                {duplicates.map(d => (
                  <li key={d.member.id} className="member-form__dup-item">
                    <img
                      src={d.member.imageConfig.finalImageUrl}
                      alt={d.member.fullName}
                      className="member-form__dup-avatar"
                      onError={e => {
                        const img = e.target as HTMLImageElement;
                        if (!img.dataset.fallbackApplied) {
                          img.dataset.fallbackApplied = 'true';
                          img.src = d.member.imageConfig.finalImageUrl;
                        }
                      }}
                    />
                    <div className="member-form__dup-info">
                      <span className="member-form__dup-name">{d.member.fullName}</span>
                      <span className="member-form__dup-meta">
                        {d.member.birthYear ? `b. ${d.member.birthYear}` : ''}
                        {d.member.generationIndex !== null
                          ? `${d.member.birthYear ? ' · ' : ''}Gen ${d.member.generationIndex}`
                          : ''}
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

          {/* Names — Marathi */}
          <div className="member-form__section">
            <h3 className="member-form__section-title">{t.sectionMarathiName}</h3>
            <div className="member-form__row">
              <div className="member-form__field">
                <label>{t.labelFirstNameMr}</label>
                <input
                  type="text"
                  value={fields.firstName_mr}
                  onChange={e => set('firstName_mr', e.target.value)}
                  className="member-form__input"
                  placeholder={t.labelFirstNameMr}
                />
              </div>
              <div className="member-form__field">
                <label>{t.labelLastNameMr}</label>
                <input
                  type="text"
                  value={fields.lastName_mr}
                  onChange={e => set('lastName_mr', e.target.value)}
                  className="member-form__input"
                  placeholder={t.labelLastNameMr}
                />
              </div>
            </div>
          </div>

          {/* Gender + Primary */}
          <div className="member-form__section">
            <div className="member-form__row">
              <div className="member-form__field">
                <label>{t.labelGender}</label>
                <select
                  value={fields.gender}
                  onChange={e => set('gender', e.target.value as 'male' | 'female' | 'unknown')}
                  className="member-form__input member-form__select"
                >
                  <option value="male">{t.optionMale}</option>
                  <option value="female">{t.optionFemale}</option>
                  <option value="unknown">{t.optionUnknown}</option>
                </select>
              </div>
              <div className="member-form__field member-form__field--checkbox">
                <label className="member-form__checkbox-label">
                  <input
                    type="checkbox"
                    checked={fields.isPrimaryInTree}
                    onChange={e => set('isPrimaryInTree', e.target.checked)}
                  />
                  {t.labelPrimary}
                </label>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="member-form__section">
            <h3 className="member-form__section-title">
              {t.sectionDates}
              <span className="member-form__section-hint">{t.hintDates}</span>
            </h3>
            <div className="member-form__dates-compact">

              {/* Birth Date */}
              <div className="member-form__date-inline-row">
                <span className="member-form__date-inline-label">{t.labelBirth}</span>
                <div className="member-form__date-inline-content">
                  <div className="member-form__date-row">
                    <select
                      className="member-form__input member-form__select member-form__date-day"
                      value={fields.birthDay}
                      onChange={e => set('birthDay', e.target.value)}
                      title={t.labelBirthDay}
                      aria-label={t.labelBirthDay}
                    >
                      <option value="">{t.labelDay}</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select
                      className="member-form__input member-form__select member-form__date-month"
                      value={fields.birthMonth}
                      onChange={e => set('birthMonth', e.target.value)}
                      title={t.labelBirthMonth}
                      aria-label={t.labelBirthMonth}
                    >
                      <option value="">{t.labelMonth}</option>
                      {t.months.map((m, i) => (
                        <option key={i} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <div className="member-form__date-year">
                      <YearPicker
                        value={fields.birthYear}
                        onChange={v => set('birthYear', v)}
                        placeholder={t.labelYear}
                        hasError={Boolean(errors.birthYear)}
                      />
                    </div>
                  </div>
                  {errors.birthYear && <span className="member-form__err">{errors.birthYear}</span>}
                </div>
              </div>

              {/* Death Date */}
              <div className="member-form__date-inline-row">
                <span className="member-form__date-inline-label" title={t.hintDeathBlank}>{t.labelDeath}</span>
                <div className="member-form__date-inline-content">
                  <div className="member-form__date-row">
                    <select
                      className="member-form__input member-form__select member-form__date-day"
                      value={fields.deathDay}
                      onChange={e => set('deathDay', e.target.value)}
                      title={t.labelDeathDay}
                      aria-label={t.labelDeathDay}
                    >
                      <option value="">{t.labelDay}</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                    <select
                      className="member-form__input member-form__select member-form__date-month"
                      value={fields.deathMonth}
                      onChange={e => set('deathMonth', e.target.value)}
                      title={t.labelDeathMonth}
                      aria-label={t.labelDeathMonth}
                    >
                      <option value="">{t.labelMonth}</option>
                      {t.months.map((m, i) => (
                        <option key={i} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <div className="member-form__date-year">
                      <YearPicker
                        value={fields.deathYear}
                        onChange={v => set('deathYear', v)}
                        placeholder={t.labelYear}
                        hasError={Boolean(errors.deathYear)}
                        clearable
                      />
                    </div>
                  </div>
                  {errors.deathYear && <span className="member-form__err">{errors.deathYear}</span>}
                </div>
              </div>

            </div>
          </div>

          {/* Details */}
          <div className="member-form__section">
            <h3 className="member-form__section-title">{t.sectionDetails}</h3>
            <div className="member-form__row">
              <div className="member-form__field">
                <label>{t.labelOccupation}</label>
                <input
                  type="text"
                  value={fields.occupation}
                  onChange={e => set('occupation', e.target.value)}
                  className="member-form__input"
                  placeholder={t.placeholderOccupation}
                />
              </div>
              <div className="member-form__field">
                <label>{t.labelLocation}</label>
                <input
                  type="text"
                  value={fields.location}
                  onChange={e => set('location', e.target.value)}
                  className="member-form__input"
                  placeholder={t.placeholderLocation}
                />
              </div>
            </div>
            <PhotoUploadSection
              imageUrl={fields.imageUrl}
              imageUrlError={errors.imageUrl}
              gender={fields.gender}
              birthYear={fields.birthYear}
              onImageChange={(url) => set('imageUrl', url)}
            />
            <div className="member-form__field member-form__field--full">
              <label>{t.labelNotes}</label>
              <textarea
                value={fields.notes}
                onChange={e => set('notes', e.target.value)}
                className="member-form__input member-form__textarea"
                rows={3}
                placeholder={t.placeholderNotes}
              />
            </div>
          </div>
        </div>

        {/* Marriage History — shown only in edit mode when member has spouse relationships */}
        {isEdit && editMember && currentTree && (
          <MarriageHistorySection editMemberId={editMember.id} currentTree={currentTree} />
        )}

        {/* Footer */}
        <div className="member-form__footer">
          {isEdit && (
            confirmingDelete ? (
              <div className="member-form__delete-confirm">
                <span className="member-form__delete-confirm__label">{t.confirmDeleteMember}</span>
                <button className="member-form__btn member-form__btn--danger member-form__btn--sm" onClick={handleDelete}>
                  {t.btnYesDelete}
                </button>
                <button className="member-form__btn member-form__btn--ghost member-form__btn--sm" onClick={() => setConfirmingDelete(false)}>
                  {t.btnCancel}
                </button>
              </div>
            ) : (
              <button className="member-form__btn member-form__btn--danger" onClick={() => setConfirmingDelete(true)}>
                <Trash2Icon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                {t.btnDeleteMember}
              </button>
            )
          )}
          <div className="member-form__footer-right">
            <button className="member-form__btn member-form__btn--ghost" onClick={handleClose}>{t.btnCancel}</button>
            <button className="member-form__btn member-form__btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? t.btnSaving : isEdit ? t.btnSaveChanges : t.btnConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberFormModal;
