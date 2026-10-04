/**
 * TreeLoader — checks for ?tree= query param on mount and loads that tree data.
 * Renders nothing; runs only once via useEffect.
 */
import React, { useEffect, useRef } from 'react';
import LZString from 'lz-string';
import { useFamilyTree } from '../../context/FamilyTreeContext';

const TreeLoader: React.FC = () => {
  const { importData } = useFamilyTree();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('tree');
    if (!encoded) return;
    try {
      const json = LZString.decompressFromEncodedURIComponent(encoded);
      if (json) {
        importData(json);
        // Clean the URL so reloads don't re-import
        const clean = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    } catch (e) {
      console.warn('Failed to load tree from URL param:', e);
    }
  }, [importData]);

  return null;
};

export default TreeLoader;
