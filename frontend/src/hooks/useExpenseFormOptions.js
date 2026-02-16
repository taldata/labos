import { useState, useCallback } from 'react'
import logger from '../utils/logger'

// ============================================================================
// Custom Hook: useExpenseFormOptions
// ============================================================================
function useExpenseFormOptions() {
    const [categories, setCategories] = useState([])
    const [subcategories, setSubcategories] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [creditCards, setCreditCards] = useState([])

    const fetchOptions = useCallback(async () => {
        try {
            // Fetch Categories with subcategories
            const catRes = await fetch('/api/v1/form-data/categories?include_subcategories=true', { credentials: 'include' })
            if (catRes.ok) {
                const data = await catRes.json()
                setCategories(data.categories || [])

                // Flatten subcategories for easier use
                const flatSubs = []
                    ; (data.categories || []).forEach(cat => {
                        if (cat.subcategories) {
                            cat.subcategories.forEach(sub => {
                                flatSubs.push({
                                    id: sub.id,
                                    name: sub.name,
                                    category_name: cat.name,
                                    department_name: cat.department_name
                                })
                            })
                        }
                    })
                setSubcategories(flatSubs)
            }

            // Fetch Suppliers
            const supRes = await fetch('/api/v1/form-data/suppliers', { credentials: 'include' })
            if (supRes.ok) {
                const data = await supRes.json()
                setSuppliers(data.suppliers || [])
            }

            // Fetch Credit Cards
            const cardRes = await fetch('/api/v1/form-data/credit-cards', { credentials: 'include' })
            if (cardRes.ok) {
                const data = await cardRes.json()
                setCreditCards(data.credit_cards || [])
            }

        } catch (err) {
            logger.error('Failed to fetch expense form options', { error: err.message })
        }
    }, [])

    return {
        categories,
        subcategories,
        suppliers,
        creditCards,
        fetchOptions
    }
}

export default useExpenseFormOptions
