# Windows Crystal Reports viewer

This small WinForms host proves how the course's SAP Crystal Reports component connects to EduPath BD.

1. Boot Windows 11 and install Visual Studio Community with **.NET desktop development**.
2. Install the free SAP Crystal Reports developer edition and matching x86 runtime for Visual Studio.
3. Open `EduPathCrystalViewer.csproj`.
4. Add a Crystal Report named `EduPathAnalytics.rpt`; choose ADO.NET (XML) and `../EduPathAnalytics.xsd` as its schema.
5. Design the Overview, Activity, Application Status and Moderation sections using `../sample-analytics.csv` or the protected API export.
6. Copy the saved `.rpt` beside the compiled executable and run the viewer.

SAP's designer and runtime are Windows-only/proprietary dependencies, so the repository contains the integration source and data contract but does not pretend a Linux-generated placeholder is a valid `.rpt` file.
