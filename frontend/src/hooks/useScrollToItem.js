import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook to handle auto-scroll and highlight for newly created items
 *
 * @param {Array} items - The list of items to monitor
 * @param {string|number|null} newItemId - The ID of the newly created item
 * @param {function} clearNewItemId - Callback to clear the new item ID after scrolling
 * @returns {object} - Object containing getItemRef function to attach refs to list items
 *
 * Usage:
 * const [newItemId, setNewItemId] = useState(null);
 * const { getItemRef } = useScrollToItem(items, newItemId, () => setNewItemId(null));
 *
 * // In your list rendering:
 * items.map(item => (
 *   <div ref={getItemRef(item.id)} data-item-id={item.id}>
 *     {item.content}
 *   </div>
 * ))
 */
export const useScrollToItem = (items, newItemId, clearNewItemId) => {
  const itemRefs = useRef({});

  // Function to get/create ref for an item
  const getItemRef = useCallback((itemId) => (element) => {
    if (element) {
      itemRefs.current[itemId] = element;
    } else {
      delete itemRefs.current[itemId];
    }
  }, []);

  // Effect to scroll to and highlight the new item
  useEffect(() => {
    if (!newItemId) return;

    // Wait a bit to ensure DOM is updated and refs are attached
    const timer = setTimeout(() => {
      const element = itemRefs.current[newItemId];

      if (element) {
        // Scroll to the element with smooth behavior
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });

        // Add highlight class with animation
        element.classList.add('highlight-new-item');

        // Remove highlight class after animation completes
        const removeHighlight = setTimeout(() => {
          element.classList.remove('highlight-new-item');
          clearNewItemId();
        }, 2000); // Match this with CSS animation duration

        return () => clearTimeout(removeHighlight);
      }
    }, 300); // Small delay to ensure list has been re-rendered

    return () => clearTimeout(timer);
  }, [newItemId, items, clearNewItemId]);

  return { getItemRef };
};

export default useScrollToItem;
