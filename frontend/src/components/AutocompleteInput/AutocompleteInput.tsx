import { useRef, useEffect, useState } from 'react';
import './AutocompleteInput.css';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (query: string, place?: any) => void;
  onSubmit?: (query: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  mapsLoaded?: boolean;
  className?: string;
}

/**
 * Reusable autocomplete input component using Google Places API
 * Can be used in search bars and comparison panels
 */
export function AutocompleteInput({
  value,
  onChange,
  onPlaceSelect,
  onSubmit,
  placeholder = 'Enter address or zip code',
  disabled = false,
  isLoading = false,
  mapsLoaded = false,
  className = ''
}: AutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || !window.google?.maps) return;
    
    // Prevent multiple initializations
    if (autocompleteRef.current) return;

    // Try new PlaceAutocompleteElement API first (requires Places API (New))
    const tryNewAPI = async () => {
      try {
        // Import Places library using the new importLibrary API
        if (!window.google.maps?.importLibrary) {
          return false; // New API not available
        }

        const { PlaceAutocompleteElement } = await window.google.maps.importLibrary('places') as any;
        
        if (!PlaceAutocompleteElement) {
          return false; // PlaceAutocompleteElement not available
        }

        // Create the element using the new API
        const autocompleteElement = new PlaceAutocompleteElement();

        // Set country restrictions
        if ('countryRestrictions' in autocompleteElement) {
          autocompleteElement.countryRestrictions = ['us'];
        } else if (autocompleteElement.setAttribute) {
          autocompleteElement.setAttribute('country-restrictions', 'us');
        }
        
        // Set bounds for Jacksonville area
        const bounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(30.15, -81.75),
          new window.google.maps.LatLng(30.45, -81.45)
        );
        
        // Set bounds
        if ('restrictToBounds' in autocompleteElement) {
          autocompleteElement.restrictToBounds = bounds;
        }

        // Replace input with autocomplete element
        if (inputRef.current && inputRef.current.parentElement) {
          const container = inputRef.current.parentElement;
          const originalInput = inputRef.current;
          
          // Hide original input but keep it in DOM for fallback
          originalInput.style.display = 'none';
          
          // Create wrapper for the autocomplete element
          const wrapper = document.createElement('div');
          wrapper.className = 'autocomplete-wrapper';
          wrapper.style.flex = '1';
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'stretch';
          wrapper.style.minHeight = '48px'; // Match input height
          wrapper.appendChild(autocompleteElement);
          
          // Insert wrapper before the button, keep original input hidden for fallback
          const button = container.querySelector('button');
          if (button && originalInput.parentElement === container) {
            // Check if wrapper already exists
            if (!wrapperRef.current) {
              container.insertBefore(wrapper, button);
              originalInput.style.display = 'none';
              wrapperRef.current = wrapper;
            }
          }

          // Listen for place selection event
          autocompleteElement.addEventListener('gmp-placeselect', async (event: any) => {
            const place = event.detail?.place || event.place;
            
            if (!place) return;

            // Fetch required fields
            try {
              if (place.fetchFields && typeof place.fetchFields === 'function') {
                await place.fetchFields({ fields: ['formattedAddress', 'addressComponents', 'geometry', 'id'] });
              }
            } catch (err) {
              if (import.meta.env.DEV) {
                console.warn('Failed to fetch place fields:', err);
              }
            }

            const formattedAddress = place.formattedAddress || place.formatted_address || '';
            if (formattedAddress) {
              onChange(formattedAddress);
              
              // Convert new API format to compatible format
              const convertedPlace = {
                formatted_address: formattedAddress,
                address_components: place.addressComponents?.map((comp: any) => ({
                  long_name: comp.longText || comp.longName || comp.text || comp.long_name || '',
                  short_name: comp.shortText || comp.shortName || comp.short_name || '',
                  types: comp.types || []
                })) || [],
                geometry: place.geometry ? {
                  location: place.geometry.location
                } : undefined,
                place_id: place.id || place.placeId || place.place_id,
              };
              
              if (onPlaceSelect) {
                onPlaceSelect(formattedAddress, convertedPlace);
              }
            }
          });

          if (!autocompleteRef.current) {
            autocompleteRef.current = { element: autocompleteElement, wrapper, originalInput };
          }
          return true;
        }
        return false;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('New Places API not available:', error);
        }
        return false;
      }
    };

    // Try new API first (async)
    tryNewAPI().then((success) => {
      if (!success && inputRef.current && !autocompleteRef.current) {
        // Fallback to legacy Autocomplete API if new API failed
        if (window.google.maps.places?.Autocomplete) {
          const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: 'us' },
            fields: ['formatted_address', 'address_components', 'geometry', 'place_id'],
            types: ['address', 'geocode'],
          });

          const bounds = new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(30.15, -81.75),
            new window.google.maps.LatLng(30.45, -81.45)
          );
          autocomplete.setBounds(bounds);

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
              onChange(place.formatted_address);
              if (onPlaceSelect) {
                onPlaceSelect(place.formatted_address, place);
              }
            }
          });

          autocompleteRef.current = autocomplete;
        }
      }
    }).catch(() => {
      // If importLibrary fails, fallback to legacy API
      if (inputRef.current && !autocompleteRef.current && window.google.maps.places?.Autocomplete) {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'address_components', 'geometry', 'place_id'],
          types: ['address', 'geocode'],
        });

        const bounds = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(30.15, -81.75),
          new window.google.maps.LatLng(30.45, -81.45)
        );
        autocomplete.setBounds(bounds);

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            onChange(place.formatted_address);
            if (onPlaceSelect) {
              onPlaceSelect(place.formatted_address, place);
            }
          }
        });

        autocompleteRef.current = autocomplete;
      }
    });

    return () => {
      if (autocompleteRef.current?.wrapper) {
        // Remove wrapper, restore original input
        autocompleteRef.current.wrapper.remove();
        if (autocompleteRef.current.originalInput) {
          autocompleteRef.current.originalInput.style.display = '';
        }
        autocompleteRef.current = null;
      }
      if (autocompleteRef.current && !autocompleteRef.current.wrapper) {
        // Legacy API cleanup
        if (window.google?.maps?.event) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
        autocompleteRef.current = null;
      }
    };
  }, [mapsLoaded]); // Removed onChange and onPlaceSelect from dependencies to prevent re-initialization

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`autocomplete-input-form ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="autocomplete-input"
        disabled={disabled || isLoading || !mapsLoaded}
      />
      {onSubmit && (
        <button
          type="submit"
          className="autocomplete-submit-button"
          disabled={disabled || isLoading || !value.trim()}
        >
          {isLoading ? '...' : 'Search'}
        </button>
      )}
    </form>
  );
}

