export default function AccountingDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Accounting Dashboard</h1>
        <p className="text-muted-foreground">Payment processing and financial tracking</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-blue-800 dark:text-blue-200 mb-2">Accounting Features Coming Soon</h3>
            <p className="text-blue-700 dark:text-blue-300 mb-3">
              The accounting dashboard will include features for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <li>Approved expenses pending payment</li>
              <li>Mark expenses as paid/unpaid</li>
              <li>Payment status tracking</li>
              <li>External accounting system integration</li>
              <li>Financial reports and export</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
