using System;
using System.Security.Principal;
using System.Windows;

namespace RyzerCortexUltra.WpfApp
{
    /// <summary>
    /// Code-Behind para MainWindow.xaml
    /// Conecta la interfaz WPF con el motor asíncrono OptimizationEngine
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            CheckAdminStatus();
            LogInitialSystemBanner();
        }

        private void CheckAdminStatus()
        {
            var identity = WindowsIdentity.GetCurrent();
            var principal = new WindowsPrincipal(identity);
            bool isAdmin = principal.IsInRole(WindowsBuiltInRole.Administrator);

            if (!isAdmin)
            {
                UacBadge.Background = System.Windows.Media.Brushes.DarkRed;
                TxtStatusHint.Text = "⚠️ Atención: Ejecutándose sin Privilegios de Administrador. Reinicia como Administrador.";
            }
        }

        private void LogInitialSystemBanner()
        {
            TxtConsoleLog.AppendText("[SISTEMA] Motor C# WPF .NET 8 Inicializado Correctamente.\n");
            TxtConsoleLog.AppendText("[SISTEMA] Enlace nativo con Microsoft.Win32.Registry y WMI listo.\n");
            TxtConsoleLog.AppendText("[SISTEMA] Haz clic en 'INICIAR FASE 3 EXTREMA' para aplicar optimizaciones en segundo plano sin consolas de comandos.\n\n");
        }

        private async void BtnStartPhase3_Click(object sender, RoutedEventArgs e)
        {
            BtnStartPhase3.IsEnabled = false;
            TxtStatusHint.Text = "Ejecutando Fase 3 Extrema... Revisa la consola de logs.";

            // IProgress<string> para actualizar la UI desde sub-hilos asíncronos en tiempo real
            var progress = new Progress<string>(message =>
            {
                TxtConsoleLog.AppendText(message + "\n");
                TxtConsoleLog.ScrollToEnd();
            });

            try
            {
                await OptimizationEngine.ExecutePhase3ExtremeAsync(progress);
                TxtStatusHint.Text = "✓ Fase 3 Extrema completada con éxito.";
            }
            catch (Exception ex)
            {
                TxtConsoleLog.AppendText($"\n❌ ERROR CRÍTICO EN ENGINE: {ex.Message}\n");
                TxtStatusHint.Text = "❌ Error durante la ejecución de la Fase 3.";
            }
            finally
            {
                BtnStartPhase3.IsEnabled = true;
            }
        }
    }
}
