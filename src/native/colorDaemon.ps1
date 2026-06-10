param()

# Ensure UTF-8 I/O (Node.js sends UTF-8 over the pipe)
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$code = @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct MAGCOLOREFFECT {
    [MarshalAs(UnmanagedType.ByValArray, SizeConst=25)]
    public float[] transform;
}

public static class MagHelper {
    [DllImport("magnification.dll", SetLastError=true)]
    public static extern bool MagInitialize();

    [DllImport("magnification.dll", SetLastError=true)]
    public static extern bool MagUninitialize();

    [DllImport("magnification.dll", SetLastError=true)]
    public static extern bool MagSetFullscreenColorEffect(ref MAGCOLOREFFECT pEffect);
}
"@

try {
    Add-Type -TypeDefinition $code -ErrorAction Stop
} catch {
    [Console]::Out.WriteLine("ERROR:AddType:" + $_.Exception.Message)
    [Console]::Out.Flush()
    exit 1
}

$ok = [MagHelper]::MagInitialize()
if (-not $ok) {
    [Console]::Out.WriteLine("ERROR:MagInitialize failed")
    [Console]::Out.Flush()
    exit 1
}

[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()

function Set-Identity {
    $e = New-Object MAGCOLOREFFECT
    $e.transform = [float[]]@(1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0, 0,0,0,0,1)
    [MagHelper]::MagSetFullscreenColorEffect([ref]$e) | Out-Null
}

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ($line.Length -eq 0) { continue }

    try {
        $cmd = $line | ConvertFrom-Json -ErrorAction Stop

        switch ($cmd.action) {
            "clear" {
                Set-Identity
                [Console]::Out.WriteLine("OK")
                [Console]::Out.Flush()
            }
            "apply" {
                $m = @($cmd.matrix)

                # SVG feColorMatrix (4x5 row-major) -> MAGCOLOREFFECT (5x5, output = input * transform)
                # transform[input_channel][output_channel]
                $t = [float[]]@(
                    [float]$m[0],  [float]$m[5],  [float]$m[10], [float]$m[15], 0.0,
                    [float]$m[1],  [float]$m[6],  [float]$m[11], [float]$m[16], 0.0,
                    [float]$m[2],  [float]$m[7],  [float]$m[12], [float]$m[17], 0.0,
                    [float]$m[3],  [float]$m[8],  [float]$m[13], [float]$m[18], 0.0,
                    [float]$m[4],  [float]$m[9],  [float]$m[14], [float]$m[19], 1.0
                )

                $e = New-Object MAGCOLOREFFECT
                $e.transform = $t
                $result = [MagHelper]::MagSetFullscreenColorEffect([ref]$e)

                if ($result) {
                    [Console]::Out.WriteLine("OK")
                } else {
                    [Console]::Out.WriteLine("ERROR:MagSetFullscreenColorEffect returned false")
                }
                [Console]::Out.Flush()
            }
            "exit" {
                break
            }
        }
    } catch {
        [Console]::Out.WriteLine("ERROR:" + $_.Exception.Message)
        [Console]::Out.Flush()
    }
}

Set-Identity
[MagHelper]::MagUninitialize() | Out-Null
