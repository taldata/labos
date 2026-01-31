import React, { forwardRef, useState, useRef, useEffect } from 'react';
import TomSelect from 'tom-select';
import 'tom-select/dist/css/tom-select.css';
import './Input.css';

const Input = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  type = 'text',
  ...props
}, ref) => {
  const inputClassNames = [
    'input-field',
    error && 'input-error',
    icon && `input-with-icon-${iconPosition}`,
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-container">
        {icon && iconPosition === 'left' && (
          <i className={`input-icon input-icon-left ${icon}`}></i>
        )}
        <input
          ref={ref}
          type={type}
          className={inputClassNames}
          required={required}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <i className={`input-icon input-icon-right ${icon}`}></i>
        )}
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Input.displayName = 'Input';

export const Select = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className = '',
  children,
  ...props
}, ref) => {
  const selectClassNames = [
    'input-field',
    'select-field',
    error && 'input-error',
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="input-container">
        <select
          ref={ref}
          className={selectClassNames}
          required={required}
          {...props}
        >
          {children}
        </select>
        <i className="fas fa-chevron-down select-icon"></i>
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Select.displayName = 'Select';

export const Textarea = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className = '',
  rows = 4,
  ...props
}, ref) => {
  const textareaClassNames = [
    'input-field',
    'textarea-field',
    error && 'input-error',
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={textareaClassNames}
        rows={rows}
        required={required}
        {...props}
      />
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export const SearchableSelect = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className = '',
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  name,
  displayKey = 'name',
  valueKey = 'id',
  allowClear = true,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Get display text for selected value
  const selectedOption = options.find(opt => opt[valueKey] === value);
  const displayText = selectedOption ? selectedOption[displayKey] : placeholder;

  // Filter options based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = options.filter(option =>
        option[displayKey].toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options, displayKey]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleSelect = (option) => {
    if (onChange) {
      // Create a synthetic event object similar to native select
      const syntheticEvent = {
        target: {
          name: name,
          value: option ? option[valueKey] : ''
        }
      };
      onChange(syntheticEvent);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    if (onChange) {
      const syntheticEvent = {
        target: {
          name: name,
          value: ''
        }
      };
      onChange(syntheticEvent);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectClassNames = [
    'input-field',
    'select-field',
    'searchable-select-field',
    error && 'input-error',
    fullWidth && 'input-full-width',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="searchable-select-container" ref={dropdownRef}>
        <div className="input-container">
          <div
            className={selectClassNames}
            onClick={handleToggle}
            style={{ cursor: 'pointer' }}
            {...props}
          >
            <span className={!selectedOption ? 'searchable-select-placeholder' : ''}>
              {displayText}
            </span>
          </div>
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} select-icon`}></i>
        </div>

        {isOpen && (
          <div className="searchable-select-dropdown">
            <div className="searchable-select-search">
              <i className="fas fa-search searchable-select-search-icon"></i>
              <input
                ref={searchInputRef}
                type="text"
                className="searchable-select-search-input"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="searchable-select-options">
              {allowClear && !searchTerm && (
                <div
                  className={`searchable-select-option searchable-select-clear-option ${!value ? 'selected' : ''}`}
                  onClick={handleClear}
                >
                  {placeholder}
                </div>
              )}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option[valueKey]}
                    className={`searchable-select-option ${
                      option[valueKey] === value ? 'selected' : ''
                    } ${option.isHeader ? 'searchable-select-option-header' : ''}`}
                    onClick={() => handleSelect(option)}
                  >
                    {option[displayKey]}
                  </div>
                ))
              ) : (
                <div className="searchable-select-no-results">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

SearchableSelect.displayName = 'SearchableSelect';

export const TomSelectInput = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  fullWidth = false,
  className = '',
  options = [],
  value,
  onChange,
  placeholder = 'Select an option',
  name,
  displayKey = 'name',
  valueKey = 'id',
  allowClear = true,
  createNewOption = null,
  ...props
}, ref) => {
  const selectRef = useRef(null);
  const tomSelectRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const nameRef = useRef(name);

  // Keep refs in sync so event handlers always use latest values
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // Helper to build Tom Select options array from props
  const buildTomOptions = () => {
    const tomOptions = [];
    if (createNewOption) {
      tomOptions.push({
        value: createNewOption[valueKey]?.toString() || '__create_new__',
        text: createNewOption[displayKey] || 'Create New',
        $order: -1
      });
    }

    const selectAllOptions = options.filter(option => option[valueKey] === '' || option[valueKey] === null);
    const regularOptions = options.filter(option => option[valueKey] !== '' && option[valueKey] !== null);

    const sortedOptions = [...regularOptions].sort((a, b) =>
      (a[displayKey] || '').localeCompare(b[displayKey] || '')
    );

    selectAllOptions.forEach((option) => {
      tomOptions.push({
        value: option[valueKey]?.toString() || '',
        text: option[displayKey] || '',
        $order: -1
      });
    });

    sortedOptions.forEach((option, index) => {
      tomOptions.push({
        value: option[valueKey]?.toString() || '',
        text: option[displayKey] || '',
        $order: index
      });
    });

    return tomOptions;
  };

  // Initialize Tom Select
  useEffect(() => {
    if (!selectRef.current) return;

    // Destroy existing instance to prevent duplicates
    if (tomSelectRef.current) {
      try {
        tomSelectRef.current.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      tomSelectRef.current = null;
    }

    const tomOptions = buildTomOptions();

    const config = {
      options: tomOptions,
      items: value ? [value.toString()] : [],
      placeholder: placeholder,
      maxOptions: null,
      allowEmptyOption: allowClear,
      create: false,
      plugins: allowClear ? ['clear_button'] : [],
      sortField: [
        { field: '$order', direction: 'asc' },
        { field: 'text', direction: 'asc' }
      ],
      render: {
        option: function(data, escape) {
          if (data.value === '__create_new__') {
            return '<div class="option create-new-option" data-value="__create_new__"><i class="fas fa-plus"></i> ' + escape(data.text) + '</div>';
          }
          return '<div class="option">' + escape(data.text) + '</div>';
        }
      },
      onItemAdd: function() {
        const selectedValue = this.getValue();
        if (onChangeRef.current) {
          onChangeRef.current({
            target: {
              name: nameRef.current,
              value: selectedValue
            }
          });
        }
      },
      onClear: function() {
        if (onChangeRef.current) {
          onChangeRef.current({
            target: {
              name: nameRef.current,
              value: ''
            }
          });
        }
      }
    };

    try {
      tomSelectRef.current = new TomSelect(selectRef.current, config);
    } catch (e) {
      console.error('Tom Select initialization failed:', e);
      return;
    }

    if (disabled) {
      tomSelectRef.current.disable();
    }

    return () => {
      if (tomSelectRef.current) {
        try {
          tomSelectRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        tomSelectRef.current = null;
      }
    };
  }, [allowClear, placeholder]);

  // Update Tom Select when options change
  useEffect(() => {
    if (!tomSelectRef.current) return;

    try {
      tomSelectRef.current.clearOptions();
      tomSelectRef.current.addOptions(buildTomOptions());
      tomSelectRef.current.refreshOptions(false);

      // Re-set the value after options update
      tomSelectRef.current.setValue(value?.toString() || '', true);
    } catch (e) {
      console.error('Tom Select options update failed:', e);
    }
  }, [options, displayKey, valueKey, createNewOption]);

  // Update disabled state
  useEffect(() => {
    if (!tomSelectRef.current) return;
    try {
      if (disabled) {
        tomSelectRef.current.disable();
      } else {
        tomSelectRef.current.enable();
      }
    } catch (e) {
      // Ignore
    }
  }, [disabled]);

  // Update Tom Select when value changes externally
  useEffect(() => {
    if (!tomSelectRef.current) return;
    const currentValue = tomSelectRef.current.getValue();
    const newValue = value?.toString() || '';
    if (currentValue !== newValue) {
      try {
        tomSelectRef.current.setValue(newValue, true);
      } catch (e) {
        // Ignore
      }
    }
  }, [value]);

  return (
    <div className={`input-wrapper ${fullWidth ? 'input-wrapper-full-width' : ''}`}>
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="input-required">*</span>}
        </label>
      )}
      <div className="tom-select-container">
        <select
          ref={selectRef}
          name={name}
          required={required}
          disabled={disabled}
          className={`tom-select-field ${className}`}
          {...props}
        >
          {allowClear && <option value="">-- {placeholder} --</option>}
          {options.map((option) => (
            <option key={option[valueKey]} value={option[valueKey]}>
              {option[displayKey]}
            </option>
          ))}
        </select>
      </div>
      {error && <span className="input-error-message">{error}</span>}
      {!error && helperText && <span className="input-helper-text">{helperText}</span>}
    </div>
  );
});

TomSelectInput.displayName = 'TomSelectInput';

export default Input;
