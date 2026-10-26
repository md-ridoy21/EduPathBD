# EduPath BD Crystal Reports package

This folder is the report hand-off layer between EduPath BD and SAP Crystal Reports.
It keeps reporting optional and Windows-only while the Android/iOS/PWA app and API stay cross-platform.

## Free classroom workflow on Windows 11

1. Install the free **SAP Crystal Reports, developer version for Microsoft Visual Studio** from SAP: <https://www.sap.com/products/data-cloud/crystal-reports.html>
2. In EduPath, sign in as an admin and download `analytics.csv` or `moderation.csv` from **Control Center > Phase 5 intelligence**.
3. Create a Crystal Report and select **ADO.NET (XML)** with `EduPathAnalytics.xsd`, or connect PostgreSQL through ODBC and use the views in `edupath_reporting_views.sql`.
4. Add `section`, `metric`, `value`, `count` and `generatedAt` to the report, then group by `section`.
5. Save the designed report as `EduPathAnalytics.rpt` and use Crystal Reports Viewer for the classroom presentation.

No paid runtime is required for development/demo. The repository does not commit proprietary SAP binaries or pretend that a binary `.rpt` can be generated on Linux. All data contracts, exports and SQL views needed by the report are included here.

## Live API contracts

- `GET /api/admin/reporting/dataset` - protected JSON dataset
- `GET /api/admin/reporting/export.csv?kind=analytics` - UTF-8 CSV
- `GET /api/admin/reporting/export.csv?kind=moderation` - moderation CSV

All routes require an ADMIN or MODERATOR JWT. This prevents private reporting data from being exposed publicly.

## Included files

- `EduPathAnalytics.xsd` - ADO.NET/Crystal field schema
- `sample-analytics.csv` - offline designer sample data
- `edupath_reporting_views.sql` - PostgreSQL views for live Crystal/ODBC reports
- `windows-viewer/` - Visual Studio WinForms source that opens the final `EduPathAnalytics.rpt`
