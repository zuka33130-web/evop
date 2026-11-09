using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using System.Security.Cryptography;
using System.Text;
namespace EvoNativeEngine.Services;

// Windows file identity/allocation and handle-bound deletion. No shell command or guessed cluster size.
internal static class CleanupFileAccess
{
    [StructLayout(LayoutKind.Sequential)]
    private struct FileInformation
    {
        public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StandardInformation
    {
        public long AllocationSize, EndOfFile; public uint NumberOfLinks;
        [MarshalAs(UnmanagedType.U1)] public bool DeletePending;
        [MarshalAs(UnmanagedType.U1)] public bool Directory;
    }
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle file, out FileInformation info);
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool GetFileInformationByHandleEx(SafeFileHandle file, int kind, out StandardInformation info, uint size);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool SetFileInformationByHandle(SafeFileHandle file, int kind, ref int info, uint size);

    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint capacity, uint flags);
    public static void VerifyResolvedPath(FileStream stream, string expected)
    {
        var path = new StringBuilder(32768);
        var length = GetFinalPathNameByHandleW(stream.SafeFileHandle, path, (uint)path.Capacity, 0);
        if (length == 0 || length >= path.Capacity) throw new IOException("No se pudo verificar la ruta real del handle.");
        var actual = path.ToString();
        if (actual.StartsWith(@"\\?\")) actual = actual[4..];
        if (!string.Equals(Path.GetFullPath(expected), actual, StringComparison.OrdinalIgnoreCase))
            throw new IOException("Ruta resuelta distinta de la permitida; enlace o cambio concurrente.");
    }
    public static (string Identity, long Bytes, long Allocated, uint Links) Inspect(FileStream stream)
    {
        if (!GetFileInformationByHandle(stream.SafeFileHandle, out var info) ||
            !GetFileInformationByHandleEx(stream.SafeFileHandle, 1, out var standard, (uint)Marshal.SizeOf<StandardInformation>()))
            throw new IOException("No se pudo verificar identidad/asignación del archivo.", new Win32Exception(Marshal.GetLastWin32Error()));
        return ($"{info.Volume:X8}:{info.IndexHigh:X8}{info.IndexLow:X8}", standard.EndOfFile, standard.AllocationSize, info.Links);
    }
    public static long DeleteVerified(string path, QuarantinedItem item)
    {
        // Exclusive handle with DELETE access: no other process can replace, open or mutate this file during verification/deletion.
        using var handle = CreateFileW(path, 0x80000000 | 0x00010000, 0, IntPtr.Zero, 3, 0x08000000, IntPtr.Zero);
        if (handle.IsInvalid) throw new IOException("Archivo ocupado o sin permiso de eliminación.", new Win32Exception(Marshal.GetLastWin32Error()));
        using var stream = new FileStream(handle, FileAccess.Read);
        VerifyResolvedPath(stream, path);
        var info = Inspect(stream);
        if (info.Links != 1 || (item.Original.FileIdentity is not null && info.Identity != item.Original.FileIdentity) || info.Bytes != item.Original.Bytes || item.Sha256 is null ||
            Convert.ToHexString(SHA256.HashData(stream)) != item.Sha256)
            throw new IOException("Integridad/enlaces no verificados; archivo conservado.");
        int delete = 1;
        if (!SetFileInformationByHandle(handle, 4, ref delete, sizeof(int)))
            throw new IOException("Windows rechazó el borrado por handle.", new Win32Exception(Marshal.GetLastWin32Error()));
        stream.Dispose(); handle.Dispose(); // Commit deletion before checking path/readback and free space.
        if (File.Exists(path)) throw new IOException("Borrado no confirmado; revisar cuarentena.");
        return info.Bytes;
    }
}
