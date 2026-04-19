import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'

interface Props {
  onExportExcel: () => void
  onExportPdf: () => void
  loading?: boolean
  label?: string
  disabled?: boolean
}

export default function ExportMenu({ onExportExcel, onExportPdf, loading, label = 'Export', disabled }: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={loading || disabled}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-muted disabled:opacity-50"
        >
          <Download size={13} />
          {loading ? 'Exporting…' : label}
          <ChevronDown size={11} className="text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-36 bg-card border rounded-lg shadow-lg py-1 text-sm"
          align="end"
          sideOffset={4}
        >
          <DropdownMenu.Item
            onSelect={onExportExcel}
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted outline-none"
          >
            <FileSpreadsheet size={13} className="text-green-600" /> Excel
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onExportPdf}
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted outline-none"
          >
            <FileText size={13} className="text-red-600" /> PDF
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
