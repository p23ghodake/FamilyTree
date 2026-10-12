/**
 * TreeLoader — checks for ?tree= query param on mount and loads that tree data.
 * Renders nothing; runs only once via useEffect.
 */
import React, { useEffect, useRef } from 'react';
import LZString from 'lz-string';
import toast from 'react-hot-toast';
import { useFamilyTree } from '../../context/FamilyTreeContext';

const TreeLoader: React.FC = () => {
  const { loadSharedData } = useFamilyTree();
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
        loadSharedData(json);
      } else toast.error('Could not open shared tree: the link is invalid.', { id: 'share-load' });
    } catch (e) {
      console.warn('Failed to load tree from URL param:', e);
      toast.error('Could not open shared tree: the link is invalid.', { id: 'share-load' });
    }
  }, [loadSharedData]);

  return null;
};

export default TreeLoader;
