param([string]$Destination='.npm-cache/phase65-fixtures')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=[System.IO.Path]::GetFullPath((Join-Path $PWD $Destination))
if (-not $root.StartsWith([System.IO.Path]::GetFullPath((Join-Path $PWD '.npm-cache'))+[System.IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Fixture output must stay under workspace .npm-cache' }
[System.IO.Directory]::CreateDirectory($root) | Out-Null
$samples=@{
 'english'="FileFlow fictional example`nAlice scored 95. Bob scored 88.`nLocal OCR works offline."
 'chinese'="虚构文字识别样本`n这是一份本地测试文档。`n小明获得九十五分。"
 'mixed'="FileFlow 本地 OCR 测试`nAlice 获得 95 分。Bob 获得 88 分。`n中英文混合文字仅在本机处理。"
}
foreach($name in $samples.Keys){
 $bitmap=[System.Drawing.Bitmap]::new(1800,600)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $font=[System.Drawing.Font]::new('Microsoft YaHei',38)
 try { $graphics.Clear([System.Drawing.Color]::White); $graphics.TextRenderingHint=[System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit; $graphics.DrawString($samples[$name],$font,[System.Drawing.Brushes]::Black,[single]35,[single]40); $bitmap.Save((Join-Path $root "$name.png"),[System.Drawing.Imaging.ImageFormat]::Png); $bitmap.Save((Join-Path $root "$name.jpg"),[System.Drawing.Imaging.ImageFormat]::Jpeg)
  $lock=$bitmap.LockBits([System.Drawing.Rectangle]::new(0,0,1800,600),[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try { $bgra=[byte[]]::new(1800*600*4);[Runtime.InteropServices.Marshal]::Copy($lock.Scan0,$bgra,0,$bgra.Length);$rgb=[byte[]]::new(1800*600*3);for($i=0;$i -lt 1800*600;$i++){$b=$bgra[$i*4];$bgra[$i*4]=$bgra[$i*4+2];$bgra[$i*4+2]=$b;$rgb[$i*3]=$bgra[$i*4];$rgb[$i*3+1]=$bgra[$i*4+1];$rgb[$i*3+2]=$bgra[$i*4+2]};[IO.File]::WriteAllBytes((Join-Path $root "$name.rgba"),$bgra);[IO.File]::WriteAllBytes((Join-Path $root "$name.rgb"),$rgb) } finally{$bitmap.UnlockBits($lock)}
 }
 finally { $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
[IO.File]::WriteAllText((Join-Path $root 'raster-manifest.json'),'{"width":1800,"height":600,"rgbaBytes":4320000,"generated":true}')
Write-Output "Generated 3 fictional OCR PNG fixtures under workspace cache."
