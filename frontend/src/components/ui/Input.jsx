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
  ...props
}, ref) => {
  const selectRef = useRef(null);
  const tomSelectRef = useRef(null);

  useEffect(() => {
    if (!selectRef.current) return;

    // Prepare options for Tom Select
    const tomOptions = options.map(option => ({
      value: option[valueKey]?.toString() || '',
      text: option[displayKey] || ''
    }));

    // Initialize Tom Select
    const config = {
      options: tomOptions,
      items: value ? [value.toString()] : [],
      placeholder: placeholder,
      maxOptions: null,
      allowEmptyOption: allowClear,
      create: false,
      sortField: {
        field: 'text',
        direction: 'asc'
      },
      onItemAdd: function() {
        const selectedValue = this.getValue();
        if (onChange) {
          const syntheticEvent = {
            target: {
              name: name,
              value: selectedValue
            }
          };
          onChange(syntheticEvent);
        }
      },
      onClear: function() {
        if (onChange) {
          const syntheticEvent = {
            target: {
              name: name,
              value: ''
            }
          };
          onChange(syntheticEvent);
        }
      }
    };

    tomSelectRef.current = new TomSelect(selectRef.current, config);

    // Cleanup
    return () => {
      if (tomSelectRef.current) {
        tomSelectRef.current.destroy();
      }
    };
  }, []);

  // Update Tom Select when options change
  useEffect(() => {
    if (tomSelectRef.current) {
      tomSelectRef.current.clearOptions();
      const tomOptions = options.map(option => ({
        value: option[valueKey]?.toString() || '',
        text: option[displayKey] || ''
      }));
      tomSelectRef.current.addOptions(tomOptions);
      tomSelectRef.current.refreshOptions(false);

      // Re-set the value if it exists
      if (value) {
        tomSelectRef.current.setValue(value.toString(), true);
      }
    }
  }, [options, displayKey, valueKey]);

  // Update disabled state
  useEffect(() => {
    if (tomSelectRef.current) {
      if (disabled) {
        tomSelectRef.current.disable();
      } else {
        tomSelectRef.current.enable();
      }
    }
  }, [disabled]);

  // Update Tom Select when value changes externally
  useEffect(() => {
    if (tomSelectRef.current) {
      const currentValue = tomSelectRef.current.getValue();
      const newValue = value?.toString() || '';
      if (currentValue !== newValue) {
        tomSelectRef.current.setValue(newValue, true);
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
