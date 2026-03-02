import { useState, useRef, useEffect, useCallback } from 'react';
import type { AdminResource } from '../types';

interface Props {
  items: AdminResource[];
  value: string;
  onChange: (id: string) => void;
  onSearch?: (term: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export default function SearchableSelect({
  items,
  value,
  onChange,
  onSearch,
  placeholder = 'Search...',
  disabled = false,
  loading = false,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Resolve selected item name for display
  const selectedItem = items.find((i) => i.id === value);
  const selectedName = selectedItem?.attributes?.name ?? (value || '');

  // Filtered items: client-side when no onSearch, otherwise show all (server filters)
  const filtered = onSearch
    ? items
    : items.filter((i) => {
        if (!inputValue) return true;
        const name = (i.attributes?.name ?? i.id).toLowerCase();
        return name.includes(inputValue.toLowerCase());
      });

  // Debounced server-side search
  const handleInputChange = useCallback(
    (term: string) => {
      setInputValue(term);
      setHighlightedIndex(-1);
      if (onSearch) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onSearch(term), 300);
      }
    },
    [onSearch],
  );

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clean up debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const selectItem = (id: string) => {
    onChange(id);
    setOpen(false);
    setInputValue('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        selectItem(filtered[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`searchable-select${disabled ? ' disabled' : ''}`} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={open ? inputValue : selectedName}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setInputValue('');
          setHighlightedIndex(-1);
        }}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && (
        <div className="ss-dropdown">
          {loading && <div className="ss-empty">Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div className="ss-empty">No results found</div>
          )}
          {!loading &&
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`ss-item${idx === highlightedIndex ? ' highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent blur before click registers
                  selectItem(item.id);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
              >
                {item.attributes?.name ?? item.id}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
