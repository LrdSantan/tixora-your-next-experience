$path = "supabase\functions\send-ticket-email\index.ts"
$content = Get-Content $path -Raw -Encoding UTF8

# Add qrCode to Ticket interface
$content = $content -replace 'qrToken: string;', 'qrToken: string; qrCode?: string;'

# Update map call to include index
$content = $content -replace 'p\.tickets\.map\(t => \{', 'p.tickets.map((t, i) => {'

# Update img tag to use qrCode
$oldImg = '<img src="\$\{qrUrl\}" alt="QR Code" width="150" height="150" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"/>'
$newImg = '<img src="${t.qrCode || qrUrl}" alt="QR Code" width="150" height="150" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"/>'
$content = $content -replace [regex]::Escape($oldImg), $newImg

# Add ticket count label
$oldLabel = '<p style="margin-top:8px;font-size:11px;color:#888;font-family:monospace;">\$\{t\.ticketCode\}</p>'
$newLabel = '<p style="margin-top:8px;font-size:12px;font-weight:700;color:#1a1a1a;">Ticket ${i + 1} of ${p.tickets.length} — ${t.tierName}</p><p style="margin-top:4px;font-size:11px;color:#888;font-family:monospace;">${t.ticketCode}</p>'
$content = $content -replace [regex]::Escape($oldLabel), $newLabel

Set-Content $path $content -Encoding UTF8
