using System;
using System.IO;
using System.Windows.Forms;
using CrystalDecisions.CrystalReports.Engine;
using CrystalDecisions.Windows.Forms;

namespace EduPathCrystalViewer
{
    public sealed class ReportViewerForm : Form
    {
        private readonly ReportDocument report = new ReportDocument();

        public ReportViewerForm(string reportPath)
        {
            Text = "EduPath BD Analytics Report";
            Width = 1180;
            Height = 760;
            StartPosition = FormStartPosition.CenterScreen;

            var viewer = new CrystalReportViewer
            {
                Dock = DockStyle.Fill,
                ToolPanelView = ToolPanelViewType.None,
                ShowGroupTreeButton = false,
                ShowParameterPanelButton = true
            };
            Controls.Add(viewer);

            var absolutePath = Path.GetFullPath(reportPath);
            if (!File.Exists(absolutePath))
            {
                MessageBox.Show($"Report not found: {absolutePath}\nCreate EduPathAnalytics.rpt from the supplied XSD first.", "EduPath BD", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            report.Load(absolutePath);
            viewer.ReportSource = report;
            FormClosed += (_, __) => { report.Close(); report.Dispose(); };
        }
    }
}
