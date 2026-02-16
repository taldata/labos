import { useState, useCallback } from 'react'
import logger from '../utils/logger'

// ============================================================================
// Custom Hook: useFilterOptions
// ============================================================================
function useFilterOptions(isManagerView = false) {
    const [departments, setDepartments] = useState([])
    const [users, setUsers] = useState([])
    const [categories, setCategories] = useState([])
    const [categoryOptions, setCategoryOptions] = useState([])
    const [suppliers, setSuppliers] = useState([])
    const [creditCards, setCreditCards] = useState([])
    const [subcategories, setSubcategories] = useState([])

    const fetchFilterOptions = useCallback(async () => {
        try {
            // Use different endpoint based on view type
            const endpoint = isManagerView
                ? '/api/v1/manager/expense-filter-options'
                : '/api/v1/admin/expense-filter-options'
            const response = await fetch(endpoint, { credentials: 'include' })

            if (response.ok) {
                const data = await response.json()

                // Departments
                setDepartments(data.departments || [])

                // Users
                setUsers(data.users || [])

                // Categories and category options
                const categoriesData = data.categories || []
                setCategories(categoriesData)

                const flattenedOptions = []
                categoriesData.forEach(cat => {
                    flattenedOptions.push({
                        id: `cat_${cat.id}`,
                        name: cat.department_name ? `${cat.department_name} > ${cat.name}` : cat.name,
                        type: 'category',
                        category_id: cat.id,
                        isHeader: true
                    })
                    if (cat.subcategories?.length > 0) {
                        cat.subcategories.forEach(sub => {
                            flattenedOptions.push({
                                id: `sub_${sub.id}`,
                                name: cat.department_name
                                    ? `${cat.department_name} > ${cat.name} > ${sub.name}`
                                    : `${cat.name} > ${sub.name}`,
                                type: 'subcategory',
                                category_id: cat.id,
                                subcategory_id: sub.id
                            })
                        })
                    }
                })
                setCategoryOptions(flattenedOptions)

                // Suppliers
                setSuppliers(data.suppliers || [])

                // Credit cards
                setCreditCards(data.credit_cards || [])

                // Subcategories
                setSubcategories(data.subcategories || [])
            } else {
                logger.error('Failed to fetch filter options', { status: response.status })
            }
        } catch (err) {
            logger.error('Failed to fetch filter options', { error: err.message })
        }
    }, [isManagerView])

    return {
        departments,
        users,
        categories,
        categoryOptions,
        suppliers,
        creditCards,
        subcategories,
        fetchFilterOptions
    }
}

export default useFilterOptions
