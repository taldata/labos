import './PageHeader.css'

/**
 * Premium Page Header Component
 * 
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {string} icon - FontAwesome icon class (e.g., "fas fa-users")
 * @param {string} variant - Color variant: purple, blue, orange, green, teal, pink
 * @param {React.ReactNode} actions - Optional action buttons to render on the right
 * @param {React.ReactNode} children - Optional content to render below title
 */
function PageHeader({
    title,
    subtitle,
    icon = "fas fa-chart-pie",
    variant = "purple",
    actions,
    children
}) {
    return (
        <div className={`page-header page-header--${variant}`}>
            <div className="page-header__content">
                <div className="page-header__text">
                    <h1 className="page-header__title">{title}</h1>
                    {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
                    {children && <div className="page-header__extra">{children}</div>}
                </div>
                <div className="page-header__right">
                    {actions && <div className="page-header__actions">{actions}</div>}
                    <div className="page-header__decoration">
                        <div className="page-header__icon-container">
                            <i className={icon}></i>
                        </div>
                        <div className="page-header__ring page-header__ring--1"></div>
                        <div className="page-header__ring page-header__ring--2"></div>
                    </div>
                </div>
            </div>
            <div className="page-header__wave"></div>
        </div>
    )
}

export default PageHeader
