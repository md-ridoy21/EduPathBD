using System;
using System.Windows.Forms;

namespace EduPathCrystalViewer
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ReportViewerForm(args.Length > 0 ? args[0] : "EduPathAnalytics.rpt"));
        }
    }
}
