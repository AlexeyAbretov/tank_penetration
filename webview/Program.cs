// Окно Windows на системном WebView2: тот же движок, что у Edge, без своего браузера.
// Игра лежит внутри exe и открывается с виртуального адреса, чтобы модули и localStorage работали.

using System.Drawing;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TankPenetration;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new GameForm());
    }
}

internal sealed class GameForm : Form
{
    // file:// режет загрузку модулей. Этот адрес смотрит в папку игры и даёт обычный https-источник.
    private const string Host = "tank-penetration.local";

    private readonly WebView2 web = new() { Dock = DockStyle.Fill };

    public GameForm()
    {
        Text = "Tank Penetration";
        BackColor = Color.FromArgb(0x09, 0x05, 0x05);
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1280, 720);
        Controls.Add(web);
        web.DefaultBackgroundColor = Color.FromArgb(0x09, 0x05, 0x05);
        var profile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Tank Penetration",
            "webview");
        Directory.CreateDirectory(profile);
        web.CreationProperties = new CoreWebView2CreationProperties
        {
            UserDataFolder = profile,
        };
        var exe = Environment.ProcessPath;
        if (exe is not null)
        {
            var icon = Icon.ExtractAssociatedIcon(exe);
            if (icon is not null)
            {
                Icon = icon;
            }
        }
        Shown += OnShown;
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        // Минимум — поле 960×540 плюс рамка. ClientSize рамку в число не включает.
        var chrome = Size - ClientSize;
        MinimumSize = new Size(960 + chrome.Width, 540 + chrome.Height);
    }

    private async void OnShown(object? sender, EventArgs e)
    {
        Shown -= OnShown;
        try
        {
            await OpenGame();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            MessageBox.Show(
                "Нужен WebView2. Его ставит браузер Edge, либо установщик Microsoft Evergreen.",
                Text,
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Close();
        }
    }

    private async Task OpenGame()
    {
        var www = Path.Combine(AppContext.BaseDirectory, "www");
        if (!File.Exists(Path.Combine(www, "index.html")))
        {
            MessageBox.Show("В этой сборке нет файлов игры.", Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            Close();
            return;
        }

        await web.EnsureCoreWebView2Async();
        var core = web.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.AreDevToolsEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;
        core.NewWindowRequested += (_, args) => args.Handled = true;
        core.NavigationStarting += (_, args) =>
        {
            if (!args.Uri.StartsWith($"https://{Host}/", StringComparison.OrdinalIgnoreCase))
            {
                args.Cancel = true;
            }
        };
        core.SetVirtualHostNameToFolderMapping(Host, www, CoreWebView2HostResourceAccessKind.Deny);
        core.Navigate($"https://{Host}/index.html");
    }
}
